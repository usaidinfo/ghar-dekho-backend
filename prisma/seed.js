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
  // 2. SUBSCRIPTION PLANS
  // ============================================================
  const plans = [
    {
      name: 'Basic',
      description: 'Free plan for individual owners. List up to 5 properties.',
      planType: 'BASIC',
      duration: 90,
      price: 0,
      maxListings: 5,
      maxFeatured: 0,
      maxBoosts: 0,
      maxTeamMembers: 0,
      hasAnalytics: false,
      hasVerifiedBadge: false,
      hasEarlyLeads: false,
      hasAIMatchmaking: false,
      sortOrder: 1,
      features: {
        listProperties: true,
        basicChat: true,
        wishlist: true,
        propertyComparison: true,
      },
    },
    {
      name: 'Premium',
      description: 'For serious owners/sellers. Feature your listings and get analytics.',
      planType: 'PREMIUM',
      duration: 30,
      price: 999,
      maxListings: 50,
      maxFeatured: 5,
      maxBoosts: 3,
      maxTeamMembers: 0,
      hasAnalytics: true,
      hasVerifiedBadge: true,
      hasEarlyLeads: false,
      hasAIMatchmaking: false,
      sortOrder: 2,
      features: {
        listProperties: true,
        featuredListings: true,
        boostListings: true,
        analytics: true,
        verifiedBadge: true,
        prioritySupport: true,
      },
    },
    {
      name: 'Agent Basic',
      description: 'Essential tools for individual agents.',
      planType: 'AGENT_BASIC',
      duration: 30,
      price: 1999,
      maxListings: 100,
      maxFeatured: 10,
      maxBoosts: 5,
      maxTeamMembers: 2,
      hasAnalytics: true,
      hasVerifiedBadge: true,
      hasEarlyLeads: false,
      hasAIMatchmaking: false,
      sortOrder: 3,
      features: {
        listProperties: true,
        featuredListings: true,
        boostListings: true,
        analytics: true,
        verifiedBadge: true,
        leadManagement: true,
        teamMembers: true,
        prioritySupport: true,
      },
    },
    {
      name: 'Agent Premium',
      description: 'Full-featured plan for agencies. Unlimited listings + AI matching.',
      planType: 'AGENT_PREMIUM',
      duration: 30,
      price: 4999,
      maxListings: -1,    // unlimited
      maxFeatured: -1,
      maxBoosts: -1,
      maxTeamMembers: 10,
      hasAnalytics: true,
      hasVerifiedBadge: true,
      hasEarlyLeads: true,
      hasAIMatchmaking: true,
      sortOrder: 4,
      features: {
        listProperties: true,
        unlimitedListings: true,
        featuredListings: true,
        boostListings: true,
        analytics: true,
        advancedAnalytics: true,
        verifiedBadge: true,
        leadManagement: true,
        teamMembers: true,
        earlyLeadAccess: true,
        aiMatchmaking: true,
        dedicatedSupport: true,
      },
    },
    {
      name: 'Agent Enterprise',
      description: 'For large agencies with 10+ team members and enterprise needs.',
      planType: 'AGENT_ENTERPRISE',
      duration: 30,
      price: 9999,
      maxListings: -1,
      maxFeatured: -1,
      maxBoosts: -1,
      maxTeamMembers: -1, // unlimited
      hasAnalytics: true,
      hasVerifiedBadge: true,
      hasEarlyLeads: true,
      hasAIMatchmaking: true,
      sortOrder: 5,
      features: {
        listProperties: true,
        unlimitedListings: true,
        featuredListings: true,
        boostListings: true,
        analytics: true,
        advancedAnalytics: true,
        verifiedBadge: true,
        leadManagement: true,
        teamMembers: true,
        unlimitedTeamMembers: true,
        earlyLeadAccess: true,
        aiMatchmaking: true,
        whiteLabel: true,
        dedicatedAccountManager: true,
        customReports: true,
      },
    },
  ];

  for (const plan of plans) {
    await prisma.subscriptionPlan.upsert({
      where: { name: plan.name }, // ✅ uses @unique name field
      update: {},
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
