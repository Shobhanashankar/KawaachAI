import Redis from 'ioredis';
import {
  ExclusionState,
  ExclusionUpdateInput,
  getExclusionState,
  hasAnyExclusion,
  setExclusionState,
} from '@kawaachai/shared';

const CACHE_KEY = 'exclusion:active';

export interface ExclusionCheck {
  active: boolean;
  activeKey: string | null;
  reason: string | undefined;
  state: ExclusionState;
}

export class ExclusionService {
  constructor(private readonly redis: Redis) {}

  async getState(): Promise<ExclusionState> {
    const cached = await this.redis.get(CACHE_KEY);
    if (cached) {
      return JSON.parse(cached) as ExclusionState;
    }

    const state = await getExclusionState();
    await this.redis.set(CACHE_KEY, JSON.stringify(state), 'EX', 60);
    return state;
  }

  async update(input: ExclusionUpdateInput): Promise<ExclusionState> {
    await setExclusionState(input);
    const state = await getExclusionState();
    await this.redis.set(CACHE_KEY, JSON.stringify(state), 'EX', 60);
    return state;
  }

  async check(): Promise<ExclusionCheck> {
    const state = await this.getState();
    const activeKey = state.war
      ? 'war'
      : state.pandemic_WHO_declared
        ? 'pandemic_WHO_declared'
        : state.government_force_majeure
          ? 'government_force_majeure'
          : null;

    return {
      active: hasAnyExclusion(state),
      activeKey,
      reason: activeKey ? state.reason ?? activeKey : undefined,
      state,
    };
  }
}
