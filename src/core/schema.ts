/**
 * ARKHAM Core Engine - Schema Definitions
 * Based on ARKHAM_HANDOVER.md Section 3 & 4
 */

export interface MasterData {
  items: ItemDefinition[];
  locations: LocationDefinition[];
  skills: SkillDefinition[];
}

export interface ItemDefinition {
  id: string;              // 例: "item_security_card"
  name: string;            // 例: "警備室のカードキー" (文中では 【警備室のカードキー】 と表現)
  category: 'key' | 'data' | 'weapon' | 'consumable' | 'clue';
  description: string;
  isConsumable: boolean;   // 使用時に消費されて消えるか
}

export interface LocationDefinition {
  id: string;              // 例: "loc_security_room"
  name: string;            // 例: "警備室" (文中では ［警備室］ と表現)
  chapter: number;
}

export interface SkillDefinition {
  id: string;              // 例: "skill_spot_hidden"
  name: string;            // 例: "目星" (文中では 〈目星〉 と表現)
  category?: string;
  defaultValue?: number;   // デフォルト初期値 (例: 25)
}

export interface NodeAction {
  acquireItemIds?: string[];
  consumeItemIds?: string[];
  sanRecovery?: string;
  triggerEventNodeId?: string;
}

export interface InvestigationPoint {
  name: string;            // 探索点名 (《 》に対応)
  description: string;
  checks?: {
    skillName: string;     // 〈 〉に対応
    difficulty?: 'regular' | 'hard' | 'extreme';
    onSuccess?: NodeAction;
    onFailure?: NodeAction;
    onCritical?: NodeAction;
  }[];
}

export interface ResourceCheckConfig {
  trigger: string;
  successLoss: string;     // "0", "1", "1D3" など
  failLoss: string;        // "1", "1D3", "1D6", "1D10" など
  resourceName?: string;   // 判定対象リソース名（省略時はシステムの既定リソース）
}

// 後方互換性のためのエイリアス
export type SanCheckConfig = ResourceCheckConfig;

export type SupportedSystemId = 'coc' | 'emoklore' | 'insane' | 'generic' | 'custom';

export interface SystemConfig {
  id: SupportedSystemId;
  name: string;                   // 表示名 (例: "クトゥルフ神話TRPG (CoC)", "エモクロアTRPG", "インセイン", "汎用・ファンタジー", "カスタム")
  resourceName: string;           // リソース名 (例: "正気度 (SAN)", "精神力 (MP)", "耐久力 (HP)", "リソース")
  checkLabel: string;             // 判定名 (例: "正気度(SAN)チェック", "共鳴判定", "恐怖判定", "精神・リソース判定")
  successLossLabel: string;       // 成功時ラベル (例: "成功時SAN減少", "成功時消耗", "成功時減少")
  failLossLabel: string;          // 失敗時ラベル (例: "失敗時SAN減少", "失敗時消耗", "失敗時減少")
  crisisLabel: string;            // 危機状態名 (例: "一時的狂気", "共鳴崩壊", "狂気顕現 / 錯乱", "リソース枯渇 / 行動不能")
  defaultInitialResource: number; // シミュレータ初期値 (例: 50, 15, 6, 50)
  icon?: string;                  // アイコン識別子
  description?: string;           // 簡潔な説明
}

export const DEFAULT_SYSTEM_PRESETS: Record<SupportedSystemId, SystemConfig> = {
  coc: {
    id: 'coc',
    name: 'クトゥルフ神話TRPG (CoC)',
    resourceName: '正気度 (SAN)',
    checkLabel: '正気度(SAN)チェック',
    successLossLabel: '成功時減少',
    failLossLabel: '失敗時減少',
    crisisLabel: '一時的狂気',
    defaultInitialResource: 50,
    icon: '🐙',
    description: '1D100ロール、正気度(SAN)喪失、一時的狂気、不定の狂気',
  },
  emoklore: {
    id: 'emoklore',
    name: 'エモクロアTRPG',
    resourceName: '精神力 (MP) / 共鳴度',
    checkLabel: '共鳴・精神判定',
    successLossLabel: '成功時消耗',
    failLossLabel: '失敗時消耗',
    crisisLabel: '共鳴崩壊',
    defaultInitialResource: 15,
    icon: '🔮',
    description: '共鳴感情、精神力(MP)消耗、共鳴変異・崩壊',
  },
  insane: {
    id: 'insane',
    name: 'インセイン (マルチジャンルホラー)',
    resourceName: '正気度 / 生命力',
    checkLabel: '恐怖判定 / 狂気獲得',
    successLossLabel: '成功時減少',
    failLossLabel: '失敗時減少',
    crisisLabel: '狂気顕現 / 錯乱',
    defaultInitialResource: 6,
    icon: '🕯️',
    description: '恐怖判定、狂気カード、秘密・居所の調査',
  },
  generic: {
    id: 'generic',
    name: '汎用・ファンタジー (D&D / SW2.5 / 独自)',
    resourceName: '精神・耐久リソース',
    checkLabel: '精神・リソース判定 (Resource Check)',
    successLossLabel: '成功時減少',
    failLossLabel: '失敗時減少',
    crisisLabel: 'リソース枯渇 / 行動不能',
    defaultInitialResource: 50,
    icon: '⚔️',
    description: 'HP/MP等のリソース消費、トラップ・ハザード判定、精神セーヴ',
  },
  custom: {
    id: 'custom',
    name: 'カスタムシステム',
    resourceName: '特殊リソース',
    checkLabel: '特殊判定',
    successLossLabel: '成功時減少',
    failLossLabel: '失敗時減少',
    crisisLabel: '限界状態',
    defaultInitialResource: 50,
    icon: '⚙️',
    description: '独自の用語体系・リソース名を自由にカスタマイズ',
  },
};

export const DEFAULT_SYSTEM_CONFIG: SystemConfig = DEFAULT_SYSTEM_PRESETS.generic;

export type ScenarioNodeType = 'scene' | 'room' | 'event' | 'check' | 'combat' | 'ending';

export interface ScenarioNode {
  id: string;                       // 一意なノードID
  chapter: number;                  // 第何章か
  title: string;                    // ノード見出し (例: "1-3. エントランス周辺エリアの探索")
  type: ScenarioNodeType;
  
  // 構造化メタデータ
  locationId: string;               // 関連する場所ID (［ ］に対応)
  purpose: string;                  // このシーンの目的
  kpInstructions: string[];         // KP向けマスタリング情報 (〔 〕に対応)
  
  // 探索・オブジェクト情報
  investigationPoints: InvestigationPoint[];

  // 描写テキスト
  readAloudText: string;            // PL向け読み上げ描写 (> に対応)

  // アイテム・リソースの入出力
  requiredItems: string[];          // このノードに入場/達成するために必要な itemId
  acquiredItems: string[];          // このノードで獲得する itemId
  consumedItems: string[];          // このノードで消費・消失する itemId

  // リソース変動 (シミュレータ用)
  resourceCheck?: ResourceCheckConfig;
  sanCheck?: SanCheckConfig;        // 旧形式・CoC用エイリアス
  timeCostMinutes: number;          // 想定所要時間 (分)
}

export type EdgeConditionType = 'always' | 'item_held' | 'check_success' | 'check_fail' | 'choice';

export interface ScenarioEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  conditionType: EdgeConditionType;
  conditionValue?: string;          // 必要な itemId や判定名など
  label?: string;                   // フローチャート上に表示するラベル
}

export interface CoreGraph {
  masterData: MasterData;
  nodes: ScenarioNode[];
  edges: ScenarioEdge[];
  startNodeId?: string;
  systemConfig?: SystemConfig;
}

// --- Linter Types ---

export type LintSeverity = 'error' | 'warning' | 'info';

export type LintIssueCode =
  | 'undefined_item'
  | 'fuzzy_item_match'
  | 'dead_item'
  | 'isolated_node'
  | 'forbidden_read_aloud_term'
  | 'bracket_syntax_error';

export interface LintIssue {
  code: LintIssueCode;
  severity: LintSeverity;
  message: string;
  nodeId?: string;
  location?: string;
  suggestion?: string;
}

// --- Graph Validator Types ---

export type ValidationSeverity = 'error' | 'warning';

export type ValidationIssueCode =
  | 'soft_lock_missing_item'
  | 'infinite_loop'
  | 'unreachable_ending'
  | 'unreachable_node'
  | 'dead_end'
  | 'dangling_branch';

export interface ValidationIssue {
  code: ValidationIssueCode;
  severity: ValidationSeverity;
  message: string;
  nodeId?: string;
  edgeIds?: string[];
  details?: {
    missingItemId?: string;
    problematicPath?: string[];
    cycleNodeIds?: string[];
    [key: string]: unknown;
  };
}

// --- Simulator Types ---

export interface SimulationConfig {
  runs?: number;                    // 試行回数 (default: 10000)
  partySize?: number;               // プレイヤー数 (default: 4)
  defaultSkillValue?: number;       // 探索者の平均技能値 (default: 60)
  skillValues?: Record<string, number>;
  initialSan?: number;              // 初期SAN (default: 50)
  diceStockCount?: number;          // 特殊ギミック: ダイス・ストック数 (default: 3)
  targetSessionMinutes?: number;    // 想定セッション時間 (default: 220)
}

export interface SimulationResult {
  totalRuns: number;
  completedRuns: number;
  lostRuns: number;
  lostRate: number;                 // 0.0 - 1.0
  nodeLostCounts: Record<string, number>;
  edgeTraversalCounts: Record<string, number>;
  edgeTraversalRates: Record<string, number>;
  averageSanByChapter: Record<number, number>;
  insanityOccurrences: number;
  averagePlayTimeMinutes: number;
  playTimePercentiles: {
    p50: number;
    p90: number;
    p95: number;
  };
  timeDistribution: {
    underTargetCount: number;
    targetMinutes: number;
    percentUnderTarget: number;
  };
}
