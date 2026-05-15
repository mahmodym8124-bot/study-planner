AGENT CONTEXT — study-planner

Purpose
- Provide a concise, machine- and human-readable summary so agents can quickly learn the repo.

Quick facts
- Stack: Node.js + Express backend, Vite frontend (vanilla JS), MongoDB.
- Run locally: `npm install` then `npm run dev` (backend on PORT, frontend on Vite).
- Env: copy `.env.example` and set `MONGODB_URI`, `JWT_SECRET`, `PORT`, `CLIENT_URL`, `VITE_API_URL`.

Key files & folders
- Backend: `server/server.js`, `server/controllers/`, `server/models/`, `server/routes/`.
- Serverless API: `api/index.js` (Vercel entry).
- Frontend: `client/js/` (main app code), `index.html`, `styles/app.css`, `public/`.
- Docs/help: `README.md`, `AGENTS.md` (agent guidance).

How to make an agent aware of this codebase
1. Provide the agent with these short docs (this file) and `README.md` + `AGENTS.md`.
2. Place more detailed docs under a `docs/` folder (API endpoints, data models, environment, run steps).
3. If the agent supports indexing or workspace ingestion, enable it and include `docs/` and `server/` + `client/js/` paths.
   - Note: some platforms deprecate automatic indexing; if so, upload or attach a compressed code snapshot or use a repo summary file.
4. Add small, focused README files inside large subsystems, e.g., `server/README.md`, `client/README.md`.
5. Keep example requests and sample data (cURL or Postman) in `docs/api.md` so agents can run or simulate calls.

Tips for better agent performance
- Keep concise summaries and README sections at module roots.
- Add JSDoc comments to public functions in `server/controllers` and `client/js`.
- Add small example fixtures in `test-fixtures/` to demonstrate typical inputs/outputs.
- Update `AGENTS.md` with any changes to run commands or environment variables.

If you want, I can:
- Generate a `docs/` skeleton with API examples and module READMEs.
- Add JSDoc comments to selected files (pick which files or controllers).
- Create a `CODEBASE_SUMMARY.md` inside the repo root with links to key files.
