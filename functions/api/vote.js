// functions/api/vote.js
import { RatingsDO } from "../_ratings-do.js";

export async function onRequestPost(context) {
  const body = await context.request.json();
  const id = context.env.RATINGS_DO.idFromName("global");
  const stub = context.env.RATINGS_DO.get(id);

  // Forward the vote to the DO. The DO handles the Elo math + storage.
  const doResponse = await stub.fetch("https://do.internal/vote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await doResponse.json();
  return Response.json(data);
}