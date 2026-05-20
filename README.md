# MindVault

MindVault is a focused study workspace for notes, files, ideas, and daily planning. The app uses a Vite frontend, an Express API, MongoDB/Mongoose data models, JWT authentication, and Vercel deployment.

## Features

- Clean responsive workspace UI with dark and light themes.
- Notes with markdown preview, tags, folders, pins, and favorites.

- Idea board with draggable lanes, priorities, and progress.
- Focus view with Pomodoro timer, tasks, and a daily focus note.
- 3D knowledge graph for notes, files, and ideas.

## Tech Stack

- Frontend: Vite, vanilla JavaScript modules, CSS, Three.js, GSAP.
- Backend: Node.js, Express, MongoDB, Mongoose, JWT, Multer.
- Deployment: Vercel with `vercel.json`.

## Project Structure

```text
client/
  js/              Frontend state, API client, UI rendering, Three.js scenes
  styles/          Application styling
server/
  config/          Database and auth configuration
  controllers/     Request handlers
  middleware/      Auth, validation, async helpers
  models/          Mongoose models
  routes/          API routes
api/index.js       Vercel serverless entry
public/            Manifest, favicon, service worker
index.html         Vite entry
vercel.json        Vercel build and rewrite configuration
```

## Local Development

1. Install dependencies:

```bash
npm install
```

2. Create `.env` from `.env.example` and set these values:

```text
MONGODB_URI=
JWT_SECRET=
JWT_EXPIRES_IN=7d
PORT=8091
CLIENT_URL=http://localhost:5173
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


3. Start the app:

```bash
npm run dev
```

Frontend: `http://localhost:5173`

API health: `http://127.0.0.1:8091/api/health`

## Authentication Setup

For full Google OAuth setup (Google Cloud Console, env vars, and validation checklist), see [docs/google-oauth-setup.md](docs/google-oauth-setup.md).

## Build

```bash
npm run build
```

## Deployment

The repository is linked to Vercel. Pushes to `main` trigger production deployments through the GitHub integration.

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
