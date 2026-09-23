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

  it('automatically selects left vs right pin for multi-branch node based on target position', () => {
    const nodes: ScenarioNode[] = [
      {
        id: 'branch-node',
        type: 'branch',
        position: { x: 300, y: 0 },
        data: {
          label: '分岐判定',
          branches: [
            { id: 'route-1', label: 'ルート 1' },
            { id: 'route-2', label: 'ルート 2' },
          ],
        },
      },
      { id: 'target-left', type: 'event', position: { x: 0, y: 0 }, data: { label: '左側イベント' } },
      { id: 'target-right', type: 'event', position: { x: 0, y: 0 }, data: { label: '右側イベント' } },
    ];

    // Initially both edges are hooked to standard right handles
    const edges: ScenarioEdge[] = [
      { id: 'e-1', source: 'branch-node', target: 'target-left', sourceHandle: 'route-1' },
      { id: 'e-2', source: 'branch-node', target: 'target-right', sourceHandle: 'route-2' },
    ];

    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(nodes, edges, { direction: 'TB' });

    const bNode = layoutedNodes.find((n) => n.id === 'branch-node')!;
    expect(bNode).toBeDefined();
    const tLeft = layoutedNodes.find((n) => n.id === 'target-left')!;
    const tRight = layoutedNodes.find((n) => n.id === 'target-right')!;

    // Verify layout placement: one node is left, one is right
    expect(tLeft.position.x).not.toEqual(tRight.position.x);
    const leftTarget = tLeft.position.x < tRight.position.x ? tLeft : tRight;
    const rightTarget = tLeft.position.x < tRight.position.x ? tRight : tLeft;

    const edgeToLeft = layoutedEdges.find((e) => e.target === leftTarget.id)!;
    const edgeToRight = layoutedEdges.find((e) => e.target === rightTarget.id)!;

    // Edge pointing to left target must use -left handle
    expect(edgeToLeft.sourceHandle).toMatch(/-left$/);
    // Edge pointing to right target must NOT use -left handle
    expect(edgeToRight.sourceHandle).not.toMatch(/-left$/);
  });

  it('places higher routes on the outside and lower routes on the inside for a 3-route branch', () => {
    const nodes: ScenarioNode[] = [
      {
        id: 'branch-3',
        type: 'branch',
        position: { x: 0, y: 0 },
        data: {
          label: '3分岐テスト',
          branches: [
            { id: 'route-1', label: 'ルート 1' },
            { id: 'route-2', label: 'ルート 2' },
          ],
        },
      },
      { id: 'target-r1', type: 'event', position: { x: 0, y: 0 }, data: { label: 'Route 1 Target' } },
      { id: 'target-r2', type: 'event', position: { x: 0, y: 0 }, data: { label: 'Route 2 Target' } },
      { id: 'target-else', type: 'event', position: { x: 0, y: 0 }, data: { label: 'Else Target' } },
    ];

    const edges: ScenarioEdge[] = [
      { id: 'e-r1', source: 'branch-3', target: 'target-r1', sourceHandle: 'route-1' },
      { id: 'e-r2', source: 'branch-3', target: 'target-r2', sourceHandle: 'route-2' },
      { id: 'e-else', source: 'branch-3', target: 'target-else', sourceHandle: 'else' },
    ];

    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(nodes, edges, { direction: 'TB' });

    const bNode = layoutedNodes.find((n) => n.id === 'branch-3')!;
    expect(bNode).toBeDefined();
    const t1 = layoutedNodes.find((n) => n.id === 'target-r1')!;
    const t2 = layoutedNodes.find((n) => n.id === 'target-r2')!;
    const tElse = layoutedNodes.find((n) => n.id === 'target-else')!;

    // Left: Route 1 (top of branch)
    // Center: Else (bottom of branch)
    // Right: Route 2 (upper of right side)
    expect(t1.position.x).toBeLessThan(tElse.position.x);
    expect(tElse.position.x).toBeLessThan(t2.position.x);

    // Pins should be automatically selected:
    // t1 uses left pin, tElse and t2 use right pins
    const e1 = layoutedEdges.find((e) => e.target === 'target-r1')!;
    const e2 = layoutedEdges.find((e) => e.target === 'target-r2')!;
    const eElse = layoutedEdges.find((e) => e.target === 'target-else')!;

    expect(e1.sourceHandle).toBe('route-1-left');
    expect(eElse.sourceHandle).toBe('else');
    expect(e2.sourceHandle).toBe('route-2');
  });

  it('places higher routes on the outside and lower routes on the inside for a 4-route branch', () => {
    const nodes: ScenarioNode[] = [
      {
        id: 'branch-4',
        type: 'branch',
        position: { x: 0, y: 0 },
        data: {
          label: '4分岐テスト',
          branches: [
            { id: 'route-1', label: 'ルート 1' },
            { id: 'route-2', label: 'ルート 2' },
            { id: 'route-3', label: 'ルート 3' },
          ],
        },
      },
      { id: 'target-1', type: 'event', position: { x: 0, y: 0 }, data: { label: 'Route 1' } },
      { id: 'target-2', type: 'event', position: { x: 0, y: 0 }, data: { label: 'Route 2' } },
      { id: 'target-3', type: 'event', position: { x: 0, y: 0 }, data: { label: 'Route 3' } },
      { id: 'target-else', type: 'event', position: { x: 0, y: 0 }, data: { label: 'Else' } },
    ];

    const edges: ScenarioEdge[] = [
      { id: 'e-1', source: 'branch-4', target: 'target-1', sourceHandle: 'route-1' },
      { id: 'e-2', source: 'branch-4', target: 'target-2', sourceHandle: 'route-2' },
      { id: 'e-3', source: 'branch-4', target: 'target-3', sourceHandle: 'route-3' },
      { id: 'e-4', source: 'branch-4', target: 'target-else', sourceHandle: 'else' },
    ];

    const { nodes: layoutedNodes } = getLayoutedElements(nodes, edges, { direction: 'TB' });

    const t1 = layoutedNodes.find((n) => n.id === 'target-1')!;
    const t2 = layoutedNodes.find((n) => n.id === 'target-2')!;
    const t3 = layoutedNodes.find((n) => n.id === 'target-3')!;
    const tElse = layoutedNodes.find((n) => n.id === 'target-else')!;

    // Left side: Route 1 is outer (leftmost), Route 2 is inner
    expect(t1.position.x).toBeLessThan(t2.position.x);

    // Inner region: Route 2 and Else are near center
    expect(t2.position.x).toBeLessThan(tElse.position.x);

    // Right side: Else is inner, Route 3 is outer (rightmost)
    expect(tElse.position.x).toBeLessThan(t3.position.x);
  });

  it('lays out node_3_console_switch in sample scenario as Console A, C, B from left to right', async () => {
    const fs = await import('fs');
    const raw = fs.readFileSync('sample/scenario_indeterminate_organ.json', 'utf-8');
    const scenario = JSON.parse(raw);
    const tab = scenario.tabs[0];

    const result = getLayoutedElements(tab.nodes, tab.edges, { direction: 'TB' });
    const sw = result.nodes.find((n: ScenarioNode) => n.id === 'node_3_console_switch')!;
    const a = result.nodes.find((n: ScenarioNode) => n.id === 'node_3_console_a')!;
    const b = result.nodes.find((n: ScenarioNode) => n.id === 'node_3_console_b')!;
    const c = result.nodes.find((n: ScenarioNode) => n.id === 'node_3_console_c')!;

    expect(sw).toBeDefined();
    // From left to right: Console A, Console C, Console B
    expect(a.position.x).toBeLessThan(c.position.x);
    expect(c.position.x).toBeLessThan(b.position.x);

    const evalNode = result.nodes.find((n: ScenarioNode) => n.id === 'node_3_scrum_eval')!;
    const e4_1 = result.nodes.find((n: ScenarioNode) => n.id === 'node_4_1')!;
    const e4_2 = result.nodes.find((n: ScenarioNode) => n.id === 'node_4_2')!;
    const e4_3 = result.nodes.find((n: ScenarioNode) => n.id === 'node_4_3')!;

    expect(evalNode).toBeDefined();
    // Eval node is placed in the center between A and B
    expect(a.position.x).toBeLessThan(evalNode.position.x);
    expect(evalNode.position.x).toBeLessThan(b.position.x);

    // Downstream endings from evalNode: 4_1 (True End, left) < 4_3 (Bad End 2, center) < 4_2 (Bad End 1, right)
    expect(e4_1.position.x).toBeLessThan(e4_3.position.x);
    expect(e4_3.position.x).toBeLessThan(e4_2.position.x);
  });

  it('guarantees multi-level branch subtrees do not cross', () => {
    // Branch node with 3 routes
    // Route 1 (top, left): A1 -> A2
    // Route 2 (middle, inside right): C1 -> C2
    // Route 3 (bottom, inside center/else): B1 -> B2
    const nodes: ScenarioNode[] = [
      {
        id: 'branch',
        type: 'branch',
        position: { x: 0, y: 0 },
        data: {
          label: '3-Branch Multi-Level',
          branches: [
            { id: 'r1', label: 'Route 1' },
            { id: 'r2', label: 'Route 2' },
          ],
        },
      },
      { id: 'a1', type: 'event', position: { x: 0, y: 0 }, data: { label: 'A1' } },
      { id: 'a2', type: 'event', position: { x: 0, y: 0 }, data: { label: 'A2' } },
      { id: 'b1', type: 'event', position: { x: 0, y: 0 }, data: { label: 'B1' } },
      { id: 'b2', type: 'event', position: { x: 0, y: 0 }, data: { label: 'B2' } },
      { id: 'else1', type: 'event', position: { x: 0, y: 0 }, data: { label: 'Else1' } },
      { id: 'else2', type: 'event', position: { x: 0, y: 0 }, data: { label: 'Else2' } },
    ];

    const edges: ScenarioEdge[] = [
      { id: 'e-r1', source: 'branch', target: 'a1', sourceHandle: 'r1' },
      { id: 'e-a1-a2', source: 'a1', target: 'a2' },
      { id: 'e-r2', source: 'branch', target: 'b1', sourceHandle: 'r2' },
      { id: 'e-b1-b2', source: 'b1', target: 'b2' },
      { id: 'e-else', source: 'branch', target: 'else1', sourceHandle: 'else' },
      { id: 'e-else1-else2', source: 'else1', target: 'else2' },
    ];

    const result = getLayoutedElements(nodes, edges, { direction: 'TB' });

    const a1 = result.nodes.find((n) => n.id === 'a1')!;
    const a2 = result.nodes.find((n) => n.id === 'a2')!;
    const else1 = result.nodes.find((n) => n.id === 'else1')!;
    const else2 = result.nodes.find((n) => n.id === 'else2')!;
    const b1 = result.nodes.find((n) => n.id === 'b1')!;
    const b2 = result.nodes.find((n) => n.id === 'b2')!;

    // Level 1 order: a1 < else1 < b1
    expect(a1.position.x).toBeLessThan(else1.position.x);
    expect(else1.position.x).toBeLessThan(b1.position.x);

    // Level 2 downstream order: a2 < else2 < b2 (NO crossing!)
    expect(a2.position.x).toBeLessThan(else2.position.x);
    expect(else2.position.x).toBeLessThan(b2.position.x);
  });
});
