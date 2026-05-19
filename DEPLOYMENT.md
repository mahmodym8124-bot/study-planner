# Vercel Deployment Guide

## Pre-Deployment Checklist

✅ **Build Status**: Production build verified and successful
- Frontend assets compiled to `dist/`
- Vite configuration optimized for production
- No build errors

✅ **Configuration Files**
- `vercel.json`: Configured with proper build, output, and rewrite rules
- `api/index.js`: Serverless entry point ready
- `vite.config.js`: Base path and asset handling configured

## Required Environment Variables for Vercel

Add these to your Vercel project settings under **Environment Variables**:

### Authentication & Security
- `MONGODB_URI` - MongoDB connection string (required)
- `JWT_SECRET` - JWT signing secret (required)
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth secret

### Application
- `CLIENT_URL` - Frontend URL (e.g., `https://your-project.vercel.app`)
- `VITE_API_URL` - API base URL (e.g., `https://your-project.vercel.app/api`)
- `VITE_GOOGLE_CLIENT_ID` - Google OAuth client ID for frontend
- `PORT` - Server port (optional, defaults to 8091)

## Deployment Steps

### 1. Push to GitHub
```bash
git add .
git commit -m "Ready for Vercel deployment"
git push origin main
```

### 2. Connect to Vercel
- Go to [vercel.com](https://vercel.com)
- Click "Add New..." → "Project"
- Import your GitHub repository
- Select your repository and click "Import"

### 3. Configure Environment
- In Vercel Dashboard → Project Settings → Environment Variables
- Add all required variables from section above
- Apply to Production environment

### 4. Deploy
- Vercel will automatically deploy when you push to `main`
- Or manually trigger: Dashboard → Deployments → Redeploy

## Post-Deployment Verification

1. ✅ Frontend loads at `https://your-project.vercel.app`
2. ✅ API responds at `https://your-project.vercel.app/api/health` (if implemented)
3. ✅ Authentication works (login/signup)
4. ✅ MongoDB operations work (create/read/update/delete)
5. ✅ Check Vercel Logs for errors: Dashboard → Deployments → Logs

## Troubleshooting

### CORS Errors
- Ensure `CLIENT_URL` and `VITE_API_URL` match your Vercel domain
- Do NOT use preview URLs (`...git-main...vercel.app`) - use production domain only

### 502 Bad Gateway
- Check MongoDB connection string
- Verify `MONGODB_URI` is set and accessible
- Check Vercel serverless function logs

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
