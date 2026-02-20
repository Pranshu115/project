# Vercel Deployment Guide

## Issue Fixed
The frontend was showing a blank page after deployment because all API calls were using relative URLs (`/api/...`) which don't work in production without proper configuration.

## Solution
All API calls have been updated to use a centralized configuration that supports environment variables. The frontend now uses the `getApiUrl()` function which reads from `VITE_API_BASE_URL` environment variable.

## Deployment Steps

### 1. Set Environment Variable in Vercel

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add a new environment variable:
   - **Name**: `VITE_API_BASE_URL`
   - **Value**: Your Render backend URL (e.g., `https://tatvadirect.onrender.com`)
   - **Environment**: Select all (Production, Preview, Development)

### 2. Verify Backend URL

Make sure your backend URL is correct. Check your Render dashboard to get the exact URL. Common formats:
- `https://your-app-name.onrender.com`
- `https://tatvadirect.onrender.com`

### 3. Redeploy

After setting the environment variable:
1. Go to **Deployments** tab in Vercel
2. Click the **"..."** menu on the latest deployment
3. Select **"Redeploy"**

Or push a new commit to trigger a new deployment.

## Configuration Files Updated

- `frontend/src/config/api.js` - Now uses `VITE_API_BASE_URL` environment variable
- `frontend/Api.js` - Updated to use environment variable
- All page components - Updated to use `getApiUrl()` function
- `frontend/vercel.json` - Simplified configuration

## Testing

After deployment:
1. Visit your Vercel frontend URL
2. Try logging in
3. Check browser console for any API errors
4. Verify API calls are going to the correct backend URL

## Troubleshooting

### Still seeing blank page?
1. Check browser console for errors
2. Verify `VITE_API_BASE_URL` is set correctly in Vercel
3. Check that your backend is running and accessible
4. Verify CORS is configured on your backend to allow your Vercel domain

### CORS Errors?
Make sure your backend (Render) has CORS configured to allow your Vercel domain:
```javascript
// In your backend server.js
const allowedOrigins = [
  'https://your-vercel-app.vercel.app',
  'https://your-custom-domain.com'
];
```

### API calls failing?
1. Check network tab in browser DevTools
2. Verify the backend URL is correct
3. Check backend logs on Render
4. Ensure backend is not sleeping (Render free tier sleeps after inactivity)

## Environment Variable Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | Backend API base URL | `https://tatvadirect.onrender.com` |

**Note**: Vite requires the `VITE_` prefix for environment variables to be exposed to the client-side code.
