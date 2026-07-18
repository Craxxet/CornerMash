export async function onRequestPost(context) {
  const url = new URL(context.request.url);
  const provided = url.searchParams.get("secret");
  const expected = context.env.RESET_SECRET;

  if (provided !== expected) {
    // TEMPORARY DEBUG — replace with the original 403 response after this works.
    return Response.json({
      error: "Forbidden",
      secretIsSet: expected !== undefined,
      expectedLength: expected ? expected.length : null,
      providedLength: provided ? provided.length : null,
      startsWith: expected ? expected.slice(0, 4) : null,
    }, { status: 403 });
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