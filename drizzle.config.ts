import { defineConfig } from "drizzle-kit";

const url = process.env.DATABASE_URL;

if (!url) throw new Error("Missing database url");

export default defineConfig({
  dialect: "postgresql",
  schema: "./schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url,
  },
});
