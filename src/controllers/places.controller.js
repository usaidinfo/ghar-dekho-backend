import { success, error } from '../utils/response.js';
import { fetchNearbyEssentials } from '../services/places.service.js';

/** GET /api/places/nearby?lat=&lng=&radiusKm=&limit= */
export const getNearbyPlaces = async (req, res) => {
  try {
    const { lat, lng, radiusKm, limit } = req.query;
    const result = await fetchNearbyEssentials({
      lat,
      lng,
      radiusKm: radiusKm != null ? Number(radiusKm) : 3,
      limit: limit != null ? Number(limit) : 3,
    });
    return res.json(success(result));
  } catch (err) {
    console.error('getNearbyPlaces error:', err);
    return res
      .status(err.status || 500)
      .json(error(err.message || 'Failed to fetch nearby places.', null, err.code));
  }
};
