import { describe, expect, it } from 'vitest';
import { layoutGraph, measureNode, withOverrides } from './layout';
import { parseDiagram } from './parse';

describe('layout', () => {
  it('places every node and flows top-to-bottom or left-to-right', () => {
    const graph = parseDiagram('flowchart', 'A -> B -> C');
    const tb = layoutGraph(graph, 'flowchart', 'TB');
    const lr = layoutGraph(graph, 'flowchart', 'LR');

    expect([...tb.keys()]).toEqual(['a', 'b', 'c']);
    expect(tb.get('b')!.y).toBeGreaterThan(tb.get('a')!.y);
    expect(lr.get('b')!.x).toBeGreaterThan(lr.get('a')!.x);
  });

  it('always lays mind maps out horizontally', () => {
    const graph = parseDiagram('mindmap', 'Root\n  Child');
    const boxes = layoutGraph(graph, 'mindmap', 'TB');
    expect(boxes.get('root/child')!.x).toBeGreaterThan(boxes.get('root')!.x);
  });

  it('gives decisions more room than plain steps', () => {
    const [step, decision] = parseDiagram('flowchart', 'Ship it -> Ship it?').nodes;
    expect(measureNode(decision).width).toBeGreaterThan(measureNode(step).width);
  });

  it('applies manual positions only to nodes that still exist', () => {
    const boxes = layoutGraph(parseDiagram('flowchart', 'A -> B'), 'flowchart', 'TB');
    const moved = withOverrides(boxes, { a: { x: 500, y: 600 }, gone: { x: 1, y: 1 } });
    expect(moved.get('a')).toMatchObject({ x: 500, y: 600 });
    expect(moved.has('gone')).toBe(false);
  });
});
