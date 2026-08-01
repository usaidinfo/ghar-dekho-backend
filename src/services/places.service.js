/**
 * Nearby lifestyle essentials around a lat/lng.
 * Prefer Google Places Nearby Search when GOOGLE_MAPS_API_KEY is set;
 * otherwise use OpenStreetMap Overpass so results are still real for the location.
 */

const PLACE_QUERIES = [
  { googleType: 'school', osmFilters: ['["amenity"="school"]'], type: 'SCHOOL' },
  { googleType: 'hospital', osmFilters: ['["amenity"="hospital"]'], type: 'HOSPITAL' },
  { googleType: 'shopping_mall', osmFilters: ['["shop"="mall"]', '["shop"="department_store"]'], type: 'MALL' },
  { googleType: 'supermarket', osmFilters: ['["shop"="supermarket"]', '["amenity"="marketplace"]'], type: 'MARKET' },
  { googleType: 'park', osmFilters: ['["leisure"="park"]'], type: 'PARK' },
  { googleType: 'pharmacy', osmFilters: ['["amenity"="pharmacy"]'], type: 'PHARMACY' },
  { googleType: 'subway_station', osmFilters: ['["railway"="station"]', '["station"="subway"]'], type: 'METRO_STATION' },
  { googleType: 'bus_station', osmFilters: ['["highway"="bus_stop"]', '["amenity"="bus_station"]'], type: 'BUS_STOP' },
  { googleType: 'restaurant', osmFilters: ['["amenity"="restaurant"]'], type: 'RESTAURANT' },
  { googleType: 'gym', osmFilters: ['["leisure"="fitness_centre"]'], type: 'GYM' },
  { googleType: 'atm', osmFilters: ['["amenity"="atm"]'], type: 'ATM' },
  { googleType: 'bank', osmFilters: ['["amenity"="bank"]'], type: 'BANK' },
];

function haversineKm(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isGoogleMapsConfigured() {
  const key = String(process.env.GOOGLE_MAPS_API_KEY || '').trim();
  if (!key) return false;
  if (/^your[_-]?google/i.test(key)) return false;
  if (key.includes('your_google_maps_api_key')) return false;
  return true;
}

async function fetchGoogleNearby({ lat, lng, radiusM, type }) {
  const key = process.env.GOOGLE_MAPS_API_KEY.trim();
  const url = new URL('https://maps.googleapis.com/maps/api/place/nearbysearch/json');
  url.searchParams.set('location', `${lat},${lng}`);
  url.searchParams.set('radius', String(radiusM));
  url.searchParams.set('type', type);
  url.searchParams.set('key', key);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Google Places HTTP ${res.status}`);
  const data = await res.json();
  if (data.status && data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(`Google Places status: ${data.status}`);
  }
  return Array.isArray(data.results) ? data.results : [];
}

async function fetchFromGoogle({ lat, lng, radiusM }) {
  const settled = await Promise.allSettled(
    PLACE_QUERIES.map(async (q) => {
      const results = await fetchGoogleNearby({ lat, lng, radiusM, type: q.googleType });
      if (!results.length) return null;
      const best = results[0];
      const plat = best.geometry?.location?.lat;
      const plng = best.geometry?.location?.lng;
      if (!Number.isFinite(plat) || !Number.isFinite(plng)) return null;
      return {
        id: best.place_id || `g-${q.type}-${plat}-${plng}`,
        type: q.type,
        name: best.name || q.type,
        distance: haversineKm(lat, lng, plat, plng),
        address: best.vicinity || best.formatted_address || null,
        latitude: plat,
        longitude: plng,
        placeId: best.place_id || null,
        source: 'google',
      };
    }),
  );

  return settled
    .filter((r) => r.status === 'fulfilled' && r.value)
    .map((r) => r.value)
    .sort((a, b) => a.distance - b.distance);
}

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.nchc.org.tw/api/interpreter',
];

/** Smaller query — fewer categories + nodes only — avoids Overpass 504 timeouts. */
async function fetchFromOverpass({ lat, lng, radiusM }) {
  const cappedRadius = Math.min(radiusM, 2500);
  const query = `
[out:json][timeout:15];
(
  node["amenity"="school"](around:${cappedRadius},${lat},${lng});
  node["amenity"="hospital"](around:${cappedRadius},${lat},${lng});
  node["shop"="mall"](around:${cappedRadius},${lat},${lng});
  node["shop"="supermarket"](around:${cappedRadius},${lat},${lng});
  node["leisure"="park"](around:${cappedRadius},${lat},${lng});
  node["amenity"="restaurant"](around:${cappedRadius},${lat},${lng});
  node["amenity"="pharmacy"](around:${cappedRadius},${lat},${lng});
  node["amenity"="bank"](around:${cappedRadius},${lat},${lng});
);
out body 40;
`.trim();

  let lastError = null;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 16000);
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
          Accept: 'application/json',
          'User-Agent': 'GharDekho/1.0 (nearby-essentials)',
        },
        body: query,
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) {
        lastError = new Error(`Overpass HTTP ${res.status}`);
        continue;
      }
      const data = await res.json();
      return normalizeOverpassElements(data, lat, lng);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error('Overpass unavailable');
}

function normalizeOverpassElements(data, lat, lng) {
  const elements = Array.isArray(data.elements) ? data.elements : [];

  const mapped = [];
  for (const el of elements) {
    const tags = el.tags || {};
    const plat = el.lat ?? el.center?.lat;
    const plng = el.lon ?? el.center?.lon;
    if (!Number.isFinite(plat) || !Number.isFinite(plng)) continue;

    let type = null;
    if (tags.amenity === 'school') type = 'SCHOOL';
    else if (tags.amenity === 'hospital') type = 'HOSPITAL';
    else if (tags.shop === 'mall' || tags.shop === 'department_store') type = 'MALL';
    else if (tags.shop === 'supermarket' || tags.amenity === 'marketplace') type = 'MARKET';
    else if (tags.leisure === 'park') type = 'PARK';
    else if (tags.amenity === 'pharmacy') type = 'PHARMACY';
    else if (tags.railway === 'station' || tags.station === 'subway') type = 'METRO_STATION';
    else if (tags.highway === 'bus_stop' || tags.amenity === 'bus_station') type = 'BUS_STOP';
    else if (tags.amenity === 'restaurant') type = 'RESTAURANT';
    else if (tags.leisure === 'fitness_centre') type = 'GYM';
    else if (tags.amenity === 'atm') type = 'ATM';
    else if (tags.amenity === 'bank') type = 'BANK';
    if (!type) continue;

    const name = tags.name || tags['name:en'] || type.replace(/_/g, ' ');
    mapped.push({
      id: `osm-${el.type}-${el.id}`,
      type,
      name,
      distance: haversineKm(lat, lng, plat, plng),
      address: tags['addr:full'] || tags['addr:street'] || null,
      latitude: plat,
      longitude: plng,
      placeId: null,
      source: 'osm',
    });
  }

  // Keep closest place per type
  const bestByType = new Map();
  for (const item of mapped.sort((a, b) => a.distance - b.distance)) {
    if (!bestByType.has(item.type)) bestByType.set(item.type, item);
  }
  return [...bestByType.values()].sort((a, b) => a.distance - b.distance);
}

/**
 * @returns {{ essentials: Array, provider: 'google'|'osm' }}
 */
export async function fetchNearbyEssentials({
  lat,
  lng,
  radiusKm = 3,
  limit = 3,
}) {
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    const err = new Error('Valid lat and lng are required.');
    err.status = 400;
    err.code = 'INVALID_COORDS';
    throw err;
  }

  const radiusM = Math.min(Math.max(Number(radiusKm) || 3, 0.5), 10) * 1000;

  if (isGoogleMapsConfigured()) {
    try {
      const essentials = await fetchFromGoogle({ lat: latitude, lng: longitude, radiusM });
      if (essentials.length) {
        return { essentials: essentials.slice(0, limit), provider: 'google' };
      }
    } catch (err) {
      console.warn('Google Places nearby failed, falling back to OSM:', err.message);
    }
  }

  try {
    const essentials = await fetchFromOverpass({ lat: latitude, lng: longitude, radiusM });
    return { essentials: essentials.slice(0, limit), provider: 'osm' };
  } catch (err) {
    console.warn('Overpass nearby failed:', err?.message || err);
    // Never hard-fail the property screen — return empty list.
    return { essentials: [], provider: 'osm' };
  }
}
