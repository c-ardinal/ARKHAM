import { describe, it, expect, beforeEach } from 'vitest';
import { buildCoreGraph } from '../adapter';
import { runSimulation } from '../simulator';
import { useScenarioStore } from '../../store/scenarioStore';
import type { ScenarioNode, ScenarioEdge } from '../../types';

describe('Branch Dual Pins & Cleanup Integrity', () => {
  describe('Adapter & Simulator Left-pin Handling', () => {
    it('correctly maps left-pin handle IDs (case-1-left, else-left) in buildCoreGraph and simulation', () => {
      const nodes: ScenarioNode[] = [
        {
          id: 'start',
          type: 'event',
          position: { x: 0, y: 0 },
          data: { label: '開始', isStart: true, variableOperations: [{ variableName: 'hasKey', operator: 'set', value: 1 }] },
        },
        {
          id: 'branch',
          type: 'branch',
          position: { x: 0, y: 100 },
          data: {
            label: '分岐',
            branches: [
              { id: 'case-key', label: '鍵所持', conditionType: 'variable', conditionValue: 'hasKey == 1' },
              { id: 'case-alt', label: '迂回', conditionType: 'variable', conditionValue: 'hasKey == 0' },
            ],
          },
        },
        {
          id: 'room-left',
          type: 'event',
          position: { x: -200, y: 200 },
          data: { label: '左の部屋' },
        },
        {
          id: 'room-else',
          type: 'event',
          position: { x: 200, y: 200 },
          data: { label: 'その他部屋' },
        },
      ];

      // Edge connected to the LEFT pin of case-key
      const edges: ScenarioEdge[] = [
        { id: 'e1', source: 'start', target: 'branch' },
        { id: 'e2', source: 'branch', target: 'room-left', sourceHandle: 'case-key-left' },
        { id: 'e3', source: 'branch', target: 'room-else', sourceHandle: 'else-left' },
      ];

      const coreGraph = buildCoreGraph(
        nodes,
        edges,
        [],
        [],
        undefined,
        { hasKey: { name: 'hasKey', type: 'number', value: 0 } }
      );

      // Verify edge condition extracted properly
      const branchEdges = coreGraph.edges.filter((e) => e.fromNodeId === 'branch');
      expect(branchEdges).toHaveLength(2);
      const toLeft = branchEdges.find((e) => e.toNodeId === 'room-left');
      expect(toLeft?.conditionType).toBe('variable');
      expect(toLeft?.conditionValue).toBe('hasKey == 1');

      // Run simulation
      const result = runSimulation(coreGraph, { runs: 10 });
      expect(result.completedRuns).toBe(10);
      expect(result.lostRate).toBe(0);
      expect(result.nodeVisitCounts?.['room-left']).toBe(10);
    });
  });

  describe('scenarioStore Cleanup Integrity on Reduction', () => {
    beforeEach(() => {
      useScenarioStore.setState({
        tabs: [
          {
            id: 'tab-1',
            name: 'メイン',
            nodes: [],
            edges: [],
            viewport: { x: 0, y: 0, zoom: 1 },
          },
        ],
        activeTabId: 'tab-1',
        characters: [],
        stages: [],
        resources: [],
        gameState: { ...useScenarioStore.getState().gameState, variables: {} },
      });
    });

    it('cleans up disconnected edges when branches are deleted', () => {
      const branchNode: ScenarioNode = {
        id: 'br_1',
        type: 'branch',
        position: { x: 0, y: 0 },
        data: {
          label: '多分岐',
          branches: [
            { id: 'c1', label: 'ルート1' },
            { id: 'c2', label: 'ルート2' },
            { id: 'c3', label: 'ルート3' },
          ],
        },
      };

      const edges: ScenarioEdge[] = [
        { id: 'e1', source: 'br_1', target: 'tgt1', sourceHandle: 'c1' },
        { id: 'e2', source: 'br_1', target: 'tgt2', sourceHandle: 'c2-left' },
        { id: 'e3', source: 'br_1', target: 'tgt3', sourceHandle: 'c3' },
      ];

      useScenarioStore.setState({
        tabs: [
          {
            id: 'tab-1',
            name: 'メイン',
            nodes: [branchNode],
            edges,
            viewport: { x: 0, y: 0, zoom: 1 },
          },
        ],
      });

      // Delete c2 (which had c2-left connected)
      useScenarioStore.getState().updateNodeData('br_1', {
        branches: [
          { id: 'c1', label: 'ルート1' },
          { id: 'c3', label: 'ルート3' },
        ],
      });

      const updatedEdges = useScenarioStore.getState().tabs[0].edges;
      expect(updatedEdges.some((e) => e.id === 'e2')).toBe(false);
      expect(updatedEdges.some((e) => e.id === 'e1')).toBe(true);
      expect(updatedEdges.some((e) => e.id === 'e3')).toBe(true);
    });

    it('cleans up EventNode and BranchNode references when a resource is deleted', () => {
      const resId = 'item_key';
      useScenarioStore.setState({
        resources: [{ id: resId, name: '合鍵', type: 'Item', description: '' }],
        tabs: [
          {
            id: 'tab-1',
            name: 'メイン',
            nodes: [
              {
                id: 'evt_1',
                type: 'event',
                position: { x: 0, y: 0 },
                data: { label: '入手イベント', acquiredItems: [resId, 'other_item'], requiredItems: [resId] },
              },
              {
                id: 'br_1',
                type: 'branch',
                position: { x: 0, y: 100 },
                data: {
                  label: 'アイテム判定',
                  conditionType: 'item_held',
                  conditionValue: resId,
                  branches: [
                    { id: 'c1', label: '所持', conditionType: 'item_held', conditionValue: resId },
                  ],
                },
              },
            ],
            edges: [],
            viewport: { x: 0, y: 0, zoom: 1 },
          },
        ],
      });

      useScenarioStore.getState().deleteResource(resId);

      const tab = useScenarioStore.getState().tabs[0];
      const evt = tab.nodes.find((n) => n.id === 'evt_1');
      expect(evt?.data.requiredItems).toEqual([]);
      expect(evt?.data.acquiredItems).toEqual(['other_item']);

      const br = tab.nodes.find((n) => n.id === 'br_1');
      expect(br?.data.conditionValue).toBe('');
      expect(br?.data.branches?.[0]?.conditionValue).toBe('');
    });

    it('cleans up EventNode variableOperations when a variable is deleted', () => {
      useScenarioStore.setState({
        gameState: { ...useScenarioStore.getState().gameState, variables: { testVar: { name: 'testVar', type: 'number', value: 10 } } },
        tabs: [
          {
            id: 'tab-1',
            name: 'メイン',
            nodes: [
              {
                id: 'evt_1',
                type: 'event',
                position: { x: 0, y: 0 },
                data: {
                  label: '変数イベント',
                  variableOperations: [
                    { variableName: 'testVar', operator: 'add', value: 5 },
                    { variableName: 'keepVar', operator: 'set', value: 1 },
                  ],
                },
              },
            ],
            edges: [],
            viewport: { x: 0, y: 0, zoom: 1 },
          },
        ],
      });

      useScenarioStore.getState().deleteVariable('testVar');

      const evt = useScenarioStore.getState().tabs[0].nodes.find((n) => n.id === 'evt_1');
      expect(evt?.data.variableOperations).toEqual([
        { variableName: 'keepVar', operator: 'set', value: 1 },
      ]);
    });
  });
});
