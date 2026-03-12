# Ghar Dekho - Property Listing Platform Backend

A comprehensive backend API for the Ghar Dekho property listing platform built with Node.js, Express, and Prisma.

## 🚀 Setup Instructions

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn
- PostgreSQL database (via Neon, Supabase, or any PostgreSQL provider)

### Step 1: Choose Database Provider

**Recommended: Neon (Serverless Postgres)**
- Visit [Neon Console](https://console.neon.tech)
- Create a new project
- Copy the connection string

**Alternative Options:**
- **Prisma Postgres**: Instant Serverless Postgres (best Prisma integration)
- **Supabase**: Postgres backend with additional features
- **AWS RDS**: For production scale

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Configure Environment Variables

```bash
# Copy the example env file
cp .env.example .env

# Edit .env and add your database URL and other credentials
```

Update the `.env` file with:
- Your database connection string (from Neon/Prisma Postgres)
- JWT secret
- OTP service credentials (Twilio)
- Email service credentials
- Cloudinary credentials (for media uploads)
- Google Maps API key

### Step 4: Setup Prisma

```bash
# Generate Prisma Client
npm run prisma:generate

# Run migrations to create database schema
npm run prisma:migrate

# (Optional) Open Prisma Studio to view database
npm run prisma:studio
```

### Step 5: Seed Database (Optional)

```bash
npm run prisma:seed
```

### Step 6: Start Development Server

```bash
npm run dev
```

The server will start on `http://localhost:5000` (or your configured PORT)

## 📁 Project Structure

```
ghar-dekho-backend/
├── prisma/
│   ├── schema.prisma      # Database schema
│   └── seed.js            # Database seeding script
├── src/
│   ├── config/            # Configuration files
│   ├── controllers/       # Route controllers
│   ├── middleware/        # Custom middleware
│   ├── models/            # Data models (if needed)
│   ├── routes/            # API routes
│   ├── services/          # Business logic
│   ├── utils/             # Utility functions
│   └── server.js          # Entry point
├── .env                   # Environment variables
├── .env.example           # Example env file
├── .gitignore
├── package.json
└── README.md
```

## 🗄️ Database Schema Overview

The schema includes comprehensive models for:

- **User Management**: Authentication, profiles, KYC, roles
- **Properties**: All property types (Residential, Commercial, PG, Plots)
- **Media**: Images, videos, 360° tours, floor plans
- **Amenities & Location**: Property amenities, nearby essentials
- **User Interactions**: Wishlist, comparisons, saved searches
- **Communication**: Chat, messages, meetings
- **Agent Features**: Agent profiles, team management, lead tracking
- **Subscriptions**: Premium plans and subscriptions
- **Notifications**: Price alerts, new property alerts
- **Reviews & Ratings**: User and property reviews
- **Analytics**: User, agent, and property analytics
- **Admin**: Admin actions, fraud detection, system config
- **Legal**: Documents, rent agreements
- **Location Data**: Locality scores, commute times

## 🔑 Key Features

- ✅ Complete user authentication with OTP
- ✅ Multi-role support (Owner, Agent, Buyer, Renter)
- ✅ Comprehensive property listing system
- ✅ Advanced search and filtering
- ✅ Real-time chat and messaging
- ✅ Meeting scheduling
- ✅ Agent management and analytics
- ✅ Subscription management
- ✅ Notification system
- ✅ Review and rating system
- ✅ Admin panel support
- ✅ Fraud detection
- ✅ Analytics and reporting

## 📝 API Endpoints (To be implemented)

The API will include endpoints for all features mentioned in the requirements.

## 🛠️ Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **ORM**: Prisma
- **Database**: PostgreSQL (Neon/Prisma Postgres)
- **Authentication**: JWT
- **File Upload**: Cloudinary
- **Real-time**: Socket.io
- **Email**: Nodemailer
- **SMS**: Twilio

## 📄 License

ISC

