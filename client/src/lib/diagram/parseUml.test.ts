import { describe, expect, it } from 'vitest';
import { layoutDiagram, layoutGraph } from './layout';
import { messageY } from './layoutSequence';
import { parseDiagram } from './parse';
import { TEMPLATES } from './templates';

const shapes = (type: Parameters<typeof parseDiagram>[0], source: string) =>
  Object.fromEntries(parseDiagram(type, source).nodes.map((n) => [n.id, [n.shape, n.variant].filter(Boolean).join(':')]));

describe('parseEr', () => {
  const source = `Student
  Roll no (key)
  Name
    First name
  Phone (multivalued)
  Age (derived)
Dependent (weak)
  Name (partial key)
Student -- Enrolls -- Course: M:N
Student == Has -- Dependent: 1:N`;

  it('reads entities, attribute kinds, composites and inferred relationships', () => {
    expect(shapes('er', source)).toEqual({
      student: 'entity',
      dependent: 'entity:weak',
      enrolls: 'relationship',
      course: 'entity',
      // Connected to a weak entity, so it becomes an identifying relationship.
      has: 'relationship:identifying',
      'student/roll-no': 'attribute:key',
      'student/name': 'attribute',
      'student/name/first-name': 'attribute',
      'student/phone': 'attribute:multivalued',
      'student/age': 'attribute:derived',
      'dependent/name': 'attribute:partial-key',
    });
  });

  it('splits cardinalities over the connections and marks total participation', () => {
    const edges = parseDiagram('er', source).edges.filter((e) => !e.target.includes('/'));
    expect(edges.map((e) => [e.id, e.label, e.total])).toEqual([
      ['student--enrolls', 'M', false],
      ['enrolls--course', 'N', false],
      ['student--has', '1', true],
      ['has--dependent', 'N', false],
    ]);
  });

  it('reports unknown tags, two entities side by side and bad cardinalities', () => {
    const { issues } = parseDiagram('er', 'Student (strong)\nA (relationship)\nB -- A -- C: 1\n  Name\nStudent -- B');
    expect(issues.map((i) => i.line)).toEqual([1, 3, 4, 5]);
  });

  it('keeps attribute rows clear of the connections between shapes', () => {
    const graph = parseDiagram('er', source);
    const boxes = layoutGraph(graph, 'er', 'TB');
    const student = boxes.get('student')!;
    const rollNo = boxes.get('student/roll-no')!;
    expect(rollNo.y + rollNo.height).toBeLessThan(student.y);
    expect(boxes.get('enrolls')!.x).toBeGreaterThan(student.x + student.width);
  });
});

describe('parseClass', () => {
  it('reads members, stereotypes and every relationship operator', () => {
    const graph = parseDiagram(
      'class',
      `interface Payable
  + pay(amount): void
abstract class Account {
  - balance: float
  + deposit(amount)
}
Savings --|> Account
Account <|.. Payable
Bank *-- Account
Line --o Order
Customer "1" -- "*" Order: places
Order ..> Clock`
    );
    const account = graph.nodes.find((n) => n.id === 'account')!;
    expect(account.stereotype).toBe('abstract');
    expect(account.compartments).toEqual([['- balance: float'], ['+ deposit(amount)']]);
    expect(graph.nodes.find((n) => n.id === 'payable')!.stereotype).toBe('interface');
    expect(graph.edges.map((e) => `${e.source} ${e.kind} ${e.target}`)).toEqual([
      'savings inherit account',
      // Arrows written right-to-left are normalised so the notation lands on the right end.
      'payable realize account',
      'bank compose account',
      'order aggregate line',
      'customer line order',
      'order depend clock',
    ]);
    expect(graph.edges[4]).toMatchObject({ sourceLabel: '1', targetLabel: '*', label: 'places' });
  });

  it('puts parents above their subclasses', () => {
    const boxes = layoutGraph(parseDiagram('class', 'Dog --|> Animal'), 'class', 'TB');
    expect(boxes.get('animal')!.y).toBeLessThan(boxes.get('dog')!.y);
  });

  it('asks for spaces around arrows', () => {
    expect(parseDiagram('class', 'Dog--|>Animal').issues[0].message).toMatch(/space on both sides/);
  });
});

describe('parseUseCase', () => {
  const source = `system Shop
actor Payment gateway
Customer -> Place order
Place order -> Pay: include
Apply coupon -> Place order: extend
Pay -> Payment gateway
Guest --|> Customer`;

  it('tells actors from use cases and labels include / extend', () => {
    expect(shapes('usecase', source)).toEqual({
      '~system': 'boundary',
      'payment-gateway': 'actor',
      customer: 'actor',
      'place-order': 'usecase',
      pay: 'usecase',
      'apply-coupon': 'usecase',
      guest: 'actor',
    });
    const labels = parseDiagram('usecase', source).edges.map((e) => e.label).filter(Boolean);
    expect(labels).toEqual(['«include»', '«extend»']);
  });

  it('draws the system boundary around the use cases with actors outside it', () => {
    const graph = parseDiagram('usecase', source);
    const boxes = layoutDiagram(graph, 'usecase', 'LR', {});
    const system = boxes.get('~system')!;
    for (const id of ['place-order', 'pay', 'apply-coupon']) {
      const b = boxes.get(id)!;
      expect(b.x).toBeGreaterThan(system.x);
      expect(b.x + b.width).toBeLessThan(system.x + system.width);
    }
    expect(boxes.get('customer')!.x + boxes.get('customer')!.width).toBeLessThan(system.x);
    // Only ever called by the system, so it stands on the right.
    expect(boxes.get('payment-gateway')!.x).toBeGreaterThan(system.x + system.width);
  });
});

describe('parseSequence', () => {
  const source = `actor User
participant App
database DB
User -> App: Log in
App -> DB: Find user
DB --> App: Record
App -> App: Check
alt ok
  App --> User: Home
else wrong
  App -) User: Error
end`;

  it('orders participants and assigns message rows', () => {
    const graph = parseDiagram('sequence', source);
    expect(graph.issues).toEqual([]);
    expect(shapes('sequence', source)).toEqual({ user: 'participant:actor', app: 'participant', db: 'participant:database', '~fragment-1': 'fragment' });
    expect(graph.edges.map((e) => [e.kind, e.row])).toEqual([
      ['arrow', 0],
      ['arrow', 1],
      // "DB --> App" is a reply from DB, not a declaration of a database called "--> App".
      ['reply', 2],
      ['arrow', 3],
      ['reply', 5.5],
      ['open', 7.5],
    ]);
    const fragment = graph.nodes.find((n) => n.shape === 'fragment')!;
    expect(fragment).toMatchObject({ subtitle: 'alt', label: 'ok', rows: [4.5, 8.5], branches: [{ row: 6.5, label: 'wrong' }] });
    expect(fragment.members).toEqual(['user', 'app']);
  });

  it('lays participants out left to right with room for labels', () => {
    const boxes = layoutGraph(parseDiagram('sequence', 'A -> B: a fairly long message label that needs room'), 'sequence', 'TB');
    const [a, b] = [boxes.get('a')!, boxes.get('b')!];
    expect(b.x - (a.x + a.width)).toBeGreaterThan(200);
    expect(a.height).toBeGreaterThan(messageY(0));
  });

  it('reports unbalanced blocks', () => {
    expect(parseDiagram('sequence', 'A -> B\nend').issues[0].message).toMatch(/without a matching/);
    expect(parseDiagram('sequence', 'loop x\nA -> B').issues[0].message).toMatch(/missing its "end"/);
  });
});

describe('parseState', () => {
  it('turns [*] into initial and final pseudo-states and allows self transitions', () => {
    const graph = parseDiagram('state', '[*] -> Idle\nIdle -> Idle: tick\nIdle -> Valid?\nValid? -> [*]: yes');
    expect(shapes('state', '[*] -> Idle\nIdle -> Valid?\nValid? -> [*]')).toEqual({
      '~initial': 'initial',
      idle: 'state',
      'valid-q': 'decision',
      '~final': 'final',
    });
    expect(graph.edges.map((e) => `${e.source}>${e.target}:${e.label ?? ''}`)).toEqual([
      '~initial>idle:',
      'idle>idle:tick',
      'idle>valid-q:',
      'valid-q>~final:yes',
    ]);
  });
});

describe('templates', () => {
  it.each(TEMPLATES.map((t) => [t.id, t] as const))('%s parses without issues', (_, template) => {
    const graph = parseDiagram(template.type, template.source);
    expect(graph.issues).toEqual([]);
    expect(layoutDiagram(graph, template.type, template.direction, {}).size).toBe(graph.nodes.length);
  });
});
