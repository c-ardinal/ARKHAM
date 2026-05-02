// src/store/tabSelectors.test.ts
import { describe, it, expect } from 'vitest';
import { findNodeAcrossTabs } from './tabSelectors';
import type { Tab } from '../types/tab';

const makeTab = (id: string, nodes: any[]): Tab => ({
  id,
  name: id,
  nodes,
  edges: [],
});

describe('findNodeAcrossTabs', () => {
  it('指定 nodeId がいずれかのタブに存在すればそのタブと共に返す', () => {
    const tabs: Tab[] = [
      makeTab('tab_a', [{ id: 'n1', type: 'event', position: {x:0,y:0}, data: { label: 'n1' } } as any]),
      makeTab('tab_b', [{ id: 'n2', type: 'event', position: {x:0,y:0}, data: { label: 'n2' } } as any]),
    ];
    const r = findNodeAcrossTabs(tabs, 'n2');
    expect(r?.tabId).toBe('tab_b');
    expect(r?.node.id).toBe('n2');
  });

  it('存在しない nodeId は null', () => {
    const tabs: Tab[] = [makeTab('tab_a', [])];
    expect(findNodeAcrossTabs(tabs, 'missing')).toBeNull();
  });
});
