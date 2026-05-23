# MindVault API

MindVault exposes an Express API from [server/server.js](../server/server.js). Vercel uses [api/index.js](../api/index.js) as the serverless entry.

All application routes are mounted under `/api`. Protected routes require the JWT issued by auth endpoints:

```http
Authorization: Bearer <token>
```

## Entrypoints

- Local Express server: `http://127.0.0.1:8091/api`
- Vite dev frontend: `http://localhost:5173`
- Health check: `GET /api/health`
- Vercel serverless API: `/api/*`

## Route Groups

### Auth

- `POST /api/auth/register` - create account with name, email, and password.
- `POST /api/auth/login` - log in with email and password.
- `POST /api/auth/google` - log in or register with a Google Identity Services credential.
- `POST /api/auth/verify-email` - verify email with a token.
- `POST /api/auth/forgot-password` - request a password reset email.
- `POST /api/auth/reset-password` - reset password with token and new password.
- `POST /api/auth/refresh-token` - refresh the current JWT; protected.
- `GET /api/auth/me` - return the current user; protected.

### Notes

- `GET /api/notes` - list notes for the current user.
- `GET /api/notes/:id` - get a note by MongoDB id.
- `POST /api/notes` - create a note.
- `PUT /api/notes/:id` - update a note.
- `DELETE /api/notes/:id` - delete a note.

### Ideas

- `GET /api/ideas` - list ideas.
- `POST /api/ideas` - create an idea.
- `PUT /api/ideas/:id` - update an idea.
- `DELETE /api/ideas/:id` - delete an idea.

### Workspace

- `GET /api/workspace/stats` - workspace totals and summary data.
- `GET /api/workspace/activity` - recent activity feed.
- `GET /api/workspace/settings` - current workspace settings.
- `PUT /api/workspace/settings` - update workspace settings.
- `GET /api/workspace/search` - workspace search.
- `DELETE /api/workspace/reset` - reset workspace data for the current user.

### Productivity

- `GET /api/productivity` - get productivity state.
- `PUT /api/productivity` - update productivity state.

### Focus

- `POST /api/focus/start` and `POST /api/focus/sessions` - start a focus session.
- `GET /api/focus` and `GET /api/focus/sessions` - list focus sessions.
- `PUT /api/focus/:id` and `PUT /api/focus/sessions/:id` - update a focus session.
- `GET /api/focus/daily-focus` and `GET /api/focus/daily` - get daily focus.
- `POST /api/focus/daily-focus` and `POST /api/focus/daily` - save daily focus.
- `POST /api/focus/daily-focus/complete` and `POST /api/focus/daily/complete` - mark daily focus complete.

### Graph

- `GET /api/graph/nodes` - list graph nodes.
- `GET /api/graph/nodes/:id` - get a graph node.
- `GET /api/graph-data` - compatibility graph data endpoint.

### Search

- `GET /api/search?q=<term>` - search across supported workspace content.

### Debug

- `GET /api/_debug/*` routes only mount outside production.

## Examples

Login:

```bash
curl -X POST http://127.0.0.1:8091/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"secret"}'
```

List notes:

```bash
curl http://127.0.0.1:8091/api/notes \
  -H "Authorization: Bearer <token>"
```

## Source of Truth

- Routes: [../server/routes](../server/routes)
- Controllers: [../server/controllers](../server/controllers)
- Models: [../server/models](../server/models)
- Frontend API client: [../client/js/api.js](../client/js/api.js)
