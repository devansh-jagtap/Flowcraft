import type { DiagramType, Direction, ThemeName } from './types';

export interface Template {
  id: string;
  name: string;
  description: string;
  type: DiagramType;
  theme: ThemeName;
  direction: Direction;
  source: string;
}

export const TEMPLATES: Template[] = [
  {
    id: 'morning-routine',
    name: 'Morning routine',
    description: 'A simple flow with a yes/no decision',
    type: 'flowchart',
    theme: 'sunset',
    direction: 'TB',
    source: `(Wake up) -> Check phone -> Is it a weekday?
Is it a weekday? -> Shower & get ready: yes
Is it a weekday? -> Sleep in: no
Sleep in -> Brunch with friends -> (Relax)
Shower & get ready -> Coffee -> Commute -> (Start work)`,
  },
  {
    id: 'online-order',
    name: 'Online order',
    description: 'How an order moves from cart to doorstep',
    type: 'flowchart',
    theme: 'ocean',
    direction: 'LR',
    source: `(Customer places order) -> Payment successful?
Payment successful? -> Send confirmation email: yes
Payment successful? -> Show retry screen: no
Show retry screen -> Payment successful?
Send confirmation email -> Pack items -> Ship -> (Delivered)`,
  },
  {
    id: 'bug-triage',
    name: 'Bug triage',
    description: 'Decide what happens to a new bug report',
    type: 'flowchart',
    theme: 'grape',
    direction: 'TB',
    source: `(New bug report) -> Can we reproduce it?
Can we reproduce it? -> Ask reporter for details: no
Ask reporter for details -> Can we reproduce it?
Can we reproduce it? -> Is it critical?: yes
Is it critical? -> Fix today -> (Release hotfix): yes
Is it critical? -> Add to next sprint: no`,
  },
  {
    id: 'trip-plan',
    name: 'Trip planner',
    description: 'Brainstorm everything for a holiday',
    type: 'mindmap',
    theme: 'ocean',
    direction: 'LR',
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
    id: 'study-plan',
    name: 'Exam study plan',
    description: 'Break a big goal into topics',
    type: 'mindmap',
    theme: 'forest',
    direction: 'LR',
    source: `Final exams
  Maths
    Calculus
    Probability
  Physics
    Mechanics
    Optics
  Chemistry
    Organic
    Periodic table
  Routine
    Pomodoro 25/5
    Sleep by 11pm`,
  },
  {
    id: 'startup-team',
    name: 'Startup team',
    description: 'Who reports to whom',
    type: 'orgchart',
    theme: 'grape',
    direction: 'TB',
    source: `Ananya: CEO
  Rahul: CTO
    Priya: Backend
    Arjun: Frontend
  Meera: Head of Design
    Kabir: Product Designer
  Sara: Head of Growth`,
  },
  {
    id: 'family-tree',
    name: 'Family tree',
    description: 'Three generations at a glance',
    type: 'orgchart',
    theme: 'forest',
    direction: 'TB',
    source: `Ramesh & Sunita: Grandparents
  Vikram: Father
    Devansh: Me
    Isha: Sister
  Kavita: Aunt
    Rohan: Cousin`,
  },
];

export const BLANK_SOURCE: Record<DiagramType, string> = {
  flowchart: '(Start) -> First step -> Looks good?\nLooks good? -> (Done): yes\nLooks good? -> First step: no',
  mindmap: 'Main idea\n  Topic one\n    Detail\n  Topic two',
  orgchart: 'Team lead: Role\n  Member: Role\n  Member: Role',
};

export const TYPE_INFO: Record<DiagramType, { label: string; hint: string }> = {
  flowchart: { label: 'Flowchart', hint: 'Steps and decisions' },
  mindmap: { label: 'Mind map', hint: 'Brainstorm ideas' },
  orgchart: { label: 'Org chart', hint: 'Teams and family trees' },
};
