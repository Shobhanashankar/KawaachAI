import { ClaimRow } from '../types';

const statusClass = (status: string): 'ok' | 'warn' | 'danger' => {
  if (status === 'APPROVED' || status === 'FNOL_SUBMITTED' || status === 'PAYOUT_QUEUED') return 'ok';
  if (status === 'SOFT_HOLD' || status === 'STEP_UP' || status === 'MANUAL_REVIEW') return 'warn';
  return 'danger';
};

interface ClaimsTimelineProps {
  claims: ClaimRow[];
}

export function ClaimsTimeline({ claims }: ClaimsTimelineProps) {
  return (
    <section className="card">
      <h2>Last 50 Claims Timeline</h2>
      <div style={{ maxHeight: 420, overflow: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Claim</th>
              <th>Status</th>
              <th>Worker</th>
              <th>Zone</th>
              <th>Payout (INR)</th>
              <th>Fraud Score</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {claims.map((claim) => (
              <tr key={claim.id}>
                <td>{claim.id.slice(0, 8)}...</td>
                <td>
                  <span className={`status-pill ${statusClass(claim.status)}`}>{claim.status}</span>
                </td>
                <td>{claim.worker_name ?? claim.worker_id}</td>
                <td>{claim.h3_zone.slice(0, 8)}...</td>
                <td>{claim.payout_amount_inr.toFixed(2)}</td>
                <td>{claim.fraud_score?.toFixed(2) ?? '-'}</td>
                <td>{new Date(claim.updated_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
