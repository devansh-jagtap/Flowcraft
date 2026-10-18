/* Applies pending database migrations. Runs in the Vercel build, before the new version goes live. */
import { env } from './config/env.js';
import { runMigrations } from './db/client.js';

if (!env.databaseUrl) {
  // Preview builds without a database configured simply skip this step.
  console.log('No DATABASE_URL: skipping migrations');
} else {
  await runMigrations();
  console.log('✓ Database migrations are up to date');
}
