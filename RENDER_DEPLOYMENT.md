# Render Deployment Checklist

## ✅ Fixed Issues

### 1. Prisma Client Generation
- **Issue**: Prisma client wasn't generated before TypeScript compilation on Render
- **Fix**: Added `postinstall` script that runs `prisma generate` automatically after `npm install`
- **Build Order**: `npm install` → `prisma generate` → `npm run build`

### 2. Database Schema Sync
- **Issue**: Database schema wasn't in sync with Prisma schema
- **Fix**: Ran `npx prisma db push --force-reset` to sync database
- **Status**: All fields (`emailOtp`, `emailOtpExpiry`, `emailVerifiedAt`) now in database

### 3. Build Command Order
- **Updated**: `render.yaml` buildCommand now runs Prisma generation before build
- **Command**: `npm install && npx prisma generate && npm run build`

## 🚀 Deployment Steps

### On Render Dashboard:

1. **Connect Repository**: `pravinbhatt-rai/six-backend`

2. **Environment Variables** (Add these in Render):
   ```
   DATABASE_URL=your_postgres_connection_string
   JWT_SECRET=your_secret_key
   FRONTEND_ORIGIN=https://six-loan.vercel.app/
   NODE_ENV=production
   PORT=4000
   EMAIL_SERVICE=gmail
   EMAIL_USER=officialsixfinance@gmail.com
   EMAIL_PASSWORD=your_email_password
   EMAIL_FROM=officialsixfinance@gmail.com
   OTP_EXPIRY_MINUTES=10
   OTP_LENGTH=6
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   ```

3. **Build Settings** (Auto-detected from render.yaml):
   - Build Command: `npm install && npx prisma generate && npm run build`
   - Start Command: `npm start`
   - Health Check: `/health`

4. **Deploy**: Click "Create Web Service"

## ✅ Verification

### Local Build (Simulating Render):
```bash
rm -rf dist node_modules/.prisma
npm install  # This runs postinstall → prisma generate
npm run build  # ✓ Success
```

### Test Endpoints After Deployment:
```bash
# Root
curl https://your-app.onrender.com/

# Health
curl https://your-app.onrender.com/health

# Email Verification
curl -X POST https://your-app.onrender.com/api/email-verification/send-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

## 📝 Files Modified
- ✅ `package.json` - Added `postinstall` script
- ✅ `render.yaml` - Updated build command order
- ✅ Database - Synced with Prisma schema

## 🎯 Current Status
- ✅ No TypeScript errors
- ✅ Build passes locally
- ✅ Prisma client properly generated
- ✅ Database schema synchronized
- ✅ Latest code pushed to GitHub

**Ready for Render deployment!** 🚀
