-- Rename legacy compositions table to shaders
ALTER TABLE IF EXISTS "compositions" RENAME TO "shaders";

-- Artworks (canvas documents)
CREATE TABLE IF NOT EXISTS "artworks" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "name" text DEFAULT 'Untitled' NOT NULL,
  "data" jsonb NOT NULL,
  "is_public" boolean DEFAULT false NOT NULL,
  "thumbnail_url" text,
  "thumbnail_updated_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
