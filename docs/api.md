API — study-planner (short)

Server entrypoints
- REST server: `server/server.js` (Express)
- Serverless: `api/index.js` (Vercel)

Common routes
- Auth: POST `/api/auth/login`, POST `/api/auth/register`
- Notes: GET `/api/notes`, POST `/api/notes`, PUT `/api/notes/:id`, DELETE `/api/notes/:id`
- Ideas: similar to notes under `/api/ideas`
- Productivity: GET/POST `/api/productivity`

Example cURL (login)

curl -X POST https://localhost:8091/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"secret"}'

Data models (high level)
- `User`: email, name, passwordHash
- `Note`/`Idea`: title, body, createdAt, userId
- `Productivity`: todos[], reminders[], pomodoro settings

See `server/models/` for exact field names.
