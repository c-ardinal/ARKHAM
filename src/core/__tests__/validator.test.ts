import { describe, it, expect } from 'vitest';
import { validateGraph } from '../validator';
import type { CoreGraph } from '../schema';

describe('ARKHAM Graph Validator Module', () => {
  it('detects soft-lock when a path reaches a node without the prerequisite item', () => {
    // Start -> Route A (acquires key) -> Gate (requires key)
    // Start -> Route B (no key)       -> Gate (requires key) [SOFT LOCK]
    const graph: CoreGraph = {
      masterData: {
        items: [
          {
            id: 'item_key',
            name: '金庫の鍵',
            category: 'key',
            description: '',
            isConsumable: false,
          },
        ],
        locations: [],
        skills: [],
      },
      nodes: [
        {
          id: 'start',
          chapter: 1,
          title: '分岐点',
          type: 'scene',
          locationId: 'loc_start',
          purpose: '開始',
          kpInstructions: [],
          investigationPoints: [],
          readAloudText: '',
          requiredItems: [],
          acquiredItems: [],
          consumedItems: [],
          timeCostMinutes: 5,
        },
        {
          id: 'route_a',
          chapter: 1,
          title: '探索ルートA',
          type: 'scene',
          locationId: 'loc_a',
          purpose: '鍵入手',
          kpInstructions: [],
          investigationPoints: [],
          readAloudText: '',
          requiredItems: [],
          acquiredItems: ['item_key'],
          consumedItems: [],
          timeCostMinutes: 10,
        },
        {
          id: 'route_b',
          chapter: 1,
          title: '探索ルートB',
          type: 'scene',
          locationId: 'loc_b',
          purpose: '鍵なし直行',
          kpInstructions: [],
          investigationPoints: [],
          readAloudText: '',
          requiredItems: [],
          acquiredItems: [],
          consumedItems: [],
          timeCostMinutes: 10,
        },
        {
          id: 'gate',
          chapter: 1,
          title: '強固な大扉',
          type: 'room',
          locationId: 'loc_gate',
          purpose: '金庫室へ',
          kpInstructions: [],
          investigationPoints: [],
          readAloudText: '',
          requiredItems: ['item_key'],
          acquiredItems: [],
          consumedItems: [],
          timeCostMinutes: 5,
        },
      ],
      edges: [
        { id: 'e1', fromNodeId: 'start', toNodeId: 'route_a', conditionType: 'choice' },
        { id: 'e2', fromNodeId: 'start', toNodeId: 'route_b', conditionType: 'choice' },
        { id: 'e3', fromNodeId: 'route_a', toNodeId: 'gate', conditionType: 'always' },
        { id: 'e4', fromNodeId: 'route_b', toNodeId: 'gate', conditionType: 'always' },
      ],
      startNodeId: 'start',
    };

    const issues = validateGraph(graph);
    const softLock = issues.find((i) => i.code === 'soft_lock_missing_item');
    expect(softLock).toBeDefined();
    expect(softLock?.nodeId).toBe('gate');
    expect(softLock?.edgeIds).toContain('e4');
  });

  it('passes when all paths acquire the prerequisite item beforehand', () => {
    // Start -> Acquires Key -> Gate (requires key)
    const graph: CoreGraph = {
      masterData: {
        items: [
          {
            id: 'item_key',
            name: '金庫の鍵',
            category: 'key',
            description: '',
            isConsumable: false,
          },
        ],
        locations: [],
        skills: [],
      },
      nodes: [
        {
          id: 'start',
          chapter: 1,
          title: '開始部屋',
          type: 'scene',
          locationId: 'loc_start',
          purpose: '開始',
          kpInstructions: [],
          investigationPoints: [],
          readAloudText: '',
          requiredItems: [],
          acquiredItems: ['item_key'],
          consumedItems: [],
          timeCostMinutes: 5,
        },
        {
          id: 'gate',
          chapter: 1,
          title: '強固な大扉',
          type: 'room',
          locationId: 'loc_gate',
          purpose: '開錠',
          kpInstructions: [],
          investigationPoints: [],
          readAloudText: '',
          requiredItems: ['item_key'],
          acquiredItems: [],
          consumedItems: [],
          timeCostMinutes: 5,
        },
      ],
      edges: [
        { id: 'e1', fromNodeId: 'start', toNodeId: 'gate', conditionType: 'always' },
      ],
      startNodeId: 'start',
    };

    const issues = validateGraph(graph);
    expect(issues.filter((i) => i.code === 'soft_lock_missing_item').length).toBe(0);
  });

  it('detects inescapable infinite loop cycles', () => {
    const graph: CoreGraph = {
      masterData: { items: [], locations: [], skills: [] },
      nodes: [
        {
          id: 'loop_1',
          chapter: 1,
          title: '迷宮の回廊A',
          type: 'room',
          locationId: 'loc_1',
          purpose: '迷路',
          kpInstructions: [],
          investigationPoints: [],
          readAloudText: '',
          requiredItems: [],
          acquiredItems: [],
          consumedItems: [],
          timeCostMinutes: 5,
        },
        {
          id: 'loop_2',
          chapter: 1,
          title: '迷宮の回廊B',
          type: 'room',
          locationId: 'loc_2',
          purpose: '迷路',
          kpInstructions: [],
          investigationPoints: [],
          readAloudText: '',
          requiredItems: [],
          acquiredItems: [],
          consumedItems: [],
          timeCostMinutes: 5,
        },
      ],
      edges: [
        { id: 'e1', fromNodeId: 'loop_1', toNodeId: 'loop_2', conditionType: 'always' },
        { id: 'e2', fromNodeId: 'loop_2', toNodeId: 'loop_1', conditionType: 'always' },
      ],
      startNodeId: 'loop_1',
    };

    const issues = validateGraph(graph);
    const loopIssue = issues.find((i) => i.code === 'infinite_loop');
    expect(loopIssue).toBeDefined();
  });

  it('detects unreachable nodes that are disconnected from start', () => {
    const graph: CoreGraph = {
      masterData: { items: [], locations: [], skills: [] },
      nodes: [
        {
          id: 'start',
          chapter: 1,
          title: '開始部屋',
          type: 'scene',
          locationId: 'loc_start',
          purpose: '開始',
          kpInstructions: [],
          investigationPoints: [],
          readAloudText: '',
          requiredItems: [],
          acquiredItems: [],
          consumedItems: [],
          timeCostMinutes: 5,
        },
        {
          id: 'isolated',
          chapter: 1,
          title: '孤立した隠し部屋',
          type: 'scene',
          locationId: 'loc_iso',
          purpose: '未接続',
          kpInstructions: [],
          investigationPoints: [],
          readAloudText: '',
          requiredItems: [],
          acquiredItems: [],
          consumedItems: [],
          timeCostMinutes: 5,
        },
      ],
      edges: [],
      startNodeId: 'start',
    };

    const issues = validateGraph(graph);
    const unreachable = issues.find((i) => i.code === 'unreachable_node');
    expect(unreachable).toBeDefined();
    expect(unreachable?.nodeId).toBe('isolated');
  });

  it('detects dead-end nodes when ending nodes exist but cannot be reached', () => {
    const graph: CoreGraph = {
      masterData: { items: [], locations: [], skills: [] },
      nodes: [
        {
          id: 'start',
          chapter: 1,
          title: '開始部屋',
          type: 'scene',
          locationId: 'loc_start',
          purpose: '開始',
          kpInstructions: [],
          investigationPoints: [],
          readAloudText: '',
          requiredItems: [],
          acquiredItems: [],
          consumedItems: [],
          timeCostMinutes: 5,
        },
        {
          id: 'dead_end_room',
          chapter: 1,
          title: '崩落した行き止まり',
          type: 'scene',
          locationId: 'loc_dead',
          purpose: '行き止まり',
          kpInstructions: [],
          investigationPoints: [],
          readAloudText: '',
          requiredItems: [],
          acquiredItems: [],
          consumedItems: [],
          timeCostMinutes: 5,
        },
        {
          id: 'true_end',
          chapter: 4,
          title: 'True End 生還',
          type: 'ending',
          locationId: 'loc_end',
          purpose: '生還',
          kpInstructions: [],
          investigationPoints: [],
          readAloudText: '',
          requiredItems: [],
          acquiredItems: [],
          consumedItems: [],
          timeCostMinutes: 5,
        },
      ],
      edges: [
        { id: 'e1', fromNodeId: 'start', toNodeId: 'dead_end_room', conditionType: 'always' },
      ],
      startNodeId: 'start',
    };

    const issues = validateGraph(graph);
    const deadEndNodeIds = issues.filter((i) => i.code === 'dead_end').map((i) => i.nodeId);
    expect(deadEndNodeIds).toContain('dead_end_room');
    expect(deadEndNodeIds).toContain('start');
  });

  it('detects dangling branch nodes that have no outgoing edges', () => {
    const graph: CoreGraph = {
      masterData: { items: [], locations: [], skills: [] },
      nodes: [
        {
          id: 'start',
          chapter: 1,
          title: '開始部屋',
          type: 'scene',
          locationId: 'loc_start',
          purpose: '開始',
          kpInstructions: [],
          investigationPoints: [],
          readAloudText: '',
          requiredItems: [],
          acquiredItems: [],
          consumedItems: [],
          timeCostMinutes: 5,
        },
        {
          id: 'branch_choice',
          chapter: 1,
          title: '選択の交差点',
          type: 'check',
          locationId: 'loc_cross',
          purpose: '分岐',
          kpInstructions: [],
          investigationPoints: [],
          readAloudText: '',
          requiredItems: [],
          acquiredItems: [],
          consumedItems: [],
          timeCostMinutes: 5,
        },
      ],
      edges: [
        { id: 'e1', fromNodeId: 'start', toNodeId: 'branch_choice', conditionType: 'always' },
      ],
      startNodeId: 'start',
    };

    const issues = validateGraph(graph);
    const dangling = issues.find((i) => i.code === 'dangling_branch');
    expect(dangling).toBeDefined();
    expect(dangling?.nodeId).toBe('branch_choice');
  });
});
