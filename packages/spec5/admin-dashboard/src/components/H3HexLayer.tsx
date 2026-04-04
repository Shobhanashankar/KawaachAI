import { cellToBoundary } from 'h3-js';
import { Polygon, Popup } from 'react-leaflet';
import { HeatmapZone } from '../types';

interface H3HexLayerProps {
  zones: HeatmapZone[];
  onSelect: (zone: HeatmapZone) => void;
  mode: 'loss' | 'claim-rate' | 'fraud-flags';
}

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

        return (
          <Polygon
            key={zone.h3_index}
            positions={coordinates}
            pathOptions={{
              color,
              weight: 1,
              fillColor: color,
              fillOpacity: 0.35,
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
