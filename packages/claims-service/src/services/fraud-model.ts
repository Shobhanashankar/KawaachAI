import fs from 'node:fs';
import path from 'node:path';
import { FraudFeatureVector } from '@kawaachai/shared';

interface ModelMeta {
  version: string;
  trained_at: string;
  intercept: number;
  weights: Record<string, number>;
}

const DEFAULT_META: ModelMeta = {
  version: 'synthetic-v1',
  trained_at: '2026-04-04T00:00:00.000Z',
  intercept: -0.55,
  weights: {
    mock_location_flag: 1.25,
    accelerometer_variance: -0.6,
    barometric_delta_match: -0.35,
    gnss_cn0_agc_anomaly: 0.95,
    gnss_ntp_time_delta: 0.45,
    bssid_zone_match: -0.4,
    cell_tower_zone_match: -0.25,
    battery_drain_z_score: 0.32,
    speed_variance_30min: -0.4,
    route_vector_linearity: 0.72,
    recent_app_activity_in_zone: -0.45,
    claim_burst_rank: -0.28,
    device_proximity_graph_degree: 0.31,
    shared_network_flag: 0.66,
    source_consensus_score: -0.58,
  },
};

const normalizeFeature = (name: string, value: number): number => {
  if (name === 'gnss_ntp_time_delta') return Math.min(value / 10, 1);
  if (name === 'device_proximity_graph_degree') return Math.min(value / 5, 1);
  if (name === 'battery_drain_z_score') return Math.min(value / 3, 1);
  return value;
};

const sigmoid = (x: number): number => 1 / (1 + Math.exp(-x));

export class FraudModel {
  private meta: ModelMeta;

  constructor() {
    this.meta = this.loadMeta();
  }

  private loadMeta(): ModelMeta {
    const rootPath = path.resolve(__dirname, '../../../../models/fraud_model_meta.json');
    if (!fs.existsSync(rootPath)) {
      return DEFAULT_META;
    }

    try {
      const content = fs.readFileSync(rootPath, 'utf8');
      const parsed = JSON.parse(content) as ModelMeta;
      if (!parsed.weights || typeof parsed.intercept !== 'number') {
        return DEFAULT_META;
      }
      return parsed;
    } catch {
      return DEFAULT_META;
    }
  }

  score(features: FraudFeatureVector): { score: number; shap: Record<string, number> } {
    const entries = Object.entries(features);
    const contributions: Record<string, number> = {};

    let linear = this.meta.intercept;
    for (const [name, rawValue] of entries) {
      const featureValue = normalizeFeature(name, rawValue);
      const weight = this.meta.weights[name] ?? 0;
      const contribution = weight * featureValue;
      contributions[name] = contribution;
      linear += contribution;
    }

    const rawScore = sigmoid(linear);
    const totalAbs = Object.values(contributions).reduce((sum, value) => sum + Math.abs(value), 0) || 1;

    const shap: Record<string, number> = {};
    for (const [name, contribution] of Object.entries(contributions)) {
      shap[name] = Number((contribution / totalAbs).toFixed(4));
    }

    return {
      score: Number(rawScore.toFixed(4)),
      shap,
    };
  }
}
