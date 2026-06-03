export default defineEventHandler(async (event) => {
  const { userId } = await requireUser(event);
  const id = getRouterParam(event, "id");
  if (!id) throw createError({ statusCode: 400, statusMessage: "Missing ID" });

  const db = useDrizzle();

  // Verify ownership
  const [artwork] = await db
    .select({ id: artworks.id })
    .from(artworks)
    .where(and(eq(artworks.id, id), eq(artworks.userId, userId)))
    .limit(1);

  if (!artwork) {
    throw createError({ statusCode: 404, statusMessage: "Composition not found" });
  }

  // Read uploaded file from multipart form data
  const formData = await readMultipartFormData(event);
  const file = formData?.find((f) => f.name === "file");

  if (!file || !file.data) {
    throw createError({ statusCode: 400, statusMessage: "Missing thumbnail file" });
  }

  // Upload to S3
  const s3 = useS3();
  const key = `thumbnails/${id}.png`;
  const thumbnailUrl = await s3.putObject(key, file.data, "image/png");

  // Update the artwork record
  await db
    .update(artworks)
    .set({
      thumbnailUrl,
      thumbnailUpdatedAt: new Date(),
    })
    .where(eq(artworks.id, id));

  return { thumbnailUrl };
});
