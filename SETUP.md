# Ghar Dekho Backend - Complete Setup Guide

## 🎯 Database Recommendation

**Use Neon (Serverless Postgres)** - Best choice for:
- ✅ Serverless PostgreSQL
- ✅ Excellent Prisma compatibility
- ✅ Free tier available
- ✅ Easy setup
- ✅ Auto-scaling

**Alternative**: Prisma Postgres (if you want the most seamless Prisma integration)

## 📋 Step-by-Step Setup Commands

### 1. Initialize Project (if not already done)

```bash
# Navigate to project directory
cd "C:\Users\asus\Desktop\Projects\Ghar Dekho"

# Initialize npm (if package.json doesn't exist)
npm init -y
```

### 2. Install All Dependencies

```bash
npm install
```

This will install:
- Express.js (web framework)
- Prisma (ORM)
- JWT (authentication)
- bcryptjs (password hashing)
- Socket.io (real-time chat)
- Cloudinary (media uploads)
- Twilio (OTP)
- And all other required packages

### 3. Setup Database (Neon)

**Option A: Using Neon (Recommended)**

1. Go to [https://console.neon.tech](https://console.neon.tech)
2. Sign up/Login
3. Create a new project
4. Copy the connection string (it will look like):
   ```
   postgresql://username:password@ep-xxx-xxx.region.aws.neon.tech/dbname?sslmode=require
   ```

**Option B: Using Prisma Postgres**

1. Go to [https://console.prisma.io](https://console.prisma.io)
2. Create a new database
3. Copy the connection string

### 4. Create Environment File

Create a `.env` file in the root directory:

```bash
# Windows PowerShell
New-Item -Path .env -ItemType File

# Or manually create .env file
```

Add the following content to `.env`:

```env
# Database (Replace with your Neon/Prisma connection string)
DATABASE_URL="postgresql://user:password@host:port/database?schema=public"

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-min-32-chars
JWT_EXPIRES_IN=7d

# Server
PORT=5000
NODE_ENV=development

# OTP Services (Twilio)
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number

# Email Service
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
EMAIL_FROM=noreply@ghardekho.com

# Cloudinary (for image/video uploads)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Google Maps API
GOOGLE_MAPS_API_KEY=your_google_maps_api_key

# Frontend URL
FRONTEND_URL=http://localhost:3000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### 5. Generate Prisma Client

```bash
npm run prisma:generate
```

This creates the Prisma Client based on your schema.

### 6. Create Database Schema (Run Migrations)

```bash
npm run prisma:migrate
```

When prompted:
- Enter migration name: `init` (or any name you prefer)
- This will create all tables in your database

### 7. (Optional) Seed Database with Initial Data

```bash
npm run prisma:seed
```

This will add:
- Default amenities
- Subscription plans
- System configurations

### 8. (Optional) Open Prisma Studio

```bash
npm run prisma:studio
```

This opens a visual database browser at `http://localhost:5555`

### 9. Start Development Server

```bash
npm run dev
```

The server will start on `http://localhost:5000`

## 🔧 Additional Commands

### Push Schema Changes (Alternative to Migrate)

If you want to push schema changes without creating migration files:

```bash
npm run prisma:push
```

### View Database in Browser

```bash
npm run prisma:studio
```

### Production Build

```bash
npm start
```

## 📝 Database Schema Summary

The complete schema includes:

### Core Models (40+ tables):
- **User & Auth**: User, Profile, OTPVerification
- **Properties**: Property, PropertyImage, PropertyVideo, VirtualTour, FloorPlan
- **Amenities**: Amenity, PropertyAmenity, NearbyEssential
- **Interactions**: Wishlist, PropertyView, PropertyComparison, SavedSearch
- **Communication**: ChatSession, Message, Meeting
- **Agents**: AgentProfile, TeamMember, LeadManagement
- **Subscriptions**: SubscriptionPlan, Subscription
- **Notifications**: Notification, PriceAlert, NewPropertyAlert
- **Reviews**: Review
- **Analytics**: UserAnalytics, AgentAnalytics, PropertyAnalytics
- **Pricing**: PriceHistory
- **Admin**: AdminAction, SystemConfig, FraudDetection
- **Legal**: LegalDocument, RentAgreement
- **Location**: LocalityData, CommuteTime

### Key Features Covered:
✅ All property types (Residential, Commercial, PG, Plots)
✅ Multi-role users (Owner, Agent, Buyer, Renter)
✅ Complete media support (Images, Videos, 360° tours)
✅ Advanced search & filtering
✅ Real-time chat & messaging
✅ Meeting scheduling
✅ Agent management & analytics
✅ Subscription system
✅ Price alerts & notifications
✅ Reviews & ratings
✅ Admin panel support
✅ Fraud detection
✅ Legal documents
✅ Location & commute data

## 🚨 Important Notes

1. **Never commit `.env` file** - It's already in `.gitignore`
2. **Change JWT_SECRET** - Use a strong random string in production
3. **Database URL** - Keep it secure, never expose it
4. **API Keys** - Get your API keys from respective services:
   - Twilio: [https://www.twilio.com](https://www.twilio.com)
   - Cloudinary: [https://cloudinary.com](https://cloudinary.com)
   - Google Maps: [https://console.cloud.google.com](https://console.cloud.google.com)

## 🎉 Next Steps

After setup:
1. Test the health endpoint: `http://localhost:5000/health`
2. Start building API routes in `src/routes/`
3. Implement controllers in `src/controllers/`
4. Add business logic in `src/services/`

## 📚 Resources

- [Prisma Docs](https://www.prisma.io/docs)
- [Neon Docs](https://neon.tech/docs)
- [Express.js Docs](https://expressjs.com)

