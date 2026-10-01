import { describe, it, expect } from 'vitest';
import { MARKDOWN_TRIGGER_REGEX } from '../../components/common/NodeMarkdown';

describe('Rendering & LOD Performance Optimizations', () => {
  describe('NodeMarkdown fast-path trigger detection', () => {
    it('correctly classifies plain scenario text without triggering markdown AST', () => {
      const plainTexts = [
        '探索者は洋館の玄関に到着する。',
        '鍵を開けて中に入る',
        'SANチェック 1/1D3',
        '聞き耳または目星のロールを行う。',
        '通常テキスト（改行あり）\n2行目の文章',
        'A simple text with numbers: 123, and symbols: (!?,.)',
      ];

      for (const text of plainTexts) {
        expect(MARKDOWN_TRIGGER_REGEX.test(text)).toBe(false);
      }
    });

    it('correctly detects markdown syntax and triggers rich renderer', () => {
      const markdownTexts = [
        '**太字テキスト**',
        '*イタリック*',
        '# 見出し1',
        '- リスト項目',
        '+ リスト項目',
        '1. 番号付きリスト',
        '`インラインコード`',
        '[リンクテキスト](http://example.com)',
        '| 表 | ヘッダ |',
        '~取り消し線~',
      ];

      for (const text of markdownTexts) {
        expect(MARKDOWN_TRIGGER_REGEX.test(text)).toBe(true);
      }
    });
  });

  describe('JumpNode target resolution logic', () => {
    const tabs = [
      {
        id: 'tab_ch1',
        name: '第1章',
        nodes: [
          { id: 'node_1', data: { label: 'オープニング' } },
          { id: 'node_2', data: { label: '書斎の調査' } },
        ],
        edges: [],
      },
      {
        id: 'tab_ch2',
        name: '第2章',
        nodes: [
          { id: 'node_3', data: { label: '地下室' } },
        ],
        edges: [],
      },
    ];

    const resolveTargetLabel = (jumpTarget: any) => {
      const targetNodeId = typeof jumpTarget === 'string'
        ? jumpTarget
        : jumpTarget?.nodeId;
      const targetTabId = typeof jumpTarget === 'object' ? jumpTarget?.tabId : null;

      if (!targetNodeId) return null;
      if (targetTabId) {
        const tab = tabs.find((t) => t.id === targetTabId);
        const n = tab?.nodes.find((x) => x.id === targetNodeId);
        return n ? (n.data.label || 'Unknown Node') : false;
      }
      for (const t of tabs) {
        const n = t.nodes.find((x) => x.id === targetNodeId);
        if (n) return n.data.label || 'Unknown Node';
      }
      return false;
    };

    it('returns target label for same-tab string target', () => {
      expect(resolveTargetLabel('node_1')).toBe('オープニング');
    });

    it('returns target label for cross-tab object target', () => {
      expect(resolveTargetLabel({ tabId: 'tab_ch2', nodeId: 'node_3' })).toBe('地下室');
    });

    it('returns false for missing/broken targets', () => {
      expect(resolveTargetLabel('non_existent_node')).toBe(false);
      expect(resolveTargetLabel({ tabId: 'tab_ch1', nodeId: 'deleted_node' })).toBe(false);
    });

    it('returns null for unconfigured targets', () => {
      expect(resolveTargetLabel(null)).toBe(null);
      expect(resolveTargetLabel(undefined)).toBe(null);
    });
  });

  describe('BranchNode connected handles extraction', () => {
    const edges = [
      { id: 'e1', source: 'branch_1', sourceHandle: 'true', target: 'node_2' },
      { id: 'e2', source: 'branch_1', sourceHandle: 'false', target: 'node_3' },
      { id: 'e3', source: 'event_99', sourceHandle: null, target: 'node_4' },
      { id: 'e4', source: 'branch_2', sourceHandle: 'route_a-right', target: 'node_5' },
    ];

    const getConnectedHandles = (nodeId: string) => {
      const handles: string[] = [];
      for (const e of edges) {
        if (e.source === nodeId) {
          handles.push(e.sourceHandle || '');
        }
      }
      return handles;
    };

    it('extracts only handles for the target branch node', () => {
      expect(getConnectedHandles('branch_1')).toEqual(['true', 'false']);
      expect(getConnectedHandles('branch_2')).toEqual(['route_a-right']);
      expect(getConnectedHandles('branch_3')).toEqual([]);
    });
  });
});
