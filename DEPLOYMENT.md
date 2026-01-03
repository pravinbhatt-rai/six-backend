# Six Loan Backend - Render Deployment Guide

## ✅ Server Status
Your backend is now properly configured with:
- ✅ Root endpoint `/` - Returns API information and available endpoints
- ✅ Health check endpoint `/health` - For deployment monitoring
- ✅ Proper error handling and 404 routes
- ✅ Production-ready build configuration

## 🚀 Deploy to Render

### Option 1: Using render.yaml (Recommended)

1. **Push your code to GitHub:**
   ```bash
   git add .
   git commit -m "Add root endpoint and deployment configuration"
   git push origin main
   ```

2. **Connect to Render:**
   - Go to https://dashboard.render.com
   - Click "New +" → "Web Service"
   - Connect your GitHub repository: `pravinbhatt-rai/six-backend`
   - Render will automatically detect `render.yaml`

3. **Configure Environment Variables:**
   Add these in Render Dashboard under "Environment":
   ```
   DATABASE_URL=your_postgres_connection_string
   JWT_SECRET=your_jwt_secret_key
   FRONTEND_ORIGIN=https://your-frontend-domain.com
   NODE_ENV=production
   ```

4. **Deploy:**
   - Click "Create Web Service"
   - Render will automatically build and deploy

### Option 2: Manual Configuration

If you prefer manual setup:

1. **Build Command:**
   ```
   npm install && npm run build && npx prisma generate
   ```

2. **Start Command:**
   ```
   npm start
   ```

3. **Health Check Path:**
   ```
   /health
   ```

## 🔍 Testing Your Deployment

Once deployed, test these endpoints:

### Root Endpoint
```bash
curl https://your-app.onrender.com/
```
Expected Response:
```json
{
  "success": true,
  "message": "Six Loan Backend API is running",
  "version": "1.0.0",
  "endpoints": {
    "health": "/health",
    "auth": "/auth",
    "admin": "/api/admin",
    "applications": "/api/applications",
    "loans": "/api/loans",
    "creditCards": "/api/credit-cards",
    "users": "/api/users"
  }
}
```

### Health Check
```bash
curl https://your-app.onrender.com/health
```
Expected Response:
```json
{
  "ok": true,
  "status": "healthy",
  "timestamp": "2026-01-04T..."
}
```

## 📝 Important Notes

1. **Database**: Make sure your PostgreSQL database is accessible from Render
2. **Environment Variables**: Never commit `.env` file (already in .gitignore)
3. **CORS**: Update `FRONTEND_ORIGIN` in your environment variables to match your frontend domain
4. **Free Tier**: Render's free tier spins down after 15 minutes of inactivity
5. **Cold Starts**: First request after spin-down may take 30-60 seconds

## 🐛 Troubleshooting

### "Cannot GET /" error
- ✅ Fixed! Root endpoint is now configured

### Build fails
- Ensure all dependencies are in `package.json`
- Check build logs for TypeScript errors

### Database connection issues
- Verify `DATABASE_URL` environment variable
- Ensure database allows external connections
- Run migrations: `npx prisma migrate deploy`

### App crashes on startup
- Check Render logs for error messages
- Verify all required environment variables are set

## 📦 Project Structure
```
backend/
├── src/                    # TypeScript source
│   ├── index.ts           # Main server file (with root route)
│   ├── routes/            # API routes
│   └── middleware/        # Auth middleware
├── dist/                  # Compiled JavaScript (production)
├── prisma/                # Database schema
├── render.yaml            # Render configuration
└── package.json           # Dependencies
```

## 🔗 Useful Links
- [Render Dashboard](https://dashboard.render.com)
- [Render Logs](https://dashboard.render.com/services)
- [GitHub Repository](https://github.com/pravinbhatt-rai/six-backend)

---

**Need Help?** Check the Render logs or test locally with:
```bash
npm run build && npm start
```
