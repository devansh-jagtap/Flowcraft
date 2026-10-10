/* Creates a demo account with a few example diagrams. Safe to run repeatedly. */
import { connectDB, disconnectDB } from './config/db.js';
import { env } from './config/env.js';
import { createShareId } from './lib/shareId.js';
import { Diagram, User } from './models/index.js';

const DEMO = { name: 'Demo User', email: 'demo@flowcraft.app', password: 'demo12345' };

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
    source: `CEO — Ananya
  CTO — Rahul
    Backend — Priya
    Frontend — Arjun
  Head of Design — Meera
    Product Designer — Kabir
  Head of Growth — Sara`,
  },
] as const;

async function seed() {
  await connectDB(env.mongoUri);

  const existing = await User.findOne({ email: DEMO.email });
  if (existing) {
    await Diagram.deleteMany({ owner: existing._id });
    await existing.deleteOne();
  }

  const user = await User.create(DEMO);
  const diagrams = await Diagram.insertMany(SAMPLES.map((s) => ({ ...s, owner: user._id })));

  // Make the first one public so the share page can be tried immediately.
  const shared = diagrams[0];
  shared.isPublic = true;
  shared.shareId = createShareId();
  await shared.save();

  console.log('✓ Seeded demo data');
  console.log(`  Login with ${DEMO.email} / ${DEMO.password}`);
  console.log(`  Public link: /s/${shared.shareId}`);
}

seed()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(disconnectDB);
