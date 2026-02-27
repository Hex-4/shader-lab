
export default defineEventHandler(async (event) => {
  const { userId } = await requireUser(event);
  const db = useDrizzle();

  const result = await db
    .select()
    .from(compositions)
    .where(eq(compositions.userId, userId))
    .orderBy(desc(compositions.updatedAt));

  return result;
});
