
export default defineEventHandler(async (event) => {
  const { userId } = await requireUser(event);
  const db = useDrizzle();

  const result = await db
    .select()
    .from(artworks)
    .where(eq(artworks.userId, userId))
    .orderBy(desc(artworks.updatedAt));

  return result;
});
