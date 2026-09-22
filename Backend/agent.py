import os
from pathlib import Path
from typing import Literal

import openai
from deepagents import create_deep_agent
from deepagents.backends import CompositeBackend, StoreBackend
from langchain.agents.middleware import (
    ClearToolUsesEdit,
    ContextEditingMiddleware,
    ModelRetryMiddleware,
    ToolErrorMiddleware,
)
from langchain_openai import ChatOpenAI
from langchain_core.tools import tool
from langgraph.types import interrupt
from mcp.shared.exceptions import McpError

PROMPT = (Path(__file__).parent / "system_prompt.md").read_text(encoding="utf-8")


def tool_error(exc: Exception, request) -> str | None:
    """MCP protocol errors (bad argument types, rejected params) carry the fix in their
    message, so hand them to the model to retry instead of failing the whole build.
    Everything else propagates."""
    if isinstance(exc, McpError):
        return f"{request.tool_call['name']} failed: {exc}. Fix the arguments and call it again."
    return None


def build_agent(build, sandbox, mcp_tools, checkpointer, store):
    @tool
    def set_stage(stage: Literal["analyzing", "building", "testing", "packaging"]) -> str:
        """Tell the user which phase of the build you are in. Call it whenever you enter a new phase."""
        build.stage = stage
        return f"Stage is now {stage}."

    @tool
    def ask_user(question: str, options: list[str]) -> str:
        """Ask the user one question. Give up to 3 short answer options; the user may also type their own answer."""
        return interrupt({"type": "question", "question": question, "options": options[:3]})

    @tool
    def request_files(description: str) -> str:
        """Ask the user to upload files you need, such as API keys, credentials or config files.
        Describe exactly what you need and why. Returns the paths the files were saved to."""
        paths = interrupt({"type": "file_request", "description": description})
        return f"The user uploaded: {', '.join(paths)}" if paths else "The user did not upload any files."

    memory = lambda ns: StoreBackend(store=store, namespace=lambda _: ns)
    return create_deep_agent(
        model=ChatOpenAI(
            model="moonshotai/kimi-k3",
            base_url="https://openrouter.ai/api/v1",
            api_key=os.environ["LLM_API_KEY"],
            max_tokens=16000,
        ),
        tools=[set_stage, ask_user, request_files, *mcp_tools],
        middleware=[
            # OpenRouter hiccups shouldn't end an hour-long build. Only transient errors retry;
            # auth and bad-request failures propagate so reason() can name them. on_failure="error"
            # keeps a dead model call failing the build instead of faking an AI message.
            ModelRetryMiddleware(
                retry_on=(openai.RateLimitError, openai.APITimeoutError,
                          openai.APIConnectionError, openai.InternalServerError),
                on_failure="error",
            ),
            ContextEditingMiddleware(edits=[ClearToolUsesEdit(
                trigger=100_000, exclude_tools=("ask_user", "request_files"))]),
            ToolErrorMiddleware(tool_error),
        ],
        system_prompt=PROMPT,
        backend=CompositeBackend(
            default=sandbox,
            routes={
                "/memories/project/": memory(("project", build.id)),
                "/memories/knowledge/": memory(("knowledge",)),
            },
        ),
        checkpointer=checkpointer,
        store=store,
    )
