import { describe, it, expect } from 'vitest';
import { lintGraph } from '../linter';
import { validateGraph } from '../validator';
import { runSimulation } from '../simulator';
import { exportToScenarioMarkdown } from '../exporter';
import type { CoreGraph, MasterData, ScenarioNode, ScenarioEdge } from '../schema';

describe('ARKHAM Reference Scenario Integration Test', () => {
  // Items from Section 5.1
  const referenceItems: MasterData['items'] = [
    { id: 'item_security_card', name: '警備室のカードキー', category: 'key', description: '', isConsumable: false },
    { id: 'item_blood_memo', name: '血塗られた観察メモ', category: 'clue', description: '', isConsumable: false },
    { id: 'item_crypto_memo', name: '暗号メモ（Dr.サトウの手帳）', category: 'clue', description: '', isConsumable: false },
    { id: 'item_usb', name: '機密暗号USB', category: 'data', description: '', isConsumable: false },
    { id: 'item_battery', name: '予備万能電池', category: 'key', description: '', isConsumable: true },
    { id: 'item_shotgun', name: 'ショットガン（装弾数6発）', category: 'weapon', description: '', isConsumable: false },
    { id: 'item_vest', name: '防弾タクティカルベスト', category: 'weapon', description: '', isConsumable: false },
    { id: 'item_crowbar', name: '大型バール', category: 'key', description: '', isConsumable: false },
    { id: 'item_bypass_code', name: 'バイパスコード', category: 'data', description: '', isConsumable: false },
    { id: 'item_pulse_wave', name: 'パルス干渉波形', category: 'data', description: '', isConsumable: false },
    { id: 'item_crystal_shard', name: '破損した時空結晶片', category: 'weapon', description: '', isConsumable: false },
    { id: 'item_resonance_defect', name: '結晶共鳴の構造欠陥', category: 'data', description: '', isConsumable: false },
    { id: 'item_scalpel', name: '生体メス', category: 'weapon', description: '', isConsumable: false },
    { id: 'item_stabilizer', name: '安定剤', category: 'consumable', description: '', isConsumable: true },
    { id: 'item_brain_data', name: '脳缶データ', category: 'data', description: '', isConsumable: false },
    { id: 'item_director_diary', name: '施設長の日記', category: 'clue', description: '', isConsumable: false },
    { id: 'item_override_key', name: 'マスターオーバーライド・キー', category: 'key', description: '', isConsumable: false },
    { id: 'item_pulse_gun', name: '因果律崩壊パルス銃', category: 'weapon', description: '', isConsumable: false },
  ];

  const referenceLocations: MasterData['locations'] = [
    { id: 'loc_intro', name: '受入検疫室', chapter: 0 },
    { id: 'loc_entrance', name: 'エントランスロビー', chapter: 1 },
    { id: 'loc_sec_room', name: '警備室', chapter: 1 },
    { id: 'loc_lab1', name: '第1実験棟：時空結晶解析室', chapter: 2 },
    { id: 'loc_lab2', name: '第2実験棟：生体培養室', chapter: 2 },
    { id: 'loc_core', name: '最深部コンソール室', chapter: 3 },
    { id: 'loc_surface', name: '地上脱出ポイント', chapter: 4 },
  ];

  const referenceSkills: MasterData['skills'] = [
    { id: 'skill_spot', name: '目星', defaultValue: 60 },
    { id: 'skill_listen', name: '聞き耳', defaultValue: 60 },
    { id: 'skill_computer', name: 'コンピューター', defaultValue: 60 },
    { id: 'skill_medicine', name: '医学', defaultValue: 60 },
  ];

  // Reference scenario nodes conforming to 220 min timetable
  const referenceNodes: ScenarioNode[] = [
    {
      id: 'node_intro',
      chapter: 0,
      title: '0. 導入と隔離施設への進入',
      type: 'scene',
      locationId: 'loc_intro',
      purpose: '状況把握と初期物資の獲得',
      kpInstructions: ['ダイス・ストックのルールをプレイヤーに説明する'],
      investigationPoints: [
        {
          name: '検疫デスク',
          description: 'Dr.サトウの遺留品が置かれている。',
          checks: [
            {
              skillName: '目星',
              onSuccess: { acquireItemIds: ['item_security_card', 'item_blood_memo'] },
            },
          ],
        },
      ],
      readAloudText: '冷たい非常灯が点滅し、換気口から異様な唸り声が響いている。',
      requiredItems: [],
      acquiredItems: ['item_security_card', 'item_blood_memo'],
      consumedItems: [],
      sanCheck: { trigger: '遺留品の血痕', successLoss: '0', failLoss: '1' },
      timeCostMinutes: 25,
    },
    {
      id: 'node_ch1_lobby',
      chapter: 1,
      title: '1-1. エントランス周辺の探索',
      type: 'scene',
      locationId: 'loc_entrance',
      purpose: '警備室へのアクセス経路確保',
      kpInstructions: ['監視カメラの存在を匂わせる'],
      investigationPoints: [
        {
          name: '案内端末',
          description: '電源は落ちているが手帳が挟まれている。',
          checks: [
            {
              skillName: '目星',
              onSuccess: { acquireItemIds: ['item_crypto_memo'] },
            },
          ],
        },
      ],
      readAloudText: '壁一面に黒ずんだ染みが広がり、空間全体が歪んでいるような眩暈を覚える。',
      requiredItems: [],
      acquiredItems: ['item_crypto_memo'],
      consumedItems: [],
      timeCostMinutes: 25,
    },
    {
      id: 'node_ch1_sec_room',
      chapter: 1,
      title: '1-2. 警備室の制圧とデータ抽出',
      type: 'room',
      locationId: 'loc_sec_room',
      purpose: 'バイパスコードとパルス干渉波形の入手',
      kpInstructions: ['カードキーがないと強固な電子ロックは開かない'],
      investigationPoints: [
        {
          name: 'メインコンソール',
          description: '解析コードが画面に流れている。',
          checks: [
            {
              skillName: 'コンピューター',
              onSuccess: { acquireItemIds: ['item_bypass_code', 'item_pulse_wave'] },
            },
          ],
        },
      ],
      readAloudText: '重厚な気密扉の先、整然と並ぶモニターに施設全域の異常が映し出されている。',
      requiredItems: ['item_security_card'],
      acquiredItems: ['item_bypass_code', 'item_pulse_wave'],
      consumedItems: [],
      timeCostMinutes: 20,
    },
    {
      id: 'node_ch2_lab',
      chapter: 2,
      title: '2-1. 中層実験区画の探索',
      type: 'scene',
      locationId: 'loc_lab1',
      purpose: '結晶共鳴と脳缶データの入手',
      kpInstructions: ['バイパスコードでエレベーターを起動する必要がある'],
      investigationPoints: [
        {
          name: '時空結晶解析端末',
          description: '結晶の破片と解析データが残されている。',
          checks: [
            {
              skillName: '目星',
              onSuccess: { acquireItemIds: ['item_crystal_shard', 'item_brain_data', 'item_override_key'] },
            },
          ],
        },
      ],
      readAloudText: '青紫色の燐光を放つ結晶群が、脈動するかのように光を放っている。',
      requiredItems: ['item_bypass_code'],
      acquiredItems: ['item_crystal_shard', 'item_brain_data', 'item_override_key'],
      consumedItems: [],
      sanCheck: { trigger: '時空の歪み', successLoss: '1', failLoss: '1D4' },
      timeCostMinutes: 75,
    },
    {
      id: 'node_ch3_climax',
      chapter: 3,
      title: '3-1. 最深部コンソール決戦',
      type: 'combat',
      locationId: 'loc_core',
      purpose: '3重コンソール操作と異形の撃退',
      kpInstructions: ['パルス干渉波形、脳缶データ、マスターオーバーライドの3点が必要'],
      investigationPoints: [
        {
          name: '三連コンソール',
          description: '3つの認証スロットが光っている。',
        },
      ],
      readAloudText: '天井を覆い尽くすほどの異様な肉塊が、脈動とともに幾重もの触手を蠢かせている。',
      requiredItems: ['item_pulse_wave', 'item_brain_data', 'item_override_key'],
      acquiredItems: [],
      consumedItems: ['item_override_key'],
      sanCheck: { trigger: '超常の怪異', successLoss: '1D3', failLoss: '1D10' },
      timeCostMinutes: 55,
    },
    {
      id: 'node_ch4_ending',
      chapter: 4,
      title: '4-1. 地上への帰還',
      type: 'ending',
      locationId: 'loc_surface',
      purpose: '生還と真相の持ち帰り',
      kpInstructions: ['生還者全員にSAN回復を与える'],
      investigationPoints: [],
      readAloudText: '朝靄の中に昇る太陽の光が、生き残った探索者たちの顔を照らし出す。',
      requiredItems: [],
      acquiredItems: [],
      consumedItems: [],
      timeCostMinutes: 20,
    },
  ];

  const referenceEdges: ScenarioEdge[] = [
    { id: 'e0', fromNodeId: 'node_intro', toNodeId: 'node_ch1_lobby', conditionType: 'always' },
    { id: 'e1', fromNodeId: 'node_ch1_lobby', toNodeId: 'node_ch1_sec_room', conditionType: 'item_held', conditionValue: 'item_security_card' },
    { id: 'e2', fromNodeId: 'node_ch1_sec_room', toNodeId: 'node_ch2_lab', conditionType: 'item_held', conditionValue: 'item_bypass_code' },
    { id: 'e3', fromNodeId: 'node_ch2_lab', toNodeId: 'node_ch3_climax', conditionType: 'always' },
    { id: 'e4', fromNodeId: 'node_ch3_climax', toNodeId: 'node_ch4_ending', conditionType: 'always' },
  ];

  const graph: CoreGraph = {
    masterData: {
      items: referenceItems,
      locations: referenceLocations,
      skills: referenceSkills,
    },
    nodes: referenceNodes,
    edges: referenceEdges,
    startNodeId: 'node_intro',
  };

  it('passes Linter with 0 errors and 0 forbidden terms', () => {
    const issues = lintGraph(graph);
    const errors = issues.filter((i) => i.severity === 'error');
    expect(errors.length).toBe(0);
  });

  it('passes Graph Validator with 0 soft-locks and 0 deadlocks', () => {
    const issues = validateGraph(graph);
    expect(issues.length).toBe(0);
  });

  it('runs Monte Carlo simulation and matches 220 min target timetable', () => {
    const sim = runSimulation(graph, {
      runs: 1000,
      partySize: 4,
      initialSan: 50,
      targetSessionMinutes: 220,
    });

    expect(sim.completedRuns).toBeGreaterThan(0);
    expect(sim.averagePlayTimeMinutes).toBe(220); // 25 + 25 + 20 + 75 + 55 + 20 = 220
    expect(sim.timeDistribution.percentUnderTarget).toBe(100);
  });

  it('exports complete standardized markdown', () => {
    const md = exportToScenarioMarkdown(graph);
    expect(md).toContain('# シナリオ本文 (Scenario Body)');
    expect(md).toContain('## 第0章');
    expect(md).toContain('## 第1章');
    expect(md).toContain('## 第2章');
    expect(md).toContain('## 第3章');
    expect(md).toContain('## 第4章');
    expect(md).toContain('〔KP向け接続案内（マスタリング情報）〕');
    expect(md).toContain('〔PL向け探索可能ポイント一覧〕');
    expect(md).toContain('〔KP描写テキスト〕');
  });
});
