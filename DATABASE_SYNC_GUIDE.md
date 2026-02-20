# Database Sync Guide

## Current Configuration

**Production Database (Render):**
- Database: `tatvaops`
- Cluster: `cluster0.z0qugmf.mongodb.net`
- Connection String: `mongodb+srv://Harsh:Harsh@cluster0.z0qugmf.mongodb.net/tatvaops?retryWrites=true&w=majority&appName=Cluster0`

## Steps to Sync Local and Production Databases

### Step 1: Update Local .env File

1. Open `/backend/.env` file
2. Find the line with `MONGODB_URI=`
3. Replace it with the production MongoDB URI:

```env
MONGODB_URI=mongodb+srv://Harsh:Harsh@cluster0.z0qugmf.mongodb.net/tatvaops?retryWrites=true&w=majority&appName=Cluster0
```

**Important:** 
- Make sure there are NO spaces around the `=` sign
- Make sure there are NO quotes around the URI
- The database name is `tatvaops` (this is important!)

### Step 2: Restart Local Backend

After updating the `.env` file:
1. Stop your local backend server (Ctrl+C)
2. Start it again: `npm start` or `npm run dev`
3. Check the console - you should see:
   ```
   ✅ MongoDB Connected: cluster0-shard-00-00.z0qugmf.mongodb.net
   Database: tatvaops
   ```

### Step 3: Verify Connection

1. Open your admin portal locally
2. Check if products are showing (they should now match production)
3. Any changes you make locally will also appear in production

## What This Means

✅ **Both local and production will use the same database**
✅ **Products you see locally will be the same as production**
✅ **Changes made locally will appear in production immediately**
✅ **No need to migrate data - everything is synced**

## Security Note

⚠️ **Important:** The MongoDB credentials are visible in `render.yaml`. For better security:
- Consider using environment variables in Render dashboard instead of hardcoding in render.yaml
- Use MongoDB Atlas IP whitelist to restrict access
- Consider using separate databases for development and production in the future

## Troubleshooting

### If connection fails:
1. Check MongoDB Atlas → Network Access → Ensure your IP is whitelisted (or use 0.0.0.0/0 for all IPs)
2. Verify the username/password are correct
3. Check if the database name `tatvaops` exists in your cluster

### If products still don't show:
1. Check browser console for API errors
2. Check backend logs for database connection status
3. Verify the database name matches exactly: `tatvaops`

## Next Steps

After syncing:
1. Your local development will use the production database
2. All products, users, orders will be shared between local and production
3. Be careful when testing - changes will affect production data!
