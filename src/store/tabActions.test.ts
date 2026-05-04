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

  // BL-2: ネストグループ（孫ノード）の再帰収集
  it('BL-2: ネストグループ移動時に孫ノードも同伴する', () => {
    const t1 = useScenarioStore.getState().activeTabId;
    const t2 = useScenarioStore.getState().addTab('B');
    const outerGroup = { id: 'outer', type: 'group', position: {x:0,y:0}, data: { label: 'Outer' } } as any;
    const innerGroup = { id: 'inner', type: 'group', position: {x:0,y:0}, data: { label: 'Inner' }, parentNode: 'outer' } as any;
    const grandchild = { id: 'grand', type: 'event', position: {x:0,y:0}, data: { label: 'G' }, parentNode: 'inner' } as any;
    useScenarioStore.getState().setActiveTab(t1);
    useScenarioStore.getState().addNode(outerGroup);
    useScenarioStore.getState().addNode(innerGroup);
    useScenarioStore.getState().addNode(grandchild);
    useScenarioStore.getState().moveNodesToTab(['outer'], t2);

    const tab2 = useScenarioStore.getState().tabs.find((t) => t.id === t2)!;
    expect(tab2.nodes.some((n) => n.id === 'outer')).toBe(true);
    expect(tab2.nodes.some((n) => n.id === 'inner')).toBe(true);
    // 孫ノードも同伴される (BL-2 fix)
    expect(tab2.nodes.some((n) => n.id === 'grand')).toBe(true);
    // ソースタブには残らない
    const tab1 = useScenarioStore.getState().tabs.find((t) => t.id === t1)!;
    expect(tab1.nodes.some((n) => n.id === 'grand')).toBe(false);
  });
});

describe('updateVariableMetadata (BL-1a): 全タブ走査', () => {
  beforeEach(reset);

  it('BL-1a: 変数名変更が非アクティブタブの VariableNode にも反映される', () => {
    const t1 = useScenarioStore.getState().activeTabId;
    const t2 = useScenarioStore.getState().addTab('B');

    // t1 に variable ノードを追加
    const varNodeT1 = {
      id: 'vn1', type: 'variable', position: {x:0,y:0},
      data: { label: 'x', targetVariable: 'x' }
    } as any;
    useScenarioStore.getState().setActiveTab(t1);
    useScenarioStore.getState().addNode(varNodeT1);

    // t2 に variable ノードを追加
    const varNodeT2 = {
      id: 'vn2', type: 'variable', position: {x:0,y:0},
      data: { label: 'x', targetVariable: 'x' }
    } as any;
    useScenarioStore.getState().setActiveTab(t2);
    useScenarioStore.getState().addNode(varNodeT2);

    // t1 をアクティブにして変数を追加後、変数名を変更
    useScenarioStore.getState().setActiveTab(t1);
    useScenarioStore.getState().addVariable('x', 'string', '');
    useScenarioStore.getState().updateVariableMetadata('x', 'x_renamed', 'string');

    const state = useScenarioStore.getState();
    // t1 の VariableNode も更新されている
    const vn1 = state.tabs.find(t => t.id === t1)!.nodes.find(n => n.id === 'vn1') as any;
    expect(vn1.data.targetVariable).toBe('x_renamed');
    // t2 (非アクティブタブ) の VariableNode も更新されている (BL-1a)
    const vn2 = state.tabs.find(t => t.id === t2)!.nodes.find(n => n.id === 'vn2') as any;
    expect(vn2.data.targetVariable).toBe('x_renamed');
  });
});

describe('addVariable (BL-1b): 全タブ Auto-assign', () => {
  beforeEach(reset);

  it('BL-1b: 変数追加時に非アクティブタブの未割当 VariableNode にも Auto-assign される', () => {
    const t1 = useScenarioStore.getState().activeTabId;
    const t2 = useScenarioStore.getState().addTab('B');

    // t1 に未割当 variable ノードを追加
    const varNodeT1 = {
      id: 'vn_t1', type: 'variable', position: {x:0,y:0},
      data: { label: 'unassigned', targetVariable: '' }
    } as any;
    useScenarioStore.getState().setActiveTab(t1);
    useScenarioStore.getState().addNode(varNodeT1);

    // t2 に未割当 variable ノードを追加
    const varNodeT2 = {
      id: 'vn_t2', type: 'variable', position: {x:0,y:0},
      data: { label: 'unassigned', targetVariable: '' }
    } as any;
    useScenarioStore.getState().setActiveTab(t2);
    useScenarioStore.getState().addNode(varNodeT2);

    // t1 をアクティブにして変数を追加 (Auto-assign が走る)
    useScenarioStore.getState().setActiveTab(t1);
    useScenarioStore.getState().addVariable('newVar', 'string', '');

    const state = useScenarioStore.getState();
    // t1 の未割当 VariableNode は割り当てられる
    const n1 = state.tabs.find(t => t.id === t1)!.nodes.find(n => n.id === 'vn_t1') as any;
    expect(n1.data.targetVariable).toBe('newVar');
    // t2 (非アクティブ) の未割当 VariableNode も割り当てられる (BL-1b)
    const n2 = state.tabs.find(t => t.id === t2)!.nodes.find(n => n.id === 'vn_t2') as any;
    expect(n2.data.targetVariable).toBe('newVar');
  });
});

describe('updateNodeData (BL-4): cross-tab 更新', () => {
  beforeEach(reset);

  it('BL-4: 非アクティブタブのノードデータを更新できる', () => {
    const t1 = useScenarioStore.getState().activeTabId;
    const t2 = useScenarioStore.getState().addTab('B');

    // t2 にノードを追加
    const nodeT2 = { id: 'nd_t2', type: 'event', position: {x:0,y:0}, data: { label: 'Old' } } as any;
    useScenarioStore.getState().setActiveTab(t2);
    useScenarioStore.getState().addNode(nodeT2);

    // t1 に切り替えて t2 のノードを updateNodeData
    useScenarioStore.getState().setActiveTab(t1);
    useScenarioStore.getState().updateNodeData('nd_t2', { label: 'New' });

    const nd = useScenarioStore.getState().tabs.find(t => t.id === t2)!.nodes.find(n => n.id === 'nd_t2') as any;
    expect(nd.data.label).toBe('New');
  });
});
