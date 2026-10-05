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

  // Deduplicate parts
  const uniqueParts = Array.from(new Set(parts));
  const formattedAddress = uniqueParts.length > 0 ? uniqueParts.join(', ') : primaryName;

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

  // Ghana bounding box: lon min -3.5, lat min 4.5, lon max 1.5, lat max 11.5
  const bboxUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(trimmed)}&lat=7.9465&lon=-1.0232&bbox=-3.5,4.5,1.5,11.5&limit=6`;

  try {
    const res = await fetch(bboxUrl, { signal });
    if (!res.ok) throw new Error(`Photon API returned ${res.status}`);
    const data: PhotonResponse = await res.json();

    let suggestions = (data.features || []).map((feat, idx) => formatPhotonFeature(feat, idx));

    // If bbox yielded too few results, query with Ghana center bias
    if (suggestions.length < 3) {
      const fallbackUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(trimmed)}&lat=7.9465&lon=-1.0232&limit=6`;
      const fallbackRes = await fetch(fallbackUrl, { signal }).catch(() => null);
      if (fallbackRes?.ok) {
        const fallbackData: PhotonResponse = await fallbackRes.json();
        const fallbackSuggestions = (fallbackData.features || []).map((feat, idx) =>
          formatPhotonFeature(feat, idx + 100),
        );

        // Merge without duplicates
        const existingIds = new Set(suggestions.map((s) => `${s.lat},${s.lng}`));
        for (const item of fallbackSuggestions) {
          if (!existingIds.has(`${item.lat},${item.lng}`)) {
            suggestions.push(item);
          }
        }
      }
    }

    return suggestions.slice(0, 6);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return [];
    console.error('Photon geocoding search error:', error);
    return [];
  }
}

export async function reverseGeocodePhoton(
  lat: number,
  lng: number,
  signal?: AbortSignal,
): Promise<LocationSuggestion | null> {
  const url = `https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}`;
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const data: PhotonResponse = await res.json();
    if (!data.features || data.features.length === 0) return null;
    return formatPhotonFeature(data.features[0], 0);
  } catch (error) {
    console.error('Photon reverse geocoding error:', error);
    return null;
  }
}
