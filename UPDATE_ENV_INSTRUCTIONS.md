# Update Your Local .env File

## Your MongoDB URI

Use this exact MongoDB URI in your local `.env` file:

```
MONGODB_URI=mongodb+srv://Harsh:Harsh@cluster0.z0qugmf.mongodb.net/tatvaops?retryWrites=true&w=majority&ssl=true
```

## Steps to Update

1. **Open** `/backend/.env` file in a text editor

2. **Find** the line that starts with `MONGODB_URI=`

3. **Replace** it with:
   ```
   MONGODB_URI=mongodb+srv://Harsh:Harsh@cluster0.z0qugmf.mongodb.net/tatvaops?retryWrites=true&w=majority&ssl=true
   ```

4. **Save** the file

5. **Restart** your backend server:
   ```bash
   cd backend
   npm start
   ```

## Verify It's Working

After restarting, check the console output. You should see:
```
✅ MongoDB Connected: cluster0-shard-00-00.z0qugmf.mongodb.net
Database: tatvaops
```

Then check your admin portal - products should now appear!

## Complete .env File Example

Your `/backend/.env` should look like this:

```env
MONGODB_URI=mongodb+srv://Harsh:Harsh@cluster0.z0qugmf.mongodb.net/tatvaops?retryWrites=true&w=majority&ssl=true
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d
PORT=8080
NODE_ENV=development
ADMIN_EMAIL=admin@tatvadirect.com
ADMIN_PASSWORD=pranshu@123
```

## Important Notes

- ✅ No spaces around `=`
- ✅ No quotes around the URI
- ✅ Database name is `tatvaops`
- ✅ After updating, **restart** your backend server
