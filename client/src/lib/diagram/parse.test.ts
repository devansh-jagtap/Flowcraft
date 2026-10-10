import { describe, expect, it } from 'vitest';
import { parseDiagram } from './parse';
import { parseFlowchart, readToken } from './parseFlowchart';
import { parseTree } from './parseTree';

describe('readToken', () => {
  it.each([
    ['(Start)', { label: 'Start', shape: 'terminal' }],
    ['{Approved}', { label: 'Approved', shape: 'decision' }],
    ['Is it raining?', { label: 'Is it raining?', shape: 'decision' }],
    ['[Write code]', { label: 'Write code', shape: 'rect' }],
    ['Write code', { label: 'Write code' }],
  ])('%s', (input, expected) => {
    expect(readToken(input)).toEqual(expected);
  });
});

describe('parseFlowchart', () => {
  it('builds nodes and edges from arrow chains', () => {
    const graph = parseFlowchart('(Start) -> Brew coffee -> (Done)');
    expect(graph.nodes.map((n) => [n.id, n.shape])).toEqual([
      ['start', 'terminal'],
      ['brew-coffee', 'rect'],
      ['done', 'terminal'],
    ]);
    expect(graph.edges.map((e) => `${e.source}>${e.target}`)).toEqual(['start>brew-coffee', 'brew-coffee>done']);
  });

  it('reuses nodes referenced by the same text across lines', () => {
    const graph = parseFlowchart('Hungry? -> Cook: yes\nHungry? -> Nap: no\nCook -> Eat');
    expect(graph.nodes).toHaveLength(4);
    expect(graph.nodes[0]).toMatchObject({ id: 'hungry-q', shape: 'decision' });
    expect(graph.edges.map((e) => e.label)).toEqual(['yes', 'no', undefined]);
  });

  it('keeps colons that are not edge labels', () => {
    const graph = parseFlowchart('Wake up -> Meeting at 9:30');
    expect(graph.nodes[1].label).toBe('Meeting at 9:30');
    expect(graph.edges[0].label).toBeUndefined();
  });

  it('accepts alternative arrows and ignores comments and blank lines', () => {
    const graph = parseFlowchart('# my flow\n\nA --> B\nB → C\n// note\nC => D');
    expect(graph.edges).toHaveLength(3);
    expect(graph.issues).toEqual([]);
  });

  it('upgrades a node shape when defined more specifically later', () => {
    const graph = parseFlowchart('Login -> Dashboard\nDashboard -> (Logout)\n(Login)');
    expect(graph.nodes.find((n) => n.id === 'login')?.shape).toBe('terminal');
  });

  it('reports incomplete arrows and self loops with line numbers', () => {
    const graph = parseFlowchart('A ->\nB -> B');
    expect(graph.issues).toEqual([
      { line: 1, message: 'Arrow is missing a step on one side' },
      { line: 2, message: '"B" points to itself' },
    ]);
  });

  it('treats a question as a different node from the same statement', () => {
    expect(parseFlowchart('Ship it -> Ship it?').nodes.map((n) => n.shape)).toEqual(['rect', 'decision']);
  });

  it('does not duplicate identical edges', () => {
    expect(parseFlowchart('A -> B\nA -> B').edges).toHaveLength(1);
  });
});

describe('parseTree', () => {
  const outline = `Trip
  Travel
    Train
  Stay
    - Hotel
    - Hostel`;

  it('builds a tree from indentation and markdown bullets', () => {
    const graph = parseTree(outline);
    expect(graph.nodes.map((n) => [n.label, n.depth])).toEqual([
      ['Trip', 0],
      ['Travel', 1],
      ['Train', 2],
      ['Stay', 1],
      ['Hotel', 2],
      ['Hostel', 2],
    ]);
    expect(graph.edges.map((e) => e.target)).toContain('trip/stay/hostel');
  });

  it('keeps ids stable when unrelated lines are inserted', () => {
    const before = parseTree(outline).nodes.find((n) => n.label === 'Hotel')!.id;
    const after = parseTree(outline.replace('Trip\n', 'Trip\n  Budget\n')).nodes.find((n) => n.label === 'Hotel')!.id;
    expect(after).toBe(before);
  });

  it('gives duplicate siblings unique ids', () => {
    const ids = parseTree('Root\n  Same\n  Same').nodes.map((n) => n.id);
    expect(new Set(ids).size).toBe(3);
  });

  it('splits "Name: Role" into title and subtitle for org charts', () => {
    const [node] = parseTree('Ananya: CEO', { subtitles: true }).nodes;
    expect(node).toMatchObject({ label: 'Ananya', subtitle: 'CEO' });
  });

  it('still accepts the older dash separator for roles', () => {
    for (const line of ['Ananya — CEO', 'Ananya - CEO']) {
      const [node] = parseTree(line, { subtitles: true }).nodes;
      expect(node).toMatchObject({ label: 'Ananya', subtitle: 'CEO' });
    }
  });

  it('handles tabs and warns about extra top-level items', () => {
    const graph = parseTree('A\n\tB\nC');
    expect(graph.nodes.find((n) => n.label === 'B')?.depth).toBe(1);
    expect(graph.issues).toHaveLength(1);
  });
});

describe('parseDiagram', () => {
  it('caps very large diagrams', () => {
    const source = Array.from({ length: 400 }, (_, i) => `Step ${i} -> Step ${i + 1}`).join('\n');
    const graph = parseDiagram('flowchart', source);
    expect(graph.nodes).toHaveLength(300);
    expect(graph.edges.every((e) => graph.nodes.some((n) => n.id === e.target))).toBe(true);
    expect(graph.issues.at(-1)?.message).toMatch(/first 300/);
  });
});
