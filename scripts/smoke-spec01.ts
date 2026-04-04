const triggerBase = process.env.TRIGGER_BASE_URL ?? 'http://localhost:3001';
const claimsBase = process.env.CLAIMS_BASE_URL ?? 'http://localhost:3002';
const token = process.env.ADMIN_BEARER_TOKEN ?? 'change-me';

const request = async (url: string, init?: RequestInit): Promise<unknown> => {
  const response = await fetch(url, init);
  const text = await response.text();
  let payload: unknown = text;
  try {
    payload = JSON.parse(text);
  } catch {
    // Keep raw text when response is not JSON.
  }

  if (!response.ok) {
    throw new Error(`Request failed ${response.status} ${response.statusText}: ${JSON.stringify(payload)}`);
  }

  return payload;
};

const run = async (): Promise<void> => {
  console.log('Running SPEC-01 smoke checks...');

  const triggerHealth = await request(`${triggerBase}/health`);
  const claimsHealth = await request(`${claimsBase}/health`);
  console.log('Trigger health:', triggerHealth);
  console.log('Claims health:', claimsHealth);

  const exclusions = await request(`${triggerBase}/admin/exclusions`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  console.log('Current exclusions:', exclusions);

  const webhookResult = await request(`${triggerBase}/webhooks/curfew`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });
  console.log('Curfew webhook published:', webhookResult);

  console.log('Smoke checks completed.');
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

export {};
