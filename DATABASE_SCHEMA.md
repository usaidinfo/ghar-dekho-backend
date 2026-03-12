# Ghar Dekho - Complete Database Schema Reference

## 📊 Schema Overview

This document provides a quick reference to all database models and their relationships.

## 🔐 Authentication & User Management

### User
- Core user model with email/phone authentication
- Supports multiple roles: USER, AGENT, ADMIN, SUPER_ADMIN
- Profile types: OWNER, AGENT, BROKER, BUYER, RENTER
- KYC verification support
- Relations: Profile, OTP, Properties, Wishlists, Chats, etc.

### Profile
- Extended user profile information
- Personal details, address, bio
- One-to-one with User

### OTPVerification
- OTP storage for email/phone verification
- Login and password reset OTPs
- Auto-expiring tokens

## 🏠 Property Models

### Property
- **Main property listing model**
- Supports all types: FLAT, APARTMENT, VILLA, HOUSE, PLOT, COMMERCIAL, OFFICE, SHOP, PG, CO_LIVING
- Listing types: BUY, RENT, PG, LEASE
- Complete location data (lat/lng, address, locality)
- Property details (BHK, area, furnishing, age, etc.)
- PG-specific fields (beds, food menu, house rules)
- Commercial-specific fields (shop area, office area)
- Status tracking (ACTIVE, SOLD, RENTED, etc.)
- Verification flags (RERA, NOC, Approved Maps)
- AI features (suggested price, locality score, safety score)
- Relations: Images, Videos, Tours, Amenities, Views, Leads, etc.

### PropertyImage
- Multiple images per property
- Primary image flag
- Ordering support
- Thumbnail URLs

### PropertyVideo
- Video tours
- Duration tracking
- Primary video flag

### VirtualTour
- 360° virtual tours
- AR views
- Video tours

### FloorPlan
- Floor plan images
- Multi-floor support
- Descriptions

### Amenity & PropertyAmenity
- Reusable amenities catalog
- Categories: BASIC, LIFESTYLE, SECURITY, PARKING, etc.
- Many-to-many with Property

### NearbyEssential
- Nearby places (schools, hospitals, markets)
- Distance tracking
- Ratings
- Location coordinates

## 👥 User Interaction Models

### Wishlist
- Save properties
- User notes
- One-to-many per user

### PropertyView
- Track property views
- View duration
- Source tracking (search, featured, map)

### PropertyComparison
- Side-by-side comparison
- Multiple properties per comparison
- Custom comparison names

### SavedSearch
- Save search filters
- Active/inactive status
- JSON filter storage
- Alert triggers

## 💬 Communication Models

### ChatSession
- One-to-one chat sessions
- Property-linked chats
- Last message tracking

### Message
- Text, image, video, document messages
- Read receipts
- Timestamps

### Meeting
- Property visit scheduling
- Meeting types: IN_PERSON, VIDEO_CALL, PHONE_CALL
- Status tracking
- Reminder system

## 🏢 Agent/Broker Models

### AgentProfile
- Agent-specific profile
- Agency information
- License numbers
- Ratings and reviews
- Subscription status
- Verification badges
- Performance metrics

### TeamMember
- Agency team management
- Role-based permissions
- Multi-agent support

### LeadManagement
- Lead tracking system
- Source tracking
- Status workflow (NEW → CONTACTED → CONVERTED)
- Priority levels
- Follow-up scheduling

## 💳 Subscription Models

### SubscriptionPlan
- Multiple plan types
- Features stored as JSON
- Pricing and duration

### Subscription
- User subscriptions
- Auto-renewal
- Payment tracking
- Status management

## 🔔 Notification Models

### Notification
- In-app notifications
- Multiple types (price drop, new property, messages, etc.)
- Read/unread status

### PriceAlert
- Price drop monitoring
- Target price tracking
- Trigger notifications

### NewPropertyAlert
- New listing alerts
- Based on saved searches
- Locality-based alerts

## ⭐ Review & Rating Models

### Review
- User-to-user reviews
- Property reviews
- Rating (1-5 stars)
- Comments and titles
- Helpful count
- Verification status

## 📈 Analytics Models

### UserAnalytics
- Daily user activity
- Properties viewed
- Searches performed
- Leads generated

### AgentAnalytics
- Agent performance metrics
- Properties listed
- Views, leads, conversions
- Revenue tracking

### PropertyAnalytics
- Property performance
- Daily views and leads
- Engagement metrics

## 💰 Pricing Models

### PriceHistory
- Track price changes
- Historical data
- Change reasons

## 👨‍💼 Admin Models

### AdminAction
- Audit trail
- All admin actions logged
- Target tracking

### SystemConfig
- Key-value configuration
- Platform settings
- Dynamic configuration

### FraudDetection
- Fraud monitoring
- Severity levels
- Status workflow
- Evidence storage

## 📄 Legal Models

### LegalDocument
- Document storage
- Verification status
- Expiration tracking
- Multiple document types

### RentAgreement
- Rental agreements
- Digital signatures
- Status tracking
- Terms and conditions

## 🗺️ Location Models

### LocalityData
- Locality information
- Safety scores
- Investment scores
- Crime rates
- Average prices
- Growth rates
- Amenity scores

### CommuteTime
- Commute calculations
- Multiple modes (driving, transit, walking)
- Distance and time

## 🔗 Key Relationships

```
User
├── Profile (1:1)
├── Properties (1:many)
├── Wishlists (1:many)
├── ChatSessions (many:many)
├── AgentProfile (1:1, if agent)
└── Subscriptions (1:many)

Property
├── Images (1:many)
├── Videos (1:many)
├── VirtualTours (1:many)
├── FloorPlans (1:many)
├── Amenities (many:many)
├── NearbyEssentials (1:many)
├── Views (1:many)
├── Wishlists (many:many)
└── Leads (1:many)

AgentProfile
├── TeamMembers (1:many)
├── Leads (1:many)
└── Analytics (1:many)
```

## 📝 Important Enums

- **UserRole**: USER, AGENT, ADMIN, SUPER_ADMIN
- **ProfileType**: OWNER, AGENT, BROKER, BUYER, RENTER
- **PropertyType**: FLAT, APARTMENT, VILLA, HOUSE, PLOT, COMMERCIAL, etc.
- **ListingType**: BUY, RENT, PG, LEASE
- **FurnishingType**: FURNISHED, SEMI_FURNISHED, UNFURNISHED
- **PropertyStatus**: ACTIVE, INACTIVE, SOLD, RENTED, etc.
- **LeadStatus**: NEW, CONTACTED, INTERESTED, CONVERTED, etc.
- **MeetingStatus**: SCHEDULED, CONFIRMED, COMPLETED, etc.

## 🎯 Indexes

All models have appropriate indexes for:
- Foreign keys
- Frequently queried fields
- Search fields (full-text on Property)
- Date ranges
- Status fields

## ✅ Features Coverage

- ✅ All 18 feature categories covered
- ✅ All property types supported
- ✅ Complete user roles and permissions
- ✅ Full media support
- ✅ Advanced search capabilities
- ✅ Real-time communication
- ✅ Agent management
- ✅ Subscription system
- ✅ Analytics and reporting
- ✅ Admin panel support
- ✅ Fraud detection
- ✅ Legal document management

