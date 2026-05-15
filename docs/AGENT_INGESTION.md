Agent ingestion guide — study-planner

Goal
Provide a compact, reliable order of content for sidebar agents ("Continue", OpenRouter, Deep Seek, etc.) to read so they can answer codebase questions and suggest changes.

Recommended ingestion order (priority)
1. Read `AGENTS.md` and `AGENT_CONTEXT.md` for run commands and agent guidance.
2. Read `README.md` (repo root) for high-level overview.
3. Read `docs/README.md`, then `docs/api.md`.
4. Read `server/` files: `server/server.js`, `server/controllers/*`, `server/routes/*`, `server/models/*`.
5. Read `client/js/` files: `client/js/main.js`, `client/js/api.js`, `client/js/store.js`.
6. Read `locales/` and `styles/` for presentation details.

Tips for the sidebar agent
- Prefer small snippets: parse files into functions/classes instead of huge blobs.
- Use `agent_manifest.json` (repo root) to get quick file pointers and a short summary for each area.
- If indexing is available, index `docs/`, `server/`, and `client/js/` first.
- If indexing is disabled, the agent should fetch these files on demand and consult `AGENT_CONTEXT.md`.

Permissions & secrets
- Do NOT index or expose `.env` or any file matching `*.env*`.

If you'd like, I can also:
- Generate a compressed code snapshot for upload.
- Produce a smaller JSON-LD-style knowledge graph of functions and routes.
