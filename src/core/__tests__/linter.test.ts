import { describe, it, expect } from 'vitest';
import { lintGraph, levenshteinDistance, checkBracketSyntax } from '../linter';
import type { CoreGraph } from '../schema';

describe('ARKHAM Linter Module', () => {
  it('calculates levenshtein distance correctly', () => {
    expect(levenshteinDistance('キーカード', 'カードキー')).toBe(4);
    expect(levenshteinDistance('警備室のカードキー', '警備室カードキー')).toBe(1);
    expect(levenshteinDistance('abc', 'abc')).toBe(0);
  });

  it('detects unclosed brackets syntax errors', () => {
    const issues = checkBracketSyntax('ここに【未完のアイテム があります');
    expect(issues.some((i) => i.code === 'bracket_syntax_error')).toBe(true);

    const validIssues = checkBracketSyntax('ここに【完結したアイテム】があります');
    expect(validIssues.length).toBe(0);
  });

  it('detects forbidden meta-gaming terms in readAloudText', () => {
    const graph: CoreGraph = {
      masterData: { items: [], locations: [], skills: [] },
      nodes: [
        {
          id: 'node_1',
          chapter: 1,
          title: 'ボス戦',
          type: 'combat',
          locationId: 'loc_1',
          purpose: '戦闘',
          kpInstructions: [],
          investigationPoints: [],
          readAloudText: '巨大なボスが現れた！戦闘フェーズに移行する。',
          requiredItems: [],
          acquiredItems: [],
          consumedItems: [],
          timeCostMinutes: 15,
        },
      ],
      edges: [],
    };

    const issues = lintGraph(graph);
    expect(issues.some((i) => i.code === 'forbidden_read_aloud_term' && i.message.includes('ボス'))).toBe(true);
    expect(issues.some((i) => i.code === 'forbidden_read_aloud_term' && i.message.includes('戦闘フェーズ'))).toBe(true);
  });

  it('suggests fuzzy matching for slightly misspelled item names', () => {
    const graph: CoreGraph = {
      masterData: {
        items: [
          {
            id: 'item_sec_key',
            name: '警備室のカードキー',
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
          id: 'node_1',
          chapter: 1,
          title: '探索シーン',
          type: 'scene',
          locationId: 'loc_1',
          purpose: '探索',
          kpInstructions: [],
          investigationPoints: [
            {
              name: '机',
              description: '【警備室カードキー】が落ちている。',
            },
          ],
          readAloudText: '',
          requiredItems: [],
          acquiredItems: [],
          consumedItems: [],
          timeCostMinutes: 10,
        },
      ],
      edges: [],
    };

    const issues = lintGraph(graph);
    const fuzzy = issues.find((i) => i.code === 'fuzzy_item_match');
    expect(fuzzy).toBeDefined();
    expect(fuzzy?.suggestion).toBe('警備室のカードキー');
  });

  it('detects dead (unused) items and isolated nodes', () => {
    const graph: CoreGraph = {
      masterData: {
        items: [
          {
            id: 'item_dead',
            name: '使われない鍵',
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
          locationId: 'loc_1',
          purpose: '開始',
          kpInstructions: [],
          investigationPoints: [],
          readAloudText: '',
          requiredItems: [],
          acquiredItems: ['item_dead'],
          consumedItems: [],
          timeCostMinutes: 10,
        },
        {
          id: 'isolated',
          chapter: 1,
          title: '孤立した小部屋',
          type: 'room',
          locationId: 'loc_2',
          purpose: '到達不能',
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

    const issues = lintGraph(graph);
    expect(issues.some((i) => i.code === 'dead_item')).toBe(true);
    expect(issues.some((i) => i.code === 'isolated_node' && i.nodeId === 'isolated')).toBe(true);
  });
});
