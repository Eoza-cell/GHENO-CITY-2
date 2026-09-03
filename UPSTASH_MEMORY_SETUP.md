# Upstash Memory Setup — AFTER THE REBIRTH

The ATR MJ can use Upstash Redis as persistent narrative memory.

## 1. Create a Redis database

Create an Upstash Redis database and copy its REST credentials.

## 2. Add these environment variables in Render

```
UPSTASH_REDIS_REST_URL=your_upstash_rest_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_rest_token
```

Do **not** put these secrets directly in GitHub source files.

## 3. Deploy

Render installs `@upstash/redis` from `package.json`.

## How ATR memory works

- PostgreSQL remains the authoritative source for stats, position, inventory, quests and permanent game state.
- Upstash stores validated narrative continuity.
- Memory is separated into:
  - player events;
  - local scene events;
  - kingdom/world events;
  - compact persistent player summaries.
- The MJ receives relevant persistent memories before generating a new response.
- Redis retention is rolling for six months by default.

If Upstash is temporarily unavailable, ATR continues with PostgreSQL memory instead of crashing.
