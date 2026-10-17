import { PGlite } from '@electric-sql/pglite';
import { sql } from 'drizzle-orm';
import { drizzle as drizzleNodePg } from 'drizzle-orm/node-postgres';
import { migrate as migrateNodePg } from 'drizzle-orm/node-postgres/migrator';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import pg from 'pg';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { db, migrationsFolder, setDb, type Db } from '../src/db/client.js';
import * as schema from '../src/db/schema.js';
import { fakeClerkUsers } from './fakeClerk.js';

vi.mock('@clerk/express', () => import('./fakeClerk.js'));

// An in-memory Postgres (PGlite) with the real migrations, so tests need no database server.
// TEST_DATABASE_URL runs the same tests against a real Postgres instead, such as a throwaway Neon branch.
// Every table is emptied after each test, so never point it at a database with data you want to keep.
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
let pglite: PGlite | undefined;
let pool: pg.Pool | undefined;

beforeAll(async () => {
  if (testDatabaseUrl) {
    pool = new pg.Pool({ connectionString: testDatabaseUrl });
    await migrateNodePg(drizzleNodePg(pool), { migrationsFolder });
    setDb(drizzleNodePg(pool, { schema }));
    return;
  }
  pglite = new PGlite();
  const testDb = drizzle(pglite, { schema });
  await migrate(testDb, { migrationsFolder });
  setDb(testDb as unknown as Db);
});

afterEach(async () => {
  fakeClerkUsers.clear();
  await db().execute(sql`truncate table ai_usage, diagrams, users cascade`);
});

afterAll(async () => {
  setDb(undefined);
  await pglite?.close();
  await pool?.end();
});
