import { cellToBoundary } from 'h3-js';
import { Polygon, Popup } from 'react-leaflet';
import { HeatmapZone } from '../types';

interface H3HexLayerProps {
  zones: HeatmapZone[];
  onSelect: (zone: HeatmapZone) => void;
  mode: 'loss' | 'claim-rate' | 'fraud-flags';
}

const clamp = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value));
};

const modeIntensity = (zone: HeatmapZone, mode: 'loss' | 'claim-rate' | 'fraud-flags'): number => {
  if (mode === 'loss') return clamp(zone.loss_ratio_pct / 220, 0, 1);
  if (mode === 'claim-rate') return clamp(zone.claim_rate_pct / 180, 0, 1);
  return clamp(zone.fraud_flag_count / 12, 0, 1);
};

const withAlpha = (hexColor: string, alpha: number): string => {
  const clean = hexColor.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((part) => `${part}${part}`).join('') : clean;
  const red = Number.parseInt(full.slice(0, 2), 16);
  const green = Number.parseInt(full.slice(2, 4), 16);
  const blue = Number.parseInt(full.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${clamp(alpha, 0, 1).toFixed(3)})`;
};

const distanceKm = (aLat: number, aLng: number, bLat: number, bLng: number): number => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);

  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return 6371 * (2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
};

const centroid = (coordinates: [number, number][]): [number, number] => {
  if (coordinates.length === 0) return [0, 0];
  const sum = coordinates.reduce(
    (acc, point) => {
      return [acc[0] + point[0], acc[1] + point[1]];
    },
    [0, 0] as [number, number],
  );
  return [sum[0] / coordinates.length, sum[1] / coordinates.length];
};

const pointAtDistance = (
  centerLat: number,
  centerLng: number,
  bearingDegrees: number,
  distanceKmValue: number,
): [number, number] => {
  const earthRadiusKm = 6371;
  const bearing = (bearingDegrees * Math.PI) / 180;
  const lat1 = (centerLat * Math.PI) / 180;
  const lng1 = (centerLng * Math.PI) / 180;
  const angularDistance = distanceKmValue / earthRadiusKm;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angularDistance) +
      Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearing),
  );

  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat1),
      Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2),
    );

  return [(lat2 * 180) / Math.PI, (lng2 * 180) / Math.PI];
};

const syntheticHex = (centerLat: number, centerLng: number, radiusKm: number): [number, number][] => {
  return Array.from({ length: 6 }, (_, index) => {
    return pointAtDistance(centerLat, centerLng, 30 + index * 60, radiusKm);
  });
};

const modeColor = (zone: HeatmapZone, mode: 'loss' | 'claim-rate' | 'fraud-flags'): string => {
  if (mode === 'loss') {
    if (zone.risk_color === 'green') return '#2f9e44';
    if (zone.risk_color === 'yellow') return '#c9891f';
    if (zone.risk_color === 'orange') return '#dd6b20';
    return '#c53030';
  }

  if (mode === 'claim-rate') {
    if (zone.claim_rate_pct < 40) return '#6da66f';
    if (zone.claim_rate_pct < 70) return '#d7b354';
    if (zone.claim_rate_pct < 100) return '#d99051';
    return '#bf4342';
  }

  if (zone.fraud_flag_count < 3) return '#82bf90';
  if (zone.fraud_flag_count < 8) return '#d7b354';
  if (zone.fraud_flag_count < 12) return '#df7e4c';
  return '#b83736';
};

export function H3HexLayer({ zones, onSelect, mode }: H3HexLayerProps) {
  return (
    <>
      {zones.map((zone) => {
        const coordinates = cellToBoundary(zone.h3_index, false).map(([lat, lng]) => [lat, lng] as [number, number]);
        const color = modeColor(zone, mode);
        const isRedHotspot = color === '#c53030' || color === '#bf4342' || color === '#b83736';
        const intensity = modeIntensity(zone, mode);
        const baseOpacity = 0.24 + intensity * 0.58;
        const fillOpacity = clamp(baseOpacity * (isRedHotspot ? 0.72 : 1), 0, 1);
        const [boundaryLat, boundaryLng] = centroid(coordinates);
        const mismatchKm = distanceKm(boundaryLat, boundaryLng, zone.lat, zone.lng);
        const useLatLngFallback = mismatchKm > 500;
        const fallbackCoordinates = useLatLngFallback ? syntheticHex(zone.lat, zone.lng, 16 + intensity * 22) : coordinates;

        return (
          <Polygon
            key={zone.h3_index}
            positions={fallbackCoordinates}
            pathOptions={{
              color: withAlpha(color, isRedHotspot ? 0.62 : 0.8),
              weight: 0.9,
              fillColor: color,
              fillOpacity,
            }}
            eventHandlers={{
              click: () => onSelect(zone),
            }}
          >
            <Popup>
              <strong>{zone.city}</strong>
              <div>Loss Ratio: {zone.loss_ratio_pct.toFixed(1)}%</div>
              <div>Claim Rate: {zone.claim_rate_pct.toFixed(1)}%</div>
              <div>Active Policies: {zone.active_policies}</div>
            </Popup>
          </Polygon>
        );
      })}
    </>
  );
}
