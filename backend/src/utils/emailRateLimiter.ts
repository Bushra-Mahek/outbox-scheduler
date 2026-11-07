import type { Redis } from "ioredis";
import { randomUUID } from "node:crypto";

const RATE_LIMIT_SCRIPT = `
  local windowKey = KEYS[1]
  local lastSendKey = KEYS[2]

  local now = tonumber(ARGV[1])
  local hourlyLimit = tonumber(ARGV[2])
  local delayMs = tonumber(ARGV[3])
  local member = ARGV[4]

  local hourAgo = now - 3600000

  redis.call("ZREMRANGEBYSCORE", windowKey, "-inf", hourAgo)

  local count = redis.call("ZCARD", windowKey)

  if hourlyLimit > 0 and count >= hourlyLimit then
    local oldest = redis.call("ZRANGE", windowKey, 0, 0, "WITHSCORES")
    local wait = tonumber(oldest[2]) + 3600000 - now
    return math.max(wait, 1)
  end

  if delayMs > 0 then
    local lastSend = redis.call("GET", lastSendKey)

    if lastSend then
      local wait = tonumber(lastSend) + delayMs - now

      if wait > 0 then
        return wait
      end
    end
  end

  redis.call("ZADD", windowKey, now, member)
  redis.call("EXPIRE", windowKey, 7200)

  if delayMs > 0 then
    redis.call("SET", lastSendKey, now, "PX", math.max(delayMs * 2, 60000))
  end

  return 0
`;

export const reserveEmailSendSlot = async (
  redis: Redis,
  campaignId: string,
  hourlyLimit: number | null,
  delaySeconds: number
): Promise<number> => {
  if (!campaignId) return 0;

  const now = Date.now();
  const member = randomUUID();

  const result = await redis.eval(
    RATE_LIMIT_SCRIPT,
    2,
    `campaign:${campaignId}:hourly`,
    `campaign:${campaignId}:last-send`,
    String(now),
    String(hourlyLimit ?? 0),
    String(delaySeconds * 1000),
    member
  );

  return Number(result);
};
