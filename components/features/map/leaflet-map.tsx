'use client';
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { HeatmapPoint } from '../../../lib/api/types';
import { severity, severityColors } from '../../../lib/format';
import { nearestRegion, getLocationName } from '../../../lib/geo';
import { c } from '../../../lib/styles';

export default function LeafletMap({
  points,
  onSelect,
}: {
  points: HeatmapPoint[];
  onSelect: (point: HeatmapPoint) => void;
}) {
  const element = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markers = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!element.current) return;
    const instance = L.map(element.current, { zoomControl: false }).setView([5.6, -0.18], 11);
    L.control.zoom({ position: 'bottomright' }).addTo(instance);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(instance);
    markers.current = L.layerGroup().addTo(instance);
    map.current = instance;
    const observer = new ResizeObserver(() => instance.invalidateSize());
    observer.observe(element.current);
    return () => {
      observer.disconnect();
      instance.remove();
      map.current = null;
      markers.current = null;
    };
  }, []);

  useEffect(() => {
    const layer = markers.current;
    if (!layer) return;
    layer.clearLayers();
    for (const point of points) {
      const color = severityColors[severity(point.intensity)];
      const tooltip = document.createElement('span');
      tooltip.textContent = `${getLocationName(point)} · ${point.intensity.toFixed(2)}`;
      L.circleMarker([point.lat, point.lng], {
        radius: 4 + point.intensity * 8,
        color,
        weight: 1,
        fillColor: color,
        fillOpacity: 0.28 + point.intensity * 0.4,
      })
        .addTo(layer)
        .on('click', () => onSelect(point))
        .bindTooltip(tooltip);
    }
  }, [points, onSelect]);

  return (
    <div ref={element} className={c('mapCanvas')} aria-label="Pothole locations across Ghana" />
  );
}
