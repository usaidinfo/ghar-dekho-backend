import prisma from '../config/database.js';
import { success, error, paginated } from '../utils/response.js';
import { getPagination, getPropertySort } from '../utils/pagination.js';
import { uploadToCloudinary, deleteFromCloudinary, uploadMultipleImages } from '../services/cloudinary.service.js';

/** Prisma `CommercialType` — must match schema exactly */
const COMMERCIAL_TYPES = [
  'OFFICE',
  'SHOP',
  'SHOWROOM',
  'WAREHOUSE',
  'RESTAURANT',
  'HOTEL',
  'INDUSTRIAL',
  'OTHER',
];

/**
 * @returns {{ value: string|null, error: string|null }}
 */
function normalizeCommercialTypeInput(raw) {
  if (raw == null || raw === '') return { value: null, error: null };
  let v = String(raw).trim().toUpperCase().replace(/-/g, '_');
  if (v === 'OFFICE_SPACE' || v === 'OFFICESPACE') v = 'OFFICE';
  if (COMMERCIAL_TYPES.includes(v)) return { value: v, error: null };
  return {
    value: null,
    error: `Invalid commercialType "${raw}". Allowed: ${COMMERCIAL_TYPES.join(', ')}`,
  };
}

/** Mobile list form sends short slugs; DB `Amenity.name` matches seed in `prisma/seed.js`. */
const AMENITY_SLUG_TO_NAME = {
  parking:  'Covered Parking',
  gym:      'Gym / Fitness',
  lift:     'Lift / Elevator',
  pool:     'Swimming Pool',
  security: 'Security / Guard',
  backup:   'Power Backup',
};

async function resolveAmenityIdsFromSlugs(slugs) {
  if (!Array.isArray(slugs) || !slugs.length) return [];
  const names = [
    ...new Set(
      slugs
        .map((s) => AMENITY_SLUG_TO_NAME[String(s).trim()])
        .filter(Boolean),
    ),
  ];
  if (!names.length) return [];
  const rows = await prisma.amenity.findMany({ where: { name: { in: names } } });
  return rows.map((r) => r.id);
}

// ─── Shared property select fields ───────────────────────────
const PROPERTY_LIST_SELECT = {
  id:           true,
  title:        true,
  price:        true,
  originalPrice:true,
  currency:     true,
  propertyType: true,
  listingType:  true,
  category:     true,
  bhk:          true,
  carpetArea:   true,
  builtUpArea:  true,
  city:         true,
  locality:     true,
  address:      true,
  latitude:     true,
  longitude:    true,
  furnishing:   true,
  isVerified:   true,
  isFeatured:   true,
  isBoosted:    true,
  isOwnerListing:true,
  viewCount:    true,
  popularityScore:true,
  postedAt:     true,
  status:       true,
  images: {
    where:  { isPrimary: true },
    take:   1,
    select: { imageUrl: true, thumbnailUrl: true },
  },
  owner: {
    select: {
      id:      true,
      profile: { select: { firstName: true, lastName: true, profileImage: true } },
    },
  },
};

const PROPERTY_DETAIL_SELECT = {
  ...PROPERTY_LIST_SELECT,
  description:      true,
  bedrooms:         true,
  bathrooms:        true,
  balconies:        true,
  superBuiltUpArea: true,
  plotArea:         true,
  floorNumber:      true,
  totalFloors:      true,
  facing:           true,
  ageOfProperty:    true,
  availableFrom:    true,
  deposit:          true,
  monthlyRent:      true,
  weeklyRent:       true,
  maintenanceCharges:true,
  pgType:           true,
  availableBeds:    true,
  totalBeds:        true,
  foodIncluded:     true,
  foodMenu:         true,
  houseRules:       true,
  checkInTimings:   true,
  checkOutTimings:  true,
  isRERAApproved:   true,
  reraNumber:       true,
  hasNOC:           true,
  hasApprovedMaps:  true,
  possessionStatus: true,
  googlePlaceId:    true,
  landmark:         true,
  pincode:          true,
  state:            true,
  aiSuggestedPrice: true,
  localityScore:    true,
  safetyScore:      true,
  investmentScore:  true,
  rentalYield:      true,
  pricePerSqft:     true,
  leadCount:        true,
  shareCount:       true,
  autoRenew:        true,
  expiresAt:        true,
  createdAt:        true,
  updatedAt:        true,
  images:           { orderBy: { order: 'asc' } },
  videos:           true,
  virtualTours:     true,
  floorPlans:       true,
  amenities: {
    include: {
      amenity: { select: { id: true, name: true, icon: true, category: true } },
    },
  },
  nearbyEssentials: true,
  commuteData:      true,
  owner: {
    select: {
      id:          true,
      phone:       true,
      email:       true,
      profileType: true,
      profile:     { select: { firstName: true, lastName: true, profileImage: true, city: true } },
      agentProfile:{
        select: {
          agencyName:    true,
          rating:        true,
          totalReviews:  true,
          isVerified:    true,
          verifiedBadge: true,
          experience:    true,
          languages:     true,
        },
      },
    },
  },
  priceHistory: { orderBy: { changedAt: 'desc' }, take: 10 },
  _count: {
    select: {
      wishlists:   true,
      reviews:     true,
      chatSessions:true,
    },
  },
};

// ─── Build WHERE clause from filters ─────────────────────────
const buildPropertyFilters = (query) => {
  const {
    listingType, propertyType, category, city, locality, state,
    minPrice, maxPrice, bhk, furnishing, minArea, maxArea,
    ageOfProperty, isVerified, isOwnerListing, possessionStatus,
    isRERAApproved, isFeatured, pgType, status = 'ACTIVE',
  } = query;

  const where = {
    ...(status        && { status }),
    ...(listingType   && { listingType }),
    ...(propertyType  && { propertyType }),
    ...(category      && { category }),
    ...(city          && { city: { contains: city, mode: 'insensitive' } }),
    ...(locality      && { locality: { contains: locality, mode: 'insensitive' } }),
    ...(state         && { state: { contains: state, mode: 'insensitive' } }),
    ...(isVerified    === 'true'  && { isVerified: true }),
    ...(isOwnerListing === 'true' && { isOwnerListing: true }),
    ...(isOwnerListing === 'false'&& { isOwnerListing: false }),
    ...(isFeatured    === 'true'  && { isFeatured: true }),
    ...(isRERAApproved=== 'true'  && { isRERAApproved: true }),
    ...(possessionStatus && { possessionStatus }),
    ...(pgType        && { pgType }),
    ...(bhk           && { bhk: { in: bhk.split(',').map(Number) } }),
    ...(furnishing    && { furnishing: { in: furnishing.split(',') } }),
    ...((minPrice || maxPrice) && {
      price: {
        ...(minPrice && { gte: Number(minPrice) }),
        ...(maxPrice && { lte: Number(maxPrice) }),
      },
    }),
    ...((minArea || maxArea) && {
      builtUpArea: {
        ...(minArea && { gte: Number(minArea) }),
        ...(maxArea && { lte: Number(maxArea) }),
      },
    }),
    ...(ageOfProperty && { ageOfProperty: { lte: Number(ageOfProperty) } }),
  };

  return where;
};

// ─── GET All Properties ───────────────────────────────────────
export const getProperties = async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const orderBy = getPropertySort(req.query.sort);
    const where   = buildPropertyFilters(req.query);

    const [properties, total] = await Promise.all([
      prisma.property.findMany({ where, orderBy, skip, take: limit, select: PROPERTY_LIST_SELECT }),
      prisma.property.count({ where }),
    ]);

    return res.json(paginated(properties, total, page, limit));
  } catch (err) {
    console.error('getProperties error:', err);
    return res.status(500).json(error('Failed to fetch properties.'));
  }
};

// ─── GET Featured Properties ──────────────────────────────────
export const getFeaturedProperties = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || '10');
    const [featured, hotDeals] = await Promise.all([
      prisma.property.findMany({
        where:   { status: 'ACTIVE', isFeatured: true },
        orderBy: { popularityScore: 'desc' },
        take:    limit,
        select:  PROPERTY_LIST_SELECT,
      }),
      prisma.hotDeal.findMany({
        where:   { isActive: true, validUntil: { gt: new Date() } },
        orderBy: { displayOrder: 'asc' },
        take:    5,
        include: {
          property: { select: PROPERTY_LIST_SELECT },
        },
      }),
    ]);
    return res.json(success({ featured, hotDeals }));
  } catch (err) {
    console.error('getFeaturedProperties error:', err);
    return res.status(500).json(error('Failed to fetch featured properties.'));
  }
};

// ─── GET Trending Areas ───────────────────────────────────────
export const getTrendingAreas = async (req, res) => {
  try {
    const areas = await prisma.trendingArea.findMany({
      where:   { isActive: true },
      orderBy: { displayOrder: 'asc' },
      take:    10,
    });
    return res.json(success(areas));
  } catch (err) {
    console.error('getTrendingAreas error:', err);
    return res.status(500).json(error('Failed to fetch trending areas.'));
  }
};

// ─── GET Single Property ──────────────────────────────────────
export const getPropertyById = async (req, res) => {
  try {
    const property = await prisma.property.findUnique({
      where:  { id: req.params.id },
      select: PROPERTY_DETAIL_SELECT,
    });

    if (!property) return res.status(404).json(error('Property not found.'));

    // Track view
    await prisma.property.update({
      where: { id: req.params.id },
      data:  { viewCount: { increment: 1 } },
    });

    if (req.user) {
      await prisma.propertyView.create({
        data: {
          userId:     req.user.id,
          propertyId: req.params.id,
          source:     req.query.source || 'direct',
        },
      }).catch(() => {}); // don't fail on duplicate
    }

    return res.json(success(property));
  } catch (err) {
    console.error('getPropertyById error:', err);
    return res.status(500).json(error('Failed to fetch property.'));
  }
};

// ─── CREATE Property ──────────────────────────────────────────
export const createProperty = async (req, res) => {
  try {
    const {
      title, description, propertyType, listingType, category,
      price, priceNegotiable, isPriceNegotiable, address, city, state, pincode,
      locality, landmark, latitude, longitude, googlePlaceId,
      bhk, bedrooms, bathrooms, balconies, carpetArea, builtUpArea,
      superBuiltUpArea, plotArea, floorNumber, floor, totalFloors,
      facing, ageOfProperty, furnishing, availableFrom,
      deposit, monthlyRent, weeklyRent, maintenanceCharges,
      pgType, availableBeds, totalBeds, foodIncluded,
      foodMenu, houseRules, checkInTimings, checkOutTimings,
      commercialType, shopArea, officeArea, parkingSpaces,
      isRERAApproved, reraNumber, hasNOC, hasApprovedMaps,
      possessionStatus, autoRenew, amenityIds,
      status: statusBody,
    } = req.body;

    const ALLOWED_STATUS = new Set([
      'DRAFT', 'ACTIVE', 'INACTIVE', 'SOLD', 'RENTED',
      'UNDER_VERIFICATION', 'REJECTED', 'EXPIRED',
    ]);
    const status = ALLOWED_STATUS.has(statusBody) ? statusBody : 'ACTIVE';

    let lat = latitude != null && String(latitude).trim() !== '' ? Number(latitude) : NaN;
    let lon = longitude != null && String(longitude).trim() !== '' ? Number(longitude) : NaN;
    if (status === 'DRAFT' && (!Number.isFinite(lat) || !Number.isFinite(lon))) {
      lat = 20.5937;
      lon = 78.9629;
    } else if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return res.status(400).json(error('Location coordinates (latitude/longitude) are required.'));
    }

    const commercialTypeNorm = normalizeCommercialTypeInput(commercialType);
    if (commercialTypeNorm.error) {
      return res.status(400).json(error(commercialTypeNorm.error));
    }

    const titleStr = String(title || '').trim();
    const descTrim = description != null ? String(description).trim() : '';
    const descFinal = descTrim || (status === 'DRAFT'
      ? `${titleStr || 'Listing'} — draft on GharDekho.`
      : '');

    const addressFinal = (address && String(address).trim())
      ? String(address).trim()
      : [locality, city].filter(Boolean).join(', ');

    let resolvedAmenityIds = Array.isArray(amenityIds) ? amenityIds.filter(Boolean) : [];
    let amenitySlugInput = req.body.amenitySlugs;
    if (typeof amenitySlugInput === 'string' && amenitySlugInput.trim()) {
      amenitySlugInput = amenitySlugInput.split(',').map((s) => String(s).trim()).filter(Boolean);
    }
    if (!resolvedAmenityIds.length && Array.isArray(amenitySlugInput)) {
      resolvedAmenityIds = await resolveAmenityIdsFromSlugs(amenitySlugInput);
    }

    const pNeg =
      priceNegotiable !== false &&
      priceNegotiable !== 'false' &&
      isPriceNegotiable !== false &&
      isPriceNegotiable !== 'false';

    const noc =
      hasNOC === true ||
      hasNOC === 'true' ||
      req.body.nocFromSociety === true ||
      req.body.nocFromSociety === 'true';
    const maps =
      hasApprovedMaps === true ||
      hasApprovedMaps === 'true' ||
      req.body.approvedMasterPlan === true ||
      req.body.approvedMasterPlan === 'true';

    const featured =
      req.body.isFeatured === true ||
      req.body.isFeatured === 'true' ||
      req.body.requestFeatured === true ||
      req.body.requestFeatured === 'true';

    const floorNum = floorNumber ?? floor;

    // Set listing duration
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 90); // 90 days default

    const property = await prisma.property.create({
      data: {
        ownerId:      req.user.id,
        isOwnerListing: req.user.profileType === 'OWNER' || req.user.profileType === 'BUYER',
        title:          titleStr,
        description:    descFinal || `${titleStr} — listing on GharDekho.`,
        propertyType, listingType,
        status,
        isFeatured: featured,
        category:     category || 'RESIDENTIAL',
        price:        Number(price),
        priceNegotiable: pNeg,
        originalPrice: Number(price),
        address:      addressFinal,
        city,
        state,
        pincode,
        locality,
        landmark, googlePlaceId,
        latitude:  lat,
        longitude: lon,
        bhk:       bhk          ? Number(bhk) : null,
        bedrooms:  bedrooms     ? Number(bedrooms) : null,
        bathrooms: bathrooms    ? Number(bathrooms) : null,
        balconies: balconies    ? Number(balconies) : null,
        carpetArea:      carpetArea      ? Number(carpetArea) : null,
        builtUpArea:     builtUpArea     ? Number(builtUpArea) : null,
        superBuiltUpArea:superBuiltUpArea? Number(superBuiltUpArea) : null,
        plotArea:        plotArea        ? Number(plotArea) : null,
        floorNumber:     floorNum != null && floorNum !== '' ? Number(floorNum) : null,
        totalFloors:     totalFloors     ? Number(totalFloors) : null,
        ageOfProperty:   ageOfProperty   ? Number(ageOfProperty) : null,
        parkingSpaces:   parkingSpaces   ? Number(parkingSpaces) : null,
        facing:          facing          || null,
        furnishing:      furnishing      || 'UNFURNISHED',
        availableFrom:   availableFrom   ? new Date(availableFrom) : null,
        deposit:         deposit         ? Number(deposit) : null,
        monthlyRent:     monthlyRent     ? Number(monthlyRent) : null,
        weeklyRent:      weeklyRent      ? Number(weeklyRent) : null,
        maintenanceCharges: maintenanceCharges ? Number(maintenanceCharges) : null,
        pgType:          pgType          || null,
        availableBeds:   availableBeds   ? Number(availableBeds) : null,
        totalBeds:       totalBeds       ? Number(totalBeds) : null,
        foodIncluded:    foodIncluded    ?? null,
        foodMenu, houseRules, checkInTimings, checkOutTimings,
        commercialType:  commercialTypeNorm.value,
        shopArea:        shopArea        ? Number(shopArea) : null,
        officeArea:      officeArea      ? Number(officeArea) : null,
        isRERAApproved:  isRERAApproved  === true || isRERAApproved === 'true',
        reraNumber:      reraNumber      || null,
        hasNOC:          noc,
        hasApprovedMaps: maps,
        possessionStatus:possessionStatus|| 'READY_TO_MOVE',
        autoRenew:       autoRenew       === true || autoRenew === 'true',
        expiresAt,
        ...(resolvedAmenityIds.length && {
          amenities: {
            create: resolvedAmenityIds.map((id) => ({ amenityId: id })),
          },
        }),
      },
      select: PROPERTY_DETAIL_SELECT,
    });

    // If images are provided in the same multipart request, upload + attach now.
    if (Array.isArray(req.files) && req.files.length) {
      try {
        const uploadResults = await uploadMultipleImages(req.files, 'property-images');
        await prisma.$transaction(
          uploadResults.map((result, idx) =>
            prisma.propertyImage.create({
              data: {
                propertyId:   property.id,
                imageUrl:     result.secure_url,
                thumbnailUrl: result.secure_url.replace('/upload/', '/upload/c_thumb,w_400/'),
                publicId:     result.public_id,
                isPrimary:    idx === 0,
                order:        idx,
                width:        result.width,
                height:       result.height,
                sizeBytes:    result.bytes,
              },
            }),
          ),
        );

        const withImages = await prisma.property.findUnique({
          where: { id: property.id },
          select: PROPERTY_DETAIL_SELECT,
        });

        return res
          .status(201)
          .json(success(withImages || property, 'Property listed successfully!'));
      } catch (imgErr) {
        // Rollback property if "all-in-one" create fails
        await prisma.property.delete({ where: { id: property.id } }).catch(() => {});
        console.error('createProperty image upload error:', imgErr);
        return res.status(500).json(error('Failed to upload images while creating property.'));
      }
    }

    return res.status(201).json(success(property, 'Property listed successfully!'));
  } catch (err) {
    console.error('createProperty error:', err);
    return res.status(500).json(error('Failed to create property listing.'));
  }
};

// ─── UPDATE Property ──────────────────────────────────────────
export const updateProperty = async (req, res) => {
  try {
    const existing = await prisma.property.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json(error('Property not found.'));
    if (existing.ownerId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json(error('Not authorized to edit this property.'));
    }

    const { amenityIds, ...updateData } = req.body;

    if (Object.prototype.hasOwnProperty.call(updateData, 'commercialType')) {
      const ct = normalizeCommercialTypeInput(updateData.commercialType);
      if (ct.error) return res.status(400).json(error(ct.error));
      updateData.commercialType = ct.value;
    }

    // Track price history if price changed
    if (updateData.price && Number(updateData.price) !== existing.price) {
      await prisma.priceHistory.create({
        data: {
          propertyId: existing.id,
          price:      existing.price,
          changedBy:  req.user.id,
          reason:     'Owner update',
        },
      });
    }

    const property = await prisma.property.update({
      where: { id: req.params.id },
      data: {
        ...updateData,
        ...(updateData.price       && { price: Number(updateData.price) }),
        ...(updateData.latitude    && { latitude: Number(updateData.latitude) }),
        ...(updateData.longitude   && { longitude: Number(updateData.longitude) }),
        ...(amenityIds && {
          amenities: {
            deleteMany: {},
            create: amenityIds.map((id) => ({ amenityId: id })),
          },
        }),
      },
      select: PROPERTY_DETAIL_SELECT,
    });

    return res.json(success(property, 'Property updated successfully.'));
  } catch (err) {
    console.error('updateProperty error:', err);
    return res.status(500).json(error('Failed to update property.'));
  }
};

// ─── DELETE Property ──────────────────────────────────────────
export const deleteProperty = async (req, res) => {
  try {
    const existing = await prisma.property.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json(error('Property not found.'));
    if (existing.ownerId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json(error('Not authorized to delete this property.'));
    }

    await prisma.property.delete({ where: { id: req.params.id } });
    return res.json(success(null, 'Property deleted successfully.'));
  } catch (err) {
    console.error('deleteProperty error:', err);
    return res.status(500).json(error('Failed to delete property.'));
  }
};

// ─── Upload Property Images ───────────────────────────────────
export const uploadPropertyImages = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json(error('No images provided.'));
    }

    const property = await prisma.property.findUnique({ where: { id: req.params.id } });
    if (!property) return res.status(404).json(error('Property not found.'));
    if (property.ownerId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json(error('Not authorized.'));
    }

    // Check existing image count
    const existingCount = await prisma.propertyImage.count({ where: { propertyId: req.params.id } });
    if (existingCount + req.files.length > 20) {
      return res.status(400).json(error(`Max 20 images allowed. Currently ${existingCount}.`));
    }

    const uploadResults = await uploadMultipleImages(req.files, 'property-images');
    const hasPrimary = await prisma.propertyImage.findFirst({
      where: { propertyId: req.params.id, isPrimary: true },
    });

    const images = await prisma.$transaction(
      uploadResults.map((result, idx) =>
        prisma.propertyImage.create({
          data: {
            propertyId:   req.params.id,
            imageUrl:     result.secure_url,
            thumbnailUrl: result.secure_url.replace('/upload/', '/upload/c_thumb,w_400/'),
            publicId:     result.public_id,
            isPrimary:    !hasPrimary && idx === 0,
            order:        existingCount + idx,
            width:        result.width,
            height:       result.height,
            sizeBytes:    result.bytes,
          },
        })
      )
    );

    return res.status(201).json(success(images, `${images.length} image(s) uploaded successfully.`));
  } catch (err) {
    console.error('uploadPropertyImages error:', err);
    return res.status(500).json(error('Failed to upload images.'));
  }
};

// ─── Delete Property Image ────────────────────────────────────
export const deletePropertyImage = async (req, res) => {
  try {
    const image = await prisma.propertyImage.findUnique({ where: { id: req.params.imageId } });
    if (!image) return res.status(404).json(error('Image not found.'));

    const property = await prisma.property.findUnique({ where: { id: image.propertyId } });
    if (property.ownerId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json(error('Not authorized.'));
    }

    if (image.publicId) {
      await deleteFromCloudinary(image.publicId).catch(console.error);
    }

    await prisma.propertyImage.delete({ where: { id: image.id } });

    // If deleted was primary, set next image as primary
    if (image.isPrimary) {
      const nextImage = await prisma.propertyImage.findFirst({ where: { propertyId: image.propertyId } });
      if (nextImage) {
        await prisma.propertyImage.update({ where: { id: nextImage.id }, data: { isPrimary: true } });
      }
    }

    return res.json(success(null, 'Image deleted.'));
  } catch (err) {
    console.error('deletePropertyImage error:', err);
    return res.status(500).json(error('Failed to delete image.'));
  }
};

// ─── Get My Listings ──────────────────────────────────────────
export const getMyListings = async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const { status } = req.query;

    const where = {
      ownerId: req.user.id,
      ...(status && { status }),
    };

    const [properties, total] = await Promise.all([
      prisma.property.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          ...PROPERTY_LIST_SELECT,
          leadCount:  true,
          viewCount:  true,
          shareCount: true,
          expiresAt:  true,
          status:     true,
          isFeatured: true,
          isBoosted:  true,
          analytics: {
            orderBy: { date: 'desc' },
            take: 7,
            select: { date: true, views: true, leads: true, messages: true },
          },
        },
      }),
      prisma.property.count({ where }),
    ]);

    return res.json(paginated(properties, total, page, limit));
  } catch (err) {
    console.error('getMyListings error:', err);
    return res.status(500).json(error('Failed to fetch your listings.'));
  }
};

// ─── Search with Text ─────────────────────────────────────────
export const searchProperties = async (req, res) => {
  try {
    const { q, ...filters } = req.query;
    const { page, limit, skip } = getPagination(req.query);
    const orderBy = getPropertySort(filters.sort);

    const baseWhere = buildPropertyFilters({ ...filters, status: 'ACTIVE' });

    // Add text search if query provided
    const where = q
      ? {
          ...baseWhere,
          OR: [
            { title:    { contains: q, mode: 'insensitive' } },
            { locality: { contains: q, mode: 'insensitive' } },
            { city:     { contains: q, mode: 'insensitive' } },
            { address:  { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
          ],
        }
      : baseWhere;

    const [properties, total] = await Promise.all([
      prisma.property.findMany({ where, orderBy, skip, take: limit, select: PROPERTY_LIST_SELECT }),
      prisma.property.count({ where }),
    ]);

    return res.json(paginated(properties, total, page, limit));
  } catch (err) {
    console.error('searchProperties error:', err);
    return res.status(500).json(error('Search failed.'));
  }
};

// ─── Get Search Suggestions ───────────────────────────────────
export const getSearchSuggestions = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) return res.json(success([]));

    const [cities, localities, properties] = await Promise.all([
      prisma.property.groupBy({
        by:     ['city'],
        where:  { city: { contains: q, mode: 'insensitive' }, status: 'ACTIVE' },
        _count: { city: true },
        take:   3,
      }),
      prisma.property.groupBy({
        by:     ['locality', 'city'],
        where:  { locality: { contains: q, mode: 'insensitive' }, status: 'ACTIVE' },
        _count: { locality: true },
        take:   5,
      }),
      prisma.property.findMany({
        where:   { title: { contains: q, mode: 'insensitive' }, status: 'ACTIVE' },
        take:    3,
        select:  { id: true, title: true, city: true, locality: true },
      }),
    ]);

    const suggestions = [
      ...cities.map((c) => ({ type: 'city',     label: c.city, count: c._count.city })),
      ...localities.map((l) => ({ type: 'locality', label: `${l.locality}, ${l.city}`, count: l._count.locality })),
      ...properties.map((p) => ({ type: 'property', label: p.title, id: p.id, city: p.city })),
    ];

    return res.json(success(suggestions));
  } catch (err) {
    console.error('getSearchSuggestions error:', err);
    return res.status(500).json(error('Failed to get suggestions.'));
  }
};

// ─── Get Nearby Properties (Map view) ────────────────────────
export const getNearbyProperties = async (req, res) => {
  try {
    const { lat, lng, radius = 5, listingType, propertyType } = req.query;

    if (!lat || !lng) {
      return res.status(400).json(error('lat and lng query params required.'));
    }

    // Approximate bounding box (1 degree ≈ 111 km)
    const latDelta = Number(radius) / 111;
    const lngDelta = Number(radius) / (111 * Math.cos(Number(lat) * (Math.PI / 180)));

    const properties = await prisma.property.findMany({
      where: {
        status:   'ACTIVE',
        latitude: { gte: Number(lat) - latDelta, lte: Number(lat) + latDelta },
        longitude:{ gte: Number(lng) - lngDelta, lte: Number(lng) + lngDelta },
        ...(listingType  && { listingType }),
        ...(propertyType && { propertyType }),
      },
      take:   50,
      select: {
        id:          true,
        title:       true,
        price:       true,
        latitude:    true,
        longitude:   true,
        propertyType:true,
        listingType: true,
        bhk:         true,
        isVerified:  true,
        images: {
          where:  { isPrimary: true },
          take:   1,
          select: { thumbnailUrl: true },
        },
      },
    });

    return res.json(success(properties));
  } catch (err) {
    console.error('getNearbyProperties error:', err);
    return res.status(500).json(error('Failed to fetch nearby properties.'));
  }
};

