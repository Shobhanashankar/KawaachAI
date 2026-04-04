import { useEffect, useMemo, useState } from 'react';
import { ClaimsTimeline } from '../components/ClaimsTimeline';
import { KPICard } from '../components/KPICard';
import { ServiceHealth } from '../components/ServiceHealth';
import { getClaims, getKpis, getMetricsRaw, getServiceHealth } from '../services/api';
import { parsePrometheusText } from '../services/metrics';
import { ClaimRow, DashboardKpis, ServiceHealthRow } from '../types';

export function OverviewPage() {
  const [kpis, setKpis] = useState<DashboardKpis | null>(null);
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [services, setServices] = useState<ServiceHealthRow[]>([]);
  const [metricsSnippet, setMetricsSnippet] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const [nextKpis, nextClaims, nextServices, metricsText] = await Promise.all([
        getKpis(),
        getClaims({ limit: 50 }),
        getServiceHealth(),
        getMetricsRaw(),
      ]);

      if (!mounted) return;
      setKpis(nextKpis);
      setClaims(nextClaims);
      setServices(nextServices);

      const parsedMetrics = parsePrometheusText(metricsText)
        .filter((metric) => metric.name === 'kawaachai_claims_total')
        .slice(0, 4)
        .map((metric) => `${metric.labels.status ?? 'unknown'}: ${metric.value}`)
        .join(' | ');

      setMetricsSnippet(parsedMetrics);
      setLoading(false);
    };

    void load();
    const timer = setInterval(() => {
      void load();
    }, 30_000);

    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  const cards = useMemo(() => {
    if (!kpis) return [];

    return [
      {
        title: 'Active Policies',
        value: String(kpis.active_policies),
      },
      {
        title: 'Claims This Week',
        value: String(kpis.claims_this_week),
      },
      {
        title: 'Auto-Approval Rate',
        value: `${kpis.auto_approval_rate_pct.toFixed(2)}%`,
      },
      {
        title: 'Manual Queue Depth',
        value: String(kpis.manual_review_queue_depth),
      },
      {
        title: 'Revenue This Week',
        value: `INR ${kpis.revenue_this_week_inr.toFixed(2)}`,
      },
      {
        title: 'Avg Claim->Payout Latency',
        value: `${kpis.avg_claim_to_payout_latency_ms.toFixed(0)} ms`,
      },
    ];
  }, [kpis]);

  if (loading) {
    return <div className="card">Loading overview...</div>;
  }

  return (
    <div className="page-grid">
      <section className="metric-grid">
        {cards.map((card) => (
          <KPICard key={card.title} title={card.title} value={card.value} />
        ))}
      </section>

      <ServiceHealth services={services} />

      <section className="card">
        <h2>Prometheus Snapshot</h2>
        <p className="muted">{metricsSnippet || 'No claim metrics yet.'}</p>
      </section>

      <ClaimsTimeline claims={claims} />
    </div>
  );
}
