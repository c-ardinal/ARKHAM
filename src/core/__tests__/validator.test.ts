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

  it('detects multiple outgoing flow edges on event node', () => {
    const graph: CoreGraph = {
      masterData: { items: [], locations: [], skills: [] },
      nodes: [
        {
          id: 'start',
          chapter: 1,
          title: '開始イベント',
          type: 'event',
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
          id: 'event_a',
          chapter: 1,
          title: 'イベントA',
          type: 'event',
          locationId: 'loc_a',
          purpose: '進行A',
          kpInstructions: [],
          investigationPoints: [],
          readAloudText: '',
          requiredItems: [],
          acquiredItems: [],
          consumedItems: [],
          timeCostMinutes: 5,
        },
        {
          id: 'event_b',
          chapter: 1,
          title: 'イベントB',
          type: 'event',
          locationId: 'loc_b',
          purpose: '進行B',
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
        { id: 'e1', fromNodeId: 'start', toNodeId: 'event_a', conditionType: 'always' },
        { id: 'e2', fromNodeId: 'start', toNodeId: 'event_b', conditionType: 'always' },
      ],
      startNodeId: 'start',
    };

    const issues = validateGraph(graph);
    const multiOut = issues.find((i) => i.code === 'multiple_event_outgoing_edges');
    expect(multiOut).toBeDefined();
    expect(multiOut?.nodeId).toBe('start');
  });

  it('detects unconnected branch route when only some routes are connected', () => {
    const graph: CoreGraph = {
      masterData: { items: [], locations: [], skills: [] },
      nodes: [
        {
          id: 'start',
          chapter: 1,
          title: '開始イベント',
          type: 'event',
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
          id: 'branch_3',
          chapter: 1,
          title: '3択の分岐',
          type: 'check',
          locationId: 'loc_start',
          purpose: '分岐',
          kpInstructions: [],
          investigationPoints: [],
          readAloudText: '',
          requiredItems: [],
          acquiredItems: [],
          consumedItems: [],
          timeCostMinutes: 5,
          branches: [
            { id: 'route_1', label: 'ルート1' },
            { id: 'route_2', label: 'ルート2' },
            { id: 'route_3', label: 'ルート3' },
          ],
        },
        {
          id: 'event_1',
          chapter: 1,
          title: 'イベント1',
          type: 'event',
          locationId: 'loc_start',
          purpose: 'イベント1',
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
        { id: 'e_start', fromNodeId: 'start', toNodeId: 'branch_3', conditionType: 'always' },
        // Only route_1 is connected; route_2 and route_3 are unconnected!
        { id: 'e_r1', fromNodeId: 'branch_3', toNodeId: 'event_1', sourceHandle: 'route_1-left', conditionType: 'choice' },
      ],
      startNodeId: 'start',
    };

    const issues = validateGraph(graph);
    const unconnected = issues.filter((i) => i.code === 'unconnected_branch_route');
    expect(unconnected).toHaveLength(2);
    expect(unconnected.map((u) => (u.details as any)?.branchId)).toEqual(expect.arrayContaining(['route_2', 'route_3']));
  });

  it('detects unconnected Else fallback route as a warning when not connected', () => {
    const graph: CoreGraph = {
      masterData: { items: [], locations: [], skills: [] },
      nodes: [
        {
          id: 'start',
          chapter: 1,
          title: '開始イベント',
          type: 'event',
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
          id: 'branch_multi',
          chapter: 1,
          title: '多分岐判定',
          type: 'check',
          locationId: 'loc_start',
          purpose: '分岐',
          kpInstructions: [],
          investigationPoints: [],
          readAloudText: '',
          requiredItems: [],
          acquiredItems: [],
          consumedItems: [],
          timeCostMinutes: 5,
          branches: [
            { id: 'case_1', label: 'ルート1' },
            { id: 'case_2', label: 'ルート2' },
          ],
        },
        {
          id: 'tgt_1',
          chapter: 1,
          title: '行先1',
          type: 'event',
          locationId: 'loc_start',
          purpose: '行先1',
          kpInstructions: [],
          investigationPoints: [],
          readAloudText: '',
          requiredItems: [],
          acquiredItems: [],
          consumedItems: [],
          timeCostMinutes: 5,
        },
        {
          id: 'tgt_2',
          chapter: 1,
          title: '行先2',
          type: 'event',
          locationId: 'loc_start',
          purpose: '行先2',
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
        { id: 'e_start', fromNodeId: 'start', toNodeId: 'branch_multi', conditionType: 'always' },
        { id: 'e_1', fromNodeId: 'branch_multi', toNodeId: 'tgt_1', sourceHandle: 'case_1', conditionType: 'choice' },
        { id: 'e_2', fromNodeId: 'branch_multi', toNodeId: 'tgt_2', sourceHandle: 'case_2', conditionType: 'choice' },
      ],
      startNodeId: 'start',
    };

    const issues = validateGraph(graph);
    // Explicit routes are connected -> 0 errors!
    const errors = issues.filter((i) => i.severity === 'error');
    expect(errors).toHaveLength(0);

    // Else route is unconnected -> 1 warning!
    const elseWarnings = issues.filter((i) => i.code === 'unconnected_else_route');
    expect(elseWarnings).toHaveLength(1);
    expect(elseWarnings[0].severity).toBe('warning');
  });

  it('detects invalid jump target when jumpTarget is missing or points to non-existent node', () => {
    const graph: CoreGraph = {
      masterData: { items: [], locations: [], skills: [] },
      nodes: [
        {
          id: 'start',
          chapter: 1,
          title: '開始イベント',
          type: 'event',
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
          id: 'jump_empty',
          chapter: 1,
          title: '空ジャンプ',
          type: 'jump',
          locationId: 'loc_start',
          purpose: 'ジャンプ',
          kpInstructions: [],
          investigationPoints: [],
          readAloudText: '',
          requiredItems: [],
          acquiredItems: [],
          consumedItems: [],
          timeCostMinutes: 5,
          jumpTarget: null,
        },
        {
          id: 'jump_broken',
          chapter: 1,
          title: 'リンク切れジャンプ',
          type: 'jump',
          locationId: 'loc_start',
          purpose: 'ジャンプ',
          kpInstructions: [],
          investigationPoints: [],
          readAloudText: '',
          requiredItems: [],
          acquiredItems: [],
          consumedItems: [],
          timeCostMinutes: 5,
          jumpTarget: { tabId: 'tab_1', nodeId: 'non_existent_node' },
        },
      ],
      edges: [
        { id: 'e1', fromNodeId: 'start', toNodeId: 'jump_empty', conditionType: 'always' },
        { id: 'e2', fromNodeId: 'start', toNodeId: 'jump_broken', conditionType: 'always' },
      ],
      startNodeId: 'start',
    };

    const issues = validateGraph(graph);
    const jumpIssues = issues.filter((i) => i.code === 'invalid_jump_target');
    expect(jumpIssues).toHaveLength(2);
    expect(jumpIssues.map((j) => j.nodeId)).toContain('jump_empty');
    expect(jumpIssues.map((j) => j.nodeId)).toContain('jump_broken');
  });

  it('detects dead-end unconnected node when no ending nodes exist in scenario', () => {
    const graph: CoreGraph = {
      masterData: { items: [], locations: [], skills: [] },
      nodes: [
        {
          id: 'start',
          chapter: 1,
          title: '開始イベント',
          type: 'event',
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
          id: 'hanging_event',
          chapter: 1,
          title: '途切れイベント',
          type: 'event',
          locationId: 'loc_start',
          purpose: '途切れ',
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
        { id: 'e1', fromNodeId: 'start', toNodeId: 'hanging_event', conditionType: 'always' },
      ],
      startNodeId: 'start',
    };

    const issues = validateGraph(graph);
    const deadEnd = issues.find((i) => i.code === 'dead_end_unconnected');
    expect(deadEnd).toBeDefined();
    expect(deadEnd?.nodeId).toBe('hanging_event');
  });

  it('detects unconnected branch route even if branch node is unreachable from start', () => {
    const graph: CoreGraph = {
      masterData: { items: [], locations: [], skills: [] },
      nodes: [
        {
          id: 'start',
          chapter: 1,
          title: '開始イベント',
          type: 'event',
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
          id: 'floating_branch',
          chapter: 1,
          title: '浮いている分岐ノード',
          type: 'check',
          locationId: 'loc_start',
          purpose: '分岐',
          kpInstructions: [],
          investigationPoints: [],
          readAloudText: '',
          requiredItems: [],
          acquiredItems: [],
          consumedItems: [],
          timeCostMinutes: 5,
          branches: [
            { id: 'opt_a', label: '選択肢A' },
            { id: 'opt_b', label: '選択肢B' },
          ],
        },
      ],
      edges: [],
      startNodeId: 'start',
    };

    const issues = validateGraph(graph);
    const unconnected = issues.filter((i) => i.code === 'unconnected_branch_route');
    expect(unconnected).toHaveLength(2);
    expect(unconnected.map((u) => (u.details as any)?.branchId)).toEqual(expect.arrayContaining(['opt_a', 'opt_b']));
    expect(issues.some((i) => i.code === 'dangling_branch')).toBe(true);
  });

  it('detects missing start node when startNodeId is omitted or not in nodeMap', () => {
    const graph: CoreGraph = {
      masterData: { items: [], locations: [], skills: [] },
      nodes: [
        {
          id: 'event_1',
          chapter: 1,
          title: 'イベント1',
          type: 'event',
          locationId: 'loc_start',
          purpose: 'イベント1',
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
      startNodeId: undefined,
    };

    const issues = validateGraph(graph);
    expect(issues.some((i) => i.code === 'missing_start_node')).toBe(true);
  });

  it('does not flag cross-tab jump target as invalid when it exists in allNodeIds', () => {
    const graph: CoreGraph = {
      masterData: { items: [], locations: [], skills: [] },
      nodes: [
        {
          id: 'start',
          chapter: 1,
          title: '開始イベント',
          type: 'event',
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
          id: 'jump_node',
          chapter: 1,
          title: '他タブジャンプ',
          type: 'jump',
          locationId: 'loc_start',
          purpose: 'ジャンプ',
          kpInstructions: [],
          investigationPoints: [],
          readAloudText: '',
          requiredItems: [],
          acquiredItems: [],
          consumedItems: [],
          timeCostMinutes: 5,
          jumpTarget: { tabId: 'tab_other', nodeId: 'node_in_tab_other' },
        },
      ],
      edges: [
        { id: 'e1', fromNodeId: 'start', toNodeId: 'jump_node', conditionType: 'always' },
      ],
      startNodeId: 'start',
      allNodeIds: ['start', 'jump_node', 'node_in_tab_other'],
    };

    const issues = validateGraph(graph);
    expect(issues.some((i) => i.code === 'invalid_jump_target')).toBe(false);
  });
});
