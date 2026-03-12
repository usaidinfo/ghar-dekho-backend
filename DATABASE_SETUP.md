# Database Connection String Setup

## ✅ Which Connection String to Use?

**Use this one (POOLED connection):**
```
DATABASE_URL="postgresql://neondb_owner:npg_n4mxIwtzrF0u@ep-tiny-rain-a19mt7ko-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
```

### Why the Pooled Connection?
- ✅ **Recommended by Neon** for most uses
- ✅ Uses **pgbouncer** for better connection management
- ✅ **More efficient** for serverless/cloud environments
- ✅ **Works perfectly with Prisma** migrations and queries
- ✅ **Better performance** under load

### When to Use Unpooled?
Only use the unpooled connection if you encounter specific connection issues during migrations. For 99% of cases, the pooled connection works perfectly.

---

## 📝 How to Set It Up

### Step 1: Create `.env` file

Navigate to your backend folder:
```bash
cd "ghar-dekho-backend"
```

Create a `.env` file in the `ghar-dekho-backend` folder (same level as `package.json`).

### Step 2: Add This Content to `.env`

Copy and paste this into your `.env` file:

```env
# ============================================
# DATABASE CONNECTION
# ============================================
DATABASE_URL="postgresql://neondb_owner:npg_n4mxIwtzrF0u@ep-tiny-rain-a19mt7ko-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"

# ============================================
# JWT AUTHENTICATION
# ============================================
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-min-32-characters-long
JWT_EXPIRES_IN=7d

# ============================================
# SERVER CONFIGURATION
# ============================================
PORT=5000
NODE_ENV=development

# ============================================
# OTP SERVICES (Twilio) - Add later
# ============================================
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number

# ============================================
# EMAIL SERVICE (SMTP) - Add later
# ============================================
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
EMAIL_FROM=noreply@ghardekho.com

# ============================================
# CLOUDINARY (Image/Video Uploads) - Add later
# ============================================
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# ============================================
# GOOGLE MAPS API - Add later
# ============================================
GOOGLE_MAPS_API_KEY=your_google_maps_api_key

# ============================================
# FRONTEND URL
# ============================================
FRONTEND_URL=http://localhost:3000

# ============================================
# RATE LIMITING
# ============================================
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### Step 3: Important Notes

1. **Keep the quotes** around the DATABASE_URL - they're important!
2. **Change JWT_SECRET** - Generate a random string (at least 32 characters)
3. **Other API keys** - You can add them later when needed
4. **Never commit `.env`** - It's already in `.gitignore`

---

## 🚀 Next Steps After Setting Up .env

Once your `.env` file is created with the DATABASE_URL:

```bash
# 1. Generate Prisma Client
npm run prisma:generate

# 2. Run migrations to create all tables
npm run prisma:migrate
# When prompted, enter: init

# 3. (Optional) Seed database
npm run prisma:seed

# 4. Start server
npm run dev
```

---

## 🔍 Connection String Breakdown

Your connection string:
```
postgresql://neondb_owner:npg_n4mxIwtzrF0u@ep-tiny-rain-a19mt7ko-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
```

- **Protocol**: `postgresql://`
- **User**: `neondb_owner`
- **Password**: `npg_n4mxIwtzrF0u`
- **Host**: `ep-tiny-rain-a19mt7ko-pooler.ap-southeast-1.aws.neon.tech` (pooler = pooled connection)
- **Database**: `neondb`
- **SSL**: `sslmode=require` (required for Neon)

---

## ⚠️ Troubleshooting

### If migrations fail with pooled connection:

Temporarily switch to unpooled for migrations only:
```env
DATABASE_URL="postgresql://neondb_owner:npg_n4mxIwtzrF0u@ep-tiny-rain-a19mt7ko.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
```

Then switch back to pooled after migration completes.

### Connection timeout errors:

Add connection timeout parameter:
```env
DATABASE_URL="postgresql://neondb_owner:npg_n4mxIwtzrF0u@ep-tiny-rain-a19mt7ko-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&connect_timeout=15"
```

---

## ✅ Verification

After setup, test the connection:

```bash
npm run prisma:studio
```

This should open Prisma Studio and connect to your database. If it works, your connection is set up correctly!

