import { create } from 'zustand';
import {
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  reconnectEdge,
  MarkerType,
} from 'reactflow';
import type {
  Connection,
  EdgeChange,
  NodeChange,
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
} from 'reactflow';
import type { ScenarioNode, ScenarioEdge, GameState, CharacterData, ResourceData } from '../types';
import { evaluateFormula } from '../utils/textUtils';
import { recomputeEdgeVisibility } from './edgeVisibility';
import type { Tab } from '../types/tab';
import { generateTabId, SCHEMA_VERSION } from '../types/tab';
import { isLegacyFormat, isFutureFormat, migrateLegacyToTabbed } from './migration';
import { retargetJumpReferencesForMove } from '../utils/jumpReferences';
import { toast } from '../components/common/toast';

// Per-group rAF id for drag-time throttled updateGroupSize calls. A flurry
// of position changes within the same animation frame collapses into a
// single updateGroupSize per affected group.
const _groupSizeRafIds = new Map<string, number>();

// Debounce window for pushHistory. Bursts of pushHistory within this window
// (e.g. each keystroke during continuous typing in the property panel)
// collapse into a single snapshot, reducing memory and structuredClone cost.
const PUSH_HISTORY_DEBOUNCE_MS = 200;
let _pushHistoryWindowOpen = false;
let _pushHistoryTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * H-T2: loadScenario の引数型 — v2 タブ形式と v1 レガシー形式の弁別ユニオン
 * JSON.parse 経由の unknown データをここで型付けし、実装内部の as any を最小化する。
 */
type LoadScenarioInput =
  | {
      /** v2 タブ形式: tabs 配列を持つ */
      tabs: unknown[];
      activeTabId?: string;
      gameState?: unknown;
      characters?: unknown[];
      resources?: unknown[];
      version?: number;
      edgeType?: string;
      [k: string]: unknown;
    }
  | {
      /** v1 レガシー形式: nodes/edges をトップレベルに持つ */
      nodes: unknown[];
      edges?: unknown[];
      gameState?: unknown;
      characters?: unknown[];
      resources?: unknown[];
      viewport?: unknown;
      edgeType?: string;
      [k: string]: unknown;
    };

// Helpers — operate on active tab
function getActiveTabFrom(state: ScenarioState): Tab | undefined {
  return state.tabs.find((t) => t.id === state.activeTabId);
}
function withActiveTab(state: ScenarioState, updater: (tab: Tab) => Partial<Tab>): Tab[] {
  return state.tabs.map((t) => (t.id === state.activeTabId ? { ...t, ...updater(t) } : t));
}

interface ScenarioState {
  tabs: Tab[];
  activeTabId: string;
  gameState: GameState;
  mode: 'edit' | 'play';
  selectedNodeId: string | string[] | null;

  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  onReconnect: (oldEdge: ScenarioEdge, newConnection: Connection) => void;
  addNode: (node: ScenarioNode) => void;
  updateNodeData: (id: string, data: any) => void;
  updateNodeStyle: (id: string, style: any) => void;
  duplicateNodes: (nodes: ScenarioNode[]) => string[]; // Returns new node IDs
  deleteNodes: (nodeIds: string[]) => void;
  setMode: (mode: 'edit' | 'play') => void;
  setSelectedNode: (id: string | string[] | null) => void;
  loadScenario: (data: LoadScenarioInput) => void;

  // Tab CRUD
  addTab: (name?: string) => string;
  renameTab: (id: string, newName: string) => void;
  deleteTab: (id: string) => void;
  reorderTabs: (fromIdx: number, toIdx: number) => void;
  setActiveTab: (id: string) => void;
  moveNodesToTab: (nodeIds: string[], targetTabId: string, edgeStrategy?: 'delete' | 'replace-jump') => void;
  executeJump: (target: { tabId: string; nodeId: string } | null) => void;

  // Localization & Theme
  language: 'en' | 'ja';
  setLanguage: (lang: 'en' | 'ja') => void;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;

  // Edge Style
  edgeType: string;
  setEdgeType: (type: string) => void;

  // Variables
  addVariable: (name: string, type: 'boolean' | 'number' | 'string', initialValue: any) => void;
  updateVariable: (name: string, value: any) => void;
  updateVariableMetadata: (oldName: string, newName: string, newType: 'boolean' | 'number' | 'string') => void;
  batchRenameVariables: (renames: Record<string, string>) => void;
  deleteVariable: (name: string) => void;

  // Characters
  characters: CharacterData[];
  addCharacter: (char: CharacterData) => void;
  updateCharacter: (id: string, char: Partial<CharacterData>) => void;
  deleteCharacter: (id: string) => void;

  // Resources
  resources: ResourceData[];
  addResource: (res: ResourceData) => void;
  updateResource: (id: string, res: Partial<ResourceData>) => void;
  deleteResource: (id: string) => void;

  // Game Logic
  reset: () => void;
  resetGame: () => void;
  recalculateGameState: () => void;
  revealAll: () => void;
  unrevealAll: () => void;
  triggerNode: (nodeId: string) => void;
  toggleNodeState: (nodeId: string) => void;
  toggleGroup: (nodeId: string) => void;
  groupNodes: (nodeIds: string[]) => void;
  ungroupNodes: (groupId: string) => void;
  setNodeParent: (nodeId: string, parentId: string | undefined, position: { x: number, y: number }) => void;
  updateGroupSize: (groupId: string, contentSize?: { width: number, height: number }) => void;
  bringNodeToFront: (nodeId: string) => void;
  resolveGroupOverlaps: (nodeId: string) => void;

  addSticky: (targetNodeId: string | undefined, position: { x: number, y: number }) => void;
  toggleStickies: (parentNodeId: string) => void;
  deleteStickies: (parentNodeId: string) => void;

  // Bulk Sticky Operations
  showAllStickies: () => void;
  hideAllStickies: () => void;
  deleteAllStickiesGlobal: () => void;
  showAllFreeStickies: () => void;
  hideAllFreeStickies: () => void;
  deleteAllFreeStickies: () => void;
  showAllNodeStickies: () => void;
  hideAllNodeStickies: () => void;
  deleteAllNodeStickies: () => void;
  hideSticky: (stickyId: string) => void;

  // History
  past: { tabs: Tab[]; activeTabId: string; gameState: GameState }[];
  future: { tabs: Tab[]; activeTabId: string; gameState: GameState }[];
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;

  // LocalStorage Persistence
  saveToLocalStorage: () => void;
  loadFromLocalStorage: () => void;
  clearLocalStorage: () => void;
  resetToInitialState: () => void;
}

// LocalStorage key
const STORAGE_KEY = 'trpg-scenario-storage';
const LEGACY_BACKUP_PREFIX = 'arkham_legacy_backup_';
const FUTURE_BACKUP_PREFIX = 'arkham_future_format_backup_';
const MAX_BACKUPS = 3;

/**
 * Returns a localized default tab name for the given 1-based index.
 * Used at store-initialization time when i18n may not yet be loaded,
 * so we read the language preference directly from localStorage.
 */
function defaultTabName(index: number, language: 'en' | 'ja' = 'ja'): string {
  return language === 'en' ? `Tab ${index}` : `タブ ${index}`;
}

/** Read the persisted language preference without triggering store initialization. */
function getStoredLanguage(): 'en' | 'ja' {
  try {
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed?.language === 'en' || parsed?.language === 'ja') return parsed.language;
    }
  } catch { /* ignore */ }
  return 'ja';
}

function pruneBackups(prefix: string) {
  try {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith(prefix)).sort();
    while (keys.length > MAX_BACKUPS) {
      const oldest = keys.shift()!;
      localStorage.removeItem(oldest);
    }
  } catch (e) { /* localStorage may be unavailable in tests */ }
}

// Load initial state from LocalStorage
const loadInitialState = () => {
  try {
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (!stored) return null;

    const parsed = JSON.parse(stored);

    if (isFutureFormat(parsed)) {
      const key = `${FUTURE_BACKUP_PREFIX}${Date.now()}`;
      try { localStorage.setItem(key, stored); } catch { /* ignore */ }
      pruneBackups(FUTURE_BACKUP_PREFIX);
      // H-T1: global.d.ts で Window 型を拡張したため as any 不要
      window.__ARKHAM_FUTURE_VERSION_DETECTED__ = (parsed as Record<string, unknown>).version as number;
      return null;
    }

    if (isLegacyFormat(parsed)) {
      const key = `${LEGACY_BACKUP_PREFIX}${Date.now()}`;
      try { localStorage.setItem(key, stored); } catch { /* ignore */ }
      pruneBackups(LEGACY_BACKUP_PREFIX);
      const migrated = migrateLegacyToTabbed(parsed, defaultTabName(1, parsed.language ?? getStoredLanguage()));
      // sanitize nodes the same way the original sanitization did
      migrated.tabs = migrated.tabs.map((tab) => ({
        ...tab,
        nodes: (tab.nodes as any[]).filter((n: any) =>
          n &&
          typeof n.id === 'string' &&
          n.position &&
          typeof n.position.x === 'number' && !isNaN(n.position.x) &&
          typeof n.position.y === 'number' && !isNaN(n.position.y)
        ).map((n: any) => ({ ...n, selected: false })),
      }));
      return migrated;
    }

    // Already v2 — sanitize each tab's nodes
    if (Array.isArray(parsed.tabs)) {
      parsed.tabs = parsed.tabs.map((tab: any) => ({
        ...tab,
        nodes: Array.isArray(tab.nodes)
          ? tab.nodes.filter((n: any) =>
              n &&
              typeof n.id === 'string' &&
              n.position &&
              typeof n.position.x === 'number' && !isNaN(n.position.x) &&
              typeof n.position.y === 'number' && !isNaN(n.position.y)
            ).map((n: any) => ({ ...n, selected: false }))
          : [],
        edges: Array.isArray(tab.edges) ? tab.edges : [],
      }));
    }
    return parsed;
  } catch (error) {
    console.error('Failed to load from LocalStorage:', error);
  }
  return null;
};

const initialStoredState = loadInitialState();

const createInitialMemoNode = (): ScenarioNode => ({
  id: 'memo-initial-warning',
  type: 'memo',
  position: { x: 100, y: 100 },
  data: {
    label: '注意事項 / Warnings',
    description: '・本ツールには自動保存機能が実装されています。\n ページを再読み込みしても、最後の作業状態が自動的に復元されます。\n ただし、ブラウザのキャッシュをクリアすると保存データも削除されます。\n 重要なデータは「ファイル→保存」で手動保存することをお勧めします。\n・使用例を見たい場合は、「ファイル→サンプルデータ読込」を実行して下さい。\n・その他の注意事項や使い方は「ヘルプ→マニュアル」をご覧下さい。\n\n上記を読み終わったらこのノードは削除して問題有りません。',
  },
  width: 400,
  height: 200,
  draggable: true,
} as any);

const createInitialTab = (): Tab => ({
  id: generateTabId(),
  name: defaultTabName(1, getStoredLanguage()),
  nodes: [createInitialMemoNode()],
  edges: [],
});

const initialFirstTab = createInitialTab();
const initialTabs: Tab[] = (initialStoredState as any)?.tabs ?? [initialFirstTab];
const initialActiveTabId: string = (initialStoredState as any)?.activeTabId ?? initialTabs[0].id;

export const useScenarioStore = create<ScenarioState>((set, get) => ({
  tabs: initialTabs,
  activeTabId: initialActiveTabId,
  gameState: initialStoredState?.gameState || {
    currentNodes: [],
    revealedNodes: [],
    inventory: {},
    equipment: {},
    knowledge: {},
    skills: {},
    stats: {},
    variables: {},
  },
  mode: initialStoredState?.mode || 'edit',
  characters: initialStoredState?.characters || [],
  resources: initialStoredState?.resources || [],

  addCharacter: (char) => set((state) => ({ characters: [...state.characters, char] })),
  updateCharacter: (id, char) => set((state) => ({
      characters: state.characters.map((c) => (c.id === id ? { ...c, ...char } : c))
  })),
  deleteCharacter: (id) => set((state) => {
      // Walk all tabs so character nodes are removed regardless of which tab is active
      const newTabs = state.tabs.map((t) => {
          const nodesToDelete = t.nodes
              .filter((n) => n.type === 'character' && n.data.referenceId === id)
              .map((n) => n.id);
          if (nodesToDelete.length === 0) return t;
          return {
              ...t,
              nodes: t.nodes.filter((n) => !nodesToDelete.includes(n.id)),
              edges: t.edges.filter(
                  (e) => !nodesToDelete.includes(e.source) && !nodesToDelete.includes(e.target)
              ),
          };
      });
      return {
          characters: state.characters.filter((c) => c.id !== id),
          tabs: newTabs,
      };
  }),

  addResource: (res) => set((state) => {
      const newResources = [...state.resources, res];

      // Auto-assign to unassigned element nodes across all tabs
      const newTabs = state.tabs.map((t) => {
          const updatedNodes = t.nodes.map((node) => {
              if ((node.type === 'element' || node.type === 'information') && !node.data.referenceId) {
                  return {
                      ...node,
                      data: { ...node.data, referenceId: res.id, infoValue: res.name },
                  };
              }
              return node;
          });
          return { ...t, nodes: updatedNodes };
      });

      return { resources: newResources, tabs: newTabs };
  }),
  updateResource: (id, res) => set((state) => {
      const updatedResources = state.resources.map((r) => (r.id === id ? { ...r, ...res } : r));
      const updatedResource = updatedResources.find((r) => r.id === id);

      // Update element nodes that reference this resource across all tabs
      const newTabs = state.tabs.map((t) => {
          const updatedNodes = t.nodes.map((node) => {
              if ((node.type === 'element' || node.type === 'information') && node.data.referenceId === id) {
                  if (updatedResource) {
                      return {
                          ...node,
                          data: { ...node.data, infoValue: updatedResource.name },
                      };
                  }
              }
              return node;
          });
          return { ...t, nodes: updatedNodes };
      });

      return { resources: updatedResources, tabs: newTabs };
  }),
  deleteResource: (id) => set((state) => {
       const resources = state.resources.filter((r) => r.id !== id);
       const fallbackResource = resources.length > 0 ? resources[0] : null;

       // Walk all tabs so element/resource nodes are updated regardless of which tab is active
       const newTabs = state.tabs.map((t) => {
           const updatedNodes = t.nodes.map((node) => {
               if ((node.type === 'element' || node.type === 'information') && node.data.referenceId === id) {
                   return {
                       ...node,
                       data: {
                           ...node.data,
                           referenceId: fallbackResource ? fallbackResource.id : undefined,
                           infoValue: fallbackResource ? fallbackResource.name : 'None',
                       },
                   };
               }
               if (node.type === 'resource' && node.data.referenceId === id) {
                   return null;
               }
               return node;
           }).filter((n): n is ScenarioNode => n !== null);

           const validIds = new Set(updatedNodes.map((n) => n.id));
           const updatedEdges = t.edges.filter(
               (e) => validIds.has(e.source) && validIds.has(e.target)
           );

           return { ...t, nodes: updatedNodes, edges: updatedEdges };
       });

       return { resources, tabs: newTabs };
  }),

  selectedNodeId: null,

  // Settings
  language: initialStoredState?.language || 'ja',
  setLanguage: (lang) => set({ language: lang }),
  theme: initialStoredState?.theme || 'dark',
  setTheme: (theme) => set({ theme }),
  edgeType: initialStoredState?.edgeType || 'default',
  setEdgeType: (type) => {
      const state = get();
      const activeTab = getActiveTabFrom(state);
      const currentEdges = activeTab?.edges ?? [];
      // Exclude sticky note edges from the update
      const updatedEdges = currentEdges.map(edge => {
          if (edge.targetHandle === 'sticky-target') return edge;
          return { ...edge, type };
      });
      set({ edgeType: type, tabs: withActiveTab(state, () => ({ edges: updatedEdges })) });
  },

  // History Implementation
  past: [],
  future: [],

  pushHistory: () => {
      // First call in the debounce window: take a snapshot now. Subsequent
      // calls within the window only refresh the timer so we don't take a
      // snapshot per keystroke during continuous edits. Undo granularity
      // becomes "edits at least 200ms apart" instead of "every action",
      // which matches typical user expectation.
      if (_pushHistoryWindowOpen) {
          if (_pushHistoryTimer !== null) clearTimeout(_pushHistoryTimer);
          _pushHistoryTimer = setTimeout(() => {
              _pushHistoryWindowOpen = false;
              _pushHistoryTimer = null;
          }, PUSH_HISTORY_DEBOUNCE_MS);
          return;
      }

      const { tabs, activeTabId, gameState, past } = get();
      // Deep copy to avoid reference issues. Use JSON serialization as
      // structuredClone may not handle React Flow's Node type cleanly.
      const snapshot = {
          tabs: JSON.parse(JSON.stringify(tabs)),
          activeTabId,
          gameState: JSON.parse(JSON.stringify(gameState)),
      };

      const newPast = [...past, snapshot].slice(-50); // Limit history
      set({ past: newPast, future: [] });

      _pushHistoryWindowOpen = true;
      if (_pushHistoryTimer !== null) clearTimeout(_pushHistoryTimer);
      _pushHistoryTimer = setTimeout(() => {
          _pushHistoryWindowOpen = false;
          _pushHistoryTimer = null;
      }, PUSH_HISTORY_DEBOUNCE_MS);
  },

  undo: () => {
      const { past, future, tabs, activeTabId, gameState } = get();
      if (past.length === 0) return;

      const previous = past[past.length - 1];
      const newPast = past.slice(0, -1);

      set({
          tabs: previous.tabs,
          activeTabId: previous.activeTabId,
          gameState: previous.gameState,
          past: newPast,
          future: [{ tabs, activeTabId, gameState }, ...future]
      });
  },

  redo: () => {
      const { past, future, tabs, activeTabId, gameState } = get();
      if (future.length === 0) return;

      const next = future[0];
      const newFuture = future.slice(1);

      set({
          tabs: next.tabs,
          activeTabId: next.activeTabId,
          gameState: next.gameState,
          past: [...past, { tabs, activeTabId, gameState }],
          future: newFuture
      });
  },

  onNodesChange: (changes: NodeChange[]) => {
    const state = get();
    const activeTab = getActiveTabFrom(state);
    const currentNodes = activeTab?.nodes ?? [];
    const currentEdges = activeTab?.edges ?? [];

    // Filter changes if in Play Mode
    let validChanges = changes;
    if (state.mode === 'play') {
        validChanges = changes.filter(change => {
            if (change.type === 'position' || change.type === 'dimensions') {
                 const node = currentNodes.find(n => n.id === change.id);
                 if (node && node.type !== 'sticky') {
                     return false; // Prevent movement for non-sticky nodes in Play Mode
                 }
            }
            return true;
        });
    }

    // Sticky Note Following Logic (using filtered changes)
    const nodeMap = new Map(currentNodes.map(n => [n.id, n]));
    const stickyUpdates = new Map<string, {x: number, y: number}>();

    // Helper to find all descendant IDs
    const getDescendants = (parentId: string): string[] => {
        const children = currentNodes.filter(n => n.parentNode === parentId);
        let descendants: string[] = children.map(c => c.id);
        children.forEach(c => {
            descendants = [...descendants, ...getDescendants(c.id)];
        });
        return descendants;
    };

    validChanges.forEach(change => {
        // Track movement of nodes that are not stickies themselves, but might be targets
        if (change.type === 'position' && change.position && change.dragging) {
            const oldNode = nodeMap.get(change.id);
            if (oldNode && oldNode.type !== 'sticky') {
                const dx = change.position.x - oldNode.position.x;
                const dy = change.position.y - oldNode.position.y;

                if (dx !== 0 || dy !== 0) {
                     // Determine all nodes affected by this move (self + descendants)
                     const affectedNodeIds = [change.id, ...getDescendants(change.id)];

                     // Find stickies attached to ANY of these nodes
                     currentNodes.forEach(n => {
                         if (n.type === 'sticky' && n.data.targetNodeId && affectedNodeIds.includes(n.data.targetNodeId)) {
                            // Only move if not selected (to avoid double movement if both selected)
                            if (!n.selected) {
                                // CRITICAL CHECK: If sticky is a descendant of the moving node, it moves automatically.
                                // Don't move it manually to avoid double movement.
                                let isDescendant = false;
                                let currentParent = n.parentNode;
                                while(currentParent) {
                                    if (currentParent === change.id) {
                                        isDescendant = true;
                                        break;
                                    }
                                    const pNode = nodeMap.get(currentParent);
                                    currentParent = pNode ? pNode.parentNode : undefined;
                                }
                                if (isDescendant) return;

                                stickyUpdates.set(n.id, {
                                    x: n.position.x + dx,
                                    y: n.position.y + dy
                                });
                            }
                         }
                     });
                }
            }
        }
    });

    // 1. Apply all changes
    let nodesAfterChanges = applyNodeChanges(validChanges, currentNodes);

    // Apply sticky updates
    if (stickyUpdates.size > 0) {
        nodesAfterChanges = nodesAfterChanges.map(n => {
            if (stickyUpdates.has(n.id)) {
                return { ...n, position: stickyUpdates.get(n.id)! };
            }
            return n;
        });
    }

    // 2. Safety Check & Cascade Deletion
    let currentNodesResult = nodesAfterChanges;
    let previousCount = -1;

    // Iteratively remove orphans until no more are removed (handles deep nesting)
    while (currentNodesResult.length !== previousCount) {
        previousCount = currentNodesResult.length;
        const nodeIds = new Set(currentNodesResult.map(n => n.id));
        currentNodesResult = currentNodesResult.filter(n => {
            if (n.parentNode && !nodeIds.has(n.parentNode)) {
                return false; // Remove orphan
            }
            return true;
        });
    }

    // Step B: Remove Stickies connected to removed nodes
    const validNodeIds = new Set(currentNodesResult.map(n => n.id));
    currentNodesResult = currentNodesResult.filter(n => {
        if (n.type === 'sticky' && n.data.targetNodeId) {
            // If target node is not among the valid nodes, delete the sticky
            if (!validNodeIds.has(n.data.targetNodeId)) {
                return false;
            }
        }
        return true;
    });

    // 3. Update group sizes for moved or resized nodes.
    const finalNodeIds = new Set(currentNodesResult.map(n => n.id));
    const affectedGroupIds = new Set<string>();
    const finalNodeIndex = new Map(currentNodesResult.map(n => [n.id, n]));
    for (const change of validChanges) {
        const isDim = change.type === 'dimensions';
        const isPos = change.type === 'position' && change.position;
        if (!isDim && !isPos) continue;
        if (!finalNodeIds.has(change.id)) continue;
        const node = finalNodeIndex.get(change.id);
        if (node?.parentNode) affectedGroupIds.add(node.parentNode);
    }
    for (const gid of affectedGroupIds) {
        const existing = _groupSizeRafIds.get(gid);
        if (existing !== undefined) cancelAnimationFrame(existing);
        const rafId = requestAnimationFrame(() => {
            _groupSizeRafIds.delete(gid);
            get().updateGroupSize(gid);
        });
        _groupSizeRafIds.set(gid, rafId);
    }

    // 4. Cleanup Edges connected to removed nodes.
    let cleanEdges = currentEdges;
    if (currentNodesResult.length !== currentNodes.length) {
        const finalNodeIdSet = new Set(currentNodesResult.map(n => n.id));
        cleanEdges = currentEdges.filter(e => finalNodeIdSet.has(e.source) && finalNodeIdSet.has(e.target));
    }

    set({ tabs: withActiveTab(state, () => ({ nodes: currentNodesResult, edges: cleanEdges })) });

    // recalculateGameState walks every node twice. Skip it for pure mid-drag
    // streams (select + dragging:true position), which can never affect
    // derived game state.
    const isMidDragOnly = validChanges.length > 0 && validChanges.every(c =>
        c.type === 'select' ||
        (c.type === 'position' && c.dragging === true)
    );
    if (!isMidDragOnly) {
        get().recalculateGameState();
    }
  },
  onEdgesChange: (changes: EdgeChange[]) => {
    const state = get();
    const activeTab = getActiveTabFrom(state);
    const currentEdges = activeTab?.edges ?? [];
    set({
      tabs: withActiveTab(state, () => ({ edges: applyEdgeChanges(changes, currentEdges) })),
    });
  },
  onConnect: (connection: Connection) => {
    get().pushHistory();
    const state = get();
    const activeTab = getActiveTabFrom(state);
    const currentEdges = activeTab?.edges ?? [];
    const { edgeType } = state;
    set({
      tabs: withActiveTab(state, () => ({
        edges: addEdge({ ...connection, type: edgeType, markerEnd: { type: MarkerType.ArrowClosed } }, currentEdges),
      })),
    });
  },
  onReconnect: (oldEdge: ScenarioEdge, newConnection: Connection) => {
    get().pushHistory();
    const state = get();
    const activeTab = getActiveTabFrom(state);
    const currentEdges = activeTab?.edges ?? [];
    set({
      tabs: withActiveTab(state, () => ({
        edges: reconnectEdge(oldEdge, newConnection, currentEdges),
      })),
    });
  },
  addNode: (node: ScenarioNode) => {
    get().pushHistory();

    let nodeToAdd = node;
    const state = get();

    // Auto-assign variable for new Variable nodes
    if (node.type === 'variable' && !node.data.targetVariable) {
        const variableNames = Object.keys(state.gameState.variables);
        if (variableNames.length > 0) {
            nodeToAdd = {
                ...node,
                data: {
                    ...node.data,
                    targetVariable: variableNames[0]
                }
            };
        }
    }

    const activeTab = getActiveTabFrom(state);
    const currentNodes = activeTab?.nodes ?? [];
    set({ tabs: withActiveTab(state, () => ({ nodes: [...currentNodes, nodeToAdd] })) });
    get().recalculateGameState();
  },
  updateNodeData: (id: string, data: any) => {
    get().pushHistory();
    const state = get();
    // BL-4: 全タブを走査して該当 nodeId のタブのみ更新（仕様 §5.3 cross-tab update）
    set({
      tabs: state.tabs.map((t) => {
        if (!t.nodes.some((n) => n.id === id)) return t;
        return {
          ...t,
          nodes: t.nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...data } } : n)),
        };
      }),
    });
    get().recalculateGameState();
  },
  duplicateNodes: (nodesToDuplicate: ScenarioNode[]) => {
      get().pushHistory();
      const state = get();
      const activeTab = getActiveTabFrom(state);
      const currentNodes = activeTab?.nodes ?? [];
      const newIds: string[] = [];
      const newNodes: ScenarioNode[] = [];

      nodesToDuplicate.forEach(node => {
          const newNode: ScenarioNode = {
              ...node,
              id: `${node.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              position: {
                  x: node.position.x + 20,
                  y: node.position.y + 20,
              },
              data: { ...node.data, label: `${node.data.label} (Copy)` },
              selected: true,
          };
          newNodes.push(newNode);
          newIds.push(newNode.id);
      });

      // Deselect all existing nodes
      const updatedExistingNodes = currentNodes.map(n => ({ ...n, selected: false }));

      set({
          tabs: withActiveTab(state, () => ({ nodes: [...updatedExistingNodes, ...newNodes] })),
          selectedNodeId: newIds.length > 0 ? newIds[newIds.length - 1] : state.selectedNodeId
      });
      get().recalculateGameState();
      return newIds;
  },
  deleteNodes: (nodeIds: string[]) => {
      get().pushHistory();
      const state = get();
      const activeTab = getActiveTabFrom(state);
      const currentNodes = activeTab?.nodes ?? [];
      const currentEdges = activeTab?.edges ?? [];

      // Recursively find all descendants to ensure we don't leave orphans
      const idsToDelete = new Set(nodeIds);
      let changed = true;
      while (changed) {
          changed = false;
          currentNodes.forEach(node => {
              // 1. Delete descendants
              if (node.parentNode && idsToDelete.has(node.parentNode) && !idsToDelete.has(node.id)) {
                  idsToDelete.add(node.id);
                  changed = true;
              }
              // 2. Delete JumpNodes that target deleted nodes
              if (node.type === 'jump' && typeof node.data.jumpTarget === 'string' && idsToDelete.has(node.data.jumpTarget) && !idsToDelete.has(node.id)) {
                  idsToDelete.add(node.id);
                  changed = true;
              }
              if (node.type === 'jump' && node.data.jumpTarget && typeof node.data.jumpTarget === 'object' && idsToDelete.has(node.data.jumpTarget.nodeId) && !idsToDelete.has(node.id)) {
                  idsToDelete.add(node.id);
                  changed = true;
              }
              // 3. Delete StickyNodes that target deleted nodes
              if (node.type === 'sticky' && node.data.targetNodeId && idsToDelete.has(node.data.targetNodeId) && !idsToDelete.has(node.id)) {
                  idsToDelete.add(node.id);
                  changed = true;
              }
          });
      }

      // Filter out nodes
      const remainingNodes = currentNodes.filter(n => !idsToDelete.has(n.id));

      // Filter out edges connected to deleted nodes
      const remainingEdges = currentEdges.filter(e => !idsToDelete.has(e.source) && !idsToDelete.has(e.target));

      set({ tabs: withActiveTab(state, () => ({ nodes: remainingNodes, edges: remainingEdges })) });
      get().recalculateGameState();
  },
  loadScenario: (data) => {
       // H-T2: LoadScenarioInput 弁別ユニオン型により型安全に分岐
       const currentLanguage = get().language;

       // Detect format and migrate if needed
       let tabs: Tab[];
       let activeTabId: string;

       if ('tabs' in data && Array.isArray(data.tabs)) {
           // v2 タブ形式
           tabs = data.tabs as Tab[];
           activeTabId = (data.activeTabId as string | undefined) ?? (data.tabs[0] as any)?.id;
       } else {
           // v1 レガシー形式: nodes/edges at top level
           const legacyData = data as Extract<LoadScenarioInput, { nodes: unknown[] }>;
           const rawNodes = (legacyData.nodes || []) as any[];
           const cleanedNodes = rawNodes.map((node: any) => {
             const { dragging, selected, ...cleanNode } = node;
             return cleanNode;
           });
           const tabId = generateTabId();
           tabs = [{
               id: tabId,
               name: defaultTabName(1, currentLanguage),
               nodes: cleanedNodes,
               edges: (legacyData.edges || []) as any[],
           }];
           activeTabId = tabId;
       }

       const { gameState, characters, resources, edgeType } = data as Record<string, unknown> & {
         gameState?: GameState;
         characters?: CharacterData[];
         resources?: ResourceData[];
         edgeType?: string;
       };

       set({
           tabs,
           activeTabId,
           gameState: gameState || {
              currentNodes: [],
              revealedNodes: [],
              inventory: {},
              equipment: {},
              knowledge: {},
              skills: {},
              stats: {},
              variables: {},
           },
           characters: characters || [],
           resources: resources || [],
           edgeType: edgeType || 'default',
           past: [],
           future: []
       });

       // After loading, apply mode-specific behavior
       const currentMode = get().mode;
       if (currentMode === 'play') {
           // In play mode, recalculate game state to ensure consistency
           get().recalculateGameState();
       }
  },
  setMode: (mode) => {
      const state = get();
      const activeTab = getActiveTabFrom(state);
      const currentNodes = activeTab?.nodes ?? [];
      const updatedNodes = currentNodes.map(n => ({
           ...n,
           draggable: true
       }));
      set({ mode, tabs: withActiveTab(state, () => ({ nodes: updatedNodes })) });
  },

  addSticky: (targetNodeId, position) => {
      const state = get();
      state.pushHistory();
      const id = `sticky-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const activeTab = getActiveTabFrom(state);
      const currentNodes = activeTab?.nodes ?? [];
      const currentEdges = activeTab?.edges ?? [];

      const newNode: ScenarioNode = {
          id,
          type: 'sticky',
          position,
          data: {
              label: 'Sticky Note',
              targetNodeId,
          },
          draggable: true,
          width: 180,
          zIndex: 2001,
      };

      let newEdges = currentEdges;
      if (targetNodeId) {
          // Create solid straight connection edge
          const newEdge: ScenarioEdge = {
              id: `edge-${id}`,
              source: targetNodeId,
              sourceHandle: 'sticky-origin',
              target: id,
              targetHandle: 'sticky-target',
              type: 'sticky',
              zIndex: 2000,
              style: { stroke: 'rgba(217, 119, 6, 0.5)', strokeWidth: 2 },
              markerEnd: { type: MarkerType.ArrowClosed, width: 0, height: 0, color: 'transparent' },
              animated: false,
          };
          newEdges = [...newEdges, newEdge];
      }

      set({ tabs: withActiveTab(state, () => ({ nodes: [...currentNodes, newNode], edges: newEdges })) });
      get().recalculateGameState();
  },

  toggleStickies: (parentNodeId) => {
      const state = get();
      state.pushHistory();
      const activeTab = getActiveTabFrom(state);
      const currentNodes = activeTab?.nodes ?? [];

      // Check current state of first sticky to toggle
      const stickies = currentNodes.filter(n => n.type === 'sticky' && n.data.targetNodeId === parentNodeId);
      if (stickies.length === 0) return;

      // If any is visible, hide all. If all hidden, show all.
      const anyVisible = stickies.some(n => !n.hidden);
      const newHiddenState = anyVisible;

      const updatedNodes = currentNodes.map(n => {
          if (n.type === 'sticky' && n.data.targetNodeId === parentNodeId) {
              return { ...n, hidden: newHiddenState };
          }
          return n;
      });

      set({ tabs: withActiveTab(state, () => ({ nodes: updatedNodes })) });
  },

  deleteStickies: (parentNodeId) => {
      const state = get();
      state.pushHistory();
      const activeTab = getActiveTabFrom(state);
      const currentNodes = activeTab?.nodes ?? [];
      const stickies = currentNodes.filter(n => n.type === 'sticky' && n.data.targetNodeId === parentNodeId);
      if (stickies.length > 0) {
          get().deleteNodes(stickies.map(n => n.id));
      }
  },

  showAllStickies: () => {
      const state = get();
      state.pushHistory();
      // Apply across all tabs so "全付箋" scope matches the menu label
      set({
          tabs: state.tabs.map((t) => ({
              ...t,
              nodes: t.nodes.map((n) => (n.type === 'sticky' ? { ...n, hidden: false } : n)),
          })),
      });
  },

  hideAllStickies: () => {
      const state = get();
      state.pushHistory();
      // Apply across all tabs so "全付箋" scope matches the menu label
      set({
          tabs: state.tabs.map((t) => ({
              ...t,
              nodes: t.nodes.map((n) => (n.type === 'sticky' ? { ...n, hidden: true } : n)),
          })),
      });
  },

  deleteAllStickiesGlobal: () => {
      const state = get();
      // Delete stickies across all tabs and update parent hasSticky flags
      const newTabs = state.tabs.map((t) => {
          const stickies = t.nodes.filter((n) => n.type === 'sticky');
          if (stickies.length === 0) return t;
          const stickyParentIds = new Set(
              stickies.map((s) => (s as any).data?.targetNodeId).filter(Boolean)
          );
          return {
              ...t,
              nodes: t.nodes
                  .filter((n) => n.type !== 'sticky')
                  .map((n) =>
                      stickyParentIds.has(n.id)
                          ? { ...n, data: { ...n.data, hasSticky: false } }
                          : n
                  ),
              edges: t.edges.filter((e) => {
                  const isStickyEdge = stickies.some(
                      (s) => s.id === e.source || s.id === e.target
                  );
                  return !isStickyEdge;
              }),
          };
      });
      state.pushHistory();
      set({ tabs: newTabs });
      get().recalculateGameState();
  },

  showAllFreeStickies: () => {
      const state = get();
      state.pushHistory();
      // Apply across all tabs so "全付箋" scope matches the menu label
      set({
          tabs: state.tabs.map((t) => ({
              ...t,
              nodes: t.nodes.map((n) =>
                  n.type === 'sticky' && !n.data.targetNodeId ? { ...n, hidden: false } : n
              ),
          })),
      });
  },

  hideAllFreeStickies: () => {
      const state = get();
      state.pushHistory();
      // Apply across all tabs so "全付箋" scope matches the menu label
      set({
          tabs: state.tabs.map((t) => ({
              ...t,
              nodes: t.nodes.map((n) =>
                  n.type === 'sticky' && !n.data.targetNodeId ? { ...n, hidden: true } : n
              ),
          })),
      });
  },

  deleteAllFreeStickies: () => {
      const state = get();
      // Delete free stickies (no targetNodeId) across all tabs
      const newTabs = state.tabs.map((t) => {
          const stickies = t.nodes.filter(
              (n) => n.type === 'sticky' && !n.data.targetNodeId
          );
          if (stickies.length === 0) return t;
          return {
              ...t,
              nodes: t.nodes.filter(
                  (n) => !(n.type === 'sticky' && !n.data.targetNodeId)
              ),
              edges: t.edges.filter((e) => {
                  const isStickyEdge = stickies.some(
                      (s) => s.id === e.source || s.id === e.target
                  );
                  return !isStickyEdge;
              }),
          };
      });
      state.pushHistory();
      set({ tabs: newTabs });
      get().recalculateGameState();
  },

  showAllNodeStickies: () => {
      const state = get();
      state.pushHistory();
      // Apply across all tabs so "全付箋" scope matches the menu label
      set({
          tabs: state.tabs.map((t) => ({
              ...t,
              nodes: t.nodes.map((n) =>
                  n.type === 'sticky' && n.data.targetNodeId ? { ...n, hidden: false } : n
              ),
          })),
      });
  },

  hideAllNodeStickies: () => {
      const state = get();
      state.pushHistory();
      // Apply across all tabs so "全付箋" scope matches the menu label
      set({
          tabs: state.tabs.map((t) => ({
              ...t,
              nodes: t.nodes.map((n) =>
                  n.type === 'sticky' && n.data.targetNodeId ? { ...n, hidden: true } : n
              ),
          })),
      });
  },

  deleteAllNodeStickies: () => {
      const state = get();
      // Delete node-attached stickies across all tabs and update parent hasSticky flags
      const newTabs = state.tabs.map((t) => {
          const stickies = t.nodes.filter(
              (n) => n.type === 'sticky' && n.data.targetNodeId
          );
          if (stickies.length === 0) return t;
          const stickyParentIds = new Set(
              stickies.map((s) => (s as any).data?.targetNodeId).filter(Boolean)
          );
          return {
              ...t,
              nodes: t.nodes
                  .filter((n) => !(n.type === 'sticky' && n.data.targetNodeId))
                  .map((n) =>
                      stickyParentIds.has(n.id)
                          ? { ...n, data: { ...n.data, hasSticky: false } }
                          : n
                  ),
              edges: t.edges.filter((e) => {
                  const isStickyEdge = stickies.some(
                      (s) => s.id === e.source || s.id === e.target
                  );
                  return !isStickyEdge;
              }),
          };
      });
      state.pushHistory();
      set({ tabs: newTabs });
      get().recalculateGameState();
  },

  hideSticky: (stickyId) => {
      const state = get();
      state.pushHistory();
      const activeTab = getActiveTabFrom(state);
      const currentNodes = activeTab?.nodes ?? [];
      const updatedNodes = currentNodes.map(n => n.id === stickyId ? { ...n, hidden: true } : n);
      set({ tabs: withActiveTab(state, () => ({ nodes: updatedNodes })) });
  },

  setSelectedNode: (idOrIds: string | string[] | null) => {
      const state = get();
      let idsToSelect: Set<string>;
      let primaryId: string | null = null;

      if (Array.isArray(idOrIds)) {
          idsToSelect = new Set(idOrIds);
          if (idOrIds.length > 0) {
              primaryId = idOrIds[idOrIds.length - 1];
          }
      } else if (idOrIds) {
          idsToSelect = new Set([idOrIds]);
          primaryId = idOrIds;
      } else {
          idsToSelect = new Set();
      }

      const activeTab = getActiveTabFrom(state);
      const currentNodes = activeTab?.nodes ?? [];
      const updatedNodes = currentNodes.map(n => ({
          ...n,
          selected: idsToSelect.has(n.id)
      }));

      set({
          selectedNodeId: primaryId,
          tabs: withActiveTab(state, () => ({ nodes: updatedNodes })),
      });
  },

  addVariable: (name, type, initialValue) => {
    get().pushHistory();
    const state = get();

    // Security check: Prevent reserved words
    if (name === '__proto__' || name === 'constructor' || name === 'prototype') {
        console.error('Reserved variable name:', name);
        return;
    }

    if (state.gameState.variables[name]) return; // Already exists

    // BL-1b: 全タブの未割当 VariableNode に Auto-assign（アクティブタブのみでは他タブに反映されない）
    const updatedTabs = state.tabs.map((tab) => ({
      ...tab,
      nodes: tab.nodes.map((node) => {
        if (node.type === 'variable' && !node.data.targetVariable) {
          return { ...node, data: { ...node.data, targetVariable: name } };
        }
        return node;
      }),
    }));

    set({
      tabs: updatedTabs,
      gameState: {
        ...state.gameState,
        variables: {
          ...state.gameState.variables,
          [name]: { name, type, value: initialValue }
        }
      }
    });
  },

  updateVariable: (name, value) => {
    const state = get();
    state.pushHistory();
    const variable = state.gameState.variables[name];
    if (!variable) return;

    let isValid = true;
    if (variable.type === 'boolean' && typeof value !== 'boolean') isValid = false;
    // Allow string for number type (for variable references)
    if (variable.type === 'number' && typeof value !== 'number' && typeof value !== 'string') isValid = false;
    if (variable.type === 'string' && typeof value !== 'string') isValid = false;

    if (!isValid) {
        console.error(`Invalid type for variable ${name}. Expected ${variable.type}, got ${typeof value}`);
        return;
    }

    set({
      gameState: {
        ...state.gameState,
        variables: {
          ...state.gameState.variables,
          [name]: { ...variable, value }
        }
      }
    });
  },

  batchRenameVariables: (renames: Record<string, string>) => {
      const state = get();
      const variables = { ...state.gameState.variables };
      let hasChanges = false;

      // Build a list of valid renames first (collision/security checks)
      const validRenames: Array<[string, string]> = [];
      Object.entries(renames).forEach(([oldName, newName]) => {
          if (oldName === newName || !variables[oldName]) return;
          // Security check
          if (newName === '__proto__' || newName === 'constructor' || newName === 'prototype') return;
          if (variables[newName]) return; // Collision check

          const variable = variables[oldName];
          delete variables[oldName];
          variables[newName] = { ...variable, name: newName };
          hasChanges = true;
          validRenames.push([oldName, newName]);
      });

      if (hasChanges) {
          // Refactor references across ALL tabs (not just active tab)
          const updatedTabs = state.tabs.map((tab) => ({
              ...tab,
              nodes: tab.nodes.map((node) => {
                  let newData = { ...node.data };
                  for (const [oldName, newName] of validRenames) {
                      const replaceRef = (text?: string) => {
                          if (!text) return text;
                          return text.replaceAll(`\${${oldName}}`, `\${${newName}}`);
                      };

                      newData.label = replaceRef(newData.label) || '';
                      newData.description = replaceRef(newData.description);
                      newData.infoValue = replaceRef(newData.infoValue);
                      newData.conditionValue = replaceRef(newData.conditionValue);

                      if (newData.conditionValue === oldName) {
                          newData.conditionValue = newName;
                      }

                      // Update targetVariable and variableValue for VariableNodes
                      if (newData.targetVariable === oldName) {
                          newData.targetVariable = newName;
                      }
                      newData.variableValue = replaceRef(newData.variableValue);

                      // Update Switch cases
                      if (newData.branches) {
                          newData.branches = newData.branches.map((b: any) => ({
                              ...b,
                              label: replaceRef(b.label) || b.label
                          }));
                      }
                  }
                  return { ...node, data: newData };
              }),
          }));

          set({
              tabs: updatedTabs,
              gameState: { ...state.gameState, variables }
          });
      }
  },

  updateVariableMetadata: (oldName, newName, newType) => {
      const state = get();
      const variables = { ...state.gameState.variables };
      const variable = variables[oldName];
      if (!variable) return;

      // If name changed, delete old and add new
      if (oldName !== newName) {
          // Security check: Prevent reserved words
          if (newName === '__proto__' || newName === 'constructor' || newName === 'prototype') {
              console.error('Reserved variable name:', newName);
              return;
          }

          if (variables[newName]) return; // Name collision
          delete variables[oldName];
          variables[newName] = { ...variable, name: newName, type: newType };

          // Helper to replace [val=OLD] with [val=NEW]
          const replaceRef = (text?: string) => {
              if (!text) return text;
              const escapedOldName = oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              const regex = new RegExp(`\\$\\{${escapedOldName}\\}`, 'g');
              return text.replace(regex, `\${${newName}}`);
          };

          // Refactor references in other variables (string types)
          Object.keys(variables).forEach(key => {
              const v = variables[key];
              if (v.type === 'string' && typeof v.value === 'string') {
                  variables[key] = {
                      ...v,
                      value: replaceRef(v.value)
                  };
              }
          });

          // BL-1a: 全タブを走査してノード参照を書き換える（アクティブタブのみでは他タブの VariableNode が古い名前のまま残る）
          const refactorNodes = (nodes: typeof state.tabs[0]['nodes']) =>
            nodes.map(node => {
              const newData = { ...node.data };

              newData.label = replaceRef(newData.label) || '';
              newData.description = replaceRef(newData.description);
              newData.infoValue = replaceRef(newData.infoValue);
              newData.conditionValue = replaceRef(newData.conditionValue);

              if (newData.conditionValue === oldName) {
                newData.conditionValue = newName;
              }

              // Update targetVariable and variableValue for VariableNodes
              if (newData.targetVariable === oldName) {
                newData.targetVariable = newName;
              }
              newData.variableValue = replaceRef(newData.variableValue);

              // Update Switch cases
              if (newData.branches) {
                newData.branches = newData.branches.map((b: any) => ({
                  ...b,
                  label: replaceRef(b.label) || b.label,
                }));
              }

              return { ...node, data: newData };
            });

          set({
              tabs: state.tabs.map((t) => ({ ...t, nodes: refactorNodes(t.nodes) })),
              gameState: { ...state.gameState, variables }
          });
      }
  },

  deleteVariable: (name) => {
    get().pushHistory();
    const state = get();
    const newVariables = { ...state.gameState.variables };
    delete newVariables[name];

    // Clear targetVariable references across ALL tabs (not just active tab)
    const updatedTabs = state.tabs.map((tab) => ({
        ...tab,
        nodes: tab.nodes.map((node) => {
            if (node.type === 'variable' && node.data.targetVariable === name) {
                return {
                    ...node,
                    data: {
                        ...node.data,
                        targetVariable: undefined
                    }
                };
            }
            return node;
        }),
    }));

    set({
      tabs: updatedTabs,
      gameState: {
        ...state.gameState,
        variables: newVariables
      }
    });
  },

  resetGame: () => {
    const state = get();
    // Unreveal all nodes across all tabs
    const newTabs = state.tabs.map((t) => ({
        ...t,
        nodes: t.nodes.map((n) => ({ ...n, data: { ...n.data, revealed: false } })),
    }));

    set({
        tabs: newTabs,
        gameState: {
            currentNodes: [],
            revealedNodes: [],
            inventory: {},
            equipment: {},
            knowledge: {},
            skills: {},
            stats: {},
            variables: state.gameState.variables,
        }
    });
    get().recalculateGameState();
  },

  recalculateGameState: () => {
      const state = get();
      // Walk all tabs' nodes — gameState is global across tabs
      const allNodes = state.tabs.flatMap((t) => t.nodes);
      const newInventory: Record<string, number> = {};
      const newEquipment: Record<string, number> = {};
      const newKnowledge: Record<string, number> = {};
      const newSkills: Record<string, number> = {};
      const newStats: Record<string, number> = {};

      // 1. Scan all Element nodes to populate keys (init 0)
      allNodes.forEach(node => {
          if (node.type === 'element' || node.type === 'information') {
              let type: string = node.data.infoType || 'knowledge';
              let name = node.data.infoValue;

              // Resolve from resource if available
              if (node.type === 'element' && node.data.referenceId) {
                 const res = state.resources.find(r => r.id === node.data.referenceId);
                 if (res) {
                     name = res.name;
                     switch(res.type) {
                         case 'Item': type = 'item'; break;
                         case 'Equipment': type = 'equipment'; break;
                         case 'Knowledge': type = 'knowledge'; break;
                         case 'Skill': type = 'skill'; break;
                         case 'Status': type = 'stat'; break;
                         default: type = 'knowledge';
                     }
                 }
              }

              if (name) {
                  if (type === 'item') {
                      if (newInventory[name] === undefined) newInventory[name] = 0;
                  } else if (type === 'equipment') {
                      if (newEquipment[name] === undefined) newEquipment[name] = 0;
                  } else if (type === 'skill') {
                      if (newSkills[name] === undefined) newSkills[name] = 0;
                  } else if (type === 'stat') {
                      if (newStats[name] === undefined) newStats[name] = 0;
                  } else {
                      if (newKnowledge[name] === undefined) newKnowledge[name] = 0;
                  }
              }
          }
      });

      // 2. Scan revealed nodes to update quantities
      allNodes.forEach(node => {
          if (node.data.revealed && (node.type === 'element' || node.type === 'information')) {
               let type: string = node.data.infoType || 'knowledge';
               let name = node.data.infoValue;
               const quantity = Number(node.data.quantity) || 1;
               const action = node.data.actionType || 'obtain';

              // Resolve from resource if available
              if (node.type === 'element' && node.data.referenceId) {
                 const res = state.resources.find(r => r.id === node.data.referenceId);
                 if (res) {
                     name = res.name;
                     switch(res.type) {
                         case 'Item': type = 'item'; break;
                         case 'Equipment': type = 'equipment'; break;
                         case 'Knowledge': type = 'knowledge'; break;
                         case 'Skill': type = 'skill'; break;
                         case 'Status': type = 'stat'; break;
                         default: type = 'knowledge';
                     }
                 }
              }

              if (name) {
                  let collection = newKnowledge;
                  if (type === 'item') collection = newInventory;
                  else if (type === 'equipment') collection = newEquipment;
                  else if (type === 'skill') collection = newSkills;
                  else if (type === 'stat') collection = newStats;

                  if (action === 'obtain') {
                      collection[name] = (collection[name] || 0) + quantity;
                  } else if (action === 'consume') {
                      collection[name] = Math.max(0, (collection[name] || 0) - quantity);
                  }
              }
          }
      });

      // 3. Update sticky status on nodes across all tabs
      // Each tab is self-contained: sticky targets only reference nodes in the same tab.
      let tabsChanged = false;
      const updatedTabs = state.tabs.map((t) => {
          const stickyTargets = new Set<string>();
          t.nodes.forEach((n) => {
              if (n.type === 'sticky' && n.data.targetNodeId) {
                  stickyTargets.add(n.data.targetNodeId);
              }
          });

          const newNodes = t.nodes.map((n) => {
              const hasSticky = stickyTargets.has(n.id);
              if (n.data.hasSticky !== hasSticky) {
                  return { ...n, data: { ...n.data, hasSticky } };
              }
              return n;
          });

          const hasChanges = newNodes.some((n, i) => n !== t.nodes[i]);
          if (!hasChanges) return t;
          tabsChanged = true;
          return { ...t, nodes: newNodes };
      });

      const updates: Partial<ScenarioState> = {
          gameState: {
              ...state.gameState,
              inventory: newInventory,
              equipment: newEquipment,
              knowledge: newKnowledge,
              skills: newSkills,
              stats: newStats
          }
      };

      if (tabsChanged) {
          updates.tabs = updatedTabs;
      }

      set(updates);
  },

  revealAll: () => {
      get().pushHistory();
      const state = get();
      let newVariables = { ...state.gameState.variables };

      // Reveal nodes across all tabs; variable side-effects accumulate globally
      const newTabs = state.tabs.map((t) => {
          const updatedNodes = t.nodes.map((node) => {
              if (node.data.revealed) return node;

              let updatedData = { ...node.data, revealed: true };

              // Handle VariableNode logic
              if (node.type === 'variable') {
                  const targetVar = node.data.targetVariable;
                  const valueExpr = node.data.variableValue;

                  if (targetVar && newVariables[targetVar]) {
                      const currentVar = newVariables[targetVar];
                      updatedData.previousValue = currentVar.value;

                      let newValue: any = valueExpr;

                      if (typeof valueExpr === 'string') {
                          const resolvedValue = evaluateFormula(valueExpr, newVariables);

                          if (currentVar.type === 'number') {
                              const num = Number(resolvedValue);
                              if (!isNaN(num)) newValue = num;
                          } else if (currentVar.type === 'boolean') {
                              newValue = String(resolvedValue) === 'true';
                          } else {
                              newValue = String(resolvedValue);
                          }
                      } else {
                          newValue = valueExpr;
                      }

                      newVariables[targetVar] = { ...currentVar, value: newValue };
                  }
              }

              return { ...node, data: updatedData };
          });
          return { ...t, nodes: updatedNodes };
      });

      set({
          tabs: newTabs,
          gameState: { ...state.gameState, variables: newVariables }
      });
      get().recalculateGameState();
  },

  unrevealAll: () => {
      get().pushHistory();
      const state = get();
      let newVariables = { ...state.gameState.variables };

      // Unreveal nodes across all tabs; variable restorations accumulate globally
      const newTabs = state.tabs.map((t) => {
          const updatedNodes = t.nodes.map((node) => {
              if (!node.data.revealed) return node;

              let updatedData = { ...node.data, revealed: false };

              // Handle VariableNode logic
              if (node.type === 'variable') {
                  const targetVar = node.data.targetVariable;

                  if (targetVar && newVariables[targetVar]) {
                      const currentVar = newVariables[targetVar];

                      // Restore previous value
                      if (updatedData.previousValue !== undefined) {
                          newVariables[targetVar] = { ...currentVar, value: updatedData.previousValue };
                      }
                  }
                  // Always clear previousValue to prevent stale state
                  updatedData.previousValue = undefined;
              }

              return { ...node, data: updatedData };
          });
          return { ...t, nodes: updatedNodes };
      });

      set({
          tabs: newTabs,
          gameState: { ...state.gameState, variables: newVariables }
      });
      get().recalculateGameState();
  },

  triggerNode: (_nodeId: string) => {
    // No-op placeholder for legacy callers; reveal flow handles state changes.
  },

  toggleNodeState: (nodeId: string) => {
    const state = get();
    state.pushHistory();

    const activeTab = getActiveTabFrom(state);
    const currentNodes = activeTab?.nodes ?? [];
    const targetNode = currentNodes.find((n) => n.id === nodeId);
    if (!targetNode) return;

    const isRevealed = !targetNode.data.revealed;
    let newGameState = { ...state.gameState };
    let newVariables = { ...newGameState.variables };

    // Helper to find all descendants
    const getDescendants = (parentId: string, nodes: ScenarioNode[]): string[] => {
        let descendants: string[] = [];
        const children = nodes.filter(n => n.parentNode === parentId);
        children.forEach(child => {
            descendants.push(child.id);
            descendants = [...descendants, ...getDescendants(child.id, nodes)];
        });
        return descendants;
    };

    const descendants = getDescendants(nodeId, currentNodes);
    const nodesToUpdate = [targetNode.id, ...descendants];

    const updatedNodes = currentNodes.map(node => {
        if (!nodesToUpdate.includes(node.id)) return node;

        // Skip if state is already matching (to avoid double execution of side effects)
        if (node.data.revealed === isRevealed) return node;

        let updatedData = { ...node.data, revealed: isRevealed };

        // Logic for VariableNode
        if (node.type === 'variable') {
            const targetVar = node.data.targetVariable;
            const valueExpr = node.data.variableValue;

            if (targetVar && newVariables[targetVar]) {
                const currentVar = newVariables[targetVar];

                if (isRevealed) {
                    // Apply: Save previous value and assign new
                    updatedData.previousValue = currentVar.value;

                    let newValue: any = valueExpr;

                    if (typeof valueExpr === 'string') {
                        const resolvedValue = evaluateFormula(valueExpr, newVariables);

                        if (currentVar.type === 'number') {
                            const num = Number(resolvedValue);
                            if (!isNaN(num)) newValue = num;
                        } else if (currentVar.type === 'boolean') {
                            newValue = String(resolvedValue) === 'true';
                        } else {
                            newValue = String(resolvedValue);
                        }
                    } else {
                        newValue = valueExpr;
                    }

                    newVariables[targetVar] = { ...currentVar, value: newValue };
                } else {
                    // Revert: Restore previous value
                    if (updatedData.previousValue !== undefined) {
                        newVariables[targetVar] = { ...currentVar, value: updatedData.previousValue };
                        updatedData.previousValue = undefined;
                    }
                }
            }
        }

        return { ...node, data: updatedData };
    });

    set({
        tabs: withActiveTab(state, () => ({ nodes: updatedNodes })),
        gameState: { ...newGameState, variables: newVariables }
    });

    get().recalculateGameState();
  },

  updateNodeStyle: (nodeId: string, style: any) => {
      const state = get();
      const activeTab = getActiveTabFrom(state);
      const currentNodes = activeTab?.nodes ?? [];
      const node = currentNodes.find(n => n.id === nodeId);
      if (!node) return;

      // Check if style is actually different
      const currentStyle = node.style || {};
      const hasChanged = Object.entries(style).some(([key, value]) => (currentStyle as any)[key] !== value);

      if (hasChanged) {
          set({
              tabs: withActiveTab(state, () => ({
                  nodes: currentNodes.map(n =>
                      n.id === nodeId ? { ...n, style: { ...n.style, ...style } } : n
                  ),
              })),
          });
      }
  },

  toggleGroup: (nodeId: string) => {
      const state = get();
      const activeTab = getActiveTabFrom(state);
      const currentNodes = activeTab?.nodes ?? [];
      const currentEdges = activeTab?.edges ?? [];
      const node = currentNodes.find((n) => n.id === nodeId);
      if (!node || node.type !== 'group') return;

      const isExpanded = !!node.data.expanded;
      const willCollapse = isExpanded; // If currently expanded, we are collapsing

      let updatedEdges = [...currentEdges];

      if (willCollapse) {
          // Collapsing: Find edges connected to children and create "virtual" edges to the group
          const childrenIds = currentNodes.filter(n => n.parentNode === nodeId).map(n => n.id);

          // Find edges where one end is in the group and the other is outside
          const relevantEdges = currentEdges.filter(e =>
              (childrenIds.includes(e.source) && !childrenIds.includes(e.target)) ||
              (childrenIds.includes(e.target) && !childrenIds.includes(e.source))
          );

          relevantEdges.forEach(edge => {
              const isSourceInGroup = childrenIds.includes(edge.source);

              const newEdge: ScenarioEdge = {
                  id: `virtual-${edge.id}`,
                  source: isSourceInGroup ? nodeId : edge.source,
                  target: isSourceInGroup ? edge.target : nodeId,
                  sourceHandle: isSourceInGroup ? undefined : edge.sourceHandle,
                  targetHandle: isSourceInGroup ? edge.targetHandle : undefined,
                  data: { originalEdgeId: edge.id, isVirtual: true },
                  type: 'default',
                  animated: true,
                  style: { strokeDasharray: '5,5' }
              };
              updatedEdges.push(newEdge);
          });
      } else {
          // Expanding: Remove virtual edges
          updatedEdges = updatedEdges.filter(e => !e.data?.isVirtual);
      }

      let updatedNodes = [...currentNodes];
      const nodeMap = new Map(updatedNodes.map(n => [n.id, { ...n }]));

      if (willCollapse) {
          // Collapsing
          const hideDescendants = (parentId: string) => {
              updatedNodes.forEach(n => {
                  if (n.parentNode === parentId) {
                      const nodeItem = nodeMap.get(n.id);
                      if (nodeItem) {
                          nodeItem.hidden = true;
                          if (nodeItem.type === 'group') {
                              hideDescendants(nodeItem.id);
                          }
                      }
                  }
              });
          };

          const targetNode = nodeMap.get(nodeId);
          if (targetNode) {
              const { backgroundColor, ...restStyle } = targetNode.style || {};
              let w = 150, h = 50;
              if (targetNode.data.contentWidth) w = targetNode.data.contentWidth + 20;
              if (targetNode.data.contentHeight) h = targetNode.data.contentHeight + 20;

              targetNode.data = { ...targetNode.data, expanded: false };
              targetNode.style = {
                  ...restStyle,
                  width: w,
                  height: h,
                  zIndex: -1
              };

              hideDescendants(nodeId);
          }
          updatedNodes = Array.from(nodeMap.values());
      } else {
          // Expanding
          const targetNode = nodeMap.get(nodeId);
          if (targetNode) {
              targetNode.data = { ...targetNode.data, expanded: true };
          }

          const updateSize = (nId: string): { w: number, h: number } => {
              const n = nodeMap.get(nId);
              if (!n) return { w: 0, h: 0 };

              if (n.type !== 'group') {
                  return {
                      w: (n.style?.width as number) ?? n.width ?? 150,
                      h: (n.style?.height as number) ?? n.height ?? 50
                  };
              }

              if (!n.data.expanded) {
                  let w = 150, h = 50;
                  if (n.data.contentWidth) w = n.data.contentWidth + 20;
                  if (n.data.contentHeight) h = n.data.contentHeight + 20;

                  n.style = { ...n.style, width: w, height: h };
                  return { w, h };
              }

              const children = Array.from(nodeMap.values()).filter(child => child.parentNode === nId);

              if (children.length > 0) {
                  let maxX = 0, maxY = 0;
                  children.forEach(child => {
                      child.hidden = false;
                      const size = updateSize(child.id);
                      maxX = Math.max(maxX, child.position.x + size.w);
                      maxY = Math.max(maxY, child.position.y + size.h);
                  });

                  const padding = 40;
                  const newW = Math.max(190, maxX + padding);
                  const newH = Math.max(90, maxY + padding);

                  n.style = { ...n.style, width: newW, height: newH, zIndex: -1 };
                  return { w: newW, h: newH };
              } else {
                  const newW = 300, newH = 300;
                  n.style = { ...n.style, width: newW, height: newH, zIndex: -1 };
                  return { w: newW, h: newH };
              }
          };

          updateSize(nodeId);

          updatedNodes = Array.from(nodeMap.values());
      }

      // Overlap prevention when expanding
      if (!willCollapse) {
          const expandedGroup = updatedNodes.find(n => n.id === nodeId);
          const newWidth = Number(expandedGroup?.style?.width) || 300;
          const newHeight = Number(expandedGroup?.style?.height) || 300;

          const getAbsPos = (n: ScenarioNode, allNodes: ScenarioNode[]) => {
              let x = n.position.x;
              let y = n.position.y;
              let current = n;
              while(current.parentNode) {
                  const parent = allNodes.find(p => p.id === current.parentNode);
                  if(parent) {
                      x += parent.position.x;
                      y += parent.position.y;
                      current = parent;
                  } else {
                      break;
                  }
              }
              return { x, y };
          };

          const groupNode = currentNodes.find(n => n.id === nodeId);
          if (groupNode) {
              const groupAbs = getAbsPos(groupNode, currentNodes);

              const overlappingNodes = currentNodes.filter(n => {
                  if (n.id === nodeId) return false;

                  let p = n.parentNode;
                  let isDescendant = false;
                  while(p) {
                      if (p === nodeId) {
                          isDescendant = true;
                          break;
                      }
                      const parent = currentNodes.find(pn => pn.id === p);
                      p = parent ? parent.parentNode : undefined;
                  }
                  if (isDescendant) return false;

                  let currentParent = groupNode.parentNode;
                  let isAncestor = false;
                  while(currentParent) {
                      if (currentParent === n.id) {
                          isAncestor = true;
                          break;
                      }
                      const parent = currentNodes.find(pn => pn.id === currentParent);
                      currentParent = parent ? parent.parentNode : undefined;
                  }
                  if (isAncestor) return false;

                  const nAbs = getAbsPos(n, currentNodes);
                  const nW = n.width || 150;
                  const nH = n.height || 50;

                  return (
                      groupAbs.x < nAbs.x + nW &&
                      groupAbs.x + newWidth > nAbs.x &&
                      groupAbs.y < nAbs.y + nH &&
                      groupAbs.y + newHeight > nAbs.y
                  );
              });

              const rootsToMove = overlappingNodes.filter(n => {
                  return !n.parentNode || !overlappingNodes.some(on => on.id === n.parentNode);
              });

              if (rootsToMove.length > 0) {
                  const groupCenter = {
                      x: groupAbs.x + newWidth / 2,
                      y: groupAbs.y + newHeight / 2,
                  };
                  const shiftMap = new Map<string, { dx: number; dy: number }>();
                  rootsToMove.forEach(n => {
                      const nAbs = getAbsPos(n, currentNodes);
                      const nW = n.width || 150;
                      const nH = n.height || 50;
                      const nCenter = { x: nAbs.x + nW / 2, y: nAbs.y + nH / 2 };
                      const diffX = nCenter.x - groupCenter.x;
                      const diffY = nCenter.y - groupCenter.y;
                      const overlapX = (newWidth / 2 + nW / 2) - Math.abs(diffX);
                      const overlapY = (newHeight / 2 + nH / 2) - Math.abs(diffY);
                      let dx = 0;
                      let dy = 0;
                      if (overlapX > 0 && overlapY > 0) {
                          if (overlapY <= overlapX) {
                              dy = diffY >= 0
                                  ? (groupAbs.y + newHeight + 20) - nAbs.y
                                  : (groupAbs.y - 20) - (nAbs.y + nH);
                          } else {
                              dx = diffX >= 0
                                  ? (groupAbs.x + newWidth + 20) - nAbs.x
                                  : (groupAbs.x - 20) - (nAbs.x + nW);
                          }
                      }
                      shiftMap.set(n.id, { dx, dy });
                  });

                  updatedNodes = updatedNodes.map(n => {
                      const shift = shiftMap.get(n.id);
                      if (shift && (shift.dx !== 0 || shift.dy !== 0)) {
                          return {
                              ...n,
                              position: {
                                  x: n.position.x + shift.dx,
                                  y: n.position.y + shift.dy,
                              },
                          };
                      }
                      return n;
                  });
              }
          }
      }

      // Recompute edge visibility so edges between hidden children are also hidden
      const finalEdges = recomputeEdgeVisibility(updatedNodes, updatedEdges);

      set({ tabs: withActiveTab(state, () => ({ nodes: updatedNodes, edges: finalEdges })) });
  },

  groupNodes: (nodeIds: string[]) => {
      const state = get();
      const activeTab = getActiveTabFrom(state);
      const currentNodes = activeTab?.nodes ?? [];
      // Exclude sticky nodes from grouping
      const nodesToGroup = currentNodes.filter(n => nodeIds.includes(n.id) && n.type !== 'sticky');
      if (nodesToGroup.length === 0) return;

      // Calculate bounding box
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      nodesToGroup.forEach(n => {
          minX = Math.min(minX, n.position.x);
          minY = Math.min(minY, n.position.y);
          const w = n.width || 200;
          const h = n.height || 100;
          maxX = Math.max(maxX, n.position.x + w);
          maxY = Math.max(maxY, n.position.y + h);
      });

      const padding = 20;
      const groupX = minX - padding;
      const groupY = minY - padding;
      const groupW = (maxX - minX) + (padding * 2);
      const groupH = (maxY - minY) + (padding * 2);

      const groupId = `group-${Date.now()}`;
      const groupNode: ScenarioNode = {
          id: groupId,
          type: 'group',
          position: { x: groupX, y: groupY },
          data: { label: 'New Group', expanded: true },
          style: { width: groupW, height: groupH, zIndex: -1 },
      };

      const updatedNodes = currentNodes.map(n => {
          if (nodeIds.includes(n.id)) {
              return {
                  ...n,
                  parentNode: groupId,
                  extent: 'parent' as 'parent',
                  position: {
                      x: n.position.x - groupX,
                      y: n.position.y - groupY
                  }
              };
          }
          return n;
      });

      set({ tabs: withActiveTab(state, () => ({ nodes: [...updatedNodes, groupNode] })) });
  },

  ungroupNodes: (groupId: string) => {
      const state = get();
      const activeTab = getActiveTabFrom(state);
      const currentNodes = activeTab?.nodes ?? [];
      const groupNode = currentNodes.find(n => n.id === groupId);
      if (!groupNode) return;

      const groupPos = groupNode.position;
      const newParentId = groupNode.parentNode;

      const updatedNodes = currentNodes.map(n => {
          if (n.parentNode === groupId) {
              return {
                  ...n,
                  parentNode: newParentId,
                  extent: newParentId ? 'parent' as 'parent' : undefined,
                  position: {
                      x: n.position.x + groupPos.x,
                      y: n.position.y + groupPos.y
                  }
              };
          }
          return n;
      }).filter(n => n.id !== groupId); // Remove the group node

      set({ tabs: withActiveTab(state, () => ({ nodes: updatedNodes })) });
  },

  setNodeParent: (nodeId: string, parentId: string | undefined, position: { x: number, y: number }) => {
      const state = get();
      const activeTab = getActiveTabFrom(state);
      const currentNodes = activeTab?.nodes ?? [];
      const updatedNodes = currentNodes.map(n => {
          if (n.id === nodeId) {
              return {
                  ...n,
                  parentNode: parentId,
                  extent: parentId ? 'parent' as 'parent' : undefined,
                  position: position
              };
          }
          return n;
      });
      set({ tabs: withActiveTab(state, () => ({ nodes: updatedNodes })) });
  },

  updateGroupSize: (groupId: string, contentSize?: { width: number, height: number }) => {
      const state = get();
      const activeTab = getActiveTabFrom(state);
      const currentNodes = activeTab?.nodes ?? [];
      const groupNode = currentNodes.find(n => n.id === groupId);
      if (!groupNode || groupNode.type !== 'group') return;

      let currentContentSize = contentSize;
      if (contentSize) {
          if (groupNode.data.contentWidth !== contentSize.width || groupNode.data.contentHeight !== contentSize.height) {
             // We will update the node in the final set call
          }
      } else {
          currentContentSize = {
              width: groupNode.data.contentWidth || 0,
              height: groupNode.data.contentHeight || 0
          };
      }

      let newWidth = currentContentSize?.width || 150;
      let newHeight = currentContentSize?.height || 50;
      const padding = 40;

      let shiftX = 0;
      let shiftY = 0;

      if (groupNode.data.expanded) {
          const children = currentNodes.filter(n => n.parentNode === groupId && n.type !== 'sticky');
          if (children.length > 0) {
              let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

              children.forEach(n => {
                  const nX = n.position.x;
                  const nY = n.position.y;
                  const nW = (n.style?.width as number) ?? n.width ?? 150;
                  const nH = (n.style?.height as number) ?? n.height ?? 50;

                  minX = Math.min(minX, nX);
                  minY = Math.min(minY, nY);
                  maxX = Math.max(maxX, nX + nW);
                  maxY = Math.max(maxY, nY + nH);
              });

              if (minX < 20) {
                  shiftX = 20 - minX;
              }
              if (minY < 50) {
                  shiftY = 50 - minY;
              }

              maxX += shiftX;
              maxY += shiftY;

              const childrenWidth = maxX + padding;
              const childrenHeight = maxY + padding;

              newWidth = Math.max(newWidth + padding, childrenWidth);
              newHeight = Math.max(newHeight + padding, childrenHeight);
          } else {
              newWidth = Math.max(newWidth + padding, 300);
              newHeight = Math.max(newHeight + padding, 300);
          }
      } else {
          newWidth += 20;
          newHeight += 20;
      }

      newWidth = Math.max(newWidth, 150);
      newHeight = Math.max(newHeight, 50);

      const styleChanged = groupNode.style?.width !== newWidth || groupNode.style?.height !== newHeight;
      const dataChanged = contentSize && (groupNode.data.contentWidth !== contentSize.width || groupNode.data.contentHeight !== contentSize.height);
      const positionChanged = shiftX > 0 || shiftY > 0;

      if (styleChanged || dataChanged || positionChanged) {
          let updatedNodes = [...currentNodes];

          if (positionChanged) {
              updatedNodes = updatedNodes.map(n => {
                  if (n.id === groupId) {
                      return {
                          ...n,
                          position: {
                              x: n.position.x - shiftX,
                              y: n.position.y - shiftY
                          }
                      };
                  }
                  if (n.parentNode === groupId) {
                      return {
                          ...n,
                          position: {
                              x: n.position.x + shiftX,
                              y: n.position.y + shiftY
                          }
                      };
                  }
                  return n;
              });
          }

          // Iterative Collision Resolution
          let currentNodesResult = [...updatedNodes];
          const queue: string[] = [groupId];
          const MAX_ITERATIONS = 500;
          let iterations = 0;

          const nodeMap = new Map<string, ScenarioNode>(currentNodesResult.map(n => [n.id, n]));

          const getAbsPos = (n: ScenarioNode) => {
              let x = n.position.x;
              let y = n.position.y;
              let current = n;
              while (current.parentNode) {
                  const parent = nodeMap.get(current.parentNode);
                  if (parent) {
                      x += parent.position.x;
                      y += parent.position.y;
                      current = parent;
                  } else {
                      break;
                  }
              }
              return { x, y };
          };

          const checkRectOverlap = (r1: any, r2: any) => {
              return (
                  r1.x < r2.x + r2.width &&
                  r1.x + r1.width > r2.x &&
                  r1.y < r2.y + r2.height &&
                  r1.y + r1.height > r2.y
              );
          };

          while (queue.length > 0 && iterations < MAX_ITERATIONS) {
              iterations++;
              const pusherId = queue.shift()!;
              const pusher = nodeMap.get(pusherId);
              if (!pusher) continue;

              const pusherAbs = getAbsPos(pusher);
              let pusherW = (pusher.style?.width as number) || pusher.width || 150;
              let pusherH = (pusher.style?.height as number) || pusher.height || 50;

              if (pusherId === groupId) {
                  pusherW = newWidth;
                  pusherH = newHeight;
              }

              const pusherRect = { x: pusherAbs.x, y: pusherAbs.y, width: pusherW, height: pusherH };
              const pusherCenter = { x: pusherRect.x + pusherRect.width / 2, y: pusherRect.y + pusherRect.height / 2 };

              const overlaps = currentNodesResult.filter(n => {
                  if (n.id === pusherId) return false;
                  if (n.type === 'sticky') return false;

                  let p = n.parentNode;
                  while (p) {
                      if (p === pusherId) return false;
                      const parent = nodeMap.get(p);
                      p = parent ? parent.parentNode : undefined;
                  }

                  let currentParent = pusher.parentNode;
                  while (currentParent) {
                      if (currentParent === n.id) return false;
                      const parent = nodeMap.get(currentParent);
                      currentParent = parent ? parent.parentNode : undefined;
                  }

                  const nAbs = getAbsPos(n);
                  const nW = (n.style?.width as number) || n.width || 150;
                  const nH = (n.style?.height as number) || n.height || 50;

                  return checkRectOverlap(pusherRect, { x: nAbs.x, y: nAbs.y, width: nW, height: nH });
              });

              overlaps.forEach(n => {
                  const nAbs = getAbsPos(n);
                  const nW = (n.style?.width as number) || n.width || 150;
                  const nH = (n.style?.height as number) || n.height || 50;
                  const nCenter = { x: nAbs.x + nW / 2, y: nAbs.y + nH / 2 };

                  let dx = 0;
                  let dy = 0;

                  const diffX = nCenter.x - pusherCenter.x;
                  const diffY = nCenter.y - pusherCenter.y;

                  const overlapX = (pusherRect.width / 2 + nW / 2) - Math.abs(diffX);
                  const overlapY = (pusherRect.height / 2 + nH / 2) - Math.abs(diffY);

                  if (overlapX > 0 && overlapY > 0) {
                       if (overlapY < overlapX) {
                           if (diffY > 0) {
                               dy = (pusherRect.y + pusherRect.height + 20) - nAbs.y;
                           } else {
                               if (pusherId === groupId) {
                                   dy = (pusherRect.y + pusherRect.height + 20) - nAbs.y;
                               }
                           }
                       } else {
                           if (diffX > 0) {
                               dx = (pusherRect.x + pusherRect.width + 20) - nAbs.x;
                           } else {
                               if (pusherId === groupId) {
                                   dx = (pusherRect.x + pusherRect.width + 20) - nAbs.x;
                               }
                           }
                       }
                  }

                  if (dx === 0 && dy === 0) {
                      dy = (pusherRect.y + pusherRect.height + 20) - nAbs.y;
                  }

                  if (dx !== 0 || dy !== 0) {
                      const getDescendants = (parentId: string, allNodes: ScenarioNode[]): string[] => {
                          const children = allNodes.filter(n => n.parentNode === parentId);
                          let ids = children.map(c => c.id);
                          children.forEach(c => {
                              ids = [...ids, ...getDescendants(c.id, allNodes)];
                          });
                          return ids;
                      };
                      const affectedIds = new Set([n.id, ...getDescendants(n.id, currentNodesResult)]);

                      currentNodesResult = currentNodesResult.map(node => {
                          if (node.id === n.id) {
                              return {
                                  ...node,
                                  position: { x: node.position.x + dx, y: node.position.y + dy }
                              };
                          }
                          if (node.type === 'sticky' && node.data.targetNodeId && affectedIds.has(node.data.targetNodeId)) {
                               return {
                                  ...node,
                                  position: { x: node.position.x + dx, y: node.position.y + dy }
                              };
                          }
                          return node;
                      });
                      for (const node of currentNodesResult) {
                          if (nodeMap.get(node.id) !== node) {
                              nodeMap.set(node.id, node);
                          }
                      }
                      if (!queue.includes(n.id)) {
                          queue.push(n.id);
                      }
                  }
              });
          }

          updatedNodes = currentNodesResult;

          updatedNodes = updatedNodes.map(n => {
              if (n.id === groupId) {
                  const { backgroundColor, ...restStyle } = n.style || {};
                  return {
                      ...n,
                      data: contentSize ? { ...n.data, contentWidth: contentSize.width, contentHeight: contentSize.height } : n.data,
                      style: { ...restStyle, width: newWidth, height: newHeight }
                  };
              }
              return n;
          });
          set({ tabs: withActiveTab(state, () => ({ nodes: updatedNodes })) });

          // Recursively update parent group size
          if (groupNode.parentNode) {
              get().updateGroupSize(groupNode.parentNode);
          }
      }
  },

  bringNodeToFront: (nodeId: string) => {
      const state = get();
      const activeTab = getActiveTabFrom(state);
      const currentNodes = activeTab?.nodes ?? [];

      // 1. Identify all nodes to move (target + descendants)
      const nodesToMove = new Set<string>();
      const queue = [nodeId];

      while(queue.length > 0) {
          const id = queue.shift()!;
          if (!nodesToMove.has(id)) {
              nodesToMove.add(id);
              const children = currentNodes.filter(n => n.parentNode === id);
              children.forEach(c => queue.push(c.id));
          }
      }

      // 2. Split nodes into "stay" and "move"
      const remainingNodes: ScenarioNode[] = [];
      const movingNodes: ScenarioNode[] = [];

      currentNodes.forEach(n => {
          if (nodesToMove.has(n.id)) {
              movingNodes.push(n);
          } else {
              remainingNodes.push(n);
          }
      });

      // Optimization: Check if already at front
      const len = movingNodes.length;
      const lastNodes = currentNodes.slice(-len);
      const isAlreadyAtFront = lastNodes.length === len && lastNodes.every((n, i) => n.id === movingNodes[i].id);

      if (isAlreadyAtFront) return;

      set({ tabs: withActiveTab(state, () => ({ nodes: [...remainingNodes, ...movingNodes] })) });
  },

  resolveGroupOverlaps: (nodeId: string) => {
      const state = get();
      const activeTab = getActiveTabFrom(state);
      const currentNodes = activeTab?.nodes ?? [];
      const node = currentNodes.find(n => n.id === nodeId);
      if (!node || node.type !== 'group') return;

      let currentNodesResult = [...currentNodes];
      const queue: string[] = [nodeId];
      const MAX_ITERATIONS = 500;
      let iterations = 0;
      let hasChanges = false;

      const nodeMap = new Map<string, ScenarioNode>(currentNodesResult.map(n => [n.id, n]));

      const getAbsPos = (n: ScenarioNode) => {
          let x = n.position.x;
          let y = n.position.y;
          let current = n;
          while (current.parentNode) {
              const parent = nodeMap.get(current.parentNode);
              if (parent) {
                  x += parent.position.x;
                  y += parent.position.y;
                  current = parent;
              } else {
                  break;
              }
          }
          return { x, y };
      };

      const checkRectOverlap = (r1: any, r2: any) => {
          return (
              r1.x < r2.x + r2.width &&
              r1.x + r1.width > r2.x &&
              r1.y < r2.y + r2.height &&
              r1.y + r1.height > r2.y
          );
      };

      while (queue.length > 0 && iterations < MAX_ITERATIONS) {
          iterations++;
          const pusherId = queue.shift()!;
          const pusher = nodeMap.get(pusherId);
          if (!pusher) continue;

          const pusherAbs = getAbsPos(pusher);
          const pusherW = (pusher.style?.width as number) || pusher.width || 150;
          const pusherH = (pusher.style?.height as number) || pusher.height || 50;

          const pusherRect = { x: pusherAbs.x, y: pusherAbs.y, width: pusherW, height: pusherH };
          const pusherCenter = { x: pusherRect.x + pusherRect.width / 2, y: pusherRect.y + pusherRect.height / 2 };

          const overlaps = currentNodesResult.filter(n => {
              if (n.id === pusherId) return false;
              if (n.type !== 'group') return false;
              if (n.parentNode !== pusher.parentNode) return false;

              const nAbs = getAbsPos(n);
              const nW = (n.style?.width as number) || n.width || 150;
              const nH = (n.style?.height as number) || n.height || 50;

              return checkRectOverlap(pusherRect, { x: nAbs.x, y: nAbs.y, width: nW, height: nH });
          });

          overlaps.forEach(n => {
              const nAbs = getAbsPos(n);
              const nW = (n.style?.width as number) || n.width || 150;
              const nH = (n.style?.height as number) || n.height || 50;
              const nCenter = { x: nAbs.x + nW / 2, y: nAbs.y + nH / 2 };

              let dx = 0;
              let dy = 0;

              const diffX = nCenter.x - pusherCenter.x;
              const diffY = nCenter.y - pusherCenter.y;

              const overlapX = (pusherRect.width / 2 + nW / 2) - Math.abs(diffX);
              const overlapY = (pusherRect.height / 2 + nH / 2) - Math.abs(diffY);

              if (overlapX > 0 && overlapY > 0) {
                   if (overlapY < overlapX) {
                       if (diffY > 0) {
                           dy = (pusherRect.y + pusherRect.height + 20) - nAbs.y;
                       } else {
                           dy = -((nAbs.y + nH) - (pusherRect.y - 20));
                       }
                   } else {
                       if (diffX > 0) {
                           dx = (pusherRect.x + pusherRect.width + 20) - nAbs.x;
                       } else {
                           dx = -((nAbs.x + nW) - (pusherRect.x - 20));
                       }
                   }
              }

              if (dx === 0 && dy === 0) {
                  dy = (pusherRect.y + pusherRect.height + 20) - nAbs.y;
              }

              if (dx !== 0 || dy !== 0) {
                  currentNodesResult = currentNodesResult.map(node => {
                      if (node.id === n.id) {
                          return {
                              ...node,
                              position: { x: node.position.x + dx, y: node.position.y + dy }
                          };
                      }
                      return node;
                  });
                  for (const node of currentNodesResult) {
                      if (nodeMap.get(node.id) !== node) {
                          nodeMap.set(node.id, node);
                      }
                  }
                  if (!queue.includes(n.id)) {
                      queue.push(n.id);
                  }
                  hasChanges = true;
              }
          });
      }

      if (hasChanges) {
          set({ tabs: withActiveTab(state, () => ({ nodes: currentNodesResult })) });
          if (node.parentNode) {
              get().updateGroupSize(node.parentNode);
          }
      }
  },

  reset: () => {
    const firstTab = createInitialTab();
    set({
      tabs: [{ id: firstTab.id, name: firstTab.name, nodes: [], edges: [] }],
      activeTabId: firstTab.id,
      gameState: {
        currentNodes: [],
        revealedNodes: [],
        inventory: {},
        equipment: {},
        knowledge: {},
        skills: {},
        stats: {},
        variables: {}
      },
      characters: [],
      resources: [],
      mode: 'edit',
      past: [],
      future: [],
      selectedNodeId: null
    });
  },

  // Tab CRUD actions
  addTab: (name) => {
    const id = generateTabId();
    const trimmed = name?.trim().slice(0, 50);
    set((state) => ({
      tabs: [...state.tabs, {
        id,
        name: trimmed && trimmed.length > 0 ? trimmed : defaultTabName(state.tabs.length + 1, state.language),
        nodes: [],
        edges: [],
      }],
    }));
    get().pushHistory();
    return id;
  },

  renameTab: (id, newName) => {
    const trimmed = newName.trim().slice(0, 50);
    if (!trimmed) return;
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === id ? { ...t, name: trimmed } : t)),
    }));
    get().pushHistory();
  },

  deleteTab: (id) => {
    const state = get();
    if (state.tabs.length <= 1) return;
    const idx = state.tabs.findIndex((t) => t.id === id);
    if (idx < 0) return;

    const newTabs = state.tabs
      .filter((t) => t.id !== id)
      .map((t) => ({
        ...t,
        nodes: t.nodes.map((n) => {
          if (n.type !== 'jump') return n;
          const jt = (n as any).data?.jumpTarget;
          if (jt && typeof jt === 'object' && jt.tabId === id) {
            return { ...n, data: { ...(n as any).data, jumpTarget: null } };
          }
          return n;
        }),
      }));

    let nextActiveId = state.activeTabId;
    if (state.activeTabId === id) {
      const nextIdx = idx < state.tabs.length - 1 ? idx + 1 : idx - 1;
      nextActiveId = state.tabs[nextIdx].id;
    }

    set({ tabs: newTabs, activeTabId: nextActiveId, selectedNodeId: null });
    get().pushHistory();
  },

  reorderTabs: (fromIdx, toIdx) => {
    set((state) => {
      const tabs = [...state.tabs];
      const [moved] = tabs.splice(fromIdx, 1);
      tabs.splice(toIdx, 0, moved);
      return { tabs };
    });
    get().pushHistory();
  },

  setActiveTab: (id) => {
    const state = get();
    if (!state.tabs.some((t) => t.id === id)) return;
    set({ activeTabId: id, selectedNodeId: null });
  },

  moveNodesToTab: (nodeIds, targetTabId, edgeStrategy = 'delete') => {
    const state = get();
    if (state.activeTabId === targetTabId) return;
    const sourceTab = state.tabs.find((t) => t.id === state.activeTabId);
    const targetTab = state.tabs.find((t) => t.id === targetTabId);
    if (!sourceTab || !targetTab) return;

    // 1. Group の子孫ノードを BFS で再帰収集（直接子だけでなく孫以下も同伴）
    // BL-2 fix: 1階層ループでは孫(ネストグループの子)が漏れるため while-loop に変更
    const movedSet = new Set(nodeIds);
    let changed = true;
    while (changed) {
      changed = false;
      for (const n of sourceTab.nodes) {
        const parent = (n as any).parentNode;
        if (parent && movedSet.has(parent) && !movedSet.has(n.id)) {
          movedSet.add(n.id);
          changed = true;
        }
      }
    }

    // 2. Sticky 解除: 親が同伴セットに居なければ親紐付けを解除して同伴
    const movingNodes: ScenarioNode[] = [];
    for (const n of sourceTab.nodes) {
      if (!movedSet.has(n.id)) continue;
      if (n.type === 'sticky' && (n as any).parentNode && !movedSet.has((n as any).parentNode)) {
        // detach by stripping parentNode
        const { parentNode, ...rest } = n as any;
        void parentNode;
        movingNodes.push(rest as ScenarioNode);
      } else {
        movingNodes.push(n);
      }
    }
    const remainingNodes = sourceTab.nodes.filter((n) => !movedSet.has(n.id));

    // 3. エッジを 4 区分に分類
    // - innerSourceEdges: 両端が remaining (元タブに残る)
    // - innerMovingEdges: 両端が movedSet (移動先タブへ)
    // - broken: source/target の片側だけ movedSet
    const innerSourceEdges: ScenarioEdge[] = [];
    const innerMovingEdges: ScenarioEdge[] = [];
    const broken: ScenarioEdge[] = [];
    for (const e of sourceTab.edges) {
      const srcMoved = movedSet.has(e.source);
      const tgtMoved = movedSet.has(e.target);
      if (srcMoved && tgtMoved) innerMovingEdges.push(e);
      else if (!srcMoved && !tgtMoved) innerSourceEdges.push(e);
      else broken.push(e);
    }

    // 4. 分断エッジ処理
    const extraSourceNodes: any[] = [];
    const extraTargetNodes: any[] = [];
    const extraSourceEdges: any[] = [];
    const extraTargetEdges: any[] = [];

    if (edgeStrategy === 'replace-jump') {
      for (const e of broken) {
        const srcMoved = movedSet.has(e.source);
        const newJumpId = `jmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        if (!srcMoved) {
          // source は元タブに残る、target は移動先
          const sourceNode = sourceTab.nodes.find((n) => n.id === e.source);
          extraSourceNodes.push({
            id: newJumpId,
            type: 'jump',
            position: {
              x: (sourceNode?.position.x ?? 0) + 200,
              y: sourceNode?.position.y ?? 0,
            },
            data: {
              label: `Jump → ${e.target}`,
              jumpTarget: { tabId: targetTabId, nodeId: e.target },
            },
          });
          extraSourceEdges.push({ ...e, id: `${e.id}_to_jump_${newJumpId}`, target: newJumpId });
        } else {
          // source が移動先タブ、target は元タブに残る
          const sourceNode = movingNodes.find((n) => n.id === e.source);
          extraTargetNodes.push({
            id: newJumpId,
            type: 'jump',
            position: {
              x: (sourceNode?.position.x ?? 0) + 200,
              y: sourceNode?.position.y ?? 0,
            },
            data: {
              label: `Jump → ${e.target}`,
              jumpTarget: { tabId: state.activeTabId, nodeId: e.target },
            },
          });
          extraTargetEdges.push({ ...e, id: `${e.id}_to_jump_${newJumpId}`, target: newJumpId });
        }
      }
    }
    // 'delete' 戦略では broken は単純に捨てる(extraXxx は空のまま)

    // 5. タブを再構築
    const newTabs = state.tabs.map((t) => {
      if (t.id === state.activeTabId) {
        return {
          ...t,
          nodes: [...remainingNodes, ...extraSourceNodes],
          edges: [...innerSourceEdges, ...extraSourceEdges],
        };
      }
      if (t.id === targetTabId) {
        return {
          ...t,
          nodes: [...t.nodes, ...movingNodes, ...extraTargetNodes],
          edges: [...t.edges, ...innerMovingEdges, ...extraTargetEdges],
        };
      }
      return t;
    });

    // 6. 移動対象ノードを指す全タブのジャンプ参照を追従
    // H-D2: インラインロジックを共有ヘルパーに統一（retargetJumpReferencesForMove と等価）
    const finalTabs = retargetJumpReferencesForMove(newTabs, [...movedSet], targetTabId);

    set({ tabs: finalTabs, activeTabId: targetTabId, selectedNodeId: null });
    get().pushHistory();
  },

  executeJump: (target) => {
    if (!target) return;
    const state = get();
    if (target.tabId !== state.activeTabId && state.tabs.some((t) => t.id === target.tabId)) {
      set({ activeTabId: target.tabId });
    }
    set({ selectedNodeId: target.nodeId });
  },

  // LocalStorage Persistence Methods
  saveToLocalStorage: () => {
    const state = get();
    const dataToSave = {
      version: SCHEMA_VERSION,
      tabs: state.tabs,
      activeTabId: state.activeTabId,
      gameState: state.gameState,
      mode: state.mode,
      characters: state.characters,
      resources: state.resources,
      language: state.language,
      theme: state.theme,
      edgeType: state.edgeType,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
    } catch (error) {
      // H-D1: QuotaExceededError はユーザへ通知する（サイレント失敗を防止）
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        toast.error('自動保存の容量上限を超えました。古いデータを削除するかエクスポートしてください');
      } else {
        console.error('Failed to save to LocalStorage:', error);
      }
    }
  },

  loadFromLocalStorage: () => {
    if (initialStoredState) {
      set({
        tabs: initialStoredState.tabs || get().tabs,
        activeTabId: initialStoredState.activeTabId || get().activeTabId,
        gameState: initialStoredState.gameState || get().gameState,
        mode: initialStoredState.mode || get().mode,
        characters: initialStoredState.characters || get().characters,
        resources: initialStoredState.resources || get().resources,
        language: initialStoredState.language || get().language,
        theme: initialStoredState.theme || get().theme,
        edgeType: initialStoredState.edgeType || get().edgeType,
      });
    }
  },

  clearLocalStorage: () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear LocalStorage:', error);
    }
  },

  resetToInitialState: () => {
    const currentLanguage = get().language;
    const currentTheme = get().theme;
    const currentEdgeType = get().edgeType;
    const newTab = createInitialTab();

    set({
      tabs: [newTab],
      activeTabId: newTab.id,
      gameState: {
        currentNodes: [],
        revealedNodes: [],
        inventory: {},
        equipment: {},
        knowledge: {},
        skills: {},
        stats: {},
        variables: {},
      },
      mode: 'edit',
      characters: [],
      resources: [],
      past: [],
      future: [],
      selectedNodeId: null,
      // 設定は保持
      language: currentLanguage,
      theme: currentTheme,
      edgeType: currentEdgeType,
    });

    // LocalStorageも更新
    get().saveToLocalStorage();

    // ビューポートもリセット
    try {
      localStorage.setItem('canvas-viewport', JSON.stringify({ x: 0, y: 0, zoom: 1 }));
    } catch (e) { /* localStorage may be unavailable in tests */ }
  },
}));
