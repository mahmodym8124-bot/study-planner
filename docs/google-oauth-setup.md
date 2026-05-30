# Google OAuth Setup

This guide covers end-to-end setup for Google Sign-In with the current MindVault implementation:

- Frontend redirects to the backend `/api/auth/google` endpoint.
- Backend starts the OAuth 2.0 authorization code flow, exchanges the code for tokens, verifies the ID token, and issues the MindVault JWT.
- The app then redirects back to `/#/auth/callback` to establish the session.

## 1. Create or Select a Google Cloud Project

1. Open <https://console.cloud.google.com/>.
2. Select an existing project or create a new one (for example `mindvault-auth`).
3. Save the project ID for reference.

## 2. Configure OAuth Consent Screen

1. Go to **APIs & Services** -> **OAuth consent screen**.
2. Choose **External** (typical for public apps) and create.
3. Set required fields:
   - App name: `MindVault`
   - User support email
   - Developer contact email
4. Add scopes:
   - `email`
   - `profile`
5. Add test users if the app is still in testing mode.

## 3. Create OAuth 2.0 Web Client Credentials

1. Go to **APIs & Services** -> **Credentials**.
2. Click **Create Credentials** -> **OAuth client ID**.
3. Application type: **Web application**.
4. Add Authorized JavaScript origins:
    - `http://localhost:5173` (local dev)
    - your Vercel domain (for example `https://your-project.vercel.app`)
    - your custom production domain (if any)
5. Add Authorized redirect URIs:
   - `http://localhost:8091/api/auth/google/callback`
   - `https://your-project.vercel.app/api/auth/google/callback`
   - your custom production domain equivalent (if any)
6. Create and copy the **Client ID** and **Client Secret**.

Notes:
- The redirect URI must match exactly what you configure in Google Cloud Console.
- Keep the Client Secret on the server only. Never expose it in `VITE_*` variables.

## 4. Environment Variables

Set these values in your local `.env` and in hosting environment settings:

```dotenv
GOOGLE_CLIENT_ID=your-google-oauth-web-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
VITE_GOOGLE_CLIENT_ID=your-google-oauth-web-client-id.apps.googleusercontent.com
```

`GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are used by the server to complete the OAuth code exchange and verify ID tokens. `VITE_GOOGLE_CLIENT_ID` is public browser configuration for any client-side Google UI, but it is not required for the redirect flow. Do not put Google client secrets or private provider keys in any `VITE_*` variable.

Related variables used in this project:

```dotenv
CLIENT_URL=http://localhost:5173
VITE_API_URL=/api
```

Reference template: [../.env.example](../.env.example)

## 5. Code Paths in This Repository

- Frontend auth/API client: [../client/js/api.js](../client/js/api.js)
- Backend Google verification handler: [../server/controllers/authController.js](../server/controllers/authController.js)
- Auth routes (`GET /api/auth/google`, `GET /api/auth/google/callback`, `POST /api/auth/google`): [../server/routes/authRoutes.js](../server/routes/authRoutes.js)
- Locale strings (including Google button text/legal links):
  - [../client/locales/en.json](../client/locales/en.json)
  - [../client/locales/ar.json](../client/locales/ar.json)
  - [../client/locales/kmr.json](../client/locales/kmr.json)

## 6. Verification Checklist

1. Run local app:
   - `npm run dev`
2. Confirm Google sign-in redirects to Google and returns a logged-in state.
3. Confirm backend receives the callback at `GET /api/auth/google/callback`.
4. Run quality checks:
   - `npm run lint`
   - `npm test`
5. Build:
   - `npm run build`
6. Re-test on deployed domain after setting production env vars.

## 7. Troubleshooting

- `Google sign-in is not configured`:
  - `GOOGLE_CLIENT_ID` / `VITE_GOOGLE_CLIENT_ID` missing in environment.
- Popup blocked or sign-in not rendering:
  - Missing/incorrect Authorized JavaScript origins in Google Cloud.
- CORS/API failures:
  - `CLIENT_URL` and `VITE_API_URL` not aligned with the current frontend origin/deployment.
