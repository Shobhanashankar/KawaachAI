import { describe, expect, it } from 'vitest';
import { FraudModel } from '../src/services/fraud-model';

describe('FraudModel', () => {
  it('scores a feature vector and returns shap map', () => {
    const model = new FraudModel();
    const result = model.score({
      mock_location_flag: 0,
      accelerometer_variance: 0.4,
      barometric_delta_match: 1,
      gnss_cn0_agc_anomaly: 0,
      gnss_ntp_time_delta: 0.3,
      bssid_zone_match: 1,
      cell_tower_zone_match: 1,
      battery_drain_z_score: 0.2,
      speed_variance_30min: 0.2,
      route_vector_linearity: 0.2,
      recent_app_activity_in_zone: 1,
      claim_burst_rank: 0.7,
      device_proximity_graph_degree: 0,
      shared_network_flag: 0,
      source_consensus_score: 1,
    });

    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
    expect(Object.keys(result.shap)).toContain('mock_location_flag');
  });
});
