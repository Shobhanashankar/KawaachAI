import { query } from '../db';
import { ExclusionState } from '../types';

const KEYS = ['war', 'pandemic_WHO_declared', 'government_force_majeure'] as const;

export interface ExclusionUpdateInput {
  war?: boolean;
  pandemic_WHO_declared?: boolean;
  government_force_majeure?: boolean;
  reason?: string;
  set_by?: string;
}

export const getExclusionState = async (): Promise<ExclusionState> => {
  const result = await query<{ key: string; active: boolean; reason: string | null; set_by: string | null; set_at: string | null }>(
    `
      SELECT key, active, reason, set_by, set_at::text
      FROM exclusion_flags
      WHERE key = ANY($1::text[])
    `,
    [KEYS],
  );

  const state: ExclusionState = {
    war: false,
    pandemic_WHO_declared: false,
    government_force_majeure: false,
  };

  for (const row of result.rows) {
    if (row.key === 'war') state.war = row.active;
    if (row.key === 'pandemic_WHO_declared') state.pandemic_WHO_declared = row.active;
    if (row.key === 'government_force_majeure') state.government_force_majeure = row.active;
    state.reason = row.reason ?? undefined;
    state.set_by = row.set_by ?? undefined;
    state.set_at = row.set_at ?? undefined;
  }

  return state;
};

export const setExclusionState = async (input: ExclusionUpdateInput): Promise<void> => {
  const updates: Array<[string, boolean | undefined]> = [
    ['war', input.war],
    ['pandemic_WHO_declared', input.pandemic_WHO_declared],
    ['government_force_majeure', input.government_force_majeure],
  ];

  for (const [key, value] of updates) {
    if (typeof value !== 'boolean') continue;
    await query(
      `
        INSERT INTO exclusion_flags (key, active, reason, set_by, set_at)
        VALUES ($1, $2, $3, $4, now())
        ON CONFLICT (key)
        DO UPDATE
          SET active = EXCLUDED.active,
              reason = EXCLUDED.reason,
              set_by = EXCLUDED.set_by,
              set_at = EXCLUDED.set_at
      `,
      [key, value, input.reason ?? null, input.set_by ?? 'admin'],
    );
  }
};

export const hasAnyExclusion = (state: ExclusionState): boolean => {
  return state.war || state.pandemic_WHO_declared || state.government_force_majeure;
};
