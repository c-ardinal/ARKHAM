import { describe, it, expect } from 'vitest';
import { exportToScenarioMarkdown } from '../exporter';
import type { CoreGraph } from '../schema';

describe('ARKHAM Exporter Module', () => {
  it('generates markdown conforming to Section 4.4 standardized structure', () => {
    const graph: CoreGraph = {
      masterData: {
        items: [
          {
            id: 'item_sec_card',
            name: '警備室のカードキー',
            category: 'key',
            description: '警備室を開錠するためのカードキー',
            isConsumable: false,
          },
        ],
        locations: [
          { id: 'loc_entrance', name: 'エントランスロビー', chapter: 1 },
          { id: 'loc_sec_room', name: '警備室', chapter: 1 },
        ],
        skills: [{ id: 'skill_spot', name: '目星', defaultValue: 25 }],
      },
      nodes: [
        {
          id: 'node_1',
          chapter: 1,
          title: 'エントランスロビーの探索',
          type: 'scene',
          locationId: 'loc_entrance',
          purpose: '警備室への進入路確保',
          kpInstructions: ['プレイヤーに不気味な静寂を強調すること'],
          investigationPoints: [
            {
              name: '丸い案内デスク',
              description: '散乱した書類の隙間に何かがある。',
              checks: [
                {
                  skillName: '目星',
                  onSuccess: { acquireItemIds: ['item_sec_card'] },
                },
              ],
            },
          ],
          readAloudText: '冷たい空気が肌を刺し、奥の扉からは微かな機械音が聞こえる。',
          requiredItems: [],
          acquiredItems: [],
          consumedItems: [],
          sanCheck: { trigger: '血痕の発見', successLoss: '0', failLoss: '1' },
          timeCostMinutes: 20,
        },
        {
          id: 'node_2',
          chapter: 1,
          title: '警備室内部',
          type: 'room',
          locationId: 'loc_sec_room',
          purpose: '監視カメラの確認',
          kpInstructions: [],
          investigationPoints: [],
          readAloudText: 'モニターが青白く点滅している。',
          requiredItems: ['item_sec_card'],
          acquiredItems: [],
          consumedItems: [],
          timeCostMinutes: 15,
        },
      ],
      edges: [
        { id: 'e1', fromNodeId: 'node_1', toNodeId: 'node_2', conditionType: 'item_held', conditionValue: 'item_sec_card' },
      ],
      startNodeId: 'node_1',
    };

    const md = exportToScenarioMarkdown(graph);

    // Section header
    expect(md).toContain('### 1-1. エントランスロビーの探索');
    // KP mastering info
    expect(md).toContain('〔KP向け接続案内（マスタリング情報）〕');
    expect(md).toContain('- **現在地 / 入口**: ［エントランスロビー］');
    expect(md).toContain('- **接続・次の行き先**: ［警備室］ (警備室内部)');
    // PL investigation points
    expect(md).toContain('〔PL向け探索可能ポイント一覧〕');
    expect(md).toContain('- **《丸い案内デスク》**: 散乱した書類の隙間に何かがある。');
    // KP read aloud
    expect(md).toContain('〔KP描写テキスト〕');
    expect(md).toContain('> 冷たい空気が肌を刺し、奥の扉からは微かな機械音が聞こえる。');
    // Investigation details & bracketed item
    expect(md).toContain('##### 🔍 《丸い案内デスク》');
    expect(md).toContain('- **判定**: 〈目星〉');
    expect(md).toContain('  - **成功時**: 【警備室のカードキー】 を獲得。');
  });
});
