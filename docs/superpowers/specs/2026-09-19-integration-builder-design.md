# Integration Builder — Design

Source requirements: `Build/Build.md`, `Build/Frontend.md`, `Build/Memory.md`.

## Goal

User picks an integration point and uploads a skill (`SKILL.md` or `.zip`). One Deep Agent reads the skill,
researches the integration point, asks the user for anything missing, builds a **Python MCP server** that
exposes the actions the skill needs, tests it in an E2B sandbox, and zips it for download.

## Architecture

```
Next.js card flow ──HTTP/SSE──► FastAPI (Backend/app.py)
                                  └─ Deep Agent (deepagents, Claude)   ← LangSmith tracing via env
                                       ├─ backend: CompositeBackend
                                       │    ├─ default → AsyncE2BSandbox (files + execute, in E2B)
                                       │    ├─ /memories/project/   → StoreBackend ns ("project", build_id)
                                       │    └─ /memories/knowledge/ → StoreBackend ns ("knowledge",)
                                       ├─ tools: Firecrawl MCP, ask_user, request_files, set_stage
                                       ├─ checkpointer: AsyncPostgresSaver   (execution state)
                                       └─ store: AsyncPostgresStore         (project + knowledge memory)
```

The agent runs in the backend process; the sandbox is where every file op and shell command happens.
Integration code only lives in the sandbox, never in Postgres.

## Memory (Postgres `agent_memory`, localhost:5432)

| Layer | Mechanism |
|---|---|
| Execution state | LangGraph `AsyncPostgresSaver`, `thread_id = build_id` |
| Project memory | `AsyncPostgresStore`, namespace `("project", build_id)`, agent writes under `/memories/project/` |
| Knowledge memory | `AsyncPostgresStore`, namespace `("knowledge",)`, shared across builds, `/memories/knowledge/` |

## Agent tools (beyond deepagents built-ins)

- `set_stage(stage)` — `analyzing | building | testing | packaging`; drives the UI animation.
- `ask_user(question, options)` — at most 3 options (UI adds "Something else" = 4 total). Pauses via `interrupt()`.
- `request_files(description)` — pauses via `interrupt()`; files the user picks are uploaded into
  `/home/user/inputs/` in the sandbox; the tool returns their paths.
- Firecrawl MCP tools (streamable HTTP) for research.

Deliverable contract (in the system prompt): `/home/user/integration/` containing the MCP server,
`README.md`, `.env.example`, tests that pass; agent then runs `zip` to `/home/user/integration.zip`
and calls `set_stage("packaging")` before finishing.

## API

| Route | Purpose |
|---|---|
| `POST /builds` (multipart `name`, `file`) | create sandbox, upload skill to `/home/user/skill/`, start run → `{id}` |
| `GET /builds/{id}/events` (SSE) | `stage`, `question`, `file_request`, `done`, `failed`; replays current state on connect |
| `POST /builds/{id}/answer` (JSON `{answer}`) | resume a paused `ask_user` |
| `POST /builds/{id}/files` (multipart `files`) | upload to sandbox, resume a paused `request_files` |
| `GET /builds/{id}/download` | the zip, read from the sandbox |

Run state for live builds (current event, sandbox handle) is held in a process dict keyed by build id.

## Frontend (Frontend/src/app/page.tsx, step 3)

- "Building" headline with a CSS shiny-text sweep (no `motion` dependency).
- Lottie (`lottie-react`) at the card bottom: `analyzing → loading.json`, `building → loading-3d-1.json`,
  `testing → loading-3d-2.json`, `packaging → loading-3d-3.json`.
- Question card (from Q7A): options + "Something else" free-text, max 4 rows.
- File request card (from file-picker): pick one or more files, submit.
- Success card with Download; failure card with the reason.

## Errors

Any exception from the run becomes a `failed` event with a readable message: Anthropic/E2B auth errors
("API key invalid or expired"), sandbox gone/timeout ("sandbox was terminated"), otherwise the error text.
Sandbox timeout is 1 hour, extended on each resume.

## Secrets

Keys live in gitignored `Backend/.env`. The Firecrawl key moves there from `Build/Build.md`.

## Testing

- `Backend/check.py`: runs a real build of a tiny sample skill end-to-end against the API, auto-answering
  questions, and asserts a zip containing `README.md` comes back.
- Frontend: typecheck + lint + manual walk-through in the browser.
