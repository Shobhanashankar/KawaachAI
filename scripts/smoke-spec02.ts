const triggerBase = process.env.TRIGGER_BASE_URL ?? 'http://localhost:3001';
const claimsBase = process.env.CLAIMS_BASE_URL ?? 'http://localhost:3002';
const token = process.env.ADMIN_BEARER_TOKEN ?? 'change-me';

const request = async (url: string, init?: RequestInit): Promise<unknown> => {
  const response = await fetch(url, init);
  const text = await response.text();
  const payload = (() => {
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return text;
    }
  })();

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${JSON.stringify(payload)}`);
  }

  return payload;
};

const sleep = async (ms: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, ms));
};

const run = async (): Promise<void> => {
  console.log('Running SPEC-02 smoke checks...');

  await request(`${triggerBase}/admin/exclusions`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ war: false, pandemic_WHO_declared: false, government_force_majeure: false }),
  });

  const event = await request(`${triggerBase}/webhooks/curfew`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ zone_h3: '8828308281fffff' }),
  });
  console.log('Published event:', event);

  await sleep(1500);

  const rings = await request(`${claimsBase}/admin/fraud/rings`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const layerStats = await request(`${claimsBase}/admin/fraud/layer-stats`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  console.log('Fraud rings:', JSON.stringify(rings));
  console.log('Layer stats:', JSON.stringify(layerStats));
  console.log('SPEC-02 smoke checks completed.');
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

export {};
