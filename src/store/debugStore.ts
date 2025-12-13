import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  type DebugState,
  type LogEntry,
  type PerformanceMetrics,
  type StateSnapshot,
  type AssertionRule,
  type AssertionResult,
  type ExportConfig,
} from '../types/debug';

// タグを自動抽出する関数
const extractTags = (message: string): string[] => {
  const tagRegex = /\[([^\]]+)\]/g;
  const tags: string[] = [];
  let match;
  while ((match = tagRegex.exec(message)) !== null) {
    tags.push(match[1]);
  }
  return tags;
};

// デフォルトのアサーションルール
const defaultAssertionRules: AssertionRule[] = [
  {
    id: 'start-node-exists',
    name: '開始ノード存在チェック',
    description: '少なくとも1つの開始ノードが設定されているか確認',
    condition: (state) => {
      return state.nodes.filter((n: any) => n.data?.isStart).length > 0;
    },
    severity: 'warning',
    enabled: true,
  },
  {
    id: 'orphan-nodes',
    name: '孤立ノード検出',
    description: 'エッジに接続されていないノード(付箋・メモを除く)を検出',
    condition: (state) => {
      const connectedNodeIds = new Set<string>();
      state.edges.forEach((edge: any) => {
        connectedNodeIds.add(edge.source);
        connectedNodeIds.add(edge.target);
      });
      
      const orphanNodes = state.nodes.filter((node: any) => 
        !connectedNodeIds.has(node.id) && 
        node.type !== 'sticky' && 
        node.type !== 'memo'
      );
      
      return orphanNodes.length === 0;
    },
    severity: 'info',
    enabled: true,
  },
  {
    id: 'undefined-variables',
    name: '変数未定義参照',
    description: '${VarName}形式で参照されているが未定義の変数を検出',
    condition: (state) => {
      const definedVars = new Set(Object.keys(state.gameState?.variables || {}));
      const varRegex = /\$\{([^}]+)\}/g;
      
      const allText: string[] = [];
      state.nodes.forEach((node: any) => {
        if (node.data?.label) allText.push(node.data.label);
        if (node.data?.description) allText.push(node.data.description);
        if (node.data?.infoValue) allText.push(node.data.infoValue);
        if (node.data?.conditionValue) allText.push(node.data.conditionValue);
        if (node.data?.variableValue) allText.push(String(node.data.variableValue));
      });
      
      for (const text of allText) {
        let match;
        while ((match = varRegex.exec(text)) !== null) {
          const varName = match[1];
          if (!definedVars.has(varName)) {
            return false;
          }
        }
      }
      
      return true;
    },
    severity: 'error',
    enabled: true,
  },
  {
    id: 'jump-target-validity',
    name: 'ジャンプノードターゲット検証',
    description: 'ジャンプノードのターゲットが存在するか確認',
    condition: (state) => {
      const nodeIds = new Set(state.nodes.map((n: any) => n.id));
      const jumpNodes = state.nodes.filter((n: any) => n.type === 'jump');
      
      for (const jumpNode of jumpNodes) {
        const target = jumpNode.data?.jumpTarget;
        if (target && !nodeIds.has(target)) {
          return false;
        }
      }
      
      return true;
    },
    severity: 'error',
    enabled: true,
  },
  {
    id: 'empty-title',
    name: 'タイトル未設定',
    description: 'タイトルが設定されていないノードを検出',
    condition: (state) => {
      const targetNodes = state.nodes.filter((n: any) => 
        !['sticky', 'memo', 'group'].includes(n.type)
      );
      return targetNodes.every((n: any) => n.data?.label && n.data.label.trim().length > 0);
    },
    severity: 'warning',
    enabled: true,
  },
  {
    id: 'dead-end-nodes',
    name: '行き止まりノード',
    description: '次のノードに繋がっていないノードを検出（エンディングの可能性あり）',
    condition: (state) => {
      const sourceIds = new Set(state.edges.map((e: any) => e.source));
      const targetNodes = state.nodes.filter((n: any) => 
        !['sticky', 'memo', 'group'].includes(n.type)
      );
      
      const deadEnds = targetNodes.filter((n: any) => !sourceIds.has(n.id));
      return deadEnds.length === 0;
    },
    severity: 'info',
    enabled: true,
  },
  {
    id: 'long-description',
    name: '長文テキスト検出',
    description: '本文が長すぎる(400文字以上)ノードを検出',
    condition: (state) => {
      return state.nodes.every((n: any) => {
        if (!n.data?.description) return true;
        return n.data.description.length < 400;
      });
    },
    severity: 'warning',
    enabled: true,
  },
];

export const useDebugStore = create<DebugState>()(
  persist(
    (set, get) => ({
      // 初期状態
      logs: [],
      maxLogs: 1000,
      
      performanceMetrics: {
        componentRenders: {},
        memory: null,
        fps: 0,
        timestamp: Date.now(),
        localStorage: null,
      },
      performanceHistory: [],
      maxHistorySize: 100,
      
      snapshots: [],
      maxSnapshots: 10,
      snapshotCompareMode: false,
      snapshotSelectedIds: [],
      snapshotDetailView: null,
      
      assertionRules: defaultAssertionRules,
      assertionResults: [],
      
      logFilter: {
        levels: new Set(['log', 'warn', 'error', 'info']),
        keyword: '',
        isRegex: false,
        tags: new Set(),
        timeRange: {
          start: null,
          end: null,
        },
      },
      
      isDebugPanelOpen: false,
      activeTab: 'logs',
      
      // アクション
      addLog: (level, args) => {
        const timestamp = new Date().toLocaleTimeString('ja-JP', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          fractionalSecondDigits: 3,
        });
        
        const message = args.map(arg => {
          if (typeof arg === 'object') {
            try {
              return JSON.stringify(arg, null, 2);
            } catch {
              return String(arg);
            }
          }
          return String(arg);
        }).join(' ');
        
        const tags = extractTags(message);
        
        const newLog: LogEntry = {
          timestamp,
          level,
          message,
          args,
          tags,
        };
        
        set(state => {
          const newLogs = [...state.logs, newLog];
          if (newLogs.length > state.maxLogs) {
            newLogs.shift();
          }
          return { logs: newLogs };
        });
      },
      
      clearLogs: () => {
        set({ logs: [] });
      },
      
      clearPerformanceMetrics: () => {
        set({
          performanceMetrics: {
            componentRenders: {},
            memory: null,
            fps: 0,
            timestamp: Date.now(),
            localStorage: null,
          },
          performanceHistory: [],
        });
      },
      
      updatePerformanceMetrics: (metrics: Partial<PerformanceMetrics>) => {
        set(state => {
          const newMetrics = {
            ...state.performanceMetrics,
            ...metrics,
            timestamp: Date.now(),
          };
          
          const newHistory = [...state.performanceHistory, newMetrics];
          if (newHistory.length > state.maxHistorySize) {
            newHistory.shift();
          }
          
          return {
            performanceMetrics: newMetrics,
            performanceHistory: newHistory,
          };
        });
      },
      
      createSnapshot: (snapshotData) => {
        const snapshot: StateSnapshot = {
          id: `snapshot-${Date.now()}`,
          timestamp: new Date().toISOString(),
          ...snapshotData,
        };
        
        set(state => {
          const newSnapshots = [...state.snapshots, snapshot];
          if (newSnapshots.length > state.maxSnapshots) {
            newSnapshots.shift();
          }
          return { snapshots: newSnapshots };
        });
      },
      
      deleteSnapshot: (id) => {
        set(state => ({
          snapshots: state.snapshots.filter(s => s.id !== id),
          // 削除されたIDが選択されていたら除外する
          snapshotSelectedIds: state.snapshotSelectedIds.filter(sid => sid !== id),
        }));
      },

      setSnapshotCompareMode: (mode) => {
        set({ snapshotCompareMode: mode });
      },

      toggleSnapshotSelection: (id) => {
        set(state => {
          const current = state.snapshotSelectedIds;
          if (current.includes(id)) {
             return { snapshotSelectedIds: current.filter(p => p !== id) };
          } else {
            if (current.length >= 2) return { snapshotSelectedIds: current };
            return { snapshotSelectedIds: [...current, id] };
          }
        });
      },

      setSnapshotDetailView: (view) => {
        set({ snapshotDetailView: view });
      },

      clearSnapshotSelection: () => {
    set({ snapshotSelectedIds: [] });
  },

  resetSnapshotSelection: () => {
        set({
          snapshotSelectedIds: [],
          snapshotCompareMode: false,
          snapshotDetailView: null,
        });
      },
      
      runAssertions: (state) => {
        const results: AssertionResult[] = [];
        const timestamp = new Date().toISOString();
        
        get().assertionRules.forEach(rule => {
          if (!rule.enabled) return;
          
          try {
            const passed = rule.condition(state);
            results.push({
              ruleId: rule.id,
              ruleName: rule.name,
              passed,
              severity: rule.severity,
              message: passed ? `✓ ${rule.name}` : `✗ ${rule.description}`,
              timestamp,
            });
          } catch (error) {
            results.push({
              ruleId: rule.id,
              ruleName: rule.name,
              passed: false,
              severity: 'error',
              message: `エラー: ${error}`,
              timestamp,
            });
          }
        });
        
        set({ assertionResults: results });
        
        // 失敗したアサーションをログに出力
        results.forEach(result => {
          if (!result.passed) {
            get().addLog(result.severity === 'info' ? 'info' : result.severity === 'warning' ? 'warn' : 'error', [
              `[Assertion] ${result.message}`
            ]);
          }
        });
      },
      
      addAssertionRule: (ruleData) => {
        try {
          const condition = new Function('state', ruleData.conditionCode) as (state: any) => boolean;
          
          const newRule: AssertionRule = {
            id: `custom-rule-${Date.now()}`,
            name: ruleData.name,
            description: ruleData.description,
            condition,
            conditionCode: ruleData.conditionCode,
            severity: ruleData.severity,
            enabled: true,
          };
          
          set(state => ({
            assertionRules: [...state.assertionRules, newRule]
          }));
          
          get().addLog('info', [`Custom assertion rule added: ${newRule.name}`]);
        } catch (e) {
          get().addLog('error', [`Failed to create assertion rule: ${e}`]);
        }
      },
      
      deleteAssertionRule: (id) => {
        set(state => ({
          assertionRules: state.assertionRules.filter(r => r.id !== id)
        }));
      },
      
      toggleAssertionRule: (id) => {
        set(state => ({
          assertionRules: state.assertionRules.map(r => 
            r.id === id ? { ...r, enabled: !r.enabled } : r
          )
        }));
      },

      setLogFilter: (filter) => {
        set(state => ({
          logFilter: { ...state.logFilter, ...filter },
        }));
      },
      
      setDebugPanelOpen: (open) => {
        set({ isDebugPanelOpen: open });
      },
      
      setActiveTab: (tab) => {
        set({ activeTab: tab });
      },
      
      exportSnapshot: (snapshotId: string, config: ExportConfig) => {
        const snapshot = get().snapshots.find(s => s.id === snapshotId);
        if (!snapshot) return;
        
        const exportData: any = {
          exportedAt: new Date().toISOString(),
          snapshotTimestamp: snapshot.timestamp,
        };
        
        if (config.includeNodes) {
          exportData.nodes = snapshot.nodes;
          exportData.edges = snapshot.edges;
        }
        if (config.includeGameState) {
          exportData.gameState = snapshot.gameState;
        }
        if (config.includeCharacters) {
          exportData.characters = snapshot.characters;
        }
        if (config.includeResources) {
          exportData.resources = snapshot.resources;
        }
        if (config.includeViewport) {
          exportData.viewport = snapshot.viewport;
        }
        if (config.includeLocalStorage) {
          exportData.localStorage = {
            keys: Object.keys(localStorage),
            note: '機密保護のため、値は含まれていません',
          };
        }
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `DebugSnapshot_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
        a.click();
        URL.revokeObjectURL(url);
      },
      
      exportLogs: (filtered) => {
        let logsToExport = get().logs;
        
        if (filtered) {
          const filter = get().logFilter;
          logsToExport = logsToExport.filter(log => {
            // レベルフィルタ
            if (!filter.levels.has(log.level)) return false;
            
            // キーワードフィルタ
            if (filter.keyword) {
              if (filter.isRegex) {
                try {
                  const regex = new RegExp(filter.keyword, 'i');
                  if (!regex.test(log.message)) return false;
                } catch {
                  // 正規表現エラーの場合は部分一致で検索
                  if (!log.message.toLowerCase().includes(filter.keyword.toLowerCase())) return false;
                }
              } else {
                if (!log.message.toLowerCase().includes(filter.keyword.toLowerCase())) return false;
              }
            }
            
            // タグフィルタ
            if (filter.tags.size > 0) {
              const hasMatchingTag = log.tags.some(tag => filter.tags.has(tag));
              if (!hasMatchingTag) return false;
            }
            
            return true;
          });
        }
        
        const logText = logsToExport.map(log =>
          `${log.timestamp} [${log.level.toUpperCase()}] ${log.message}`
        ).join('\n');
        
        const blob = new Blob([logText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `DebugLog_${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
        a.click();
        URL.revokeObjectURL(url);
      },
    }),
    {
      name: 'debug-storage', // localStorageのキー名
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        logs: state.logs,
        snapshots: state.snapshots,
        snapshotCompareMode: state.snapshotCompareMode,
        snapshotSelectedIds: state.snapshotSelectedIds,
        snapshotDetailView: state.snapshotDetailView,
        logFilter: {
          ...state.logFilter,
          levels: Array.from(state.logFilter.levels),
          tags: Array.from(state.logFilter.tags),
        },
        isDebugPanelOpen: state.isDebugPanelOpen,
        activeTab: state.activeTab,
      }),
      merge: (persistedState: any, currentState) => {
        if (!persistedState) return currentState;

        const merged = { ...currentState, ...persistedState };

        if (persistedState.logFilter) {
          merged.logFilter = {
            ...currentState.logFilter,
            ...persistedState.logFilter,
            // Setを再構築
            levels: Array.isArray(persistedState.logFilter.levels)
              ? new Set(persistedState.logFilter.levels)
              : currentState.logFilter.levels,
            tags: Array.isArray(persistedState.logFilter.tags)
              ? new Set(persistedState.logFilter.tags)
              : currentState.logFilter.tags,
          };
        }

        return merged;
      },
    }
  )
);
