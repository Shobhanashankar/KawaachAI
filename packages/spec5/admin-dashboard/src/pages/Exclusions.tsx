import { useEffect, useState } from 'react';
import { ServiceHealth } from '../components/ServiceHealth';
import { getExclusions, getServiceHealth, updateExclusions } from '../services/api';
import { ExclusionState, ServiceHealthRow } from '../types';

interface AuditEvent {
  at: string;
  admin: string;
  reason: string;
  nextState: ExclusionState;
}

const adminUser = import.meta.env.VITE_ADMIN_USER ?? 'admin-ui';

const formatAdminLabel = (value: string | null | undefined): string => {
  if (!value) return 'N/A';
  if (value.toLowerCase().includes('spec5')) return 'admin-ui';
  return value;
};

export function ExclusionsPage() {
  const [state, setState] = useState<ExclusionState | null>(null);
  const [services, setServices] = useState<ServiceHealthRow[]>([]);
  const [reason, setReason] = useState('');
  const [auditTrail, setAuditTrail] = useState<AuditEvent[]>([]);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const [nextState, nextServices] = await Promise.all([getExclusions(), getServiceHealth()]);
      if (!mounted) return;
      setState(nextState);
      setServices(nextServices);
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

  const toggleFlag = async (key: keyof Pick<ExclusionState, 'war' | 'pandemic_WHO_declared' | 'government_force_majeure'>) => {
    if (!state) return;

    const confirmed = window.confirm('Setting this flag will halt all claim processing. Confirm?');
    if (!confirmed) return;

    setUpdating(true);
    try {
      const next = await updateExclusions({
        [key]: !state[key],
        reason: reason || `Updated ${key}`,
      });
      setState(next);

      setAuditTrail((prev) => [
        {
          at: new Date().toISOString(),
          admin: adminUser,
          reason: reason || `Updated ${key}`,
          nextState: next,
        },
        ...prev,
      ]);

      setReason('');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="page-grid split-2">
      <section className="page-grid">
        <section className="card">
          <h2>Exclusion Flag Management</h2>
          {!state ? (
            <p className="muted">Loading flags...</p>
          ) : (
            <>
              <label htmlFor="exclusion-reason" style={{ display: 'block', marginBottom: 8 }}>
                Reason
              </label>
              <input
                id="exclusion-reason"
                className="input"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Reason for exclusion state update"
              />

              <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                <button type="button" className="btn btn-muted" disabled={updating} onClick={() => toggleFlag('war')}>
                  War: {state.war ? 'ON' : 'OFF'}
                </button>
                <button
                  type="button"
                  className="btn btn-muted"
                  disabled={updating}
                  onClick={() => toggleFlag('pandemic_WHO_declared')}
                >
                  Pandemic WHO Declared: {state.pandemic_WHO_declared ? 'ON' : 'OFF'}
                </button>
                <button
                  type="button"
                  className="btn btn-muted"
                  disabled={updating}
                  onClick={() => toggleFlag('government_force_majeure')}
                >
                  Government Force Majeure: {state.government_force_majeure ? 'ON' : 'OFF'}
                </button>
              </div>

              <p className="muted" style={{ marginTop: 10 }}>
                Last update: {state.set_at ? new Date(state.set_at).toLocaleString() : 'N/A'} by {formatAdminLabel(state.set_by)}
              </p>
            </>
          )}
        </section>

        <ServiceHealth services={services} />
      </section>

      <section className="card">
        <h2>Exclusion Audit Trail</h2>
        {auditTrail.length === 0 ? (
          <p className="muted">No local audit events yet in this session.</p>
        ) : (
          <div style={{ maxHeight: 540, overflow: 'auto' }}>
            {auditTrail.map((item, idx) => (
              <article key={`${item.at}-${idx}`} className="card" style={{ boxShadow: 'none', marginBottom: 8 }}>
                <p style={{ margin: 0, fontWeight: 600 }}>{new Date(item.at).toLocaleString()}</p>
                <p style={{ margin: '6px 0' }}>Admin: {formatAdminLabel(item.admin)}</p>
                <p style={{ margin: '6px 0' }}>Reason: {item.reason}</p>
                <p style={{ margin: 0 }}>
                  Flags: war={String(item.nextState.war)}, pandemic={String(item.nextState.pandemic_WHO_declared)},
                  force-majeure: {String(item.nextState.government_force_majeure)}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
