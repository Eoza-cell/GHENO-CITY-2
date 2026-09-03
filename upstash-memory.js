/**
 * ATR Long-Term Memory powered by Upstash Redis.
 *
 * Official DB remains the source of truth for stats/position/inventory.
 * Redis stores narrative continuity and validated events across restarts.
 */

let redis = null;
let enabled = false;

try {
  const { Redis } = require('@upstash/redis');
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redis = Redis.fromEnv();
    enabled = true;
    console.log('[UPSTASH MEMORY] Connected.');
  } else {
    console.warn('[UPSTASH MEMORY] Disabled: UPSTASH_REDIS_REST_URL/TOKEN missing.');
  }
} catch (err) {
  console.warn('[UPSTASH MEMORY] SDK unavailable:', err.message);
}

const PREFIX = 'atr:memory:v1';
const clean = (v) => String(v || '').replace(/\s+/g, ' ').trim().slice(0, 1600);
const playerKey = (id) => `${PREFIX}:player:${id}:events`;
const worldKey = () => `${PREFIX}:world:events`;
const summaryKey = (id) => `${PREFIX}:player:${id}:summary`;

async function pushEvent(key, event, max = 500) {
  if (!enabled) return false;
  const payload = JSON.stringify({ ...event, at: new Date().toISOString() });
  await redis.lpush(key, payload);
  await redis.ltrim(key, 0, max - 1);
  await redis.expire(key, 60 * 60 * 24 * 180); // 6 months rolling retention
  return true;
}

async function rememberValidatedAction({ player, action, summary, location, subLocation, impacts = [] }) {
  if (!enabled) return false;

  const event = {
    type: 'validated_action',
    playerId: player.whatsappId,
    playerName: player.name,
    location,
    subLocation,
    action: clean(action),
    summary: clean(summary),
    impacts: impacts.map(clean).slice(0, 12)
  };

  await pushEvent(playerKey(player.whatsappId), event);
  await pushEvent(worldKey(), event, 1000);

  // Keep a compact persistent summary as a fast "identity/arc" memory.
  const previous = await redis.get(summaryKey(player.whatsappId));
  const line = clean(`${location} > ${subLocation}: ${summary}`);
  const merged = previous
    ? clean(`${previous}\n• ${line}`).slice(-12000)
    : `• ${line}`;
  await redis.set(summaryKey(player.whatsappId), merged, { ex: 60 * 60 * 24 * 180 });

  return true;
}

async function rememberImportantEvent(event) {
  if (!enabled) return false;
  return pushEvent(worldKey(), {
    type: event.type || 'world_event',
    ...event,
    summary: clean(event.summary || event.entry || '')
  }, 1000);
}

async function parseRows(rows) {
  return (rows || []).map(row => {
    if (typeof row === 'string') {
      try { return JSON.parse(row); } catch { return null; }
    }
    return row;
  }).filter(Boolean);
}

async function getNarrativeContext({ player, location, subLocation, limit = 24 }) {
  if (!enabled) {
    return { enabled: false, playerMemory: [], localMemory: [], worldMemory: [], summary: null };
  }

  const [playerRows, worldRows, summary] = await Promise.all([
    redis.lrange(playerKey(player.whatsappId), 0, limit - 1),
    redis.lrange(worldKey(), 0, Math.max(limit * 2, 40) - 1),
    redis.get(summaryKey(player.whatsappId))
  ]);

  const playerMemory = (await parseRows(playerRows)).reverse();

  const world = await parseRows(worldRows);
  const localMemory = world
    .filter(e => e.location === location && e.subLocation === subLocation)
    .slice(0, 12)
    .reverse();

  const worldMemory = world
    .filter(e => e.location === location && e.subLocation !== subLocation)
    .slice(0, 8)
    .reverse();

  return { enabled: true, playerMemory, localMemory, worldMemory, summary };
}

function formatMemoryContext(memory) {
  if (!memory || !memory.enabled) {
    return 'Mémoire Upstash indisponible : utiliser la mémoire PostgreSQL locale.';
  }

  const fmt = (e) => {
    const impact = e.impacts?.length ? ` | Conséquences: ${e.impacts.join('; ')}` : '';
    return `- [${e.at || 'ancien'}] ${e.playerName || 'Monde'} @ ${e.location || '?'} > ${e.subLocation || '?'} : ${e.summary || e.action || ''}${impact}`;
  };

  return [
    'RÉSUMÉ PERSISTANT DU JOUEUR:',
    memory.summary || 'Aucun résumé compact encore enregistré.',
    '',
    'SOUVENIRS PERSISTANTS DU JOUEUR:',
    ...(memory.playerMemory.length ? memory.playerMemory.map(fmt) : ['- Aucun événement enregistré.']),
    '',
    'SOUVENIRS DE LA SCÈNE:',
    ...(memory.localMemory.length ? memory.localMemory.map(fmt) : ['- Aucun événement local récent.']),
    '',
    'CONTEXTE DU ROYAUME:',
    ...(memory.worldMemory.length ? memory.worldMemory.map(fmt) : ['- Aucun événement régional récent.'])
  ].join('\n').slice(0, 18000);
}

module.exports = {
  isUpstashMemoryEnabled: () => enabled,
  rememberValidatedAction,
  rememberImportantEvent,
  getNarrativeContext,
  formatMemoryContext
};
