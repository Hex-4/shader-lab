
export default defineEventHandler(async (event) => {
  const { userId } = await requireUser(event);
  const id = getRouterParam(event, "id");
  if (!id) throw createError({ statusCode: 400, statusMessage: "Missing ID" });

  const body = await readBody(event);
  const db = useDrizzle();

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (body.name !== undefined) updates.name = body.name;
  if (body.data !== undefined) updates.data = body.data;
  if (body.isPublic !== undefined) updates.isPublic = body.isPublic;

  const [updated] = await db
    .update(artworks)
    .set(updates)
    .where(and(eq(artworks.id, id), eq(artworks.userId, userId)))
    .returning();

  if (!updated) {
    throw createError({ statusCode: 404, statusMessage: "Composition not found" });
  }

  return updated;
});
