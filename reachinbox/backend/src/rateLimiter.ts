import { redisConnection } from "./redis";

// Returns the current 1-hour "bucket" as a string, e.g. "2026-09-26T14"
// Every sender gets one counter per hour, so limits reset automatically.
function currentHourWindow(date = new Date()): string {
  return date.toISOString().slice(0, 13); // "YYYY-MM-DDTHH"
}

function nextHourStart(date = new Date()): Date {
  const next = new Date(date);
  next.setMinutes(0, 0, 0);
  next.setHours(next.getHours() + 1);
  return next;
}

/**
 * Atomically increments this sender's counter for the current hour and
 * tells you whether they are still under the limit.
 *
 * Why Redis and not an in-memory variable?
 * Because if you ever run 2+ worker processes/instances, an in-memory
 * counter would be wrong (each process has its own number). Redis INCR
 * is atomic across every process talking to the same Redis, so counting
 * stays correct no matter how many workers you run.
 */
export async function tryConsumeQuota(
  senderId: string,
  maxPerHour: number
): Promise<{ allowed: boolean; nextWindowStart: Date }> {
  const window = currentHourWindow();
  const key = `ratelimit:${senderId}:${window}`;

  const count = await redisConnection.incr(key);
  if (count === 1) {
    // first hit this hour - make the counter expire after ~1 hour
    // so we don't leak keys forever
    await redisConnection.expire(key, 3600);
  }

  if (count > maxPerHour) {
    // Over the limit: roll the counter back (we didn't actually use this slot)
    await redisConnection.decr(key);
    return { allowed: false, nextWindowStart: nextHourStart() };
  }

  return { allowed: true, nextWindowStart: nextHourStart() };
}

// Minimum gap between two sends from the SAME sender (mimics provider throttling).
export async function waitMinDelay(senderId: string, minDelayMs: number) {
  const key = `lastsend:${senderId}`;
  const last = await redisConnection.get(key);
  const now = Date.now();
  if (last) {
    const elapsed = now - parseInt(last, 10);
    if (elapsed < minDelayMs) {
      await new Promise((r) => setTimeout(r, minDelayMs - elapsed));
    }
  }
  await redisConnection.set(key, Date.now().toString());
}
