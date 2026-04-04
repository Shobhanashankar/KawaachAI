interface KPICardProps {
  title: string;
  value: string;
  hint?: string;
}

export function KPICard({ title, value, hint }: KPICardProps) {
  return (
    <article className="card" style={{ minHeight: 124 }}>
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>
        {title}
      </p>
      <h3 style={{ margin: '8px 0 6px', fontSize: 30 }}>{value}</h3>
      {hint ? (
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          {hint}
        </p>
      ) : null}
    </article>
  );
}
