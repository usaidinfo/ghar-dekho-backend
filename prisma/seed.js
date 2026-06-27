// Ghar Dekho - Database Seed Script
// Run: npm run prisma:seed

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // ============================================================
  // 1. DEFAULT AMENITIES
  // ============================================================
  const amenities = [
    // BASIC
    { name: 'Lift / Elevator',     category: 'BASIC',         icon: '🛗' },
    { name: 'Power Backup',        category: 'BASIC',         icon: '⚡' },
    { name: '24x7 Water Supply',   category: 'BASIC',         icon: '💧' },
    { name: 'Gas Pipeline',        category: 'BASIC',         icon: '🔥' },
    { name: 'Intercom',            category: 'BASIC',         icon: '📞' },
    // SECURITY
    { name: 'Security / Guard',    category: 'SECURITY',      icon: '🔒' },
    { name: 'CCTV Cameras',        category: 'SECURITY',      icon: '📹' },
    { name: 'Video Doorbell',      category: 'SECURITY',      icon: '🔔' },
    { name: 'Gated Community',     category: 'SECURITY',      icon: '🚪' },
    { name: 'Fire Safety',         category: 'SECURITY',      icon: '🧯' },
    // PARKING
    { name: 'Covered Parking',     category: 'PARKING',       icon: '🚗' },
    { name: 'Open Parking',        category: 'PARKING',       icon: '🅿️' },
    { name: 'Two-Wheeler Parking', category: 'PARKING',       icon: '🛵' },
    { name: 'EV Charging',         category: 'PARKING',       icon: '⚡' },
    // LIFESTYLE
    { name: 'Swimming Pool',       category: 'LIFESTYLE',     icon: '🏊' },
    { name: 'Garden / Terrace',    category: 'LIFESTYLE',     icon: '🌳' },
    { name: 'Rooftop Lounge',      category: 'LIFESTYLE',     icon: '🏙️' },
    { name: 'Jogging Track',       category: 'LIFESTYLE',     icon: '🏃' },
    { name: 'Yoga / Meditation',   category: 'LIFESTYLE',     icon: '🧘' },
    { name: 'BBQ Area',            category: 'LIFESTYLE',     icon: '🍖' },
    // HEALTH
    { name: 'Gym / Fitness',       category: 'HEALTH',        icon: '💪' },
    { name: 'Sports Court',        category: 'HEALTH',        icon: '🏸' },
    { name: 'Cycling Track',       category: 'HEALTH',        icon: '🚴' },
    // ENTERTAINMENT
    { name: 'Clubhouse',           category: 'ENTERTAINMENT', icon: '🏢' },
    { name: 'Mini Theatre',        category: 'ENTERTAINMENT', icon: '🎬' },
    { name: 'Gaming Zone',         category: 'ENTERTAINMENT', icon: '🎮' },
    { name: 'Library',             category: 'ENTERTAINMENT', icon: '📚' },
    // CONNECTIVITY
    { name: 'WiFi',                category: 'CONNECTIVITY',  icon: '📶' },
    { name: 'High-Speed Internet', category: 'CONNECTIVITY',  icon: '🌐' },
    // KIDS
    { name: 'Kids Play Area',      category: 'KIDS',          icon: '🛝' },
    { name: 'Kids Pool',           category: 'KIDS',          icon: '🧒' },
    // PET FRIENDLY
    { name: 'Pet Friendly',        category: 'PET_FRIENDLY',  icon: '🐾' },
    { name: 'Pet Play Area',       category: 'PET_FRIENDLY',  icon: '🐶' },
  ];

  for (const amenity of amenities) {
    await prisma.amenity.upsert({
      where: { name: amenity.name },
      update: {},
      create: amenity,
    });
  }
  console.log(`✅ ${amenities.length} amenities seeded`);

  // ============================================================
  // 2. SUBSCRIPTION PLANS (aligned with mobile membership tiers)
  // ============================================================
  const plans = [
    {
      name: 'Owner Basic',
      description: 'List 1 property with up to 10 photos.',
      planType: 'BASIC',
      accountType: 'OWNER',
      planTier: 'BASIC',
      duration: 30,
      price: 499,
      maxListings: 1,
      maxFeatured: 0,
      maxBoosts: 0,
      sortOrder: 1,
      features: { maxPhotos: 10, maxVideos: 0, visibleContact: true, basicSupport: true },
    },
    {
      name: 'Owner Medium',
      description: '3 listings, 20 photos, 1 video, top search placement.',
      planType: 'MEDIUM',
      accountType: 'OWNER',
      planTier: 'MEDIUM',
      duration: 30,
      price: 999,
      maxListings: 3,
      maxFeatured: 0,
      maxBoosts: 0,
      sortOrder: 2,
      features: { maxPhotos: 20, maxVideos: 1, topSearch: true, prioritySupport: true },
    },
    {
      name: 'Owner Premium',
      description: '5 listings, 30 photos, 2 videos, featured listing.',
      planType: 'PREMIUM',
      accountType: 'OWNER',
      planTier: 'PREMIUM',
      duration: 30,
      price: 1499,
      maxListings: 5,
      maxFeatured: 1,
      maxBoosts: 0,
      hasVerifiedBadge: true,
      sortOrder: 3,
      features: { maxPhotos: 30, maxVideos: 2, topSearch: true, featuredListing: true, prioritySupport: true },
    },
    {
      name: 'Broker Basic',
      description: '5 active listings with lead inbox.',
      planType: 'BASIC',
      accountType: 'BROKER',
      planTier: 'BASIC',
      duration: 30,
      price: 999,
      maxListings: 5,
      sortOrder: 4,
      features: { maxPhotos: 20, maxVideos: 0, leadInbox: true, basicAnalytics: true },
    },
    {
      name: 'Broker Medium',
      description: '15 listings, verified badge, 1 boost per month.',
      planType: 'MEDIUM',
      accountType: 'BROKER',
      planTier: 'MEDIUM',
      duration: 30,
      price: 1999,
      maxListings: 15,
      maxBoosts: 1,
      hasVerifiedBadge: true,
      hasAnalytics: true,
      sortOrder: 5,
      features: { maxPhotos: 25, maxVideos: 1, leadDashboard: true, prioritySupport: true },
    },
    {
      name: 'Broker Premium',
      description: 'Unlimited listings, team access, 3 boosts per month.',
      planType: 'PREMIUM',
      accountType: 'BROKER',
      planTier: 'PREMIUM',
      duration: 30,
      price: 2999,
      maxListings: -1,
      maxBoosts: 3,
      maxTeamMembers: 5,
      hasVerifiedBadge: true,
      hasAnalytics: true,
      sortOrder: 6,
      features: { maxPhotos: 30, maxVideos: 2, featuredListing: true, teamAccess: true },
    },
    {
      name: 'Builder Basic',
      description: '1 project listing with up to 25 photos.',
      planType: 'BASIC',
      accountType: 'BUILDER',
      planTier: 'BASIC',
      duration: 30,
      price: 1999,
      maxListings: 1,
      sortOrder: 7,
      features: { maxPhotos: 25, maxVideos: 0, brochureUpload: true },
    },
    {
      name: 'Builder Medium',
      description: '3 projects, video tour, featured project slot.',
      planType: 'MEDIUM',
      accountType: 'BUILDER',
      planTier: 'MEDIUM',
      duration: 30,
      price: 4999,
      maxListings: 3,
      maxFeatured: 1,
      hasAnalytics: true,
      sortOrder: 8,
      features: { maxPhotos: 30, maxVideos: 1, virtualTour: true, featuredListing: true, leadManagement: true },
    },
    {
      name: 'Builder Premium',
      description: '10 projects, homepage featured placement.',
      planType: 'PREMIUM',
      accountType: 'BUILDER',
      planTier: 'PREMIUM',
      duration: 30,
      price: 9999,
      maxListings: 10,
      maxFeatured: 3,
      maxBoosts: -1,
      hasAnalytics: true,
      sortOrder: 9,
      features: { maxPhotos: 40, maxVideos: 3, homepageFeatured: true, dedicatedManager: true },
    },
  ];

  for (const plan of plans) {
    await prisma.subscriptionPlan.upsert({
      where: { name: plan.name },
      update: plan,
      create: plan,
    });
  }
  console.log(`✅ ${plans.length} subscription plans seeded`);

  // ============================================================
  // 3. SYSTEM CONFIG
  // ============================================================
  const configs = [
    { key: 'platform_name',                   value: '"Ghar Dekho"',    description: 'Platform display name' },
    { key: 'platform_tagline',                value: '"Ghar Dekho, Sahi Ghar Chuno"', description: 'Platform tagline' },
    { key: 'support_email',                   value: '"support@ghardekho.com"', description: 'Support email' },
    { key: 'support_phone',                   value: '"+911800000000"', description: 'Support phone' },
    { key: 'max_property_images',             value: 20,  description: 'Max images per property' },
    { key: 'max_property_videos',             value: 5,   description: 'Max videos per property' },
    { key: 'property_listing_duration_days',  value: 90,  description: 'Default listing duration (days)' },
    { key: 'featured_listing_duration_days',  value: 30,  description: 'Featured listing duration (days)' },
    { key: 'boost_duration_days',             value: 7,   description: 'Boost listing duration (days)' },
    { key: 'otp_expiry_minutes',              value: 10,  description: 'OTP expiry time in minutes' },
    { key: 'max_wishlist_items',              value: 200, description: 'Max wishlist items per user' },
    { key: 'max_comparison_properties',       value: 4,   description: 'Max properties in one comparison' },
    { key: 'commission_rate_percent',         value: 2,   description: 'Platform commission rate %' },
    { key: 'ai_price_prediction_enabled',     value: true, description: 'Toggle AI price prediction' },
    { key: 'ghar_advisor_enabled',            value: true, description: 'Toggle Ghar Advisor AI chatbot' },
    { key: 'min_images_for_listing',          value: 3,   description: 'Minimum images required to post' },
  ];

  for (const config of configs) {
    const val = typeof config.value === 'string' && config.value.startsWith('"')
      ? config.value.slice(1, -1) // strip manual quotes for JSON string
      : config.value;

    await prisma.systemConfig.upsert({
      where: { key: config.key },
      update: {},
      create: {
        key: config.key,
        value: val,
        description: config.description,
      },
    });
  }
  console.log(`✅ ${configs.length} system configs seeded`);

  // ============================================================
  // 4. TRENDING AREAS (sample)
  // ============================================================
  const trendingAreas = [
    { locality: 'Baner',         city: 'Pune',      state: 'Maharashtra', trendScore: 9.2, displayOrder: 1 },
    { locality: 'Hinjewadi',     city: 'Pune',      state: 'Maharashtra', trendScore: 9.0, displayOrder: 2 },
    { locality: 'Whitefield',    city: 'Bengaluru', state: 'Karnataka',   trendScore: 8.8, displayOrder: 3 },
    { locality: 'Gurgaon Sector 82', city: 'Gurugram', state: 'Haryana', trendScore: 8.7, displayOrder: 4 },
    { locality: 'Powai',         city: 'Mumbai',    state: 'Maharashtra', trendScore: 8.5, displayOrder: 5 },
    { locality: 'Kondapur',      city: 'Hyderabad', state: 'Telangana',   trendScore: 8.3, displayOrder: 6 },
    { locality: 'New Town',      city: 'Kolkata',   state: 'West Bengal', trendScore: 8.0, displayOrder: 7 },
    { locality: 'Gomti Nagar',   city: 'Lucknow',   state: 'Uttar Pradesh', trendScore: 7.8, displayOrder: 8 },
  ];

  for (const area of trendingAreas) {
    await prisma.trendingArea.upsert({
      where: { locality_city: { locality: area.locality, city: area.city } },
      update: { trendScore: area.trendScore },
      create: area,
    });
  }
  console.log(`✅ ${trendingAreas.length} trending areas seeded`);

  console.log('\n🎉 Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
