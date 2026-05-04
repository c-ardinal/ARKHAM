// src/store/tabActions.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useScenarioStore } from './scenarioStore';

function reset() {
  useScenarioStore.getState().resetToInitialState();
}

describe('addTab', () => {
  beforeEach(reset);

  it('新規タブを追加し、ID を返す', () => {
    const before = useScenarioStore.getState().tabs.length;
    const newId = useScenarioStore.getState().addTab('テストタブ');
    const after = useScenarioStore.getState().tabs.length;
    expect(after).toBe(before + 1);
    const found = useScenarioStore.getState().tabs.find((t) => t.id === newId);
    expect(found?.name).toBe('テストタブ');
    expect(found?.nodes).toEqual([]);
    expect(found?.edges).toEqual([]);
  });

  it('name 省略時は既定名を付与', () => {
    const id = useScenarioStore.getState().addTab();
    const tab = useScenarioStore.getState().tabs.find((t) => t.id === id);
    expect(tab?.name).toMatch(/(タブ|Tab)/);
  });
});

describe('renameTab', () => {
  beforeEach(reset);

  it('タブ名を変更', () => {
    const id = useScenarioStore.getState().addTab('A');
    useScenarioStore.getState().renameTab(id, 'B');
    expect(useScenarioStore.getState().tabs.find((t) => t.id === id)?.name).toBe('B');
  });

  it('前後空白は trim', () => {
    const id = useScenarioStore.getState().addTab('A');
    useScenarioStore.getState().renameTab(id, '  C  ');
    expect(useScenarioStore.getState().tabs.find((t) => t.id === id)?.name).toBe('C');
  });

  it('空文字/空白のみは無視(元の名前を維持)', () => {
    const id = useScenarioStore.getState().addTab('A');
    useScenarioStore.getState().renameTab(id, '   ');
    expect(useScenarioStore.getState().tabs.find((t) => t.id === id)?.name).toBe('A');
    useScenarioStore.getState().renameTab(id, '');
    expect(useScenarioStore.getState().tabs.find((t) => t.id === id)?.name).toBe('A');
  });

  it('50 文字超は切り捨て', () => {
    const id = useScenarioStore.getState().addTab('A');
    const long = 'x'.repeat(100);
    useScenarioStore.getState().renameTab(id, long);
    expect(useScenarioStore.getState().tabs.find((t) => t.id === id)?.name.length).toBe(50);
  });
});

describe('deleteTab', () => {
  beforeEach(reset);

  it('最後の1タブは削除されない', () => {
    const beforeLen = useScenarioStore.getState().tabs.length;
    const id = useScenarioStore.getState().tabs[0].id;
    useScenarioStore.getState().deleteTab(id);
    expect(useScenarioStore.getState().tabs.length).toBe(beforeLen);
  });

  it('複数タブのうち1つを削除できる', () => {
    const id2 = useScenarioStore.getState().addTab('B');
    const before = useScenarioStore.getState().tabs.length;
    useScenarioStore.getState().deleteTab(id2);
    expect(useScenarioStore.getState().tabs.length).toBe(before - 1);
    expect(useScenarioStore.getState().tabs.find((t) => t.id === id2)).toBeUndefined();
  });

  it('アクティブタブを削除すると右隣に切替', () => {
    const id1 = useScenarioStore.getState().tabs[0].id;
    const id2 = useScenarioStore.getState().addTab('B');
    useScenarioStore.getState().setActiveTab(id1);
    useScenarioStore.getState().deleteTab(id1);
    expect(useScenarioStore.getState().activeTabId).toBe(id2);
  });

  it('右端のアクティブタブを削除すると左隣に切替', () => {
    const id1 = useScenarioStore.getState().tabs[0].id;
    const id2 = useScenarioStore.getState().addTab('B');
    useScenarioStore.getState().setActiveTab(id2);
    useScenarioStore.getState().deleteTab(id2);
    expect(useScenarioStore.getState().activeTabId).toBe(id1);
  });
});

describe('reorderTabs', () => {
  beforeEach(reset);

  it('インデックス指定でタブ順を入れ替え', () => {
    const id1 = useScenarioStore.getState().tabs[0].id;
    const id2 = useScenarioStore.getState().addTab('B');
    const id3 = useScenarioStore.getState().addTab('C');
    useScenarioStore.getState().reorderTabs(0, 2);
    const tabs = useScenarioStore.getState().tabs;
    expect(tabs.map((t) => t.id)).toEqual([id2, id3, id1]);
  });
});

describe('setActiveTab', () => {
  beforeEach(reset);

  it('アクティブタブを切替、selectedNodeId を null に', () => {
    const id2 = useScenarioStore.getState().addTab('B');
    useScenarioStore.getState().setSelectedNode('some_node');
    useScenarioStore.getState().setActiveTab(id2);
    expect(useScenarioStore.getState().activeTabId).toBe(id2);
    expect(useScenarioStore.getState().selectedNodeId).toBeNull();
  });

  it('存在しない id を渡しても変更しない', () => {
    const before = useScenarioStore.getState().activeTabId;
    useScenarioStore.getState().setActiveTab('nonexistent');
    expect(useScenarioStore.getState().activeTabId).toBe(before);
  });
});

describe('executeJump', () => {
  beforeEach(reset);

  it('同タブ内: activeTabId を変更せず selectedNodeId のみ更新', () => {
    const t1 = useScenarioStore.getState().activeTabId;
    useScenarioStore.getState().executeJump({ tabId: t1, nodeId: 'n_x' });
    expect(useScenarioStore.getState().activeTabId).toBe(t1);
    expect(useScenarioStore.getState().selectedNodeId).toBe('n_x');
  });

  it('別タブ: activeTabId を切替+selectedNodeId 更新', () => {
    const t2 = useScenarioStore.getState().addTab('B');
    useScenarioStore.getState().executeJump({ tabId: t2, nodeId: 'n_y' });
    expect(useScenarioStore.getState().activeTabId).toBe(t2);
    expect(useScenarioStore.getState().selectedNodeId).toBe('n_y');
  });

  it('null target は no-op', () => {
    const before = useScenarioStore.getState().selectedNodeId;
    useScenarioStore.getState().executeJump(null);
    expect(useScenarioStore.getState().selectedNodeId).toBe(before);
  });
});

describe('moveNodesToTab', () => {
  beforeEach(reset);

  it('指定ノードを別タブへ移動 + ターゲットタブへ自動切替', () => {
    const t1 = useScenarioStore.getState().activeTabId;
    const t2 = useScenarioStore.getState().addTab('B');
    const node = { id: 'n_test', type: 'event', position: { x: 0, y: 0 }, data: { label: 'X' } } as any;
    useScenarioStore.getState().setActiveTab(t1);
    useScenarioStore.getState().addNode(node);
    useScenarioStore.getState().moveNodesToTab(['n_test'], t2);

    const state = useScenarioStore.getState();
    expect(state.tabs.find((t) => t.id === t1)!.nodes.some((n) => n.id === 'n_test')).toBe(false);
    expect(state.tabs.find((t) => t.id === t2)!.nodes.some((n) => n.id === 'n_test')).toBe(true);
    expect(state.activeTabId).toBe(t2);
  });

  it('GroupNode 移動時に子ノードも同伴', () => {
    const t1 = useScenarioStore.getState().activeTabId;
    const t2 = useScenarioStore.getState().addTab('B');
    const group = { id: 'g1', type: 'group', position: {x:0,y:0}, data: { label: 'G' } } as any;
    const child = { id: 'c1', type: 'event', position: {x:0,y:0}, data: { label: 'C' }, parentNode: 'g1' } as any;
    useScenarioStore.getState().setActiveTab(t1);
    useScenarioStore.getState().addNode(group);
    useScenarioStore.getState().addNode(child);
    useScenarioStore.getState().moveNodesToTab(['g1'], t2);

    const tab2 = useScenarioStore.getState().tabs.find((t) => t.id === t2)!;
    expect(tab2.nodes.some((n) => n.id === 'g1')).toBe(true);
    expect(tab2.nodes.some((n) => n.id === 'c1')).toBe(true);
  });

  it('ジャンプ参照が追従(移動先 tabId に書き換わる)', () => {
    const t1 = useScenarioStore.getState().activeTabId;
    const t2 = useScenarioStore.getState().addTab('B');
    const target = { id: 'tgt', type: 'event', position: {x:0,y:0}, data: { label: 'T' } } as any;
    const jump = { id: 'jmp', type: 'jump', position: {x:0,y:0}, data: { label: 'J', jumpTarget: { tabId: t1, nodeId: 'tgt' } } } as any;
    useScenarioStore.getState().setActiveTab(t1);
    useScenarioStore.getState().addNode(target);
    useScenarioStore.getState().addNode(jump);
    useScenarioStore.getState().moveNodesToTab(['tgt'], t2);
    const movedJump = useScenarioStore.getState().tabs.flatMap((t) => t.nodes).find((n) => n.id === 'jmp') as any;
    expect(movedJump.data.jumpTarget).toEqual({ tabId: t2, nodeId: 'tgt' });
  });

  it('分断エッジ削除戦略 (default): broken edges は消える', () => {
    const t1 = useScenarioStore.getState().activeTabId;
    const t2 = useScenarioStore.getState().addTab('B');
    const a = { id: 'a', type: 'event', position: {x:0,y:0}, data: { label: 'A' } } as any;
    const b = { id: 'b', type: 'event', position: {x:0,y:0}, data: { label: 'B' } } as any;
    useScenarioStore.getState().setActiveTab(t1);
    useScenarioStore.getState().addNode(a);
    useScenarioStore.getState().addNode(b);
    // Add edge a→b
    useScenarioStore.getState().onConnect({ source: 'a', target: 'b', sourceHandle: null, targetHandle: null } as any);
    expect(useScenarioStore.getState().tabs.find(t => t.id === t1)!.edges.length).toBe(1);

    useScenarioStore.getState().moveNodesToTab(['b'], t2);
    // edge should be deleted
    const state = useScenarioStore.getState();
    expect(state.tabs.find(t => t.id === t1)!.edges.length).toBe(0);
    expect(state.tabs.find(t => t.id === t2)!.edges.length).toBe(0);
  });

  it('分断エッジ ジャンプ置換戦略: 元タブに jump ノード+エッジが生成される', () => {
    const t1 = useScenarioStore.getState().activeTabId;
    const t2 = useScenarioStore.getState().addTab('B');
    const a = { id: 'a', type: 'event', position: {x:0,y:0}, data: { label: 'A' } } as any;
    const b = { id: 'b', type: 'event', position: {x:0,y:0}, data: { label: 'B' } } as any;
    useScenarioStore.getState().setActiveTab(t1);
    useScenarioStore.getState().addNode(a);
    useScenarioStore.getState().addNode(b);
    useScenarioStore.getState().onConnect({ source: 'a', target: 'b', sourceHandle: null, targetHandle: null } as any);
    useScenarioStore.getState().moveNodesToTab(['b'], t2, 'replace-jump');
    const tab1 = useScenarioStore.getState().tabs.find(t => t.id === t1)!;
    // Source タブに jump ノードが追加されている
    const jumpInSource = tab1.nodes.find(n => n.type === 'jump');
    expect(jumpInSource).toBeDefined();
    expect((jumpInSource as any).data.jumpTarget).toEqual({ tabId: t2, nodeId: 'b' });
    // Source タブに a → jump のエッジが残る
    expect(tab1.edges.some(e => e.source === 'a' && e.target === jumpInSource!.id)).toBe(true);
  });
});
