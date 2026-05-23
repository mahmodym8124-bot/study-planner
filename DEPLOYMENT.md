# MindVault Vercel Deployment Guide

## Pre-Deployment Checklist

**Build Status**
- Frontend assets compiled to `dist/`
- Vite configuration optimized for production
- `npm run build` passes locally

**Configuration Files**
- `vercel.json`: Configured with proper build, output, and rewrite rules
- `api/index.js`: Serverless entry point ready
- `vite.config.js`: Base path and asset handling configured

## Required Environment Variables for Vercel

Add these to your Vercel project settings under **Environment Variables**:

### Authentication & Security
- `MONGODB_URI` - MongoDB connection string (required)
- `JWT_SECRET` - JWT signing secret (required)
- `GOOGLE_CLIENT_ID` - Google OAuth client ID

### Application
- `CLIENT_URL` - Frontend URL (e.g., `https://your-project.vercel.app`)
- `VITE_API_URL` - API base URL (e.g., `https://your-project.vercel.app/api`)
- `VITE_GOOGLE_CLIENT_ID` - Google OAuth client ID for frontend
- `PASSWORD_RESET_BASE_URL` - Public frontend URL used in reset links
- `SENTRY_DSN` - Optional Sentry DSN

### Email
- `SMTP_HOST` - SMTP server host
- `SMTP_PORT` - SMTP port
- `SMTP_USER` - SMTP username
- `SMTP_PASS` - SMTP password or Gmail App Password
- `SMTP_FROM_EMAIL` - Optional sender email; defaults to `SMTP_USER`
- `SMTP_FROM_NAME` - Optional sender name; defaults to `MindVault`

`PORT` is optional and defaults to `8091`. A Google OAuth client secret is not required by the current Google Identity Services credential flow.

## Deployment Steps

### 1. Push to GitHub
```bash
git add .
git commit -m "Ready for Vercel deployment"
git push origin main
```

### 2. Connect to Vercel
- Go to [vercel.com](https://vercel.com)
- Click "Add New..." -> "Project"
- Import your GitHub repository
- Select your repository and click "Import"

### 3. Configure Environment
- In Vercel Dashboard -> Project Settings -> Environment Variables
- Add all required variables from section above
- Apply to Production environment

### 4. Deploy
- Vercel will automatically deploy when you push to `main`
- Or manually trigger: Dashboard → Deployments → Redeploy

## Post-Deployment Verification

1. Frontend loads at `https://your-project.vercel.app`.
2. API responds at `https://your-project.vercel.app/api/health`.
3. Email/password auth and Google sign-in work.
4. Password reset email sends and reset links open the deployed frontend.
5. MongoDB operations work for notes, ideas, workspace, focus, graph, and search.
6. Vercel logs show no serverless function errors.

## Troubleshooting

### CORS Errors
- Ensure `CLIENT_URL` and `VITE_API_URL` match your Vercel domain
- Do NOT use preview URLs (`...git-main...vercel.app`) - use production domain only
- Confirm the Google OAuth client allows the deployed origin

### 502 Bad Gateway
- Check MongoDB connection string
- Verify `MONGODB_URI` is set and accessible
- Check Vercel serverless function logs

### Password Reset Email Fails
- Verify `PASSWORD_RESET_BASE_URL` uses HTTPS in production
- Verify `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, and `SMTP_PASS`
- For Gmail, use a 16-character App Password, not the normal account password

### Build Failures
- Run `npm run build` locally to verify
- Check for missing environment variables
- Verify all dependencies in `package.json`

## Build Output
- Frontend: `dist/` directory
- API: Handled by `api/index.js` serverless function
- Static assets: Cached with optimal headers set in `vercel.json`

## Notes
- The project uses ES modules (`"type": "module"`)
- Vite frontend is served from root with API proxy to `/api`
- All backend routes are handled by the serverless function at `api/index.js`
- Google OAuth setup details are in [docs/google-oauth-setup.md](docs/google-oauth-setup.md)
