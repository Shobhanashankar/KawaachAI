import { LlmReviewPayload } from '../types';

interface LLMSummaryCardProps {
  summary: LlmReviewPayload;
}

const severityClass = (severity: 'HIGH' | 'MEDIUM' | 'LOW'): 'danger' | 'warn' | 'ok' => {
  if (severity === 'HIGH') return 'danger';
  if (severity === 'MEDIUM') return 'warn';
  return 'ok';
};

export function LLMSummaryCard({ summary }: LLMSummaryCardProps) {
  if (!summary.available || !summary.result) {
    return (
      <section className="card">
        <h3>AI Summary</h3>
        <p className="muted">{summary.fallback_message ?? 'AI summary unavailable — please review manually.'}</p>
        <details>
          <summary>View prompt</summary>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{summary.prompt}</pre>
        </details>
      </section>
    );
  }

  const result = summary.result;

  return (
    <section className="card">
      <h3>AI Summary</h3>
      <p>{result.summary}</p>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <span className="status-pill ok">Recommendation: {result.recommendation}</span>
        <span className="status-pill warn">Confidence: {result.confidence}</span>
      </div>

      <h4 style={{ marginBottom: 8 }}>Top Fraud Signals</h4>
      {result.top_signals.map((signal) => (
        <article key={signal.signal} className="card" style={{ boxShadow: 'none', marginBottom: 8 }}>
          <p style={{ margin: 0, fontWeight: 600 }}>{signal.signal}</p>
          <p style={{ margin: '6px 0' }}>{signal.explanation}</p>
          <span className={`status-pill ${severityClass(signal.severity)}`}>{signal.severity}</span>
        </article>
      ))}

      <h4 style={{ marginBottom: 8 }}>Reasoning</h4>
      <p>{result.reasoning}</p>

      <details>
        <summary>View prompt</summary>
        <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{summary.prompt}</pre>
      </details>
    </section>
  );
}
