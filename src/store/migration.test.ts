// src/store/migration.test.ts
import { describe, it, expect } from 'vitest';
import { isLegacyFormat, isFutureFormat, migrateLegacyToTabbed, migrateJumpTargets } from './migration';
import type { ScenarioNode } from '../types';

const makeJumpNode = (id: string, target: any): ScenarioNode => ({
  id,
  type: 'jump',
  position: { x: 0, y: 0 },
  data: { label: id, jumpTarget: target },
} as ScenarioNode);

describe('isLegacyFormat', () => {
  it('tabs フィールドが無いデータを legacy と判定', () => {
    expect(isLegacyFormat({ nodes: [], edges: [] })).toBe(true);
  });

  it('tabs フィールドを持つデータは legacy ではない', () => {
    expect(isLegacyFormat({ tabs: [], activeTabId: '' })).toBe(false);
  });

  it('null/undefined は legacy 扱い', () => {
    expect(isLegacyFormat(null)).toBe(true);
    expect(isLegacyFormat(undefined)).toBe(true);
  });
});

describe('isFutureFormat', () => {
  it('version > 2 を future と判定', () => {
    expect(isFutureFormat({ version: 3, tabs: [] })).toBe(true);
  });

  it('version === 2 は future ではない', () => {
    expect(isFutureFormat({ version: 2, tabs: [] })).toBe(false);
  });

  it('version 未指定は future ではない', () => {
    expect(isFutureFormat({ tabs: [] })).toBe(false);
  });
});

describe('migrateLegacyToTabbed', () => {
  it('レガシーデータを単一タブにラップ', () => {
    const legacy = {
      nodes: [{ id: 'n1', type: 'event', position: {x:0,y:0}, data: { label: 'A' } }],
      edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
      gameState: { variables: {}, inventory: {}, equipment: {}, knowledge: {}, skills: {}, stats: {}, currentNodes: [], revealedNodes: [] },
      characters: [],
      resources: [],
    };
    const result = migrateLegacyToTabbed(legacy as any, 'タブ 1');
    expect(result.version).toBe(2);
    expect(result.tabs).toHaveLength(1);
    expect(result.tabs[0].name).toBe('タブ 1');
    expect(result.tabs[0].nodes).toHaveLength(1);
    expect(result.tabs[0].edges).toHaveLength(1);
    expect(result.activeTabId).toBe(result.tabs[0].id);
  });

  it('nodes/edges 欠損は空配列で補う', () => {
    const result = migrateLegacyToTabbed({} as any, 'Tab 1');
    expect(result.tabs[0].nodes).toEqual([]);
    expect(result.tabs[0].edges).toEqual([]);
    expect(result.characters).toEqual([]);
    expect(result.resources).toEqual([]);
  });
});

describe('migrateJumpTargets', () => {
  it('文字列 jumpTarget を {tabId, nodeId} に変換', () => {
    const nodes = [makeJumpNode('j1', 'target_node')];
    const result = migrateJumpTargets(nodes, 'tab_x');
    expect(result[0].data.jumpTarget).toEqual({ tabId: 'tab_x', nodeId: 'target_node' });
  });

  it('null/undefined はそのまま保持', () => {
    const nodes = [makeJumpNode('j1', null), makeJumpNode('j2', undefined)];
    const result = migrateJumpTargets(nodes, 'tab_x');
    expect(result[0].data.jumpTarget).toBeNull();
    expect(result[1].data.jumpTarget).toBeUndefined();
  });

  it('jump 以外のノードは変更しない', () => {
    const eventNode = { id: 'e1', type: 'event', position: {x:0,y:0}, data: { label: 'E' } } as ScenarioNode;
    const result = migrateJumpTargets([eventNode], 'tab_x');
    expect(result[0]).toBe(eventNode);
  });

  it('既に {tabId, nodeId} 形式のものはそのまま', () => {
    const nodes = [makeJumpNode('j1', { tabId: 'tab_a', nodeId: 'n_b' })];
    const result = migrateJumpTargets(nodes, 'tab_x');
    expect(result[0].data.jumpTarget).toEqual({ tabId: 'tab_a', nodeId: 'n_b' });
  });
});
