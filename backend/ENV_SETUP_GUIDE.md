# Environment Variables Setup Guide

## Location
Your `.env` file should be located in: `/backend/.env`

## Required Format

Your `.env` file should look like this (copy this format exactly):

```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d
PORT=8080
NODE_ENV=development

# AI Platform API Keys
GEMINI_API_KEY=your-gemini-api-key-here
```

## Important Notes:

1. **NO SPACES around the `=` sign**
   - ✅ Correct: `GEMINI_API_KEY=your-key-here`
   - ❌ Wrong: `GEMINI_API_KEY = your-key-here`
   - ❌ Wrong: `GEMINI_API_KEY= your-key-here`

2. **NO QUOTES** (unless your key contains spaces)
   - ✅ Correct: `GEMINI_API_KEY=AIzaSyAbc123...`
   - ❌ Wrong: `GEMINI_API_KEY="AIzaSyAbc123..."`
   - ❌ Wrong: `GEMINI_API_KEY='AIzaSyAbc123...'`

3. **NO EMPTY LINES** at the beginning of the file

4. **Variable name must be EXACTLY**: `GEMINI_API_KEY` (case-sensitive)

## How to Fix Your .env File:

1. Open `/backend/.env` in a text editor
2. Make sure you have a line that says:
   ```
   GEMINI_API_KEY=your-actual-api-key
   ```
3. Replace `your-actual-api-key` with your actual Gemini API key
4. Save the file
5. **RESTART your backend server** (this is crucial!)

## Test if it's working:

After restarting your server, check the console output. You should see:
```
GEMINI_API_KEY: ✅ Set
```

Or visit: `http://localhost:8080/api/debug/env` to see if the key is loaded.

## Common Issues:

- **Server not restarted**: Environment variables are only loaded when the server starts
- **Wrong file location**: Must be in `/backend/.env`, not in root directory
- **Spaces around =**: Remove all spaces
- **Wrong variable name**: Must be exactly `GEMINI_API_KEY` (not `GEMINI_KEY` or `GOOGLE_GEMINI_API_KEY`)
