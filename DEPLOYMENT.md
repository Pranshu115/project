# Deployment Guide

## Prerequisites
- Node.js 18+ installed
- MongoDB Atlas account
- Deployment platform account (Vercel, Netlify, Railway, or Render)

## Environment Variables

### Backend (.env)
```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d
PORT=8080
NODE_ENV=production

# Admin Configuration (REQUIRED for admin access)
ADMIN_EMAIL=admin@tatvadirect.com
ADMIN_PASSWORD=your-secure-admin-password-change-this
ADMIN_NAME=Admin User
ADMIN_COMPANY=Tatva Direct

# CORS Configuration (Optional - for production)
ALLOWED_ORIGINS=https://your-frontend-domain.com,https://another-domain.com

# AI Platform API Keys (Optional - for AI Fetch feature)
# At least one API key is required to use the AI Fetch feature
# The system will auto-select the best available provider if set to 'auto'
OPENAI_API_KEY=sk-your-openai-api-key-here
GEMINI_API_KEY=your-gemini-api-key-here
ANTHROPIC_API_KEY=your-anthropic-claude-api-key-here
```

## Deployment Options

### Option 1: Vercel (Recommended for Frontend + Backend)

#### Frontend Deployment:
1. Connect your GitHub repo to Vercel
2. Set build command: `npm run build`
3. Set output directory: `dist`
4. Deploy from `frontend` folder

#### Backend Deployment:
1. Create new Vercel project for backend
2. Deploy from `backend` folder
3. Add environment variables in Vercel dashboard
4. Update frontend API calls to use backend URL

### Option 2: Netlify (Frontend) + Railway (Backend)

#### Frontend on Netlify:
1. Connect GitHub repo
2. Set build command: `npm run build`
3. Set publish directory: `frontend/dist`
4. Update `netlify.toml` with your backend URL

#### Backend on Railway:
1. Connect GitHub repo
2. Deploy from `backend` folder
3. Add environment variables
4. Railway will auto-detect Node.js

### Option 3: Render (Full Stack)

#### Backend on Render:
1. Create new Web Service
2. Connect GitHub repo
3. Set build command: `npm install`
4. Set start command: `npm start`
5. Add environment variables

#### Frontend on Render:
1. Create new Static Site
2. Set build command: `npm run build`
3. Set publish directory: `dist`

## Post-Deployment Steps

1. **Seed Database:**
   ```bash
   # Run this after backend is deployed
   npm run seed:production
   ```

2. **Update Frontend API URLs:**
   - Update all `/api` calls to use your deployed backend URL
   - Or configure proxy in your deployment platform

3. **Test Authentication:**
   - Admin: admin@tatvadirect.com / TatvaAdmin@2024
   - Test user: john@example.com / password123

## Troubleshooting

### Common Issues:

1. **CORS Errors:**
   - Add your frontend domain to CORS configuration in backend

2. **Database Connection:**
   - Ensure MongoDB Atlas allows connections from all IPs (0.0.0.0/0)
   - Check connection string format

3. **Environment Variables:**
   - Ensure all required env vars are set in deployment platform
   - JWT_SECRET should be a long, random string

4. **Build Errors:**
   - Check Node.js version compatibility
   - Ensure all dependencies are in package.json

## Local Testing Before Deployment

```bash
# Install all dependencies
npm run install:all

# Build frontend
npm run build

# Start backend in production mode
NODE_ENV=production npm run start:backend

# Test the built frontend (serve the dist folder)
cd frontend && npx serve dist
```

## API Endpoints

- `POST /api/auth/login` - User login
- `POST /api/auth/signup` - User registration
- `GET /api/admin/dashboard` - Admin dashboard data
- `GET /api/dashboard/supplier` - Supplier dashboard
- `GET /api/dashboard/service-provider` - Service provider dashboard

## Security Notes

- Change JWT_SECRET in production
- Use HTTPS in production
- Implement rate limiting
- Validate all inputs
- Use environment variables for sensitive data