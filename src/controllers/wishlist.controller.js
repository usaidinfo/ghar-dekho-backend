import prisma from '../config/database.js';
import { success, error, paginated } from '../utils/response.js';
import { getPagination } from '../utils/pagination.js';

// ─── Get Wishlist ─────────────────────────────────────────────
export const getWishlist = async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req.query);

    const [items, total] = await Promise.all([
      prisma.wishlist.findMany({
        where:   { userId: req.user.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          property: {
            select: {
              id:          true,
              title:       true,
              price:       true,
              originalPrice: true,
              propertyType:true,
              listingType: true,
              bhk:         true,
              carpetArea:  true,
              city:        true,
              locality:    true,
              isVerified:  true,
              isFeatured:  true,
              status:      true,
              furnishing:  true,
              images: {
                where:  { isPrimary: true },
                take:   1,
                select: { imageUrl: true, thumbnailUrl: true },
              },
            },
          },
        },
      }),
      prisma.wishlist.count({ where: { userId: req.user.id } }),
    ]);

    return res.json(paginated(items, total, page, limit));
  } catch (err) {
    console.error('getWishlist error:', err);
    return res.status(500).json(error('Failed to fetch wishlist.'));
  }
};

// ─── Add to Wishlist ──────────────────────────────────────────
export const addToWishlist = async (req, res) => {
  try {
    const { propertyId, notes } = req.body;

    const property = await prisma.property.findUnique({ where: { id: propertyId } });
    if (!property) return res.status(404).json(error('Property not found.'));

    // Check if already in wishlist
    const existing = await prisma.wishlist.findUnique({
      where: { userId_propertyId: { userId: req.user.id, propertyId } },
    });

    if (existing) {
      return res.status(409).json(error('Property already in wishlist.', null, 'ALREADY_EXISTS'));
    }

    const item = await prisma.wishlist.create({
      data: { userId: req.user.id, propertyId, notes },
      include: { property: { select: { id: true, title: true, price: true } } },
    });

    return res.status(201).json(success(item, 'Property saved to wishlist.'));
  } catch (err) {
    console.error('addToWishlist error:', err);
    return res.status(500).json(error('Failed to add to wishlist.'));
  }
};

// ─── Remove from Wishlist ─────────────────────────────────────
export const removeFromWishlist = async (req, res) => {
  try {
    const { propertyId } = req.params;

    const existing = await prisma.wishlist.findUnique({
      where: { userId_propertyId: { userId: req.user.id, propertyId } },
    });

    if (!existing) return res.status(404).json(error('Property not in your wishlist.'));

    await prisma.wishlist.delete({
      where: { userId_propertyId: { userId: req.user.id, propertyId } },
    });

    return res.json(success(null, 'Property removed from wishlist.'));
  } catch (err) {
    console.error('removeFromWishlist error:', err);
    return res.status(500).json(error('Failed to remove from wishlist.'));
  }
};

// ─── Check if in Wishlist ─────────────────────────────────────
export const checkWishlist = async (req, res) => {
  try {
    const item = await prisma.wishlist.findUnique({
      where: { userId_propertyId: { userId: req.user.id, propertyId: req.params.propertyId } },
    });
    return res.json(success({ isSaved: !!item, item }));
  } catch (err) {
    console.error('checkWishlist error:', err);
    return res.status(500).json(error('Failed to check wishlist.'));
  }
};

// ─── Get Compare List ─────────────────────────────────────────
export const getComparisons = async (req, res) => {
  try {
    const comparisons = await prisma.propertyComparison.findMany({
      where:   { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        properties: {
          include: {
            property: {
              select: {
                id: true, title: true, price: true, bhk: true,
                carpetArea: true, builtUpArea: true, propertyType: true,
                listingType: true, city: true, locality: true,
                furnishing: true, ageOfProperty: true, isVerified: true,
                isRERAApproved: true, facing: true, floorNumber: true,
                totalFloors: true, parkingSpaces: true,
                images: { where: { isPrimary: true }, take: 1 },
                amenities: { include: { amenity: { select: { name: true, icon: true } } } },
              },
            },
          },
        },
      },
    });
    return res.json(success(comparisons));
  } catch (err) {
    console.error('getComparisons error:', err);
    return res.status(500).json(error('Failed to fetch comparisons.'));
  }
};

// ─── Add to Compare ───────────────────────────────────────────
export const addToCompare = async (req, res) => {
  try {
    const { propertyId, comparisonId, name } = req.body;

    // Create new comparison group or use existing
    let comparison;
    if (comparisonId) {
      comparison = await prisma.propertyComparison.findFirst({
        where: { id: comparisonId, userId: req.user.id },
        include: { properties: true },
      });
      if (!comparison) return res.status(404).json(error('Comparison not found.'));
    } else {
      comparison = await prisma.propertyComparison.create({
        data: { userId: req.user.id, name: name || 'My Comparison' },
        include: { properties: true },
      });
    }

    if (comparison.properties.length >= 4) {
      return res.status(400).json(error('Max 4 properties per comparison.'));
    }

    const item = await prisma.comparisonProperty.create({
      data: { comparisonId: comparison.id, propertyId },
    });

    return res.status(201).json(success({ ...item, comparisonId: comparison.id }, 'Added to comparison.'));
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json(error('Property already in this comparison.'));
    }
    console.error('addToCompare error:', err);
    return res.status(500).json(error('Failed to add to comparison.'));
  }
};

// ─── Remove from Compare ──────────────────────────────────────
export const removeFromCompare = async (req, res) => {
  try {
    const { comparisonId, propertyId } = req.params;

    await prisma.comparisonProperty.deleteMany({
      where: { comparisonId, propertyId },
    });

    return res.json(success(null, 'Removed from comparison.'));
  } catch (err) {
    console.error('removeFromCompare error:', err);
    return res.status(500).json(error('Failed to remove from comparison.'));
  }
};

