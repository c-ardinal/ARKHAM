import { describe, it, expect } from 'vitest';
import { getLayoutedElements } from '../autoLayout';
import type { ScenarioNode, ScenarioEdge } from '../../types';

describe('autoLayout', () => {
  it('arranges sequential nodes from top to bottom (TB)', () => {
    const nodes: ScenarioNode[] = [
      { id: 'node-1', type: 'event', position: { x: 500, y: 500 }, data: { label: 'Node 1' } },
      { id: 'node-2', type: 'event', position: { x: 100, y: 100 }, data: { label: 'Node 2' } },
      { id: 'node-3', type: 'event', position: { x: 0, y: 0 }, data: { label: 'Node 3' } },
    ];

    const edges: ScenarioEdge[] = [
      { id: 'e1-2', source: 'node-1', target: 'node-2' },
      { id: 'e2-3', source: 'node-2', target: 'node-3' },
    ];

    const { nodes: layouted } = getLayoutedElements(nodes, edges, { direction: 'TB' });

    const n1 = layouted.find((n) => n.id === 'node-1')!;
    const n2 = layouted.find((n) => n.id === 'node-2')!;
    const n3 = layouted.find((n) => n.id === 'node-3')!;

    // In TB direction, y coordinates must increase sequentially (top to bottom)
    expect(n1.position.y).toBeLessThan(n2.position.y);
    expect(n2.position.y).toBeLessThan(n3.position.y);
  });

  it('arranges branch sibling nodes horizontally (left to right)', () => {
    const nodes: ScenarioNode[] = [
      { id: 'root', type: 'event', position: { x: 0, y: 0 }, data: { label: 'Root' } },
      { id: 'branch-a', type: 'event', position: { x: 0, y: 0 }, data: { label: 'Branch A' } },
      { id: 'branch-b', type: 'event', position: { x: 0, y: 0 }, data: { label: 'Branch B' } },
    ];

    const edges: ScenarioEdge[] = [
      { id: 'e-ra', source: 'root', target: 'branch-a' },
      { id: 'e-rb', source: 'root', target: 'branch-b' },
    ];

    const { nodes: layouted } = getLayoutedElements(nodes, edges, { direction: 'TB' });

    const root = layouted.find((n) => n.id === 'root')!;
    const bA = layouted.find((n) => n.id === 'branch-a')!;
    const bB = layouted.find((n) => n.id === 'branch-b')!;

    // Both branch nodes are below root
    expect(root.position.y).toBeLessThan(bA.position.y);
    expect(root.position.y).toBeLessThan(bB.position.y);

    // Branch nodes are on approximately the same rank, separated horizontally
    expect(bA.position.y).toEqual(bB.position.y);
    expect(bA.position.x).not.toEqual(bB.position.x);
  });

  it('keeps sticky nodes unmutated', () => {
    const nodes: ScenarioNode[] = [
      { id: 'n1', type: 'event', position: { x: 10, y: 10 }, data: { label: 'Event' } },
      { id: 's1', type: 'sticky', position: { x: 999, y: 888 }, data: { label: 'Note' } },
    ];
    const edges: ScenarioEdge[] = [];

    const { nodes: layouted } = getLayoutedElements(nodes, edges);
    const sticky = layouted.find((n) => n.id === 's1')!;
    expect(sticky.position).toEqual({ x: 999, y: 888 });
  });

  it('positions reference-connected nodes (satellites) neatly to the right of parent event node', () => {
    const nodes: ScenarioNode[] = [
      { id: 'event-1', type: 'event', position: { x: 0, y: 0 }, data: { label: '調査開始' } },
      { id: 'char-1', type: 'character', position: { x: 0, y: 0 }, data: { label: '探偵助手' } },
      { id: 'stage-1', type: 'stage', position: { x: 0, y: 0 }, data: { label: '書斎' } },
    ];

    const edges: ScenarioEdge[] = [
      { id: 'ref-1', source: 'event-1', target: 'char-1', type: 'reference', sourceHandle: 'ref-source', targetHandle: 'ref-target' },
      { id: 'ref-2', source: 'event-1', target: 'stage-1', type: 'reference', sourceHandle: 'ref-source', targetHandle: 'ref-target' },
    ];

    const { nodes: layouted } = getLayoutedElements(nodes, edges, { direction: 'TB' });

    const ev = layouted.find((n) => n.id === 'event-1')!;
    const ch = layouted.find((n) => n.id === 'char-1')!;
    const st = layouted.find((n) => n.id === 'stage-1')!;

    // Satellites must be placed to the right of the event node
    expect(ch.position.x).toBeGreaterThanOrEqual(ev.position.x + 240);
    expect(st.position.x).toBeGreaterThanOrEqual(ev.position.x + 240);

    // Satellites are vertically stacked without overlapping
    expect(Math.abs(ch.position.y - st.position.y)).toBeGreaterThanOrEqual(70);
  });

  it('prevents collision between satellite nodes and sibling branches', () => {
    const nodes: ScenarioNode[] = [
      { id: 'root', type: 'event', position: { x: 0, y: 0 }, data: { label: 'Root Event' } },
      { id: 'char-root', type: 'character', position: { x: 0, y: 0 }, data: { label: 'Key NPC' } },
      { id: 'branch-a', type: 'event', position: { x: 0, y: 0 }, data: { label: 'Branch A' } },
      { id: 'branch-b', type: 'event', position: { x: 0, y: 0 }, data: { label: 'Branch B' } },
    ];

    const edges: ScenarioEdge[] = [
      { id: 'ref-c', source: 'root', target: 'char-root', type: 'reference' },
      { id: 'e-ra', source: 'root', target: 'branch-a' },
      { id: 'e-rb', source: 'root', target: 'branch-b' },
    ];

    const { nodes: layouted } = getLayoutedElements(nodes, edges, { direction: 'TB' });

    const root = layouted.find((n) => n.id === 'root')!;
    const sat = layouted.find((n) => n.id === 'char-root')!;
    const bA = layouted.find((n) => n.id === 'branch-a')!;
    const bB = layouted.find((n) => n.id === 'branch-b')!;

    // Satellite is to the right of root
    expect(sat.position.x).toBeGreaterThan(root.position.x);

    // Both branches are placed below root
    expect(bA.position.y).toBeGreaterThan(root.position.y);
    expect(bB.position.y).toBeGreaterThan(root.position.y);
  });
});
