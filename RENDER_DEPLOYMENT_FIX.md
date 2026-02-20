# Render Deployment Fix Guide

## Issues Fixed

1. **CORS Configuration**: Updated to allow Vercel domains (including wildcard for *.vercel.app)
2. **Environment Variables**: Added ALLOWED_ORIGINS to render.yaml
3. **Database Logging**: Enhanced logging to verify database connection

## Steps to Fix Production

### Step 1: Update Render Environment Variables

Go to Render Dashboard → Your Backend Service → Environment:

1. **Verify MONGODB_URI is set:**
   ```
   mongodb+srv://Harsh:Harsh@cluster0.z0qugmf.mongodb.net/tatvaops?retryWrites=true&w=majority&ssl=true
   ```

2. **Add ALLOWED_ORIGINS** (if not already set):
   ```
   https://project-frontend-rikh1nvv7-pranshus-projects-2ecfd5c2.vercel.app,https://*.vercel.app
   ```
   Or use your actual Vercel frontend URL.

### Step 2: Verify Vercel Frontend Environment Variable

Go to Vercel Dashboard → Your Frontend Project → Settings → Environment Variables:

1. **Add/Verify VITE_API_BASE_URL:**
   ```
   https://tatvadirect.onrender.com
   ```
   (Or your actual Render backend URL)

2. **Redeploy** the frontend after setting the variable

### Step 3: Check Render Logs

After redeploying backend, check Render logs:

1. Go to Render Dashboard → Your Backend Service → Logs
2. Look for:
   ```
   ✅ MongoDB Connected: ...
   📊 Database: tatvaops
   📦 Found X total products in database
   ```

### Step 4: Test the API

1. Open browser DevTools → Network tab
2. Go to Admin Product Status page
3. Check the API request:
   - URL should be: `https://tatvadirect.onrender.com/api/admin/products/all`
   - Status should be 200 (not CORS error)
   - Response should contain products array

## Troubleshooting

### If products still don't show:

1. **Check browser console:**
   - Look for CORS errors
   - Check if API URL is correct
   - Verify response contains products

2. **Check Render backend logs:**
   - Look for database connection messages
   - Check for "Found X total products" message
   - Verify database name is "tatvaops"

3. **Verify environment variables:**
   - Render: MONGODB_URI, ALLOWED_ORIGINS
   - Vercel: VITE_API_BASE_URL

4. **Test API directly:**
   ```bash
   curl https://tatvadirect.onrender.com/api/admin/products/all \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

## Expected Behavior After Fix

✅ Backend connects to MongoDB successfully
✅ Database name shows as "tatvaops"
✅ Products are found and returned
✅ CORS allows Vercel frontend requests
✅ Frontend receives products data
✅ Products display in admin portal
