study-planner — Docs

This small docs folder is intended for agents that need a compact, curated snapshot of the repository to perform deep searches, code navigation, and context-aware suggestions.

What is included
- `api.md` — short API endpoint summary and examples.
- `agent.md` — instructions for feeding this repository to a sidebar agent or "Continue"/OpenRouter-style assistant.

How agents should use this folder
- Read `agent.md` first for run commands and recommended ingestion order.
- Read `api.md` for example requests and common payloads.
- If an agent supports indexing, include this `docs/` folder and the `server/` and `client/js/` folders in the index scope.
