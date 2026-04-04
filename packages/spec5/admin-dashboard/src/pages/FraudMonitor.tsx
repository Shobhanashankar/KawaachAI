import { useEffect, useMemo, useState } from 'react';
import { RingGraph } from '../components/RingGraph';
import { ShapChart } from '../components/ShapChart';
import { getClaims, getFraudRings, getLayerStats } from '../services/api';
import { ClaimRow, FraudRing, LayerStat } from '../types';

export function FraudMonitorPage() {
  const [stats, setStats] = useState<LayerStat[]>([]);
  const [rings, setRings] = useState<FraudRing[]>([]);
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [selectedClaimId, setSelectedClaimId] = useState<string>('');

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const [nextStats, nextRings, nextClaims] = await Promise.all([
        getLayerStats(),
        getFraudRings(),
        getClaims({ limit: 80 }),
      ]);

      if (!mounted) return;
      setStats(nextStats);
      setRings(nextRings);
      setClaims(nextClaims);

      if (!selectedClaimId) {
        const withFraudDetail = nextClaims.find((claim) => Boolean(claim.fraud_detail));
        if (withFraudDetail) {
          setSelectedClaimId(withFraudDetail.id);
        }
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [selectedClaimId]);

  const selectedClaim = useMemo(() => {
    return claims.find((claim) => claim.id === selectedClaimId) ?? null;
  }, [claims, selectedClaimId]);

  return (
    <div className="page-grid">
      <section className="card">
        <h2>6-Layer Defense Stack Performance</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Layer</th>
                <th>Total Claims</th>
                <th>Pass Rate</th>
                <th>Reject Rate</th>
                <th>Avg Latency</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((row) => (
                <tr key={row.layer}>
                  <td>{row.layer}</td>
                  <td>{row.total_claims_processed}</td>
                  <td>{row.pass_rate_pct.toFixed(2)}%</td>
                  <td>{row.reject_rate_pct.toFixed(2)}%</td>
                  <td>{row.avg_latency_ms.toFixed(2)} ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <RingGraph rings={rings} />

      <section className="card split-2">
        <div>
          <h2>Claim Fraud Detail</h2>
          <select
            className="input"
            value={selectedClaimId}
            onChange={(event) => setSelectedClaimId(event.target.value)}
          >
            <option value="">Select claim</option>
            {claims.map((claim) => (
              <option key={claim.id} value={claim.id}>
                {claim.id.slice(0, 8)}... | {claim.status} | {claim.worker_id}
              </option>
            ))}
          </select>

          {selectedClaim ? (
            <div style={{ marginTop: 12 }}>
              <p>
                <strong>Fraud Score:</strong> {selectedClaim.fraud_score?.toFixed(2) ?? '-'}
              </p>
              <p>
                <strong>RBA Outcome:</strong> {selectedClaim.rba_outcome ?? '-'}
              </p>

              <h3>Layer Outcomes</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Layer</th>
                      <th>Outcome</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(selectedClaim.fraud_detail?.layer_outcomes ?? {}).map(([key, value]) => (
                      <tr key={key}>
                        <td>{key}</td>
                        <td>{String(value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="muted" style={{ marginTop: 10 }}>
              Select a claim to view SHAP and layer outcomes.
            </p>
          )}
        </div>

        <div>
          <h2>SHAP Breakdown</h2>
          <ShapChart shapValues={selectedClaim?.fraud_detail?.shap_values ?? {}} />
        </div>
      </section>
    </div>
  );
}
