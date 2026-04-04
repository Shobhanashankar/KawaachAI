import { ServiceHealthRow } from '../types';

interface ServiceHealthProps {
  services: ServiceHealthRow[];
}

const formatServiceName = (name: string): string => {
  if (name === 'spec5-admin-api') return 'Admin API';
  if (name === 'trigger-monitor') return 'Trigger Monitor';
  if (name === 'claims-service') return 'Claims Service';
  return name;
};

export function ServiceHealth({ services }: ServiceHealthProps) {
  return (
    <section className="card">
      <h2>Service Health</h2>
      <div className="split-3">
        {services.map((service) => (
          <article key={service.service} className="card" style={{ padding: 12, boxShadow: 'none' }}>
            <p style={{ margin: 0, fontWeight: 600 }}>{formatServiceName(service.service)}</p>
            <p style={{ margin: '6px 0 0' }}>
              <span
                className="legend-dot"
                style={{ background: service.status === 'up' ? 'var(--ok)' : 'var(--danger)' }}
              />
              {service.status === 'up' ? 'Healthy' : 'Down'}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
