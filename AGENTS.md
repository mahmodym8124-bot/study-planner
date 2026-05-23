# AGENTS.md — Agent guidance for MindVault

Purpose
- Quick reference for AI coding agents to navigate, run, and modify this repo.
- Keep this as the single source of agent-facing instructions. Do not add duplicate agent context files unless there is a specific tool requirement.

Quick commands
- Install: `npm install` (root)
- Dev (frontend + backend): `npm run dev` (runs `client` + `server` concurrently)
- Build frontend: `npm run build`
- Start server: `npm run start` (runs `node server/server.js`)
- Lint: `npm run lint`
- Test: `npm test`

Important notes
- This project uses ES modules (`"type": "module"` in `package.json`).
- Backend is an Express app (server/server.js) and also exposes a Vercel serverless entry at `api/index.js`.
- Environment variables must be set from `.env.example` (see `README.md`). Typical vars: `MONGODB_URI`, `JWT_SECRET`, `PORT`, `CLIENT_URL`, `VITE_API_URL`, `GOOGLE_CLIENT_ID`, `VITE_GOOGLE_CLIENT_ID`.
- Do not read, index, print, or commit `.env` or any file matching `*.env*`.

Key locations (start here)
- Project overview: [README.md](README.md)
- Root package/config: [package.json](package.json), [vercel.json](vercel.json)
- Server entry: [server/server.js](server/server.js)
- Serverless API (Vercel): [api/index.js](api/index.js)
- Server folders: [server/controllers](server/controllers), [server/routes](server/routes), [server/models](server/models), [server/middleware](server/middleware), [server/config](server/config)
- Frontend files: [client/js](client/js), [client/styles](client/styles), [client/locales](client/locales), [index.html](index.html), [public](public)
- Docs: [docs](docs), especially [docs/api.md](docs/api.md), [docs/google-oauth-setup.md](docs/google-oauth-setup.md), and [docs/ERROR_BOUNDARIES.md](docs/ERROR_BOUNDARIES.md)
- Tests: [__tests__](__tests__)

Agent guidelines
- Link, don't embed: prefer linking to existing docs (see Key locations) instead of copying large blocks.
- Minimal edits: keep PRs focused to a single area (backend vs frontend). Update both client and server only when necessary.
- Running locally: use `npm run dev`. Backend listens on `PORT` (default 8091), frontend on Vite default (5173).
- When changing APIs, update corresponding route tests and client API calls in `client/js/api.js`.
- Read order for repo orientation: `AGENTS.md`, `README.md`, `docs/README.md`, `docs/api.md`, then the relevant files under `server/`, `api/`, `client/js/`, `client/styles/`, and `client/locales/`.
- If indexing is available, index `docs/`, `server/`, `api/`, and `client/js/` first. Exclude secrets, generated output, `node_modules/`, `dist/`, logs, and test output.

Common pitfalls
- Vercel preview URLs may require public `VITE_API_URL` for GitHub Pages builds — see `README.md`.
- CORS and auth: ensure `CLIENT_URL` and `VITE_API_URL` align when testing across ports or deployments.
- Google sign-in needs both `GOOGLE_CLIENT_ID` and `VITE_GOOGLE_CLIENT_ID`; see [docs/google-oauth-setup.md](docs/google-oauth-setup.md).
- Error-boundary code lives in `client/js/error-boundary.js`, `client/js/error-utils.js`, and `client/styles/error-boundary.css`.

If you need more
- For subsystem-specific agent instructions (frontend, backend, tests), propose `/create-agent instruction` files.
