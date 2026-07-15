export async function onRequestGet(context) {
  const id = context.env.RATINGS_DO.idFromName("global");
  const stub = context.env.RATINGS_DO.get(id);

  const doResponse = await stub.fetch("https://do.internal/rankings");
  const data = await doResponse.json();
  return Response.json(data);
}