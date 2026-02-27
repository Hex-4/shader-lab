
export default defineEventHandler(async (event) => {
  const { userId } = await requireUser(event);
  const id = getRouterParam(event, "id");
  if (!id) throw createError({ statusCode: 400, statusMessage: "Missing ID" });

  const db = useDrizzle();

  const [deleted] = await db
    .delete(compositions)
    .where(and(eq(compositions.id, id), eq(compositions.userId, userId)))
    .returning({ id: compositions.id });

  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: "Composition not found" });
  }

  return { ok: true };
});
