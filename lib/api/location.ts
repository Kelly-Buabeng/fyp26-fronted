import { ACCRA_LANDMARKS, nearestRegion } from '../geo';

export type LocationSuggestion = {
  id: string;
  name: string;
  formattedAddress: string;
  lat: number;
  lng: number;
  city?: string;
  state?: string;
  country?: string;
};

type PhotonFeature = {
  type: string;
  geometry: {
    coordinates: [number, number]; // [lng, lat]
    type: string;
  };
  properties: {
    osm_id?: number;
    name?: string;
    street?: string;
    housenumber?: string;
    city?: string;
    district?: string;
    state?: string;
    country?: string;
    postcode?: string;
  };
};

type PhotonResponse = {
  type: string;
  features: PhotonFeature[];
};

const searchCache = new Map<string, LocationSuggestion[]>();

export function searchLocalLandmarks(query: string): LocationSuggestion[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed || trimmed.length < 2) return [];

  const matches: LocationSuggestion[] = [];
  for (let i = 0; i < ACCRA_LANDMARKS.length; i++) {
    const item = ACCRA_LANDMARKS[i];
    if (item.name.toLowerCase().includes(trimmed)) {
      const region = nearestRegion({ lat: item.lat, lng: item.lng });
      matches.push({
        id: `local-${i}-${item.lat}-${item.lng}`,
        name: item.name,
        formattedAddress: `${item.name}, ${region}, Ghana`,
        lat: item.lat,
        lng: item.lng,
        city: item.name.split(',')[0],
        state: region,
        country: 'Ghana',
      });
    }
  }
  return matches;
}

function formatPhotonFeature(feature: PhotonFeature, index: number): LocationSuggestion {
  const p = feature.properties;
  const lng = feature.geometry.coordinates[0];
  const lat = feature.geometry.coordinates[1];

  const primaryName = p.name || p.street || p.city || p.district || 'Location';

  const parts = [
    p.housenumber && p.street ? `${p.housenumber} ${p.street}` : p.street,
    p.district,
    p.city,
    p.state,
    p.country,
  ].filter((item): item is string => Boolean(item && item !== primaryName));

  const uniqueParts = Array.from(new Set(parts));

  return {
    id: `${p.osm_id || index}-${lat}-${lng}`,
    name: primaryName,
    formattedAddress: `${primaryName}${uniqueParts.length > 0 ? ', ' + uniqueParts.join(', ') : ''}`,
    lat: Number(lat.toFixed(6)),
    lng: Number(lng.toFixed(6)),
    city: p.city || p.district,
    state: p.state,
    country: p.country,
  };
}

export async function searchLocationPhoton(
  query: string,
  signal?: AbortSignal,
): Promise<LocationSuggestion[]> {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 2) return [];

  const cacheKey = trimmed.toLowerCase();
  if (searchCache.has(cacheKey)) {
    return searchCache.get(cacheKey)!;
  }

  const localResults = searchLocalLandmarks(trimmed);

  const bboxUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(trimmed)}&lat=7.9465&lon=-1.0232&bbox=-3.5,4.5,1.5,11.5&limit=8`;

  try {
    const fetchController = new AbortController();
    const timeoutId = setTimeout(() => fetchController.abort(), 1500);

    const onAbort = () => fetchController.abort();
    signal?.addEventListener('abort', onAbort);

    const res = await fetch(bboxUrl, { signal: fetchController.signal }).finally(() => {
      clearTimeout(timeoutId);
      signal?.removeEventListener('abort', onAbort);
    });

    if (!res.ok) throw new Error(`Photon API returned ${res.status}`);
    const data: PhotonResponse = await res.json();

    const remoteSuggestions = (data.features || []).map((feat, idx) => formatPhotonFeature(feat, idx));

    const combined = [...localResults];
    const existingCoords = new Set(localResults.map((r) => `${r.lat.toFixed(3)},${r.lng.toFixed(3)}`));

    for (const rem of remoteSuggestions) {
      const key = `${rem.lat.toFixed(3)},${rem.lng.toFixed(3)}`;
      if (!existingCoords.has(key)) {
        existingCoords.add(key);
        combined.push(rem);
      }
    }

    const finalResults = combined.slice(0, 8);
    searchCache.set(cacheKey, finalResults);
    return finalResults;
  } catch (error: any) {
    const isAbort =
      signal?.aborted ||
      error?.name === 'AbortError' ||
      error?.name === 'ResponseAborted' ||
      error?.code === '20' ||
      (typeof error?.message === 'string' &&
        (error.message.includes('abort') || error.message.includes('ResponseAborted')));

    if (isAbort) return localResults;
    searchCache.set(cacheKey, localResults);
    return localResults;
  }
}

export async function reverseGeocodePhoton(
  lat: number,
  lng: number,
  signal?: AbortSignal,
): Promise<LocationSuggestion | null> {
  const url = `https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}`;
  try {
    const fetchController = new AbortController();
    const timeoutId = setTimeout(() => fetchController.abort(), 1500);

    const onAbort = () => fetchController.abort();
    signal?.addEventListener('abort', onAbort);

    const res = await fetch(url, { signal: fetchController.signal }).finally(() => {
      clearTimeout(timeoutId);
      signal?.removeEventListener('abort', onAbort);
    });

    if (!res.ok) return null;
    const data: PhotonResponse = await res.json();
    if (!data.features || data.features.length === 0) return null;
    return formatPhotonFeature(data.features[0], 0);
  } catch {
    return null;
  }
}
