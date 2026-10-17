import { defineConfig } from 'drizzle-kit';

// Migrations run over the direct (unpooled) connection, as Neon recommends.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || '' },
});
