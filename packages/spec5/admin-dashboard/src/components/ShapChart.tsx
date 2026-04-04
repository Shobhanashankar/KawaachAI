import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface ShapChartProps {
  shapValues: Record<string, number>;
}

export function ShapChart({ shapValues }: ShapChartProps) {
  const data = Object.entries(shapValues)
    .map(([key, value]) => ({ feature: key, value }))
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
    .slice(0, 8);

  return (
    <div style={{ width: '100%', height: 280 }}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ left: 4, right: 14, top: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.35} />
          <XAxis type="number" />
          <YAxis dataKey="feature" type="category" width={160} />
          <Tooltip />
          <Bar dataKey="value" fill="#0a7a4f" radius={[0, 6, 6, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
