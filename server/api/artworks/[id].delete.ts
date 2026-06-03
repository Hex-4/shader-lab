
export default defineEventHandler(async (event) => {
  const { userId } = await requireUser(event);
  const id = getRouterParam(event, "id");
  if (!id) throw createError({ statusCode: 400, statusMessage: "Missing ID" });

  const db = useDrizzle();

  const [deleted] = await db
    .delete(artworks)
    .where(and(eq(artworks.id, id), eq(artworks.userId, userId)))
    .returning({ id: artworks.id });

  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: "Composition not found" });
  }

  return { ok: true };
});
