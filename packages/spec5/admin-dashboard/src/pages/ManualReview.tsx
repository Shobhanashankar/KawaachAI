import { useEffect, useMemo, useState } from 'react';
import { LLMSummaryCard } from '../components/LLMSummaryCard';
import { getClaims, runLlmReview, saveDecision } from '../services/api';
import { ClaimRow, LlmReviewPayload } from '../types';

export function ManualReviewPage() {
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [selectedClaimId, setSelectedClaimId] = useState<string>('');
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summaries, setSummaries] = useState<Record<string, LlmReviewPayload>>({});
  const [reason, setReason] = useState('');
  const [savingDecision, setSavingDecision] = useState(false);

  const load = async () => {
    const queue = await getClaims({ limit: 120, status: ['STEP_UP', 'MANUAL_REVIEW'] });
    const sorted = [...queue].sort((a, b) => (b.fraud_score ?? 0) - (a.fraud_score ?? 0));
    setClaims(sorted);
    if (!selectedClaimId && sorted[0]) {
      setSelectedClaimId(sorted[0].id);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const selectedClaim = useMemo(() => claims.find((claim) => claim.id === selectedClaimId) ?? null, [claims, selectedClaimId]);

  const requestSummary = async () => {
    if (!selectedClaimId) return;
    setLoadingSummary(true);
    try {
      const summary = await runLlmReview(selectedClaimId);
      setSummaries((prev) => ({ ...prev, [selectedClaimId]: summary }));
    } finally {
      setLoadingSummary(false);
    }
  };

  const submitDecision = async (decision: 'APPROVE' | 'REJECT' | 'REQUEST_MORE_INFO') => {
    if (!selectedClaimId) return;
    setSavingDecision(true);
    try {
      await saveDecision(selectedClaimId, { decision, reason });
      setReason('');
      await load();
    } finally {
      setSavingDecision(false);
    }
  };

  return (
    <div className="page-grid split-2">
      <section className="card">
        <h2>Manual Review Queue</h2>
        <div className="table-wrap" style={{ maxHeight: 540 }}>
          <table>
            <thead>
              <tr>
                <th>Claim</th>
                <th>Worker</th>
                <th>Status</th>
                <th>Fraud Score</th>
              </tr>
            </thead>
            <tbody>
              {claims.map((claim) => (
                <tr
                  key={claim.id}
                  style={{ cursor: 'pointer', background: selectedClaimId === claim.id ? '#edf7f0' : undefined }}
                  onClick={() => setSelectedClaimId(claim.id)}
                >
                  <td>{claim.id.slice(0, 8)}...</td>
                  <td>{claim.worker_name ?? claim.worker_id}</td>
                  <td>{claim.status}</td>
                  <td>{claim.fraud_score?.toFixed(2) ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="page-grid">
        <section className="card">
          <h2>Selected Claim</h2>
          {selectedClaim ? (
            <>
              <p>
                <strong>Claim:</strong> {selectedClaim.id}
              </p>
              <p>
                <strong>Worker:</strong> {selectedClaim.worker_name ?? selectedClaim.worker_id}
              </p>
              <p>
                <strong>Zone:</strong> {selectedClaim.city} ({selectedClaim.h3_zone})
              </p>
              <p>
                <strong>Fraud Score:</strong> {selectedClaim.fraud_score?.toFixed(2) ?? '-'}
              </p>

              <button type="button" className="btn btn-primary" onClick={requestSummary} disabled={loadingSummary}>
                {loadingSummary ? 'Generating...' : 'AI Summary'}
              </button>
            </>
          ) : (
            <p className="muted">Select a claim to start manual review.</p>
          )}
        </section>

        {selectedClaimId && summaries[selectedClaimId] ? (
          <LLMSummaryCard summary={summaries[selectedClaimId]} />
        ) : null}

        <section className="card">
          <h3>Admin Decision Override</h3>
          <textarea
            rows={3}
            value={reason}
            placeholder="Override reason (required for audit clarity)"
            onChange={(event) => setReason(event.target.value)}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <button
              className="btn btn-primary"
              type="button"
              disabled={savingDecision || !selectedClaimId}
              onClick={() => submitDecision('APPROVE')}
            >
              Approve
            </button>
            <button
              className="btn btn-danger"
              type="button"
              disabled={savingDecision || !selectedClaimId}
              onClick={() => submitDecision('REJECT')}
            >
              Reject
            </button>
            <button
              className="btn btn-muted"
              type="button"
              disabled={savingDecision || !selectedClaimId}
              onClick={() => submitDecision('REQUEST_MORE_INFO')}
            >
              Request More Info
            </button>
          </div>
        </section>
      </section>
    </div>
  );
}
