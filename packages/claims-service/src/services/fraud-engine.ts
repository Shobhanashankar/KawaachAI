import crypto from 'node:crypto';
import Redis from 'ioredis';
import {
  ActivePolicy,
  DisruptionEvent,
  FraudDetail,
  FraudFeatureVector,
  getBssidProximityWorkers,
  getWorkerTelemetryProfile,
  getZoneByH3,
  RBAOutcome,
  upsertClaimBssids,
  WorkerTelemetryProfile,
} from '@kawaachai/shared';
import { FraudModel } from './fraud-model';
import { rbaDecision } from './rba';

export interface FraudResult {
  passed: boolean;
  score: number;
  reason?: string;
  duration_ms: number;
  rbaOutcome: RBAOutcome;
  fraudDetail: FraudDetail;
  notification?: {
    type: 'SOFT_HOLD' | 'STEP_UP' | 'REJECT';
    message: string;
  };
}

export class FraudEngine {
  private readonly model = new FraudModel();

  constructor(private readonly redis: Redis) {}

  async run(policy: ActivePolicy, event: DisruptionEvent, claimId: string): Promise<FraudResult> {
    const start = Date.now();

    const zone = await getZoneByH3(policy.h3_zone);
    if (!zone) {
      return this.rejectMissingZone(claimId, start);
    }

    const profile = (await getWorkerTelemetryProfile(policy.worker_id)) ??
      this.defaultTelemetryProfile(policy.worker_id, zone.lat, zone.lng);

    const [mockFlag, geoValidation, dedupValidation, sourceConsensusScore, claimBurstRank] =
      await Promise.all([
        this.checkMockLocation(profile),
        this.checkGeoValidation(profile, zone.lat, zone.lng),
        this.checkWorkerEventDedup(policy.worker_id, event.event_id),
        this.checkSourceConsensus(event),
        this.computeClaimBurstRank(event.event_id, policy.worker_id),
      ]);

    const bssidHashes = profile.bssids.map((value) => this.hashBssid(value));
    await upsertClaimBssids(claimId, bssidHashes, new Date().toISOString());
    const proximityWorkers = await getBssidProximityWorkers(bssidHashes, event.event_id);
    const ringDegree = new Set(proximityWorkers).size;

    const speedVariance = this.variance(profile.speed_samples);
    const routeLinearity = speedVariance < 0.01 ? 0.95 : speedVariance < 0.05 ? 0.72 : 0.18;
    const gnssDeltaSeconds = Math.abs(profile.gps_timestamp_ms - profile.ntp_timestamp_ms) / 1000;
    const gnssAnomaly = profile.gnss_cn0 > 45 && profile.gnss_agc < -8 ? 1 : 0;
    const expectedPressure = event.trigger_type === 'RAIN' ? 1000 : 1008;
    const barometricMatch = Math.abs(profile.barometric_pressure_hpa - expectedPressure) <= 12 ? 1 : 0;
    const cellTowerMatch = profile.cell_tower_ids.some((value) =>
      value.toLowerCase().includes(zone.city.toLowerCase()),
    )
      ? 1
      : 0;
    const sharedNetworkFlag = profile.shared_network_flag || ringDegree >= 3 ? 1 : 0;

    const featureVector: FraudFeatureVector = {
      mock_location_flag: mockFlag,
      accelerometer_variance: profile.accelerometer_variance,
      barometric_delta_match: barometricMatch,
      gnss_cn0_agc_anomaly: gnssAnomaly,
      gnss_ntp_time_delta: gnssDeltaSeconds,
      bssid_zone_match: sharedNetworkFlag ? 0 : 1,
      cell_tower_zone_match: cellTowerMatch,
      battery_drain_z_score: profile.battery_drain_z_score,
      speed_variance_30min: speedVariance,
      route_vector_linearity: routeLinearity,
      recent_app_activity_in_zone: profile.recent_app_activity_in_zone ? 1 : 0,
      claim_burst_rank: claimBurstRank,
      device_proximity_graph_degree: ringDegree,
      shared_network_flag: sharedNetworkFlag,
      source_consensus_score: sourceConsensusScore,
    };

    const modelResult = this.model.score(featureVector);
    const adjustedScore = this.clamp(
      modelResult.score +
        (mockFlag ? 0.35 : 0) +
        (geoValidation ? 0 : 0.7) +
        (dedupValidation ? 0 : 0.7) +
        (sourceConsensusScore > 0 ? 0 : 0.25) +
        (ringDegree >= 3 ? 0.3 : 0),
    );

    const decision =
      !geoValidation || !dedupValidation
        ? { action: 'REJECT' as RBAOutcome, message: 'Claim rejected by hard pre-check.' }
        : rbaDecision(adjustedScore, policy.saferider_tier);

    const reasonByOutcome: Record<RBAOutcome, string> = {
      AUTO_APPROVE: 'Claim auto-approved by fraud engine',
      SOFT_HOLD: 'Claim placed in soft hold for passive re-check',
      STEP_UP: 'Claim requires step-up verification',
      REJECT: !geoValidation
        ? 'GPS outside eligible zone boundary'
        : !dedupValidation
          ? 'Duplicate worker-event claim attempt'
          : 'Claim rejected by fraud policy',
    };

    const fraudDetail: FraudDetail = {
      claim_id: claimId,
      fraud_score: adjustedScore,
      rba_outcome: decision.action,
      shap_values: modelResult.shap,
      feature_vector: featureVector,
      layer_outcomes: {
        mock_check: mockFlag ? 'FAIL' : 'PASS',
        geo_validation: geoValidation ? 'PASS' : 'FAIL',
        dedup: dedupValidation ? 'PASS' : 'FAIL',
        source_consensus: sourceConsensusScore > 0 ? 'PASS' : 'FAIL',
        isolation_forest: adjustedScore,
        syndicate_graph: `DEGREE_${ringDegree}`,
      },
    };

    return {
      passed: decision.action === 'AUTO_APPROVE',
      score: adjustedScore,
      reason: reasonByOutcome[decision.action],
      duration_ms: Date.now() - start,
      rbaOutcome: decision.action,
      fraudDetail,
      notification:
        decision.action === 'SOFT_HOLD' || decision.action === 'STEP_UP' || decision.action === 'REJECT'
          ? {
              type: decision.action,
              message: decision.message ?? reasonByOutcome[decision.action],
            }
          : undefined,
    };
  }

  private rejectMissingZone(claimId: string, startTs: number): FraudResult {
    return {
      passed: false,
      score: 1,
      reason: 'Missing zone metadata',
      duration_ms: Date.now() - startTs,
      rbaOutcome: 'REJECT',
      fraudDetail: {
        claim_id: claimId,
        fraud_score: 1,
        rba_outcome: 'REJECT',
        shap_values: {},
        feature_vector: {
          mock_location_flag: 0,
          accelerometer_variance: 0,
          barometric_delta_match: 0,
          gnss_cn0_agc_anomaly: 0,
          gnss_ntp_time_delta: 0,
          bssid_zone_match: 0,
          cell_tower_zone_match: 0,
          battery_drain_z_score: 0,
          speed_variance_30min: 0,
          route_vector_linearity: 1,
          recent_app_activity_in_zone: 0,
          claim_burst_rank: 0,
          device_proximity_graph_degree: 0,
          shared_network_flag: 0,
          source_consensus_score: 0,
        },
        layer_outcomes: {
          mock_check: 'PASS',
          geo_validation: 'FAIL',
          dedup: 'FAIL',
          source_consensus: 'FAIL',
          isolation_forest: 1,
          syndicate_graph: 'DEGREE_0',
        },
      },
      notification: {
        type: 'REJECT',
        message: 'Claim rejected due to missing zone metadata.',
      },
    };
  }

  private defaultTelemetryProfile(workerId: string, lat: number, lng: number): WorkerTelemetryProfile {
    const now = Date.now();
    return {
      worker_id: workerId,
      mock_provider: false,
      allow_mock_location: false,
      lat,
      lng,
      hdop: 5,
      accelerometer_variance: 0.32,
      barometric_pressure_hpa: 1005,
      gnss_cn0: 34,
      gnss_agc: -2,
      gps_timestamp_ms: now,
      ntp_timestamp_ms: now + 300,
      battery_drain_z_score: 0.2,
      speed_samples: [3.2, 4.8, 5.1],
      bssids: [],
      cell_tower_ids: [],
      recent_app_activity_in_zone: true,
      shared_network_flag: false,
    };
  }

  private checkMockLocation(profile: WorkerTelemetryProfile): Promise<number> {
    return Promise.resolve(profile.mock_provider || profile.allow_mock_location ? 1 : 0);
  }

  private checkGeoValidation(
    profile: WorkerTelemetryProfile,
    zoneLat: number,
    zoneLng: number,
  ): Promise<boolean> {
    const meters = this.haversineMeters(profile.lat, profile.lng, zoneLat, zoneLng);
    const tolerance = Math.max(50, profile.hdop * 10);
    return Promise.resolve(meters <= tolerance);
  }

  private async checkWorkerEventDedup(workerId: string, eventId: string): Promise<boolean> {
    const key = `claim:${workerId}:${eventId}`;
    const inserted = await this.redis.set(key, '1', 'EX', 60 * 60 * 24, 'NX');
    return inserted === 'OK';
  }

  private checkSourceConsensus(event: DisruptionEvent): Promise<number> {
    if (event.trigger_type === 'CURFEW' || event.trigger_type === 'PLATFORM_DOWN') {
      return Promise.resolve(1);
    }

    return Promise.resolve(event.source_apis.length >= 2 ? 1 : 0);
  }

  private async computeClaimBurstRank(eventId: string, workerId: string): Promise<number> {
    const key = `fraud:burst:${eventId}`;
    const now = Date.now();
    await this.redis.zadd(key, String(now), workerId);
    await this.redis.expire(key, 60 * 60);

    const rank = await this.redis.zrank(key, workerId);
    const count = await this.redis.zcard(key);
    if (rank === null || count === 0) return 1;

    return Number(((rank + 1) / count).toFixed(4));
  }

  private hashBssid(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex').slice(0, 16);
  }

  private variance(samples: number[]): number {
    if (!samples.length) return 0;
    const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length;
    return (
      samples.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
      Math.max(samples.length, 1)
    );
  }

  private haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const toRadians = (value: number): number => (value * Math.PI) / 180;
    const earthRadiusM = 6_371_000;
    const dLat = toRadians(lat2 - lat1);
    const dLng = toRadians(lng2 - lng1);

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadiusM * c;
  }

  private clamp(value: number): number {
    if (value < 0) return 0;
    if (value > 1) return 1;
    return Number(value.toFixed(4));
  }
}
