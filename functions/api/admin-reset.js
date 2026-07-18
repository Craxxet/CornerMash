export async function onRequestPost(context) {
  const url = new URL(context.request.url);
  const provided = url.searchParams.get("secret");
  if (provided !== context.env.RESET_SECRET) {
    return new Response("Forbidden", { status: 403 });
  }

  // The actual reset is performed by the DO. We just proxy to it.
  const id = context.env.RATINGS_DO.idFromName("global");
  const stub = context.env.RATINGS_DO.get(id);

  const doResponse = await stub.fetch("https://do.internal/reset", {
    method: "POST",
  });

  return new Response(doResponse.body, {
    status: doResponse.status,
    headers: { "Content-Type": "application/json" },
  });
}