
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id) throw createError({ statusCode: 400, statusMessage: "Missing ID" });

  const db = useDrizzle();

  // Try to get authenticated user (optional for public compositions)
  let userId: string | null = null;
  try {
    const session = await getUserSession(event);
    userId = session.secure?.userId ?? null;
  } catch {
    // Not authenticated — only public compositions accessible
  }

  const [composition] = await db
    .select()
    .from(compositions)
    .where(
      userId
        ? and(eq(compositions.id, id), or(eq(compositions.userId, userId), eq(compositions.isPublic, true)))
        : and(eq(compositions.id, id), eq(compositions.isPublic, true)),
    )
    .limit(1);

  if (!composition) {
    throw createError({ statusCode: 404, statusMessage: "Composition not found" });
  }

  return composition;
});
