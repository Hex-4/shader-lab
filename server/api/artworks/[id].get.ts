
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id) throw createError({ statusCode: 400, statusMessage: "Missing ID" });

  const db = useDrizzle();

  // Try to get authenticated user (optional for public artworks)
  let userId: string | null = null;
  try {
    const session = await getUserSession(event);
    userId = session.secure?.userId ?? null;
  } catch {
    // Not authenticated — only public artworks accessible
  }

  const [artwork] = await db
    .select()
    .from(artworks)
    .where(
      userId
        ? and(eq(artworks.id, id), or(eq(artworks.userId, userId), eq(artworks.isPublic, true)))
        : and(eq(artworks.id, id), eq(artworks.isPublic, true)),
    )
    .limit(1);

  if (!artwork) {
    throw createError({ statusCode: 404, statusMessage: "Composition not found" });
  }

  return artwork;
});
