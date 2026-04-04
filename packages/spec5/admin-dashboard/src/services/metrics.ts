export interface ParsedMetric {
  name: string;
  labels: Record<string, string>;
  value: number;
}

const parseLabels = (raw: string): Record<string, string> => {
  const labels: Record<string, string> = {};
  if (!raw.trim()) return labels;

  for (const token of raw.split(',')) {
    const [key, value] = token.split('=');
    if (!key || !value) continue;
    labels[key.trim()] = value.replace(/^"|"$/g, '').trim();
  }

  return labels;
};

export const parsePrometheusText = (text: string): ParsedMetric[] => {
  const lines = text.split('\n');
  const result: ParsedMetric[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const match = trimmed.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*)(\{([^}]*)\})?\s+([-+]?\d+(?:\.\d+)?(?:e[-+]?\d+)?)$/);
    if (!match) continue;

    result.push({
      name: match[1],
      labels: parseLabels(match[3] ?? ''),
      value: Number(match[4]),
    });
  }

  return result;
};
