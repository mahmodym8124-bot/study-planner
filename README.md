# MindVault — Personal Knowledge & File Management Workspace

MindVault is a startup-grade productivity workspace for saving files, writing notes, organizing ideas, managing projects, and visualizing knowledge in 3D. It uses a vanilla JavaScript frontend with Three.js and GSAP, plus a secure Node.js/Express/MongoDB backend.

## Highlights

- **Cinematic landing experience** with mouse-reactive Three.js particles, geometric objects, dynamic lighting, and GSAP entrance animations.
- **JWT authentication** with encrypted passwords, protected API routes, persistent sessions, and rate limiting.
- **Premium dashboard** with glassmorphism panels, responsive sidebar, instant search, quick actions, stats, and activity timeline.
- **Notes system** with markdown preview, tags, folders, pins, favorites, editable modals, and autosave-friendly architecture.
- **File manager** with drag-and-drop upload, local storage, MIME protection, image previews, folder/tag metadata, and deletion.
- **3D knowledge graph** where notes, files, and ideas appear as draggable connected nodes with an inspector panel.
- **Idea board** with draggable Kanban lanes, priorities, statuses, and progress tracking.
- **Productivity suite** with Pomodoro timer, to-do list, daily focus, reminders-ready schema, and calendar widget.
- **Premium UX** with dark/light mode, command palette, keyboard shortcuts, skeleton loaders, toast notifications, animated modals, and PWA offline shell.

## Tech Stack

### Frontend

- HTML5
- CSS3
- Vanilla JavaScript ES modules
- Three.js
- GSAP
- Vite

### Backend

- Node.js
- Express.js
- MongoDB + Mongoose
- JWT
- Multer local uploads
- Helmet, CORS, compression, rate limiting, express-validator

## Project Structure

```text
/client
  /js
    api.js              API client and token persistence
    main.js             SPA router, UI rendering, interactions
    store.js            Shared client state utilities
    three-scenes.js     Ambient background, hero scene, graph scene
    ui.js               Toasts, modals, markdown, helpers
  /styles
    app.css             Responsive premium SaaS styling
/public
  favicon.svg
  manifest.webmanifest
  sw.js                 Offline PWA service worker
/server
  /config
    db.js               MongoDB connection
  /controllers          Request handlers
  /middleware           Auth, validation, upload protection
  /models               User, Note, FileAsset, Idea, Productivity, Activity
  /routes               API route modules
  /utils                Activity logging helpers
/uploads                Local uploaded files
index.html              Vite entry
```

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env` and update secrets:

```bash
cp .env.example .env
```

Required variables:

| Variable | Description |
| --- | --- |
| `PORT` | Express server port. This project uses `8091` locally because `8080` may be occupied by another service. |
| `CLIENT_URL` | Allowed frontend origin for CORS, e.g. `http://localhost:5173`. |
| `MONGODB_URI` | MongoDB connection string. |
| `JWT_SECRET` | Strong random secret used to sign sessions. |
| `JWT_EXPIRES_IN` | JWT expiration, e.g. `7d`. |
| `MAX_FILE_SIZE` | Upload limit in bytes. |
| `VITE_API_URL` | Frontend API base URL. Defaults to `/api`. |

### 3. Start MongoDB

Use local MongoDB or a cloud provider such as MongoDB Atlas.

```bash
mongod
```

### 4. Run development servers

```bash
npm run dev
```

- Frontend: <http://localhost:5173>
- Backend API: <http://localhost:8091/api/health>

## Production Build

```bash
npm run build
npm start
```

When `NODE_ENV=production`, Express serves the compiled `dist` frontend and the API from the same process.

## API Overview

| Method | Route | Description |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Create account and receive JWT. |
| `POST` | `/api/auth/login` | Authenticate and receive JWT. |
| `GET` | `/api/auth/me` | Get current user. |
| `GET/POST` | `/api/notes` | List or create notes. |
| `PUT/DELETE` | `/api/notes/:id` | Update or delete a note. |
| `GET/POST` | `/api/files` | List or upload files. |
| `DELETE` | `/api/files/:id` | Delete a file and local asset. |
| `GET/POST` | `/api/ideas` | List or create ideas. |
| `PUT/DELETE` | `/api/ideas/:id` | Update or delete an idea. |
| `GET` | `/api/workspace/stats` | Dashboard counters. |
| `GET` | `/api/workspace/activity` | Activity timeline. |
| `GET` | `/api/workspace/search?q=` | Search notes, files, ideas. |
| `GET/PUT` | `/api/productivity` | Read or update productivity data. |

## Security Notes

- Passwords are hashed with bcrypt before storage.
- API routes are protected with JWT middleware.
- Request validation is handled with express-validator.
- Uploads are restricted by MIME type and file size.
- Rate limiting protects `/api/*` endpoints.
- Helmet, compression, and CORS are enabled.
- Secrets and deployment settings are loaded from environment variables.

## Deployment Guide

### Render / Railway

1. Create a new Node.js service from this repository.
2. Set build command: `npm install && npm run build`.
3. Set start command: `npm start`.
4. Add environment variables from `.env.example`.
5. Use MongoDB Atlas for `MONGODB_URI`.
6. Configure persistent disk storage if you need local uploads to survive deploy restarts.

This repo also includes `render.yaml`, so on Render you can use **New +** -> **Blueprint** and select this GitHub repository. Add your Atlas `MONGODB_URI` when Render asks for the secret value.

### Vercel / Netlify Frontend + Render API

1. Deploy the frontend with build command `npm run build` and output directory `dist`.
2. Deploy the Express API separately on Render/Railway.
3. Set `VITE_API_URL` to the deployed API URL ending in `/api`.
4. Set backend `CLIENT_URL` to the deployed frontend origin.
5. For durable uploads, replace local storage with Supabase Storage or another object store.

## Keyboard Shortcuts

- `Cmd/Ctrl + K`: Open command palette.
- `Cmd/Ctrl + N`: Create a new note.

## Notes for Portfolio Use

MindVault is intentionally built with a polished visual system, production-style API boundaries, deployment documentation, and scalable folder structure so it can be shown in interviews, portfolio demos, or early-stage startup presentations.
