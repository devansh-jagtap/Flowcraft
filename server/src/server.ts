import { createApp } from './app.js';
import { connectDB } from './db/client.js';
import { env } from './config/env.js';

async function main() {
  if (!env.clerk.secretKey) console.warn('⚠ CLERK_SECRET_KEY is not set: signed-in requests will be rejected (see server/.env.example)');
  await connectDB();
  console.log('✓ Connected to Postgres and applied migrations');

  createApp().listen(env.port, () => {
    console.log(`✓ Flowcraft API running on http://localhost:${env.port}`);
  });
}

main().catch((err: unknown) => {
  console.error('✗ Failed to start:', err instanceof Error ? err.message : err);
  process.exit(1);
});
