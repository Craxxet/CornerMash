export class RatingsDO {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.ratings = {};
    this.voteCount = 0;

    // Load existing state from storage before serving any request.
    this.state.blockConcurrencyWhile(async () => {
      try {
        const ratings = await this.state.storage.get("ratings");
        const voteCount = await this.state.storage.get("voteCount");
        if (ratings) this.ratings = ratings;
        if (voteCount != null) this.voteCount = voteCount;
      } catch (err) {
        console.error("RatingsDO load failed:", err);
      }
    });
  }

  async fetch(request) {
  const url = new URL(request.url);

  if (url.pathname === "/vote" && request.method === "POST") {
    return await this.handleVote(request);
  }

  if (url.pathname === "/rankings" && request.method === "GET") {
    return await this.handleRankings();
  }

  if (url.pathname === "/reset" && request.method === "POST") {
    return await this.handleReset(request);
  }

  return new Response("Not found", { status: 404 });
  }

  async handleVote(request) {
    const { winner, loser, winnerInitial, loserInitial } = await request.json();

    if (!this.ratings[winner]) {
      this.ratings[winner] = { rating: winnerInitial, wins: 0, losses: 0 };
    }
    if (!this.ratings[loser]) {
      this.ratings[loser] = { rating: loserInitial, wins: 0, losses: 0 };
    }

    const K = 48;
    const wR = this.ratings[winner].rating;
    const lR = this.ratings[loser].rating;
    const expectedW = 1 / (1 + Math.pow(10, (lR - wR) / 400));

    this.ratings[winner].rating = wR + K * (1 - expectedW);
    this.ratings[winner].wins += 1;
    this.ratings[loser].rating  = lR + K * (0 - (1 - expectedW));
    this.ratings[loser].losses += 1;
    this.voteCount += 1;

    // Persist BEFORE responding. Each write is its own single-key put.
    await this.state.storage.put("ratings",   this.ratings);
    await this.state.storage.put("voteCount", this.voteCount);

    return Response.json({
      winner: { id: winner, ...this.ratings[winner] },
      loser:  { id: loser,  ...this.ratings[loser]  },
      totalVotes: this.voteCount,
    });
  }

  async handleRankings() {
    return Response.json({
      ratings: this.ratings,
      totalVotes: this.voteCount,
    });
  }
  async handleReset(request) {
  const url = new URL(request.url);
  const secret = url.searchParams.get("secret");
  if (secret !== "cornermash-flush-all-the-data-in-this-year-of-our-lord-2026") {
    return new Response("Forbidden", { status: 403 });
  }

  // Wait for any in-flight vote to finish writing, then wipe.
  // Without this, a vote that started just before the reset could
  // land its storage.put AFTER our deletes, leaving a ghost rating.
  await this.state.blockConcurrencyWhile(async () => {
    await this.state.storage.delete("ratings");
    await this.state.storage.delete("voteCount");
    this.ratings = {};
    this.voteCount = 0;
  });

  return Response.json({ ok: true, message: "DO storage cleared" });
  }
}

export default {
  async fetch() {
    return new Response(
      "This Worker hosts the RatingsDO Durable Object class. Access via env.RATINGS_DO.",
      { status: 404 }
    );
  },
};