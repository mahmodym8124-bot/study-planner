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
```


3. Start the app:

```bash
npm run dev
```

Frontend: `http://localhost:5173`

API health: `http://127.0.0.1:8091/api/health`

## Build

```bash
npm run build
```

## End-to-End Tests

```bash
npx playwright test --list
npm run test:e2e
```

## Deployment

The repository is linked to Vercel. Pushes to `main` trigger production deployments through the GitHub integration.

For GitHub Pages builds, set repository variable `VITE_API_URL` to a **public** API base URL (for example `https://your-project.vercel.app/api`). Do not use protected Vercel preview URLs (`...git-main...vercel.app`) because they return auth pages and cause browser CORS failures.

Production build command:

```bash
npm run build
```

Output directory:

```text
dist
```
