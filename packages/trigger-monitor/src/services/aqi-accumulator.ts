import Redis from 'ioredis';

export class AqiAccumulator {
  constructor(private readonly redis: Redis) {}

  private key(zoneH3: string): string {
    return `aqi:zone:${zoneH3}`;
  }

  async reset(zoneH3: string): Promise<void> {
    await this.redis.del(this.key(zoneH3));
  }

  async recordBreach(
    zoneH3: string,
    breached: boolean,
    timestampMs: number,
    requiredSamples: number,
  ): Promise<boolean> {
    const key = this.key(zoneH3);

    if (!breached) {
      await this.reset(zoneH3);
      return false;
    }

    await this.redis.zadd(key, String(timestampMs), String(timestampMs));

    const retentionMs = Math.max(requiredSamples * 5 * 60 * 1000, 15 * 60 * 1000);
    await this.redis.zremrangebyscore(key, 0, timestampMs - retentionMs);
    await this.redis.expire(key, Math.ceil(retentionMs / 1000));

    const count = await this.redis.zcard(key);
    return count >= requiredSamples;
  }
}
