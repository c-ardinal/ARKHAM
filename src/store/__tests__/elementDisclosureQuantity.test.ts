import { describe, it, expect, beforeEach } from 'vitest';
import { useScenarioStore } from '../scenarioStore';
import type { ScenarioNode, ResourceData } from '../../types';

describe('Element Node Disclosure & Quantity Calculation', () => {
  beforeEach(() => {
    useScenarioStore.setState({
      tabs: [
        {
          id: 'tab_test',
          name: 'Test Tab',
          nodes: [],
          edges: [],
        },
      ],
      activeTabId: 'tab_test',
      resources: [
        { id: 'res_card_key', name: '警備室のカードキー', type: 'Item' },
        { id: 'res_memo', name: '血塗られた観察メモ', type: 'Knowledge' },
        { id: 'res_pulse', name: 'パルス干渉波形', type: 'Knowledge' },
        { id: 'res_bypass', name: 'バイパスコード', type: 'Knowledge' },
      ],
      gameState: {
        variables: {},
        inventory: {},
        equipment: {},
        knowledge: {},
        skills: {},
        stats: {},
        currentNodes: [],
        revealedNodes: [],
      },
    });
  });

  it('updates item quantity when an element node is toggled to revealed', () => {
    const store = useScenarioStore.getState();
    const elementNode: ScenarioNode = {
      id: 'elem_card',
      type: 'element',
      position: { x: 0, y: 0 },
      data: {
        label: '【警備室のカードキー】を入手',
        infoValue: '警備室のカードキー',
        infoType: 'item',
        actionType: 'obtain',
        quantity: 1,
        referenceId: 'res_card_key',
        revealed: false,
      },
    };

    useScenarioStore.setState((s) => ({
      tabs: s.tabs.map((t) => (t.id === 'tab_test' ? { ...t, nodes: [elementNode] } : t)),
    }));
    store.recalculateGameState();

    // Initially, key exists with 0
    expect(useScenarioStore.getState().gameState.inventory['警備室のカードキー']).toBe(0);

    // Toggle revealed
    store.toggleNodeState('elem_card');

    // Quantity should now be 1
    expect(useScenarioStore.getState().gameState.inventory['警備室のカードキー']).toBe(1);
    expect(useScenarioStore.getState().gameState.revealedNodes).toContain('elem_card');

    // Toggle unrevealed
    store.toggleNodeState('elem_card');
    expect(useScenarioStore.getState().gameState.inventory['警備室のカードキー']).toBe(0);
    expect(useScenarioStore.getState().gameState.revealedNodes).not.toContain('elem_card');
  });

  it('correctly handles legacy actionType "acquire" and uppercase infoType', () => {
    const store = useScenarioStore.getState();
    const legacyNode: ScenarioNode = {
      id: 'elem_legacy',
      type: 'element',
      position: { x: 0, y: 0 },
      data: {
        label: '【血塗られた観察メモ】を入手',
        infoValue: '血塗られた観察メモ',
        infoType: 'Knowledge' as any,
        actionType: 'acquire' as any,
        quantity: 1,
        referenceId: 'res_memo',
        revealed: false,
      },
    };

    useScenarioStore.setState((s) => ({
      tabs: s.tabs.map((t) => (t.id === 'tab_test' ? { ...t, nodes: [legacyNode] } : t)),
    }));
    store.recalculateGameState();

    expect(useScenarioStore.getState().gameState.knowledge['血塗られた観察メモ']).toBe(0);

    store.toggleNodeState('elem_legacy');
    expect(useScenarioStore.getState().gameState.knowledge['血塗られた観察メモ']).toBe(1);
  });

  it('updates all items when node has multi-item acquisition via acquiredItems', () => {
    const store = useScenarioStore.getState();
    const multiNode: ScenarioNode = {
      id: 'elem_multi',
      type: 'element',
      position: { x: 0, y: 0 },
      data: {
        label: '波形とコードを入手',
        acquiredItems: ['res_pulse', 'res_bypass'],
        revealed: false,
      },
    };

    useScenarioStore.setState((s) => ({
      tabs: s.tabs.map((t) => (t.id === 'tab_test' ? { ...t, nodes: [multiNode] } : t)),
    }));
    store.recalculateGameState();

    expect(useScenarioStore.getState().gameState.knowledge['パルス干渉波形']).toBe(0);
    expect(useScenarioStore.getState().gameState.knowledge['バイパスコード']).toBe(0);

    store.toggleNodeState('elem_multi');
    expect(useScenarioStore.getState().gameState.knowledge['パルス干渉波形']).toBe(1);
    expect(useScenarioStore.getState().gameState.knowledge['バイパスコード']).toBe(1);
  });

  it('updates all element quantities on revealAll and resets on unrevealAll', () => {
    const store = useScenarioStore.getState();
    const node1: ScenarioNode = {
      id: 'elem_1',
      type: 'element',
      position: { x: 0, y: 0 },
      data: {
        label: 'カード入手',
        infoValue: '警備室のカードキー',
        infoType: 'item',
        actionType: 'obtain',
        quantity: 1,
        referenceId: 'res_card_key',
        revealed: false,
      },
    };
    const node2: ScenarioNode = {
      id: 'elem_2',
      type: 'element',
      position: { x: 0, y: 0 },
      data: {
        label: 'メモ入手',
        infoValue: '血塗られた観察メモ',
        infoType: 'knowledge',
        actionType: 'obtain',
        quantity: 1,
        referenceId: 'res_memo',
        revealed: false,
      },
    };

    useScenarioStore.setState((s) => ({
      tabs: s.tabs.map((t) => (t.id === 'tab_test' ? { ...t, nodes: [node1, node2] } : t)),
    }));

    store.revealAll();
    expect(useScenarioStore.getState().gameState.inventory['警備室のカードキー']).toBe(1);
    expect(useScenarioStore.getState().gameState.knowledge['血塗られた観察メモ']).toBe(1);

    store.unrevealAll();
    expect(useScenarioStore.getState().gameState.inventory['警備室のカードキー']).toBe(0);
    expect(useScenarioStore.getState().gameState.knowledge['血塗られた観察メモ']).toBe(0);
  });
});
