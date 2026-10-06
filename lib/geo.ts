import type { HeatmapPoint } from './api/types';

export const REGIONS: Record<string, [number, number]> = {
  'Greater Accra': [5.6037, -0.187],
  Ashanti: [6.6885, -1.6244],
  Western: [4.9346, -1.7554],
  'Western North': [6.2044, -2.4806],
  Central: [5.1053, -1.2466],
  Eastern: [6.0941, -0.2591],
  Volta: [6.6008, 0.4713],
  Oti: [7.7514, 0.3489],
  Northern: [9.4008, -0.8393],
  Savannah: [9.0833, -1.8167],
  'North East': [10.5297, -0.3689],
  'Upper East': [10.7856, -0.8514],
  'Upper West': [10.0601, -2.5099],
  Bono: [7.3389, -2.3267],
  'Bono East': [7.592, -1.9395],
  Ahafo: [6.7975, -2.5211],
};

export const ACCRA_LANDMARKS: { lat: number; lng: number; name: string }[] = [
  { lat: 5.6508, lng: -0.1869, name: 'East Legon / Boundary Road, Accra' },
  { lat: 5.6037, lng: -0.1870, name: 'Kwame Nkrumah Circle, Accra' },
  { lat: 5.5560, lng: -0.1969, name: 'Osu Oxford Street, Accra' },
  { lat: 5.6322, lng: -0.2311, name: 'Achimota New Motorway, Accra' },
  { lat: 5.6145, lng: -0.1012, name: 'Spintex Road, Accra' },
  { lat: 5.5789, lng: -0.2245, name: 'Kaneshie Market Road, Accra' },
  { lat: 5.5841, lng: -0.1712, name: 'Cantonments Road, Accra' },
  { lat: 5.5412, lng: -0.2541, name: 'Dansoman High Street, Accra' },
  { lat: 5.5610, lng: -0.2619, name: 'Dansoman / Mallam Junction, Accra' },
  { lat: 5.5720, lng: -0.2780, name: 'Gbawe / Weija Boulevard, Accra' },
  { lat: 5.5400, lng: -0.3400, name: 'Kasoa Main Highway' },
  { lat: 5.6089, lng: -0.1690, name: 'Airport Residential Area, Accra' },
  { lat: 5.6580, lng: -0.1520, name: 'Madina Zongo Junction, Accra' },
  { lat: 5.5920, lng: -0.2105, name: 'Kwame Nkrumah Avenue, Adabraka' },
  { lat: 5.6201, lng: -0.1754, name: 'Dzorwulu Highway, Accra' },
  { lat: 5.5688, lng: -0.1450, name: 'Labone Bypass, Accra' },
  { lat: 5.6100, lng: -0.2400, name: 'Lapaz Highway Junction, Accra' },
  { lat: 5.6700, lng: -0.1870, name: 'Legon Campus / UG, Accra' },
  { lat: 5.6780, lng: -0.2100, name: 'Haatso / Agbogba Road, Accra' },
  { lat: 5.6350, lng: -0.2180, name: 'Dome Market Road, Accra' },
  { lat: 5.6450, lng: -0.1250, name: 'Adenta Barrier, Accra' },
  { lat: 5.6800, lng: -0.2500, name: 'Pokuase Interchange, Accra' },
  { lat: 5.6700, lng: -0.0000, name: 'Tema Community 1 Central' },
  { lat: 5.6900, lng: -0.0150, name: 'Tema Community 6 & 10' },
  { lat: 5.7000, lng: -0.0350, name: 'Ashaiman Market Square' },
  { lat: 5.5900, lng: -0.0800, name: 'Teshie Nungua Coastal Road' },
  { lat: 6.6885, lng: -1.6244, name: 'Adum Central, Kumasi' },
  { lat: 6.6740, lng: -1.5710, name: 'KNUST Campus, Kumasi' },
  { lat: 6.6970, lng: -1.6300, name: 'Kejetia Market, Kumasi' },
  { lat: 6.7050, lng: -1.6250, name: 'Bantama High Street, Kumasi' },
  { lat: 9.4008, lng: -0.8393, name: 'Tamale Central Market, Northern Region' },
  { lat: 4.9346, lng: -1.7554, name: 'Takoradi Market Circle, Western Region' },
  { lat: 5.1053, lng: -1.2466, name: 'Cape Coast Central, Central Region' },
  { lat: 6.0941, lng: -0.2591, name: 'Koforidua Central, Eastern Region' },
  { lat: 6.6008, lng: 0.4713, name: 'Ho Central, Volta Region' },
  { lat: 7.3389, lng: -2.3267, name: 'Sunyani Central, Bono Region' },
  { lat: 10.7856, lng: -0.8514, name: 'Bolgatanga Central, Upper East' },
  { lat: 10.0601, lng: -2.5099, name: 'Wa Central, Upper West' },
];

export function nearestRegion(point: Pick<HeatmapPoint, 'lat' | 'lng'>) {
  const rad = (n: number) => (n * Math.PI) / 180;
  const distance = ([lat, lng]: [number, number]) =>
    Math.sin(rad(lat - point.lat) / 2) ** 2 +
    Math.cos(rad(point.lat)) * Math.cos(rad(lat)) * Math.sin(rad(lng - point.lng) / 2) ** 2;
  return Object.keys(REGIONS).reduce(
    (best, r) => (distance(REGIONS[r]) < distance(REGIONS[best]) ? r : best),
    Object.keys(REGIONS)[0],
  );
}

export function getLocationName(point: { lat: number; lng: number }): string {
  let closest: { name: string; dist: number } | null = null;

  for (const item of ACCRA_LANDMARKS) {
    const dist = Math.hypot(item.lat - point.lat, item.lng - point.lng);
    if (dist < 0.15 && (!closest || dist < closest.dist)) {
      closest = { name: item.name, dist };
    }
  }

  if (closest) {
    return closest.name;
  }

  const region = nearestRegion(point);
  return `${region}, Ghana`;
}
