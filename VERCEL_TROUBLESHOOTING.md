# Vercel Deployment Troubleshooting Guide

## Blank Page Issue - Step by Step Fix

### Step 1: Verify Environment Variable is Set

1. Go to your Vercel project: https://vercel.com/dashboard
2. Click on your project
3. Go to **Settings** → **Environment Variables**
4. Verify `VITE_API_BASE_URL` is set to your Render backend URL:
   - Example: `https://tatvadirect.onrender.com`
   - **Important**: Do NOT include trailing slash
   - Make sure it's set for **Production**, **Preview**, and **Development**

### Step 2: Check Vercel Build Logs

1. Go to **Deployments** tab in Vercel
2. Click on the latest deployment
3. Check the **Build Logs** for any errors
4. Look for:
   - Build failures
   - Missing dependencies
   - Environment variable warnings

### Step 3: Check Browser Console

1. Open your deployed site
2. Press `F12` or right-click → **Inspect**
3. Go to **Console** tab
4. Look for:
   - Red error messages
   - API configuration logs (should show your backend URL)
   - Any React errors

### Step 4: Verify Build Output

1. In Vercel deployment logs, check:
   - Build completed successfully
   - Output directory: `dist`
   - Files are being generated

### Step 5: Test API Connection

1. Open browser console
2. Type: `fetch('YOUR_BACKEND_URL/api/health').then(r => r.json()).then(console.log)`
3. Replace `YOUR_BACKEND_URL` with your Render backend URL
4. Check if you get a response (CORS might block, but you should see the attempt)

## Common Issues and Solutions

### Issue 1: Environment Variable Not Set
**Symptoms**: Blank page, console shows default API URL
**Solution**: Set `VITE_API_BASE_URL` in Vercel environment variables

### Issue 2: Build Fails
**Symptoms**: Deployment shows "Build Failed" in Vercel
**Solution**: 
- Check build logs for specific errors
- Verify `package.json` has correct build script: `"build": "vite build"`
- Check Node.js version compatibility

### Issue 3: JavaScript Errors
**Symptoms**: Console shows red errors
**Solution**:
- Check browser console for specific error messages
- Verify all imports are correct
- Check if any dependencies are missing

### Issue 4: CORS Errors
**Symptoms**: Network tab shows CORS errors
**Solution**: 
- Update backend CORS to allow your Vercel domain
- Add your Vercel URL to `ALLOWED_ORIGINS` in backend `.env`

### Issue 5: Backend Not Responding
**Symptoms**: Network requests fail, timeout errors
**Solution**:
- Verify backend is running on Render
- Check Render logs for errors
- Verify backend URL is correct (no typos)

## Quick Debugging Steps

1. **Check if app loads at all**:
   - Open browser console
   - Look for "API Base URL:" log message
   - If you see it, React is loading

2. **Check for React errors**:
   - Look for "ErrorBoundary" component
   - Check if error boundary caught anything

3. **Check network requests**:
   - Go to Network tab in DevTools
   - Refresh page
   - See if any requests are being made
   - Check if requests are going to correct URL

4. **Verify HTML structure**:
   - View page source (Ctrl+U)
   - Look for `<div id="root"></div>`
   - Check if JavaScript files are loading

## Manual Testing

After setting environment variable and redeploying:

1. **Clear browser cache**:
   - Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
   - Or use incognito/private window

2. **Check deployment**:
   - Wait for Vercel deployment to complete
   - Check deployment status is "Ready"

3. **Test login**:
   - Try accessing the login page
   - Check if form loads
   - Try logging in

## Still Not Working?

If you've tried all the above:

1. **Check Vercel Function Logs**:
   - Go to Vercel dashboard → Your project → Functions
   - Check for any serverless function errors

2. **Verify Build Configuration**:
   - Check `vercel.json` is correct
   - Verify `package.json` build script
   - Check `vite.config.js` settings

3. **Test Locally**:
   ```bash
   cd frontend
   npm run build
   npm install -g serve
   serve -s dist
   ```
   - Visit `http://localhost:3000`
   - See if it works locally

4. **Contact Support**:
   - Share Vercel build logs
   - Share browser console errors
   - Share network tab screenshots

## Expected Behavior After Fix

Once fixed, you should see:
- ✅ Page loads (not blank)
- ✅ Login page appears
- ✅ Console shows API URL log
- ✅ No red errors in console
- ✅ Network requests go to correct backend URL
