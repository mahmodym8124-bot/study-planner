# Google OAuth Setup

This guide covers end-to-end setup for Google Sign-In with the current MindVault implementation:

- Frontend uses Google Identity Services (`credential` flow).
- Backend verifies the Google ID token using `google-auth-library`.
- App then returns its own JWT session token.

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
5. Create and copy the **Client ID**.

Notes:
- For the current GIS credential flow in this repo, a backend redirect URI is not required for sign-in.
- A client secret is not required by the current implementation.

## 4. Environment Variables

Set these values in your local `.env` and in hosting environment settings:

```dotenv
GOOGLE_CLIENT_ID=your-google-oauth-web-client-id.apps.googleusercontent.com
VITE_GOOGLE_CLIENT_ID=your-google-oauth-web-client-id.apps.googleusercontent.com
```

Related variables used in this project:

```dotenv
CLIENT_URL=http://localhost:5173
VITE_API_URL=/api
```

Reference template: [../.env.example](../.env.example)

## 5. Code Paths in This Repository

- Frontend auth/API client: [../client/js/api.js](../client/js/api.js)
- Backend Google verification handler: [../server/controllers/authController.js](../server/controllers/authController.js)
- Auth routes (`POST /api/auth/google`): [../server/routes/authRoutes.js](../server/routes/authRoutes.js)
- Locale strings (including Google button text/legal links):
  - [../client/locales/en.json](../client/locales/en.json)
  - [../client/locales/ar.json](../client/locales/ar.json)
  - [../client/locales/kmr.json](../client/locales/kmr.json)

## 6. Verification Checklist

1. Run local app:
   - `npm run dev`
2. Confirm Google sign-in renders and returns a logged-in state.
3. Confirm backend receives `credential` at `POST /api/auth/google`.
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
