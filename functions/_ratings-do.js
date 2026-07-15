// functions/_ratings-do.js
//
// Durable Object: holds all Elo ratings in memory + persists to its
// own private storage. All requests for the "global" name go to the
// same instance, so votes are serialised and no updates are lost.

export class RatingsDO {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.ratings = {};
    this.voteCount = 0;

    // Load existing state from storage, blocking all requests until done
    // so in-memory state is always consistent with disk.
    this.state.blockConcurrencyWhile(async () => {
      const data = await this.state.storage.get(["ratings", "voteCount"]);
      this.ratings = data.ratings || {};
      this.voteCount = data.voteCount || 0;
    });
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/vote" && request.method === "POST") {
      return this.handleVote(request);
    }

    if (url.pathname === "/rankings" && request.method === "GET") {
      return this.handleRankings();
    }

    return new Response("Not found", { status: 404 });
  }

  handleVote(request) {
    return request.json().then(({ winner, loser, winnerInitial, loserInitial }) => {
      // First time we've seen this CS? Use its initial rating.
      if (!this.ratings[winner]) {
        this.ratings[winner] = { rating: winnerInitial, wins: 0, losses: 0 };
      }
      if (!this.ratings[loser]) {
        this.ratings[loser] = { rating: loserInitial, wins: 0, losses: 0 };
      }

      // Standard Elo update (K = 32)
      const K = 32;
      const wR = this.ratings[winner].rating;
      const lR = this.ratings[loser].rating;
      const expectedW = 1 / (1 + Math.pow(10, (lR - wR) / 400));

      this.ratings[winner].rating = wR + K * (1 - expectedW);
      this.ratings[winner].wins += 1;
      this.ratings[loser].rating  = lR + K * (0 - (1 - expectedW));
      this.ratings[loser].losses += 1;

      this.voteCount += 1;

      return this.state.storage.put({
        ratings: this.ratings,
        voteCount: this.voteCount,
      }).then(() => Response.json({
        winner: { id: winner, ...this.ratings[winner] },
        loser:  { id: loser,  ...this.ratings[loser]  },
        totalVotes: this.voteCount,
      }));
    });
  }

  handleRankings() {
    return Promise.resolve(Response.json({
      ratings: this.ratings,
      totalVotes: this.voteCount,
    }));
  }
}