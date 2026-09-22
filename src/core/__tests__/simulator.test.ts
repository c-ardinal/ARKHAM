import { describe, it, expect } from 'vitest';
import { runSimulation, rollDice } from '../simulator';
import type { CoreGraph } from '../schema';

describe('ARKHAM Simulator Module', () => {
  it('rolls dice formula correctly', () => {
    expect(rollDice('0')).toBe(0);
    expect(rollDice('5')).toBe(5);

    for (let i = 0; i < 20; i++) {
      const d6 = rollDice('1D6');
      expect(d6).toBeGreaterThanOrEqual(1);
      expect(d6).toBeLessThanOrEqual(6);

      const d10plus2 = rollDice('1D10+2');
      expect(d10plus2).toBeGreaterThanOrEqual(3);
      expect(d10plus2).toBeLessThanOrEqual(12);
    }
  });

  it('runs Monte Carlo simulation and outputs valid metrics', () => {
    const graph: CoreGraph = {
      masterData: {
        items: [
          {
            id: 'item_cure',
            name: '精神安定剤',
            category: 'consumable',
            description: '',
            isConsumable: true,
          },
        ],
        locations: [
          { id: 'loc_entrance', name: 'エントランス', chapter: 1 },
          { id: 'loc_boss', name: '深淵の間', chapter: 2 },
          { id: 'loc_end', name: '脱出地点', chapter: 2 },
        ],
        skills: [{ id: 'skill_spot', name: '目星', defaultValue: 60 }],
      },
      nodes: [
        {
          id: 'start',
          chapter: 1,
          title: '探索開始',
          type: 'scene',
          locationId: 'loc_entrance',
          purpose: '導入',
          kpInstructions: [],
          investigationPoints: [],
          readAloudText: '',
          requiredItems: [],
          acquiredItems: ['item_cure'],
          consumedItems: [],
          sanCheck: { trigger: '異変目撃', successLoss: '0', failLoss: '1D3' },
          timeCostMinutes: 20,
        },
        {
          id: 'boss',
          chapter: 2,
          title: '深淵の怪物との対峙',
          type: 'combat',
          locationId: 'loc_boss',
          purpose: '決戦',
          kpInstructions: [],
          investigationPoints: [],
          readAloudText: '',
          requiredItems: [],
          acquiredItems: [],
          consumedItems: [],
          sanCheck: { trigger: '怪異との遭遇', successLoss: '1D3', failLoss: '1D10' },
          timeCostMinutes: 45,
        },
        {
          id: 'end',
          chapter: 2,
          title: '地上への生還',
          type: 'ending',
          locationId: 'loc_end',
          purpose: '結末',
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
        { id: 'e1', fromNodeId: 'start', toNodeId: 'boss', conditionType: 'always' },
        { id: 'e2', fromNodeId: 'boss', toNodeId: 'end', conditionType: 'always' },
      ],
      startNodeId: 'start',
    };

    const result = runSimulation(graph, {
      runs: 1000,
      partySize: 4,
      initialSan: 50,
      targetSessionMinutes: 100,
    });

    expect(result.totalRuns).toBe(1000);
    expect(result.completedRuns + result.lostRuns).toBe(1000);
    expect(result.averagePlayTimeMinutes).toBeGreaterThan(0);
    expect(result.averageSanByChapter[1]).toBeGreaterThan(0);
    expect(result.timeDistribution.percentUnderTarget).toBeGreaterThan(0);
  });
});
