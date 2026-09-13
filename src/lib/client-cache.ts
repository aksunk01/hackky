/**
 * Each provider (Gemini/Claude/ElevenLabs) has no shared/env fallback — every
 * call runs against the caller's own key — so a client per distinct API key
 * is cached rather than rebuilt on every request. Bounded so keys a user has
 * since rotated or removed don't accumulate in memory forever.
 */
const MAX_CACHED_CLIENTS = 50;

export function createKeyedClientCache<T>(create: (apiKey: string) => T): (apiKey: string) => T {
  const cache = new Map<string, T>();
  return (apiKey: string) => {
    const existing = cache.get(apiKey);
    if (existing) return existing;
    if (cache.size >= MAX_CACHED_CLIENTS) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    const client = create(apiKey);
    cache.set(apiKey, client);
    return client;
  };
}
