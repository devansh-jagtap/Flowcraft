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
  {
    id: 'university-er',
    name: 'University database',
    description: 'ER diagram with keys, weak entity and M:N',
    type: 'er',
    theme: 'ocean',
    direction: 'LR',
    source: `Student
  Roll no (key)
  Name
    First name
    Last name
  Phone (multivalued)
  Age (derived)
Course
  Course id (key)
  Title
  Credits
Dependent (weak)
  Name (partial key)
  Relation
Enrolls (relationship)
  Grade
Student == Enrolls -- Course: M:N
Student -- Has == Dependent: 1:N`,
  },
  {
    id: 'library-classes',
    name: 'Library system',
    description: 'UML classes, inheritance and composition',
    type: 'class',
    theme: 'grape',
    direction: 'TB',
    source: `abstract class User
  - id: int
  - name: String
  + login(): bool
class Member
  - borrowLimit: int
  + borrow(book): Loan
class Librarian
  + addBook(book): void
class Library
  - name: String
class Book
  - isbn: String
  - title: String
class Loan
  - dueDate: Date
  + isOverdue(): bool
Member --|> User
Librarian --|> User
Library *-- Book
Member "1" -- "*" Loan: has
Loan --> Book`,
  },
  {
    id: 'shop-use-cases',
    name: 'Online shop',
    description: 'Actors, use cases, include and extend',
    type: 'usecase',
    theme: 'forest',
    direction: 'LR',
    source: `system Online shop
actor Customer
actor Payment gateway
Customer -> Browse products
Customer -> Place order
Customer -> Track order
Place order -> Make payment: include
Apply coupon -> Place order: extend
Make payment -> Payment gateway`,
  },
  {
    id: 'login-sequence',
    name: 'Login sequence',
    description: 'Messages between user, app and database',
    type: 'sequence',
    theme: 'ocean',
    direction: 'TB',
    source: `actor User
participant Web app
database Database
User -> Web app: Enter email and password
Web app -> Database: Find user
Database --> Web app: User record
Web app -> Web app: Check password
alt password correct
  Web app --> User: Show dashboard
else wrong password
  Web app --> User: Show error
end`,
  },
  {
    id: 'order-states',
    name: 'Order lifecycle',
    description: 'States an order moves through',
    type: 'state',
    theme: 'sunset',
    direction: 'TB',
    source: `[*] -> Placed
Placed -> Paid: payment received
Placed -> Cancelled: customer cancels
Paid -> Shipped: courier picks up
Shipped -> Delivered: signed for
Delivered -> [*]
Cancelled -> [*]`,
  },
];

export const BLANK_SOURCE: Record<DiagramType, string> = {
  flowchart: '(Start) -> First step -> Looks good?\nLooks good? -> (Done): yes\nLooks good? -> First step: no',
  mindmap: 'Main idea\n  Topic one\n    Detail\n  Topic two',
  orgchart: 'Team lead: Role\n  Member: Role\n  Member: Role',
  er: 'Customer\n  Customer id (key)\n  Name\nOrder\n  Order id (key)\n  Date\nCustomer -- Places -- Order: 1:N',
  class: 'class Animal\n  - name: String\n  + speak(): void\nclass Dog\n  + fetch(): void\nDog --|> Animal',
  usecase: 'system My app\nUser -> Sign in\nUser -> View profile',
  sequence: 'actor User\nUser -> App: Request\nApp --> User: Response',
  state: '[*] -> Idle\nIdle -> Working: start\nWorking -> Idle: stop\nWorking -> [*]',
};

export type TypeGroup = 'Basic' | 'UML' | 'Database';

export const TYPE_INFO: Record<DiagramType, { label: string; hint: string; group: TypeGroup; article: string; directional?: boolean }> = {
  flowchart: { label: 'Flowchart', hint: 'Steps and decisions', group: 'Basic', article: 'a flowchart', directional: true },
  mindmap: { label: 'Mind map', hint: 'Brainstorm ideas', group: 'Basic', article: 'a mind map' },
  orgchart: { label: 'Org chart', hint: 'Teams and family trees', group: 'Basic', article: 'an org chart' },
  er: { label: 'ER diagram', hint: 'Entities, attributes, relationships', group: 'Database', article: 'an ER diagram' },
  class: { label: 'Class diagram', hint: 'UML classes and inheritance', group: 'UML', article: 'a class diagram', directional: true },
  usecase: { label: 'Use case', hint: 'UML actors and goals', group: 'UML', article: 'a use case diagram' },
  sequence: { label: 'Sequence', hint: 'UML messages over time', group: 'UML', article: 'a sequence diagram' },
  state: { label: 'State machine', hint: 'UML states and transitions', group: 'UML', article: 'a state diagram', directional: true },
};

export const TYPE_GROUPS: TypeGroup[] = ['Basic', 'UML', 'Database'];
