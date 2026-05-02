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
