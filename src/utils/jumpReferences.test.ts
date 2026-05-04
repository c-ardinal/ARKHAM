import { describe, it, expect } from 'vitest';
import {
  retargetJumpReferencesForMove,
  detectBrokenEdges,
  countJumpReferencesToTab,
} from './jumpReferences';
import type { Tab } from '../types/tab';

const makeTab = (id: string, nodes: any[], edges: any[] = []): Tab => ({
  id,
  name: id,
  nodes,
  edges,
});

const jumpNode = (id: string, target: any) => ({
  id,
  type: 'jump',
  position: { x: 0, y: 0 },
  data: { label: id, jumpTarget: target },
});

describe('retargetJumpReferencesForMove', () => {
  it('移動対象 nodeId を指すジャンプの tabId を更新', () => {
    const tabs: Tab[] = [
      makeTab('tab_a', [
        jumpNode('j1', { tabId: 'tab_b', nodeId: 'n1' }),
      ]),
      makeTab('tab_b', [
        { id: 'n1', type: 'event', position: {x:0,y:0}, data: { label: 'n1' } },
      ]),
    ];
    const result = retargetJumpReferencesForMove(tabs, ['n1'], 'tab_c');
    const j1 = result.find((t) => t.id === 'tab_a')!.nodes.find((n: any) => n.id === 'j1');
    expect((j1 as any).data.jumpTarget).toEqual({ tabId: 'tab_c', nodeId: 'n1' });
  });

  it('移動対象に含まれないノードへのジャンプは変更しない', () => {
    const tabs: Tab[] = [
      makeTab('tab_a', [jumpNode('j1', { tabId: 'tab_b', nodeId: 'other' })]),
      makeTab('tab_b', []),
    ];
    const result = retargetJumpReferencesForMove(tabs, ['n1'], 'tab_c');
    const j1 = result[0].nodes.find((n: any) => n.id === 'j1');
    expect((j1 as any).data.jumpTarget).toEqual({ tabId: 'tab_b', nodeId: 'other' });
  });

  it('null jumpTarget はそのまま', () => {
    const tabs: Tab[] = [makeTab('tab_a', [jumpNode('j1', null)])];
    const result = retargetJumpReferencesForMove(tabs, ['n1'], 'tab_c');
    expect((result[0].nodes[0] as any).data.jumpTarget).toBeNull();
  });
});

describe('detectBrokenEdges', () => {
  it('移動対象と非移動対象の間のエッジを検出', () => {
    const edges = [
      { id: 'e1', source: 'a', target: 'b' },
      { id: 'e2', source: 'b', target: 'c' },
      { id: 'e3', source: 'd', target: 'e' },
    ];
    const broken = detectBrokenEdges(edges, new Set(['b']));
    expect(broken.map((e) => e.id).sort()).toEqual(['e1', 'e2']);
  });

  it('移動対象同士のエッジは分断されない', () => {
    const edges = [{ id: 'e1', source: 'a', target: 'b' }];
    const broken = detectBrokenEdges(edges, new Set(['a', 'b']));
    expect(broken).toEqual([]);
  });
});

describe('countJumpReferencesToTab', () => {
  it('対象タブを指すジャンプノード数を返す', () => {
    const tabs: Tab[] = [
      makeTab('tab_a', [jumpNode('j1', { tabId: 'tab_x', nodeId: 'n1' })]),
      makeTab('tab_b', [
        jumpNode('j2', { tabId: 'tab_x', nodeId: 'n2' }),
        jumpNode('j3', { tabId: 'tab_y', nodeId: 'n3' }),
      ]),
    ];
    expect(countJumpReferencesToTab(tabs, 'tab_x')).toBe(2);
    expect(countJumpReferencesToTab(tabs, 'tab_y')).toBe(1);
    expect(countJumpReferencesToTab(tabs, 'tab_z')).toBe(0);
  });
});
