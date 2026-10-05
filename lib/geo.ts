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
