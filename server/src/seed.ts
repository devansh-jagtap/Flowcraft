/* Creates a demo account with a few example diagrams. Safe to run repeatedly. */
import { eq } from 'drizzle-orm';
import { connectDB, db, disconnectDB } from './db/client.js';
import { diagrams, users } from './db/schema.js';
import { createShareId } from './lib/shareId.js';

// Sign in through Clerk with this (verified) email to claim the demo diagrams. Set SEED_EMAIL to use your own.
const DEMO = { name: 'Demo User', email: (process.env.SEED_EMAIL ?? 'demo@flowcraft.app').toLowerCase() };

const SAMPLES = [
  {
    title: 'Morning routine',
    type: 'flowchart',
    direction: 'TB',
    theme: 'sunset',
    starred: true,
    source: `(Wake up) -> Check phone -> Is it a weekday?
Is it a weekday? -> Shower & get ready: yes
Is it a weekday? -> Sleep in: no
Sleep in -> Brunch with friends -> (Relax)
Shower & get ready -> Coffee -> Commute -> (Start work)`,
  },
  {
    title: 'Plan a trip to Goa',
    type: 'mindmap',
    direction: 'LR',
    theme: 'ocean',
    source: `Goa Trip
  Travel
    Book train tickets
    Rent a scooter
  Stay
    Beach hut in Palolem
    2 nights in Panjim
  Things to do
    Dudhsagar falls
    Scuba diving
    Night market
  Budget
    ₹15,000 per person`,
  },
  {
    title: 'Startup team',
    type: 'orgchart',
    direction: 'TB',
    theme: 'grape',
    source: `Ananya: CEO
  Rahul: CTO
    Priya: Backend
    Arjun: Frontend
  Meera: Head of Design
    Kabir: Product Designer
  Sara: Head of Growth`,
  },
] as const;

async function seed() {
  await connectDB();

  // Deleting the user removes their diagrams too (ON DELETE CASCADE).
  await db().delete(users).where(eq(users.email, DEMO.email));
  const [user] = await db().insert(users).values(DEMO).returning();

  // Make the first one public so the share page can be tried immediately.
  const shareId = createShareId();
  await db()
    .insert(diagrams)
    .values(SAMPLES.map((s, i) => ({ ...s, ownerId: user.id, ...(i === 0 && { isPublic: true, shareId }) })));

  console.log('✓ Seeded demo data');
  console.log(`  Sign in with the Clerk account for ${DEMO.email} to see them`);
  console.log(`  Public link: /s/${shareId}`);
}

seed()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(disconnectDB);
