import asyncio
import json
import logging
import os
import re
import uuid
from contextlib import asynccontextmanager
from dataclasses import dataclass
from pathlib import PurePosixPath

from dotenv import load_dotenv

load_dotenv()

import anthropic
import e2b
import uvicorn
from e2b import AsyncSandbox
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from langchain_e2b import AsyncE2BSandbox
from langchain_mcp_adapters.client import MultiServerMCPClient
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from langgraph.store.postgres.aio import AsyncPostgresStore
from langgraph.types import Command
from psycopg.conninfo import make_conninfo
from pydantic import BaseModel

from agent import build_agent

PG = make_conninfo(host="localhost", port=5432, dbname="agent_memory", user="rohan", password=os.environ["PG_PASSWORD"])
HOME = "/home/user"
MAX_UPLOAD = 20 * 1024 * 1024
log = logging.getLogger("harkx")


@dataclass
class Build:
    id: str
    name: str
    stage: str = "analyzing"
    status: str = "running"  # running | waiting | done | failed
    ask: dict | None = None
    error: str | None = None
    sandbox: AsyncSandbox | None = None
    agent: object = None
    task: asyncio.Task | None = None

    def snapshot(self):
        return {"status": self.status, "stage": self.stage, "ask": self.ask, "error": self.error}


# live builds are held in memory; a server restart loses them (checkpoints stay in Postgres).
# Reattach by storing the sandbox id per build if restarts mid-build ever matter.
builds: dict[str, Build] = {}


@asynccontextmanager
async def lifespan(app):
    async with AsyncPostgresSaver.from_conn_string(PG) as saver, AsyncPostgresStore.from_conn_string(PG) as store:
        await saver.setup()
        await store.setup()
        firecrawl = {
            "transport": "streamable_http",
            "url": "https://mcp.firecrawl.dev/v2/mcp",
            "headers": {"Authorization": f"Bearer {os.environ['FIRECRAWL_API_KEY']}"},
        }
        app.state.deps = (await MultiServerMCPClient({"firecrawl": firecrawl}).get_tools(), saver, store)
        yield


app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:3000"], allow_methods=["*"], allow_headers=["*"])


def reason(e: Exception) -> str:
    if isinstance(e, anthropic.AuthenticationError):
        return "The Anthropic API key is invalid or has expired."
    if isinstance(e, e2b.AuthenticationException):
        return "The E2B API key is invalid or has expired."
    if isinstance(e, e2b.CommandExitException):
        return "The agent finished without producing an integration."
    if isinstance(e, (e2b.SandboxException, e2b.TimeoutException, e2b.NotFoundException)):
        return "The build sandbox was terminated or became unavailable."
    return f"The build couldn't be completed: {e}"


async def run(build: Build, payload):
    config = {"configurable": {"thread_id": build.id}, "recursion_limit": 1000}
    try:
        await build.sandbox.set_timeout(3600)
        async for _ in build.agent.astream(payload, config):
            pass
        state = await build.agent.aget_state(config)
        if state.interrupts:
            build.ask, build.status = state.interrupts[0].value, "waiting"
            return
        await build.sandbox.commands.run(
            f"cd {HOME} && test -f integration/README.md && python3 -m zipfile -c integration.zip integration/"
        )
        build.status = "done"
    except Exception as e:
        log.exception("build %s failed", build.id)
        build.status, build.error = "failed", reason(e)


async def start(build: Build, filename: str, data: bytes):
    try:
        build.sandbox = await AsyncSandbox.create(api_key=os.environ["E2B_KEY"], timeout=3600)
        if filename.lower().endswith(".zip"):
            await build.sandbox.files.write(f"{HOME}/skill.zip", data)
            await build.sandbox.commands.run(f"cd {HOME} && python3 -m zipfile -e skill.zip skill/")
        else:
            await build.sandbox.files.write(f"{HOME}/skill/SKILL.md", data)
        build.agent = build_agent(build, AsyncE2BSandbox(sandbox=build.sandbox), *app.state.deps)
    except Exception as e:
        log.exception("build %s failed to start", build.id)
        build.status, build.error = "failed", reason(e)
        return
    prompt = f"Integration point: {build.name}. The skill is in {HOME}/skill/. Build the integration."
    await run(build, {"messages": [{"role": "user", "content": prompt}]})


def get(build_id: str) -> Build:
    if build_id not in builds:
        raise HTTPException(404, "No such build")
    return builds[build_id]


def resume(build_id: str, kind: str, value):
    build = get(build_id)
    if build.status != "waiting" or build.ask["type"] != kind:
        raise HTTPException(409, f"The build isn't waiting for a {kind}")
    build.status, build.ask = "running", None
    build.task = asyncio.create_task(run(build, Command(resume=value)))


@app.post("/builds")
async def create(name: str = Form(..., max_length=40), file: UploadFile = File(...)):
    if not re.search(r"\.(md|zip)$", file.filename or "", re.I):
        raise HTTPException(400, "Only .zip or .md files are allowed")
    data = await file.read(MAX_UPLOAD + 1)
    if len(data) > MAX_UPLOAD:
        raise HTTPException(413, "The skill file is too large")
    build = Build(id=uuid.uuid4().hex, name=name.strip())
    builds[build.id] = build
    build.task = asyncio.create_task(start(build, file.filename, data))
    return {"id": build.id}


@app.get("/builds/{build_id}/events")
async def events(build_id: str):
    build = get(build_id)

    # each connection polls the build twice a second; push on change if many viewers ever watch one build
    async def stream():
        last = None
        while True:
            snap = json.dumps(build.snapshot())
            if snap != last:
                yield f"data: {snap}\n\n"
                last = snap
            if build.status in ("done", "failed"):
                return
            await asyncio.sleep(0.5)

    return StreamingResponse(stream(), media_type="text/event-stream")


class Answer(BaseModel):
    answer: str


@app.post("/builds/{build_id}/answer")
async def answer(build_id: str, body: Answer):
    resume(build_id, "question", body.answer.strip() or "Skipped")


@app.post("/builds/{build_id}/files")
async def files(build_id: str, files: list[UploadFile] = File(default=[])):
    build = get(build_id)
    if build.status != "waiting" or build.ask["type"] != "file_request":
        raise HTTPException(409, "The build isn't waiting for files")
    paths = []
    for f in files:
        path = f"{HOME}/inputs/{PurePosixPath(f.filename or 'file').name}"
        await build.sandbox.files.write(path, await f.read(MAX_UPLOAD))
        paths.append(path)
    resume(build_id, "file_request", paths)


@app.get("/builds/{build_id}/download")
async def download(build_id: str):
    build = get(build_id)
    if build.status != "done":
        raise HTTPException(409, "The integration isn't ready")
    # the sandbox (and the zip) lives until its 1h timeout; no explicit cleanup after download
    data = await build.sandbox.files.read(f"{HOME}/integration.zip", format="bytes")
    slug = re.sub(r"[^a-z0-9]+", "-", build.name.lower()).strip("-") or "integration"
    return Response(bytes(data), media_type="application/zip",
                    headers={"Content-Disposition": f'attachment; filename="{slug}-integration.zip"'})


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    # psycopg's async driver can't run on Windows' default Proactor loop
    asyncio.run(uvicorn.Server(uvicorn.Config(app, port=8000)).serve(), loop_factory=asyncio.SelectorEventLoop)
