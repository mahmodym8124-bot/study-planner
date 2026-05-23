# MindVault

MindVault is a focused personal workspace for notes, ideas, files, search, knowledge graph exploration, and daily focus planning. The app uses a Vite frontend, an Express API, MongoDB/Mongoose models, JWT authentication, Google sign-in, password reset email, and Vercel deployment.

## Features

- Clean responsive workspace UI with dark and light themes.
- Notes with markdown preview, tags, folders, pins, and favorites.
- Idea board with draggable lanes, priorities, and progress.
- Workspace stats, recent activity, settings, and global search.
- Focus view with Pomodoro sessions and daily focus tracking.
- 3D knowledge graph for notes, files, and ideas.
- English, Arabic, and Kurmanji locale files.

## Tech Stack

- Frontend: Vite, vanilla JavaScript modules, CSS, Three.js, GSAP.
- Backend: Node.js, Express, MongoDB, Mongoose, JWT, Google auth, Nodemailer.
- Deployment: Vercel with `vercel.json`.
- Tests: Jest, Supertest, mongodb-memory-server.

## Project Structure

```text
client/
  js/              Frontend state, API client, UI rendering, Three.js scenes
  locales/         Translation JSON files
  styles/          App, graph, and error-boundary CSS
server/
  config/          Database and auth configuration
  controllers/     Request handlers
  middleware/      Auth, validation, async helpers
  models/          Mongoose models
  routes/          API routes
  services/        Email and supporting services
api/index.js       Vercel serverless entry
public/            Manifest, favicon, service worker
docs/              API, OAuth, deployment, and frontend resilience docs
__tests__/         Route, API, client, and service tests
index.html         Vite entry
vercel.json        Vercel build and rewrite configuration
```

## Local Development

1. Install dependencies:

```bash
npm install
```

2. Create `.env` from `.env.example` and set the required values:

```text
MONGODB_URI=
JWT_SECRET=
JWT_EXPIRES_IN=2h
PORT=8091
CLIENT_URL=http://localhost:5173
ADDITIONAL_CLIENT_URLS=
ENFORCE_HTTPS=true
VITE_API_URL=/api
GOOGLE_CLIENT_ID=your-google-oauth-web-client-id.apps.googleusercontent.com
VITE_GOOGLE_CLIENT_ID=your-google-oauth-web-client-id.apps.googleusercontent.com
PASSWORD_RESET_BASE_URL=http://localhost:5173
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=your-gmail-address@gmail.com
SMTP_PASS=your-16-character-gmail-app-password
SMTP_FROM_EMAIL=
SMTP_FROM_NAME=MindVault
```

For Gmail, enable 2-Step Verification on the sending Google account, create an App Password, and use that 16-character App Password for `SMTP_PASS`. Do not use your normal Gmail password. `SMTP_FROM_EMAIL` is optional and defaults to `SMTP_USER`.

Use a high-entropy `JWT_SECRET` of at least 32 characters. Keep server-only secrets out of frontend variables; only `VITE_API_URL`, `VITE_API_TIMEOUT_MS`, and `VITE_GOOGLE_CLIENT_ID` are intended for browser exposure.

3. Start the app:

```bash
npm run dev
```

Frontend: `http://localhost:5173`

API health: `http://127.0.0.1:8091/api/health`

## API

The Express app mounts route groups under `/api/auth`, `/api/notes`, `/api/ideas`, `/api/workspace`, `/api/productivity`, `/api/focus`, `/api/graph`, and `/api/search`.

See [docs/api.md](docs/api.md) for the route summary.

Security controls include owner-scoped database queries, strict request validation, Mongo operator key rejection, JWT expiry enforcement, email verification, expiring password reset tokens, HTTPS enforcement in production, and endpoint-specific rate limits.

## Authentication Setup

For full Google OAuth setup (Google Cloud Console, env vars, and validation checklist), see [docs/google-oauth-setup.md](docs/google-oauth-setup.md).

## Checks

```bash
npm run build
npm test
npm run lint
```

## Deployment

The repository is linked to Vercel. Pushes to `main` trigger production deployments through the GitHub integration. See [DEPLOYMENT.md](DEPLOYMENT.md) for the deployment checklist.

For GitHub Pages builds, set repository variables `VITE_API_URL` and `VITE_GOOGLE_CLIENT_ID`.

- `VITE_API_URL` should point to a **public** API base URL (for example `https://your-project.vercel.app/api`). Do not use protected Vercel preview URLs (`...git-main...vercel.app`) because they return auth pages and cause browser CORS failures.
- `VITE_GOOGLE_CLIENT_ID` must be the same Google OAuth web client ID used by Vercel so Google sign-in renders on Pages too.

Also make sure your Google OAuth client allows both deployment origins, including `https://mahmodym8124-bot.github.io` and your Vercel domain.

Production build command:

```bash
npm run build
```

Output directory:

```text
dist
```
