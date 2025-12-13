import type { ScenarioNode, ScenarioEdge, GameState, CharacterData, ResourceData } from '../types';

// ログエントリ
export interface LogEntry {
  timestamp: string;
  level: 'log' | 'warn' | 'error' | 'info';
  message: string;
  args: any[];
  tags: string[]; // 自動抽出されたタグ ([Viewport], [DEBUG]等)
}

// パフォーマンスメトリクス
export interface ComponentMetrics {
  count: number;
  avgTime: number;
  minTime: number;
  maxTime: number;
  lastRenderTime: number;
}

export interface PerformanceMetrics {
  componentRenders: Record<string, ComponentMetrics>;
  memory: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  } | null;
  fps: number;
  timestamp: number;
  localStorage: {
    used: number;      // 使用バイト数
    quota: number;     // 割り当て容量
    percentage: number; // 使用率(%)
  } | null;
}

// 状態スナップショット
export interface StateSnapshot {
  id: string;
  timestamp: string; // ISO 8601形式
  nodes: ScenarioNode[];
  edges: ScenarioEdge[];
  gameState: GameState;
  characters: CharacterData[];
  resources: ResourceData[];
  viewport: { x: number; y: number; zoom: number } | null;
  mode: 'edit' | 'play';
}

// アサーションルール
export interface AssertionRule {
  id: string;
  name: string;
  description: string;
  condition: (state: any) => boolean;
  conditionCode?: string; // カスタムルール用のコード文字列
  severity: 'info' | 'warning' | 'error';
  enabled: boolean;
}

// アサーション結果
export interface AssertionResult {
  ruleId: string;
  ruleName: string;
  passed: boolean;
  severity: 'info' | 'warning' | 'error';
  message: string;
  timestamp: string;
}

// フィルタ設定
export interface LogFilter {
  levels: Set<'log' | 'warn' | 'error' | 'info'>;
  keyword: string;
  isRegex: boolean;
  tags: Set<string>;
  timeRange: {
    start: string | null; // HH:mm:ss形式
    end: string | null;
  };
}

// エクスポート設定
export interface ExportConfig {
  includeNodes: boolean;
  includeGameState: boolean;
  includeCharacters: boolean;
  includeResources: boolean;
  includeViewport: boolean;
  includeLocalStorage: boolean;
}

// スナップショット詳細ビュー
export interface SnapshotDetailView {
  type: 'node' | 'edge' | 'character' | 'resource';
  item1: any;
  item2: any;
  action: 'added' | 'removed' | 'modified';
}

// デバッグストアの状態
export interface DebugState {
  // ログ
  logs: LogEntry[];
  maxLogs: number;
  
  // パフォーマンス
  performanceMetrics: PerformanceMetrics;
  performanceHistory: PerformanceMetrics[];
  maxHistorySize: number;
  
  // スナップショット
  snapshots: StateSnapshot[];
  maxSnapshots: number;
  snapshotCompareMode: boolean;
  snapshotSelectedIds: string[];
  snapshotDetailView: SnapshotDetailView | null;
  
  // アサーション
  assertionRules: AssertionRule[];
  assertionResults: AssertionResult[];
  
  // フィルタ
  logFilter: LogFilter;
  
  // UI状態
  isDebugPanelOpen: boolean;
  activeTab: 'logs' | 'performance' | 'snapshots' | 'assertions';
  
  // アクション
  addLog: (level: LogEntry['level'], args: any[]) => void;
  clearLogs: () => void;
  clearPerformanceMetrics: () => void;
  updatePerformanceMetrics: (metrics: Partial<PerformanceMetrics>) => void;
  createSnapshot: (state: Omit<StateSnapshot, 'id' | 'timestamp'>) => void;
  deleteSnapshot: (id: string) => void;
  setSnapshotCompareMode: (mode: boolean) => void;
  toggleSnapshotSelection: (id: string) => void;
  setSnapshotDetailView: (view: SnapshotDetailView | null) => void;
  clearSnapshotSelection: () => void;
  resetSnapshotSelection: () => void;
  runAssertions: (state: any) => void;
  addAssertionRule: (rule: Omit<AssertionRule, 'id' | 'enabled' | 'condition'> & { conditionCode: string }) => void;
  deleteAssertionRule: (id: string) => void;
  toggleAssertionRule: (id: string) => void;
  setLogFilter: (filter: Partial<LogFilter>) => void;
  setDebugPanelOpen: (open: boolean) => void;
  setActiveTab: (tab: DebugState['activeTab']) => void;
  exportSnapshot: (snapshotId: string, config: ExportConfig) => void;
  exportLogs: (filtered: boolean) => void;
}
