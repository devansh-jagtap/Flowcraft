/*
 * The Vercel Function that serves /api/*. It wraps the same Express app the Docker image runs
 * (server/src/app.ts, compiled to server/dist by the build). The React app is served by Vercel's CDN
 * from client/dist, and database migrations run once in the build (server/src/migrate.ts).
 */
import { createApp } from '../server/dist/app.js';
import { connectDB } from '../server/dist/db/client.js';

const app = createApp();

/** One database pool per function instance, opened on its first request. */
let connecting;
function ready() {
  connecting ??= connectDB({ migrate: false }).catch((err) => {
    // Let the next request try again instead of failing every request on this instance.
    connecting = undefined;
    throw err;
  });
  return connecting;
}

export default async function handler(req, res) {
  try {
    await ready();
  } catch (err) {
    console.error('Database connection failed:', err instanceof Error ? err.message : err);
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: { message: 'The database is not reachable right now. Please try again in a moment.' } }));
    return;
  }
  return app(req, res);
}
