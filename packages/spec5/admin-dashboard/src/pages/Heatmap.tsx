import { useEffect, useState } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import { H3HexLayer } from '../components/H3HexLayer';
import { getHeatmap } from '../services/api';
import { HeatmapZone } from '../types';

export function HeatmapPage() {
  const [zones, setZones] = useState<HeatmapZone[]>([]);
  const [selectedZone, setSelectedZone] = useState<HeatmapZone | null>(null);
  const [layerMode, setLayerMode] = useState<'loss' | 'claim-rate' | 'fraud-flags'>('loss');

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const nextZones = await getHeatmap();
      if (!mounted) return;
      setZones(nextZones);
      if (!selectedZone && nextZones[0]) {
        setSelectedZone(nextZones[0]);
      }
    };

    void load();
    const timer = setInterval(() => {
      void load();
    }, 300_000);

    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [selectedZone]);

  return (
    <div className="page-grid split-2">
      <section className="card" style={{ minHeight: 560 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>H3 Risk Heatmap</h2>
          <select
            value={layerMode}
            onChange={(event) => setLayerMode(event.target.value as 'loss' | 'claim-rate' | 'fraud-flags')}
            className="input"
            style={{ width: 220 }}
          >
            <option value="loss">Loss Ratio Layer</option>
            <option value="claim-rate">Claim Rate Layer</option>
            <option value="fraud-flags">Fraud Flag Layer</option>
          </select>
        </div>

        <MapContainer center={[20.5937, 78.9629]} zoom={5} style={{ height: 470, borderRadius: 12 }} preferCanvas>
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <H3HexLayer zones={zones} mode={layerMode} onSelect={setSelectedZone} />
        </MapContainer>
      </section>

      <section className="card">
        <h2>Zone Drill-Down</h2>
        {!selectedZone ? (
          <p className="muted">Click a hexagon to inspect zone-level detail.</p>
        ) : (
          <div className="page-grid">
            <p>
              <strong>{selectedZone.city}</strong> ({selectedZone.h3_index})
            </p>
            <p>Active Policies: {selectedZone.active_policies}</p>
            <p>Weekly Claim Rate: {selectedZone.claim_rate_pct.toFixed(2)}%</p>
            <p>Loss Ratio: {selectedZone.loss_ratio_pct.toFixed(2)}%</p>
            <p>Fraud Flags: {selectedZone.fraud_flag_count}</p>
            <div>
              <h3>Top Fraud Signals</h3>
              <ul>
                {selectedZone.top_fraud_signals.length ? (
                  selectedZone.top_fraud_signals.map((signal) => <li key={signal}>{signal}</li>)
                ) : (
                  <li>No fraud signal data in this window.</li>
                )}
              </ul>
            </div>
            <div>
              <h3>Weather/Trigger History</h3>
              <ul>
                {selectedZone.weather_history.length ? (
                  selectedZone.weather_history.map((item) => <li key={item}>{item}</li>)
                ) : (
                  <li>No recent trigger activity.</li>
                )}
              </ul>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
