// GET /api/rankings
// Returns: { ratings: { "cs-id": { rating, wins, losses } }, totalVotes: number }

const INITIAL_RATING = 1000;
const PREFIX = "elo:";

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      // Small edge cache is fine — rankings change slowly
      "Cache-Control": "public, max-age=10",
    },
  });

export async function onRequestGet(context) {
  const { env } = context;
  const ratings = {};

  // List all elo:* keys (KV paginates internally for large sets)
  let cursor;
  do {
    const page = await env.VOTES.list({ prefix: PREFIX, cursor });
    for (const key of page.keys) {
      const id = key.name.slice(PREFIX.length);
      const raw = await env.VOTES.get(key.name);
      const rating = raw !== null ? parseFloat(raw) : INITIAL_RATING;
      // Pull wins/losses in parallel batches? Sequential is fine for 137 items.
      const wRaw = await env.VOTES.get(`wins:${id}`);
      const lRaw = await env.VOTES.get(`losses:${id}`);
      ratings[id] = {
        rating,
        wins:   wRaw !== null ? parseInt(wRaw, 10) : 0,
        losses: lRaw !== null ? parseInt(lRaw, 10) : 0,
      };
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);

  const totalRaw = await env.VOTES.get("total_votes");
  const totalVotes = totalRaw !== null ? parseInt(totalRaw, 10) : 0;

  return json({ ratings, totalVotes });
}