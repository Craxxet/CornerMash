// POST /api/vote
// body: { winner, loser, winnerInitial?, loserInitial? }
// Returns: { winner: {id, rating, wins, losses}, loser: {...}, totalVotes }

const DEFAULT_RATING = 1000; // only used if the client doesn't send an initial rating
const K_FACTOR = 24;
const FLOOR = 1;

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const { winner, loser } = body;
  const winnerInit = typeof body.winnerInitial === "number" ? body.winnerInitial : DEFAULT_RATING;
  const loserInit  = typeof body.loserInitial  === "number" ? body.loserInitial  : DEFAULT_RATING;

  if (
    typeof winner !== "string" ||
    typeof loser !== "string" ||
    !winner || !loser ||
    winner === loser
  ) {
    return json({ error: "Invalid vote: need distinct winner and loser ids" }, 400);
  }

  // Read current ratings, wins, losses (KV may not have an entry for unseen CSs)
  const [rWRaw, rLRaw, wWRaw, wLRaw, lWRaw, lLRaw, totalRaw] = await Promise.all([
    env.VOTES.get(`elo:${winner}`),
    env.VOTES.get(`elo:${loser}`),
    env.VOTES.get(`wins:${winner}`),
    env.VOTES.get(`wins:${loser}`),
    env.VOTES.get(`losses:${winner}`),
    env.VOTES.get(`losses:${loser}`),
    env.VOTES.get("total_votes"),
  ]);

  // Use the per-CS initial rating from the client for CSs the server has never seen
  let rW = rWRaw !== null ? parseFloat(rWRaw) : winnerInit;
  let rL = rLRaw !== null ? parseFloat(rLRaw) : loserInit;
  let wW = wWRaw !== null ? parseInt(wWRaw, 10) : 0;
  let wL = wLRaw !== null ? parseInt(wLRaw, 10) : 0;
  let lW = lWRaw !== null ? parseInt(lWRaw, 10) : 0;
  let lL = lLRaw !== null ? parseInt(lLRaw, 10) : 0;

  // Bradley-Terry expected scores
  const eW = rW / (rW + rL);
  const eL = rL / (rW + rL);

  // Update ratings
  rW = rW + K_FACTOR * (1 - eW);
  rL = Math.max(FLOOR, rL - K_FACTOR * eL);
  wW += 1;
  lL += 1;
  const total = (totalRaw !== null ? parseInt(totalRaw, 10) : 0) + 1;

  // Persist (don't block the response)
  const writes = Promise.all([
    env.VOTES.put(`elo:${winner}`, rW.toString()),
    env.VOTES.put(`elo:${loser}`,  rL.toString()),
    env.VOTES.put(`wins:${winner}`,     wW.toString()),
    env.VOTES.put(`losses:${loser}`,    lL.toString()),
    env.VOTES.put("total_votes",        total.toString()),
  ]);
  context.waitUntil(writes);

  return json({
    winner: { id: winner, rating: rW, wins: wW, losses: lW },
    loser:  { id: loser,  rating: rL, wins: wL, losses: lL },
    totalVotes: total,
  });
}

export async function onRequest() {
  return json({ error: "Use POST" }, 405);
}