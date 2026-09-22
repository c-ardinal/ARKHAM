import { describe, it, expect } from 'vitest';
import { runSimulation } from '../simulator';
import { lintGraph } from '../linter';
import { buildCoreGraph } from '../adapter';
import type { CoreGraph } from '../schema';

describe('ARKHAM Variable Simulation & Analysis', () => {
  it('correctly updates variables and follows variable condition edges in simulation', () => {
    const graph: CoreGraph = {
      masterData: {
        items: [],
        locations: [{ id: 'loc_1', name: '洋館', chapter: 1 }],
        skills: [],
        variables: [
          { name: 'alarm_level', type: 'number', initialValue: 0 },
        ],
      },
      nodes: [
        {
          id: 'start',
          chapter: 1,
          title: '潜入開始',
          type: 'scene',
          locationId: 'loc_1',
          purpose: '導入',
          kpInstructions: [],
          investigationPoints: [],
          readAloudText: '',
          requiredItems: [],
          acquiredItems: [],
          consumedItems: [],
          variableOperations: [
            { variableName: 'alarm_level', operator: 'set', value: 0 },
            { variableName: 'alarm_level', operator: 'add', value: 2 },
          ],
          timeCostMinutes: 10,
        },
        {
          id: 'branch_node',
          chapter: 1,
          title: '警報判定',
          type: 'scene',
          locationId: 'loc_1',
          purpose: '分岐',
          kpInstructions: [],
          investigationPoints: [],
          readAloudText: '',
          requiredItems: [],
          acquiredItems: [],
          consumedItems: [],
          timeCostMinutes: 5,
        },
        {
          id: 'alarm_triggered',
          chapter: 1,
          title: '警報発令ルート',
          type: 'scene',
          locationId: 'loc_1',
          purpose: '戦闘',
          kpInstructions: [],
          investigationPoints: [],
          readAloudText: '',
          requiredItems: [],
          acquiredItems: [],
          consumedItems: [],
          timeCostMinutes: 30,
        },
        {
          id: 'stealth_success',
          chapter: 1,
          title: '隠密成功ルート',
          type: 'scene',
          locationId: 'loc_1',
          purpose: '潜入',
          kpInstructions: [],
          investigationPoints: [],
          readAloudText: '',
          requiredItems: [],
          acquiredItems: [],
          consumedItems: [],
          timeCostMinutes: 15,
        },
      ],
      edges: [
        { id: 'e1', fromNodeId: 'start', toNodeId: 'branch_node', conditionType: 'always' },
        {
          id: 'e2',
          fromNodeId: 'branch_node',
          toNodeId: 'alarm_triggered',
          conditionType: 'variable',
          variableCondition: 'alarm_level >= 2',
        },
        {
          id: 'e3',
          fromNodeId: 'branch_node',
          toNodeId: 'stealth_success',
          conditionType: 'variable',
          variableCondition: 'alarm_level < 2',
        },
      ],
      startNodeId: 'start',
    };

    const result = runSimulation(graph, { runs: 50 });

    expect(result.totalRuns).toBe(50);
    // Since start node adds 2 to alarm_level, alarm_level is 2.
    // Therefore alarm_level >= 2 is true 100% of the time, e2 (alarm_triggered) is traversed, e3 is not.
    expect(result.edgeTraversalCounts['e2']).toBe(50);
    expect(result.edgeTraversalCounts['e3'] || 0).toBe(0);
  });

  it('linter catches undefined variables in variable condition edges', () => {
    const graph: CoreGraph = {
      masterData: {
        items: [],
        locations: [{ id: 'loc_1', name: '洋館', chapter: 1 }],
        skills: [],
        variables: [{ name: 'registered_var', type: 'number', initialValue: 0 }],
      },
      nodes: [
        {
          id: 'n1',
          chapter: 1,
          title: 'ノード1',
          type: 'scene',
          locationId: 'loc_1',
          purpose: '',
          kpInstructions: [],
          investigationPoints: [],
          readAloudText: '',
          requiredItems: [],
          acquiredItems: [],
          consumedItems: [],
          timeCostMinutes: 10,
        },
        {
          id: 'n2',
          chapter: 1,
          title: 'ノード2',
          type: 'scene',
          locationId: 'loc_1',
          purpose: '',
          kpInstructions: [],
          investigationPoints: [],
          readAloudText: '',
          requiredItems: [],
          acquiredItems: [],
          consumedItems: [],
          timeCostMinutes: 10,
        },
      ],
      edges: [
        {
          id: 'e1',
          fromNodeId: 'n1',
          toNodeId: 'n2',
          conditionType: 'variable',
          variableCondition: 'unknown_var >= 5',
        },
      ],
      startNodeId: 'n1',
    };

    const issues = lintGraph(graph);
    const undefinedVarIssue = issues.find((i) => i.code === 'undefined_variable');
    expect(undefinedVarIssue).toBeDefined();
    expect(undefinedVarIssue?.message).toContain('unknown_var');
  });

  it('linter catches syntax errors in variable condition edges', () => {
    const graph: CoreGraph = {
      masterData: {
        items: [],
        locations: [{ id: 'loc_1', name: '洋館', chapter: 1 }],
        skills: [],
        variables: [{ name: 'my_var', type: 'number', initialValue: 0 }],
      },
      nodes: [
        {
          id: 'n1',
          chapter: 1,
          title: 'ノード1',
          type: 'scene',
          locationId: 'loc_1',
          purpose: '',
          kpInstructions: [],
          investigationPoints: [],
          readAloudText: '',
          requiredItems: [],
          acquiredItems: [],
          consumedItems: [],
          timeCostMinutes: 10,
        },
        {
          id: 'n2',
          chapter: 1,
          title: 'ノード2',
          type: 'scene',
          locationId: 'loc_1',
          purpose: '',
          kpInstructions: [],
          investigationPoints: [],
          readAloudText: '',
          requiredItems: [],
          acquiredItems: [],
          consumedItems: [],
          timeCostMinutes: 10,
        },
      ],
      edges: [
        {
          id: 'e1',
          fromNodeId: 'n1',
          toNodeId: 'n2',
          conditionType: 'variable',
          variableCondition: 'my_var >= && 10',
        },
      ],
      startNodeId: 'n1',
    };

    const issues = lintGraph(graph);
    const syntaxIssue = issues.find((i) => i.code === 'expression_syntax_error');
    expect(syntaxIssue).toBeDefined();
    expect(syntaxIssue?.message).toContain('構文エラー');
  });

  it('adapter converts scenario branch node with conditionType="variable" into condition edges', () => {
    const scenario = {
      title: 'テストシナリオ',
      description: '',
      tabs: [
        {
          id: 'tab1',
          name: 'メイン',
          nodes: [
            {
              id: 'branch1',
              type: 'branch',
              position: { x: 0, y: 0 },
              data: {
                title: '変数判定',
                conditionType: 'variable',
                conditionValue: 'sanity_score <= 30',
              },
            },
            {
              id: 'insane_node',
              type: 'event',
              position: { x: 100, y: 0 },
              data: { title: '発狂ルート' },
            },
            {
              id: 'normal_node',
              type: 'event',
              position: { x: 100, y: 100 },
              data: { title: '通常ルート' },
            },
          ],
          edges: [
            {
              id: 'e_true',
              source: 'branch1',
              target: 'insane_node',
              sourceHandle: 'true',
            },
            {
              id: 'e_false',
              source: 'branch1',
              target: 'normal_node',
              sourceHandle: 'false',
            },
          ],
        },
      ],
      variablesInput: [
        { id: 'v1', name: 'sanity_score', type: 'number', initialValue: 50 },
      ],
    };
    const tab = scenario.tabs[0];
    const variablesMap = {
      sanity_score: { name: 'sanity_score', type: 'number', value: 50 },
    };
    const coreGraph = buildCoreGraph(tab.nodes as any, tab.edges as any, [], [], undefined, variablesMap);
    expect(coreGraph.masterData.variables).toHaveLength(1);
    expect(coreGraph.masterData.variables![0].name).toBe('sanity_score');

    const trueEdge = coreGraph.edges.find((e) => e.toNodeId === 'insane_node');
    const falseEdge = coreGraph.edges.find((e) => e.toNodeId === 'normal_node');

    expect(trueEdge?.conditionType).toBe('variable');
    expect(trueEdge?.variableCondition).toBe('sanity_score <= 30');

    expect(falseEdge?.conditionType).toBe('variable');
    expect(falseEdge?.variableCondition).toBe('!(sanity_score <= 30)');
  });
});
