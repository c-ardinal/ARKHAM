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

interface ScenarioState {
  nodes: ScenarioNode[];
  edges: ScenarioEdge[];
  gameState: GameState;
  mode: 'edit' | 'play';
  selectedNodeId: string | null;

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
  loadScenario: (data: { nodes: ScenarioNode[], edges: ScenarioEdge[], gameState: GameState, characters?: CharacterData[], resources?: ResourceData[] }) => void;
  
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
  hideSticky: (stickyId: string) => void;
  
  // Bulk Sticky Operations
  // Bulk Sticky Operations
  // setStickyUpdating removed
  showAllStickies: () => void;
  hideAllStickies: () => void;
  deleteAllStickiesGlobal: () => void;
  showAllFreeStickies: () => void;
  hideAllFreeStickies: () => void;
  deleteAllFreeStickies: () => void;
  showAllNodeStickies: () => void;
  hideAllNodeStickies: () => void;
  deleteAllNodeStickies: () => void;

  // History
  past: { nodes: ScenarioNode[], edges: ScenarioEdge[], gameState: GameState }[];
  future: { nodes: ScenarioNode[], edges: ScenarioEdge[], gameState: GameState }[];
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

// Load initial state from LocalStorage
const loadInitialState = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Sanitize nodes to prevent crash due to invalid data
      if (parsed && Array.isArray(parsed.nodes)) {
          parsed.nodes = parsed.nodes.filter((n: any) => 
               n && 
               typeof n.id === 'string' && 
               n.position && 
               typeof n.position.x === 'number' && !isNaN(n.position.x) &&
               typeof n.position.y === 'number' && !isNaN(n.position.y)
          ).map((n: any) => ({
              ...n,
              selected: false // Reset selection to prevent infinite loop on reload
          }));
      }
      return parsed;
    }
  } catch (error) {
    console.error('Failed to load from LocalStorage:', error);
  }
  return null;
};

const initialStoredState = loadInitialState();

export const useScenarioStore = create<ScenarioState>((set, get) => ({
  nodes: initialStoredState?.nodes || [
    {
      id: 'memo-initial-warning',
      type: 'memo',
      position: { x: 100, y: 100 },
      data: {
        label: '注意事項 / Warnings',
        description: '・本ツールには自動保存機能が実装されています。\n ページを再読み込みしても、最後の作業状態が自動的に復元されます。\n ただし、ブラウザのキャッシュをクリアすると保存データも削除されます。\n 重要なデータは「ファイル→保存」で手動保存することをお勧めします。\n・使用例を見たい場合は、「ファイル→サンプルデータ読込」を実行して下さい。\n・その他の注意事項や使い方は「ヘルプ→マニュアル」をご覧下さい。\n\n上記を読み終わったらこのノードは削除して問題有りません。'
      },
      width: 400,
      height: 200,
      draggable: true
    }
  ],
  edges: initialStoredState?.edges || [],
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
      const nodesToDelete = state.nodes.filter(n => n.type === 'character' && n.data.referenceId === id).map(n => n.id);
      let newNodes = state.nodes;
      let newEdges = state.edges;
      if (nodesToDelete.length > 0) {
           newNodes = state.nodes.filter(n => !nodesToDelete.includes(n.id));
           newEdges = state.edges.filter(e => !nodesToDelete.includes(e.source) && !nodesToDelete.includes(e.target));
      }
      return {
          characters: state.characters.filter((c) => c.id !== id),
          nodes: newNodes,
          edges: newEdges
      };
  }),

  addResource: (res) => set((state) => ({ resources: [...state.resources, res] })),
  updateResource: (id, res) => set((state) => ({
      resources: state.resources.map((r) => (r.id === id ? { ...r, ...res } : r))
  })),
  deleteResource: (id) => set((state) => {
       const resources = state.resources.filter((r) => r.id !== id);
       const fallbackResource = resources.length > 0 ? resources[0] : null;

       const newNodes = state.nodes.map(node => {
           if ((node.type === 'element' || node.type === 'information') && node.data.referenceId === id) {
               return {
                   ...node,
                   data: {
                       ...node.data,
                       referenceId: fallbackResource ? fallbackResource.id : undefined,
                       infoValue: fallbackResource ? fallbackResource.name : 'None',
                       // Resetting infoType to fallback type might be good too if we were storing it, 
                       // but currently we derive it in recalculateGameState or use referenceId.
                   }
               };
           }
           // Resource Nodes themselves checking referenceId? 
           // Technically resource nodes also use referenceId.
           if (node.type === 'resource' && node.data.referenceId === id) {
                // If the resource node is pointing to the deleted resource, what should happen?
                // Probably should be deleted or show error. 
                // Existing logic deleted them. Let's keep deleting Resource Nodes that point to it,
                // BUT Element Nodes should be reassigned.
                return null; 
           }
           return node;
       }).filter((n): n is ScenarioNode => n !== null);
       
       const validIds = new Set(newNodes.map(n => n.id));
       const newEdges = state.edges.filter(e => validIds.has(e.source) && validIds.has(e.target));

      return {
          resources,
          nodes: newNodes,
          edges: newEdges
      };
  }),

  selectedNodeId: null,
  
  // Settings
  language: initialStoredState?.language || 'ja',
  setLanguage: (lang) => set({ language: lang }),
  theme: initialStoredState?.theme || 'dark',
  setTheme: (theme) => set({ theme }),
  edgeType: initialStoredState?.edgeType || 'default',
  setEdgeType: (type) => {
      const { edges } = get();
      // Exclude sticky note edges from the update
      const updatedEdges = edges.map(edge => {
          if (edge.targetHandle === 'sticky-target') return edge;
          return { ...edge, type };
      });
      set({ edgeType: type, edges: updatedEdges });
  },
  
  // History Implementation
  past: [],
  future: [],
  
  pushHistory: () => {
      const { nodes, edges, gameState, past } = get();
      // Deep copy to avoid reference issues
      const snapshot = {
          nodes: JSON.parse(JSON.stringify(nodes)),
          edges: JSON.parse(JSON.stringify(edges)),
          gameState: JSON.parse(JSON.stringify(gameState))
      };
      
      const newPast = [...past, snapshot].slice(-50); // Limit history
      set({ past: newPast, future: [] });
  },

  undo: () => {
      const { past, future, nodes, edges, gameState } = get();
      if (past.length === 0) return;
      
      const previous = past[past.length - 1];
      const newPast = past.slice(0, -1);
      
      set({
          nodes: previous.nodes,
          edges: previous.edges,
          gameState: previous.gameState,
          past: newPast,
          future: [{ nodes, edges, gameState }, ...future]
      });
  },

  redo: () => {
      const { past, future, nodes, edges, gameState } = get();
      if (future.length === 0) return;

      const next = future[0];
      const newFuture = future.slice(1);

      set({
          nodes: next.nodes,
          edges: next.edges,
          gameState: next.gameState,
          past: [...past, { nodes, edges, gameState }],
          future: newFuture
      });
  },

  onNodesChange: (changes: NodeChange[]) => {
    const state = get();
    
    // Filter changes if in Play Mode
    let validChanges = changes;
    if (state.mode === 'play') {
        validChanges = changes.filter(change => {
            if (change.type === 'position' || change.type === 'dimensions') {
                 const node = state.nodes.find(n => n.id === change.id);
                 if (node && node.type !== 'sticky') {
                     return false; // Prevent movement for non-sticky nodes in Play Mode
                 }
            }
            return true;
        });
    }

    // Sticky Note Following Logic (using filtered changes)
    const nodeMap = new Map(state.nodes.map(n => [n.id, n]));
    const stickyUpdates = new Map<string, {x: number, y: number}>();
    
    // Helper to find all descendant IDs
    const getDescendants = (parentId: string): string[] => {
        const children = state.nodes.filter(n => n.parentNode === parentId);
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
                     state.nodes.forEach(n => {
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
    let nodesAfterChanges = applyNodeChanges(validChanges, state.nodes);
    
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
    // Step A: Identify valid non-orphan nodes
    // We do this by checking parent existence. Iterate until stable or just once?
    // ReactFlow structure is usually flat list with parentNode pointers.
    // If we filter once, we might miss grandchildren if order is wrong? 
    // Actually, we should check against the *resulting* set of IDs.
    
    // First, map available IDs
    let currentNodes = nodesAfterChanges;
    let previousCount = -1;
    
    // Iteratively remove orphans until no more are removed (handles deep nesting)
    while (currentNodes.length !== previousCount) {
        previousCount = currentNodes.length;
        const nodeIds = new Set(currentNodes.map(n => n.id));
        currentNodes = currentNodes.filter(n => {
            if (n.parentNode && !nodeIds.has(n.parentNode)) {
                return false; // Remove orphan
            }
            return true;
        });
    }

    // Step B: Remove Stickies connected to removed nodes
    const validNodeIds = new Set(currentNodes.map(n => n.id));
    currentNodes = currentNodes.filter(n => {
        if (n.type === 'sticky' && n.data.targetNodeId) {
            // If target node is not among the valid nodes, delete the sticky
            if (!validNodeIds.has(n.data.targetNodeId)) {
                return false;
            }
        }
        return true;
    });

    // 3. Update group sizes for moved or resized nodes
    // Using filtered 'currentNodes'
    const finalNodeIds = new Set(currentNodes.map(n => n.id));
    validChanges.forEach(change => {
        if ((change.type === 'position' && change.position) || change.type === 'dimensions') {
            // Only strictly valid checks
             if (!finalNodeIds.has(change.id)) return;
             
             const node = currentNodes.find(n => n.id === change.id);
             if (node && node.parentNode) {
                setTimeout(() => {
                    get().updateGroupSize(node.parentNode!);
                }, 0);
            }
        }
    });

    // 4. Cleanup Edges connected to removed nodes
    const finalNodeIdSet = new Set(currentNodes.map(n => n.id));
    const cleanEdges = state.edges.filter(e => finalNodeIdSet.has(e.source) && finalNodeIdSet.has(e.target));

    set({ nodes: currentNodes, edges: cleanEdges });
    get().recalculateGameState();
  },
  onEdgesChange: (changes: EdgeChange[]) => {
    set({
      edges: applyEdgeChanges(changes, get().edges),
    });
  },
  onConnect: (connection: Connection) => {
    get().pushHistory();
    const { edgeType } = get();
    set({
      edges: addEdge({ ...connection, type: edgeType, markerEnd: { type: MarkerType.ArrowClosed } }, get().edges),
    });
  },
  onReconnect: (oldEdge: ScenarioEdge, newConnection: Connection) => {
    get().pushHistory();
    set({
      edges: reconnectEdge(oldEdge, newConnection, get().edges),
    });
  },
  addNode: (node: ScenarioNode) => {
    get().pushHistory();
    set({ nodes: [...get().nodes, node] });
    get().recalculateGameState();
  },
  updateNodeData: (id: string, data: any) => {
    get().pushHistory();
    set({
      nodes: get().nodes.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, ...data } } : node
      ),
    });
    get().recalculateGameState();
  },
  duplicateNodes: (nodesToDuplicate: ScenarioNode[]) => {
      get().pushHistory();
      const state = get();
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
      const updatedExistingNodes = state.nodes.map(n => ({ ...n, selected: false }));
      
      set({ 
          nodes: [...updatedExistingNodes, ...newNodes],
          selectedNodeId: newIds.length > 0 ? newIds[newIds.length - 1] : state.selectedNodeId
      });
      get().recalculateGameState();
      return newIds;
  },
  deleteNodes: (nodeIds: string[]) => {
      get().pushHistory();
      const state = get();
      
      // Recursively find all descendants to ensure we don't leave orphans
      const idsToDelete = new Set(nodeIds);
      let changed = true;
      while (changed) {
          changed = false;
          state.nodes.forEach(node => {
              // 1. Delete descendants
              if (node.parentNode && idsToDelete.has(node.parentNode) && !idsToDelete.has(node.id)) {
                  idsToDelete.add(node.id);
                  changed = true;
              }
              // 2. Delete JumpNodes that target deleted nodes
              if (node.type === 'jump' && node.data.jumpTarget && idsToDelete.has(node.data.jumpTarget) && !idsToDelete.has(node.id)) {
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
      const remainingNodes = state.nodes.filter(n => !idsToDelete.has(n.id));
      
      // Filter out edges connected to deleted nodes
      const remainingEdges = state.edges.filter(e => !idsToDelete.has(e.source) && !idsToDelete.has(e.target));

      set({ nodes: remainingNodes, edges: remainingEdges });
      get().recalculateGameState();
  },
  loadScenario: (data) => {
       const { nodes, edges, gameState, characters, resources, edgeType } = data as any; // Type assertion to allow new props
       set({ 
           nodes: nodes || [], 
           edges: edges || [], 
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
       const updatedNodes = state.nodes.map(n => ({
           ...n,
           // Enable draggable for ALL nodes in both modes to mimic Edit Mode interaction (prevents double-tap zoom),
           // but we will restrict actual movement in onNodesChange for Play Mode.
           draggable: true 
       }));
      set({ mode, nodes: updatedNodes });
  },
  
  addSticky: (targetNodeId, position) => {
      const state = get();
      state.pushHistory();
      const id = `sticky-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const newNode: ScenarioNode = {
          id,
          type: 'sticky',
          position,
          data: { 
              label: 'Sticky Note', 
              targetNodeId,
          },
          draggable: true, // Always draggable
          width: 180,
          zIndex: 2001, // Ensure sticky is above the edge (2000)
      };
      
      let newEdges = state.edges;
      if (targetNodeId) {
          // Create solid straight connection edge
          const newEdge: ScenarioEdge = {
              id: `edge-${id}`,
              source: targetNodeId,
              sourceHandle: 'sticky-origin',
              target: id,
              targetHandle: 'sticky-target',
              type: 'sticky',
              zIndex: 2000, // Ensure line is above other nodes
              style: { stroke: 'rgba(217, 119, 6, 0.5)', strokeWidth: 2 }, // Amber-600/50
              markerEnd: { type: MarkerType.ArrowClosed, width: 0, height: 0, color: 'transparent' }, // Hide arrow
              animated: false,
          };
          newEdges = [...newEdges, newEdge];
      }
      
      set({ nodes: [...state.nodes, newNode], edges: newEdges });
      get().recalculateGameState();
  },

  toggleStickies: (parentNodeId) => {
      const state = get();
      state.pushHistory();
      
      // Check current state of first sticky to toggle
      const stickies = state.nodes.filter(n => n.type === 'sticky' && n.data.targetNodeId === parentNodeId);
      if (stickies.length === 0) return;
      
      // If any is visible, hide all. If all hidden, show all.
      const anyVisible = stickies.some(n => !n.hidden);
      const newHiddenState = anyVisible; 
      
      const updatedNodes = state.nodes.map(n => {
          if (n.type === 'sticky' && n.data.targetNodeId === parentNodeId) {
              return { ...n, hidden: newHiddenState };
          }
          return n;
      });
      
      set({ nodes: updatedNodes });
  },

  deleteStickies: (parentNodeId) => {
      const state = get();
      state.pushHistory(); // Assuming we want undo support
      const stickies = state.nodes.filter(n => n.type === 'sticky' && n.data.targetNodeId === parentNodeId);
      if (stickies.length > 0) {
          get().deleteNodes(stickies.map(n => n.id));
      }
  },




  showAllStickies: () => {
      const state = get();
      state.pushHistory();
      const updatedNodes = state.nodes.map(n => n.type === 'sticky' ? { ...n, hidden: false } : n);
      set({ nodes: updatedNodes });
  },

  hideAllStickies: () => {
      const state = get();
      state.pushHistory();
      const updatedNodes = state.nodes.map(n => n.type === 'sticky' ? { ...n, hidden: true } : n);
      set({ nodes: updatedNodes });
  },

  deleteAllStickiesGlobal: () => {
      const state = get();
      const stickies = state.nodes.filter(n => n.type === 'sticky');
      if (stickies.length > 0) {
          get().deleteNodes(stickies.map(n => n.id));
      }
  },

  showAllFreeStickies: () => {
      const state = get();
      state.pushHistory();
      const updatedNodes = state.nodes.map(n => (n.type === 'sticky' && !n.data.targetNodeId) ? { ...n, hidden: false } : n);
      set({ nodes: updatedNodes });
  },
  
  hideAllFreeStickies: () => {
      const state = get();
      state.pushHistory();
      const updatedNodes = state.nodes.map(n => (n.type === 'sticky' && !n.data.targetNodeId) ? { ...n, hidden: true } : n);
      set({ nodes: updatedNodes });
  },
  
  deleteAllFreeStickies: () => {
      const state = get();
      const stickies = state.nodes.filter(n => n.type === 'sticky' && !n.data.targetNodeId);
      if (stickies.length > 0) {
          get().deleteNodes(stickies.map(n => n.id));
      }
  },

  showAllNodeStickies: () => {
      const state = get();
      state.pushHistory();
      const updatedNodes = state.nodes.map(n => (n.type === 'sticky' && n.data.targetNodeId) ? { ...n, hidden: false } : n);
      set({ nodes: updatedNodes });
  },
  
  hideAllNodeStickies: () => {
      const state = get();
      state.pushHistory();
      const updatedNodes = state.nodes.map(n => (n.type === 'sticky' && n.data.targetNodeId) ? { ...n, hidden: true } : n);
      set({ nodes: updatedNodes });
  },
  
  deleteAllNodeStickies: () => {
      const state = get();
      const stickies = state.nodes.filter(n => n.type === 'sticky' && n.data.targetNodeId);
      if (stickies.length > 0) {
          get().deleteNodes(stickies.map(n => n.id));
      }
  },

  hideSticky: (stickyId) => {
      const state = get();
      state.pushHistory();
      const updatedNodes = state.nodes.map(n => n.id === stickyId ? { ...n, hidden: true } : n);
      set({ nodes: updatedNodes });
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

      const updatedNodes = state.nodes.map(n => ({
          ...n,
          selected: idsToSelect.has(n.id)
      }));
      
      set({ 
          selectedNodeId: primaryId,
          nodes: updatedNodes
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
    
    // Auto-assign to unassigned variable nodes
    const updatedNodes = state.nodes.map(node => {
        if (node.type === 'variable' && !node.data.targetVariable) {
            return {
                ...node,
                data: { ...node.data, targetVariable: name }
            };
        }
        return node;
    });

    set({
      nodes: updatedNodes,
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
      let updatedNodes = [...state.nodes];
      let hasChanges = false;

      Object.entries(renames).forEach(([oldName, newName]) => {
          if (oldName === newName || !variables[oldName]) return;
          
          // Security check
          if (newName === '__proto__' || newName === 'constructor' || newName === 'prototype') return;

          if (variables[newName]) return; // Collision check

          const variable = variables[oldName];
          delete variables[oldName];
          variables[newName] = { ...variable, name: newName };
          hasChanges = true;

          // Refactor references
          updatedNodes = updatedNodes.map(node => {
              const newData = { ...node.data };
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
                  newData.branches = newData.branches.map(b => ({
                      ...b,
                      label: replaceRef(b.label) || b.label
                  }));
              }

              return { ...node, data: newData };
          });
      });

      if (hasChanges) {
          set({ 
              nodes: updatedNodes,
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
              // Escape special characters in oldName for regex
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

          // Refactor references in nodes
          const updatedNodes = state.nodes.map(node => {
              const newData = { ...node.data };
              
              newData.label = replaceRef(newData.label) || '';
              newData.description = replaceRef(newData.description);
              newData.infoValue = replaceRef(newData.infoValue);
              newData.conditionValue = replaceRef(newData.conditionValue);
              
              // Also check direct usage in conditionValue if it matches the variable name exactly (for switch/check)
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
                  newData.branches = newData.branches.map(b => ({
                      ...b,
                      label: replaceRef(b.label) || b.label
                  }));
              }

              return { ...node, data: newData };
          });
          
          set({ 
              nodes: updatedNodes,
              gameState: { ...state.gameState, variables }
          });
      } else {
          // Just type change - DISALLOWED by user request
          // "Variables cannot change type after creation"
          // So we do nothing here or revert?
          // The UI should prevent this, but we can enforce it here.
          // variables[oldName] = { ...variable, type: newType };
          // set({ 
          //     gameState: { ...state.gameState, variables }
          // });
      }
  },

  deleteVariable: (name) => {
    const state = get();
    const newVariables = { ...state.gameState.variables };
    delete newVariables[name];
    set({
      gameState: {
        ...state.gameState,
        variables: newVariables
      }
    });
  },
  
  resetGame: () => {
    const state = get();
    // Unreveal all nodes
    const updatedNodes = state.nodes.map(n => ({ ...n, data: { ...n.data, revealed: false } }));
    
    set({
        nodes: updatedNodes,
        gameState: {
            currentNodes: [],
            revealedNodes: [],
            inventory: {},
            equipment: {},
            knowledge: {},
            skills: {},
            stats: {},
            // Preserve variables but reset values? 
            // For now, we keep behavior of wiping, but user might want to keep definitions.
            // If we want to keep definitions, we should copy them.
            // But 'resetGame' usually implies full reset.
            // However, variables are created in Edit mode. Resetting game shouldn't delete them from Edit mode?
            // Actually, variables are part of GameState. If we wipe GameState, we wipe variables.
            // This seems to be a flaw in the original design or my understanding.
            // If variables are part of the "Scenario Definition", they should be separate from "Runtime State".
            // But here they are mixed.
            // I will try to preserve variable definitions but reset values if possible, or just wipe for now as per original.
            // Wait, if I wipe them, the Sidebar VariableList will be empty!
            // That's bad.
            // I should PRESERVE variables but reset their values?
            // Or just leave them alone?
            // If I leave them alone, they keep their modified values.
            // I'll preserve them for now to avoid deleting user work.
            variables: state.gameState.variables, 
        }
    });
    get().recalculateGameState();
  },

  recalculateGameState: () => {
      const state = get();
      const newInventory: Record<string, number> = {};
      const newEquipment: Record<string, number> = {};
      const newKnowledge: Record<string, number> = {};
      const newSkills: Record<string, number> = {};
      const newStats: Record<string, number> = {};

      // 1. Scan all Element nodes to populate keys (init 0)
      state.nodes.forEach(node => {
          if (node.type === 'element' || node.type === 'information') {
              let type: string = node.data.infoType || 'knowledge';
              let name = node.data.infoValue;
              
              // Resolve from resource if available
              if (node.type === 'element' && node.data.referenceId) {
                 const res = state.resources.find(r => r.id === node.data.referenceId);
                 if (res) {
                     name = res.name;
                     // Map ResourceType to GameState keys
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
      state.nodes.forEach(node => {
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

      // 3. Update sticky status on nodes
      const stickyTargets = new Set<string>();
      state.nodes.forEach(n => {
          if (n.type === 'sticky' && n.data.targetNodeId) {
              stickyTargets.add(n.data.targetNodeId);
          }
      });
      
      const newNodes = state.nodes.map(n => {
          const hasSticky = stickyTargets.has(n.id);
          if (n.data.hasSticky !== hasSticky) {
             return { ...n, data: { ...n.data, hasSticky } }; 
          }
          return n;
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
      
      const hasNodeChanges = newNodes.some((n, i) => n !== state.nodes[i]);
      if (hasNodeChanges) {
          updates.nodes = newNodes;
      }

      set(updates);
  },

  revealAll: () => {
      get().pushHistory();
      const state = get();
      let newVariables = { ...state.gameState.variables };
      
      const updatedNodes = state.nodes.map(node => {
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
                  
                  // Use evaluateFormula for robust substitution and calculation
                  if (typeof valueExpr === 'string') {
                      // We need to pass the *current* state of variables for evaluation.
                      // Since we are iterating, we should use newVariables which accumulates changes.
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
                      // If it's already a number/boolean in the data (unlikely for input, but possible)
                      newValue = valueExpr;
                  }

                  newVariables[targetVar] = { ...currentVar, value: newValue };
              }
          }
          
          return { ...node, data: updatedData };
      });

      set({ 
          nodes: updatedNodes,
          gameState: { ...state.gameState, variables: newVariables }
      });
      get().recalculateGameState();
  },

  unrevealAll: () => {
      get().pushHistory();
      const state = get();
      let newVariables = { ...state.gameState.variables };

      const updatedNodes = state.nodes.map(node => {
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

      set({ 
          nodes: updatedNodes,
          gameState: { ...state.gameState, variables: newVariables }
      });
      get().recalculateGameState();
  },

  triggerNode: (nodeId: string) => {
    console.log('Trigger node (Logic only)', nodeId);
  },

  toggleNodeState: (nodeId: string) => {
    const state = get();
    state.pushHistory();

    const targetNode = state.nodes.find((n) => n.id === nodeId);
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

    const descendants = getDescendants(nodeId, state.nodes);
    const nodesToUpdate = [targetNode.id, ...descendants];

    const updatedNodes = state.nodes.map(node => {
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
                        // Use current state variables (accumulated changes)
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
        nodes: updatedNodes, 
        gameState: { ...newGameState, variables: newVariables } 
    });
    
    get().recalculateGameState();
  },

  updateNodeStyle: (nodeId: string, style: any) => {
      const state = get();
      const node = state.nodes.find(n => n.id === nodeId);
      if (!node) return;

      // Check if style is actually different
      const currentStyle = node.style || {};
      const hasChanged = Object.entries(style).some(([key, value]) => (currentStyle as any)[key] !== value);

      if (hasChanged) {
          set({
              nodes: state.nodes.map(n => 
                  n.id === nodeId ? { ...n, style: { ...n.style, ...style } } : n
              )
          });
      }
  },

  toggleGroup: (nodeId: string) => {
      const state = get();
      const node = state.nodes.find((n) => n.id === nodeId);
      if (!node || node.type !== 'group') return;

      const isExpanded = !!node.data.expanded;
      const willCollapse = isExpanded; // If currently expanded, we are collapsing
      
      let updatedEdges = [...state.edges];

      if (willCollapse) {
          // Collapsing: Find edges connected to children and create "virtual" edges to the group
          const childrenIds = state.nodes.filter(n => n.parentNode === nodeId).map(n => n.id);
          
          // Find edges where one end is in the group and the other is outside
          const relevantEdges = state.edges.filter(e => 
              (childrenIds.includes(e.source) && !childrenIds.includes(e.target)) ||
              (childrenIds.includes(e.target) && !childrenIds.includes(e.source))
          );

          relevantEdges.forEach(edge => {
              const isSourceInGroup = childrenIds.includes(edge.source);
              
              const newEdge: ScenarioEdge = {
                  id: `virtual-${edge.id}`,
                  source: isSourceInGroup ? nodeId : edge.source,
                  target: isSourceInGroup ? edge.target : nodeId,
                  sourceHandle: isSourceInGroup ? undefined : edge.sourceHandle, // Group handle?
                  targetHandle: isSourceInGroup ? edge.targetHandle : undefined,
                  data: { originalEdgeId: edge.id, isVirtual: true },
                  type: 'default', // or simple bezier
                  animated: true,
                  style: { strokeDasharray: '5,5' }
              };
              updatedEdges.push(newEdge);
          });
      } else {
          // Expanding: Remove virtual edges
          updatedEdges = updatedEdges.filter(e => !e.data?.isVirtual);
      }

      let updatedNodes = [...state.nodes];
      const nodeMap = new Map(updatedNodes.map(n => [n.id, { ...n }]));

      if (willCollapse) {
          // Collapsing
          // Recursive function to hide all descendants
          const hideDescendants = (parentId: string) => {
              updatedNodes.forEach(n => {
                  if (n.parentNode === parentId) {
                      const node = nodeMap.get(n.id);
                      if (node) {
                          node.hidden = true;
                          if (node.type === 'group') {
                              hideDescendants(node.id);
                          }
                      }
                  }
              });
          };

          const targetNode = nodeMap.get(nodeId);
          if (targetNode) {
              const { backgroundColor, ...restStyle } = targetNode.style || {};
              // Calculate collapsed size
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
          // 2. Set the target node to expanded first
          const targetNode = nodeMap.get(nodeId);
          if (targetNode) {
              targetNode.data = { ...targetNode.data, expanded: true };
          }

          // 3. Recursive function to calculate size and restore visibility
          const updateSize = (nId: string): { w: number, h: number } => {
              const n = nodeMap.get(nId);
              if (!n) return { w: 0, h: 0 };
              
              if (n.type !== 'group') {
                  return { 
                      w: (n.style?.width as number) ?? n.width ?? 150,
                      h: (n.style?.height as number) ?? n.height ?? 50
                  };
              }
              
              // It is a group
              if (!n.data.expanded) {
                  // Collapsed size logic
                  let w = 150, h = 50;
                  if (n.data.contentWidth) w = n.data.contentWidth + 20;
                  if (n.data.contentHeight) h = n.data.contentHeight + 20;
                  
                  n.style = { ...n.style, width: w, height: h };
                  return { w, h };
              }
              
              // Expanded group
              const children = Array.from(nodeMap.values()).filter(child => child.parentNode === nId);
              
              if (children.length > 0) {
                  let maxX = 0, maxY = 0;
                  children.forEach(child => {
                      child.hidden = false; // Restore visibility for children of expanded group
                      const size = updateSize(child.id); // Recurse
                      maxX = Math.max(maxX, child.position.x + size.w);
                      maxY = Math.max(maxY, child.position.y + size.h);
                  });
                  
                  const padding = 40;
                  // Match updateGroupSize logic: Math.max(150 + padding, childrenWidth)
                  const newW = Math.max(190, maxX + padding);
                  const newH = Math.max(90, maxY + padding);
                  
                  n.style = { ...n.style, width: newW, height: newH, zIndex: -1 };
                  return { w: newW, h: newH };
              } else {
                  // Empty expanded group
                  const newW = 300, newH = 300;
                  n.style = { ...n.style, width: newW, height: newH, zIndex: -1 };
                  return { w: newW, h: newH };
              }
          };
          
          // 4. Trigger update from the target node
          updateSize(nodeId);
          
          updatedNodes = Array.from(nodeMap.values());
      }

      // Overlap prevention when expanding
      if (!willCollapse) {
          // Get the new size of the expanded group from the updated nodes
          const expandedGroup = updatedNodes.find(n => n.id === nodeId);
          const newWidth = Number(expandedGroup?.style?.width) || 300;
          const newHeight = Number(expandedGroup?.style?.height) || 300;

          // Helper to get absolute position
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

          // Group absolute position
          // Note: We use the current node's position. 
          // If the group itself has a parent, we need its absolute position.
          const groupNode = state.nodes.find(n => n.id === nodeId);
          if (groupNode) {
              const groupAbs = getAbsPos(groupNode, state.nodes);
              
              // Find nodes that are NOT descendants of this group and overlap with the expanded area
              const overlappingNodes = state.nodes.filter(n => {
                  if (n.id === nodeId) return false;
                  
                  // Check if n is a descendant of nodeId
                  let p = n.parentNode;
                  let isDescendant = false;
                  while(p) {
                      if (p === nodeId) {
                          isDescendant = true;
                          break;
                      }
                      const parent = state.nodes.find(pn => pn.id === p);
                      p = parent ? parent.parentNode : undefined;
                  }
                  if (isDescendant) return false;

                  // Check if n is an ancestor of nodeId (Prevent moving parent group)
                  let currentParent = groupNode.parentNode;
                  let isAncestor = false;
                  while(currentParent) {
                      if (currentParent === n.id) {
                          isAncestor = true;
                          break;
                      }
                      const parent = state.nodes.find(pn => pn.id === currentParent);
                      currentParent = parent ? parent.parentNode : undefined;
                  }
                  if (isAncestor) return false;
                  
                  const nAbs = getAbsPos(n, state.nodes);
                  const nW = n.width || 150;
                  const nH = n.height || 50;
                  
                  return (
                      groupAbs.x < nAbs.x + nW &&
                      groupAbs.x + newWidth > nAbs.x &&
                      groupAbs.y < nAbs.y + nH &&
                      groupAbs.y + newHeight > nAbs.y
                  );
              });
              
              // Filter out nodes whose parents are also moving to avoid double shifting
              const rootsToMove = overlappingNodes.filter(n => {
                  return !n.parentNode || !overlappingNodes.some(on => on.id === n.parentNode);
              });
              
              if (rootsToMove.length > 0) {
                  const shiftY = newHeight; // Shift by the new height
                  
                  updatedNodes = updatedNodes.map(n => {
                      if (rootsToMove.some(rt => rt.id === n.id)) {
                          return {
                              ...n,
                              position: {
                                  ...n.position,
                                  y: n.position.y + shiftY
                              }
                          };
                      }
                      return n;
                  });
              }
          }
      }

      set({ nodes: updatedNodes, edges: updatedEdges });
      // No need to call updateGroupSize immediately as we set the size manually
  },
  
  // ... (groupNodes, ungroupNodes, setNodeParent)

  groupNodes: (nodeIds: string[]) => {
      const state = get();
      // Exclude sticky nodes from grouping
      const nodesToGroup = state.nodes.filter(n => nodeIds.includes(n.id) && n.type !== 'sticky');
      if (nodesToGroup.length === 0) return;

      // Calculate bounding box
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      nodesToGroup.forEach(n => {
          minX = Math.min(minX, n.position.x);
          minY = Math.min(minY, n.position.y);
          // Estimate width/height if not set (default 150x50 roughly)
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

      // Update nodes to be children of group
      // ReactFlow handles relative positioning automatically if we update position?
      // No, we must update position to be relative to parent.
      const updatedNodes = state.nodes.map(n => {
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

      set({ nodes: [...updatedNodes, groupNode] });
  },

  ungroupNodes: (groupId: string) => {
      const state = get();
      const groupNode = state.nodes.find(n => n.id === groupId);
      if (!groupNode) return;

      const groupPos = groupNode.position;
      const newParentId = groupNode.parentNode;
      
      // Update children to remove parent and adjust position
      const updatedNodes = state.nodes.map(n => {
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

      set({ nodes: updatedNodes });
  },

  setNodeParent: (nodeId: string, parentId: string | undefined, position: { x: number, y: number }) => {
      const state = get();
      const updatedNodes = state.nodes.map(n => {
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
      set({ nodes: updatedNodes });
  },

  updateGroupSize: (groupId: string, contentSize?: { width: number, height: number }) => {
      const state = get();
      const groupNode = state.nodes.find(n => n.id === groupId);
      if (!groupNode || groupNode.type !== 'group') return;

      // Update content size in data if provided
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
const children = state.nodes.filter(n => n.parentNode === groupId && n.type !== 'sticky');
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

              // Check for negative expansion (children moving left/up out of group)
              // We add padding to ensure they are not right on the edge
              if (minX < 20) {
                  shiftX = 20 - minX;
              }
              if (minY < 50) { // More padding on top for header
                  shiftY = 50 - minY;
              }
              
              // Apply shift to max calculation
              maxX += shiftX;
              maxY += shiftY;

              const childrenWidth = maxX + padding;
              const childrenHeight = maxY + padding;

              newWidth = Math.max(newWidth + padding, childrenWidth);
              newHeight = Math.max(newHeight + padding, childrenHeight);
          } else {
              // No children, just content + padding
              newWidth = Math.max(newWidth + padding, 300);
              newHeight = Math.max(newHeight + padding, 300);
          }
      } else {
          // Collapsed: Content size + padding
           newWidth += 20;
           newHeight += 20;
      }

      // Ensure minimums
      newWidth = Math.max(newWidth, 150);
      newHeight = Math.max(newHeight, 50);

      // Check if update is needed
      const styleChanged = groupNode.style?.width !== newWidth || groupNode.style?.height !== newHeight;
      const dataChanged = contentSize && (groupNode.data.contentWidth !== contentSize.width || groupNode.data.contentHeight !== contentSize.height);
      const positionChanged = shiftX > 0 || shiftY > 0;

      if (styleChanged || dataChanged || positionChanged) {
          let updatedNodes = [...state.nodes];
          
          // Apply shifts if needed
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
          let currentNodes = [...updatedNodes];
          const queue: string[] = [groupId];
          const MAX_ITERATIONS = 500;
          let iterations = 0;

          // Helper to get absolute position
          const getAbsPos = (n: ScenarioNode, allNodes: ScenarioNode[]) => {
              // Always calculate from relative positions because positionAbsolute might be stale
              // during this simulation update loop.
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

          // Helper to check rect overlap
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
              // Allow re-visiting if pushed again? No, to prevent loops, maybe limit per node?
              // But a node might need to move multiple times if pushed by different sources.
              // Let's just rely on MAX_ITERATIONS for safety.
              
              const pusher = currentNodes.find(n => n.id === pusherId);
              if (!pusher) continue;

              const pusherAbs = getAbsPos(pusher, currentNodes);
              let pusherW = (pusher.style?.width as number) || pusher.width || 150;
              let pusherH = (pusher.style?.height as number) || pusher.height || 50;
              
              // Special case for the GroupNode being resized: use new dimensions
              if (pusherId === groupId) {
                  pusherW = newWidth;
                  pusherH = newHeight;
              }

              const pusherRect = { x: pusherAbs.x, y: pusherAbs.y, width: pusherW, height: pusherH };
              const pusherCenter = { x: pusherRect.x + pusherRect.width / 2, y: pusherRect.y + pusherRect.height / 2 };

              // Find overlaps
              const overlaps = currentNodes.filter(n => {
                  if (n.id === pusherId) return false;
                  if (n.type === 'sticky') return false;
                  
                  // Exclude descendants (they move with parent)
                  let p = n.parentNode;
                  while(p) {
                      if (p === pusherId) return false;
                      const parent = currentNodes.find(pn => pn.id === p);
                      p = parent ? parent.parentNode : undefined;
                  }

                  // Exclude ancestors (parent groups don't move for children)
                  let currentParent = pusher.parentNode;
                  while(currentParent) {
                      if (currentParent === n.id) return false;
                      const parent = currentNodes.find(pn => pn.id === currentParent);
                      currentParent = parent ? parent.parentNode : undefined;
                  }

                  const nAbs = getAbsPos(n, currentNodes);
                  const nW = (n.style?.width as number) || n.width || 150;
                  const nH = (n.style?.height as number) || n.height || 50;
                  
                  return checkRectOverlap(pusherRect, { x: nAbs.x, y: nAbs.y, width: nW, height: nH });
              });

              overlaps.forEach(n => {
                  const nAbs = getAbsPos(n, currentNodes);
                  const nW = (n.style?.width as number) || n.width || 150;
                  const nH = (n.style?.height as number) || n.height || 50;
                  const nCenter = { x: nAbs.x + nW / 2, y: nAbs.y + nH / 2 };

                  let dx = 0;
                  let dy = 0;

                  // Determine shift direction based on center relative position
                  // Prefer shifting Down or Right
                  const diffX = nCenter.x - pusherCenter.x;
                  const diffY = nCenter.y - pusherCenter.y;

                  // Calculate minimum shift needed
                  const overlapX = (pusherRect.width / 2 + nW / 2) - Math.abs(diffX);
                  const overlapY = (pusherRect.height / 2 + nH / 2) - Math.abs(diffY);

                  if (overlapX > 0 && overlapY > 0) {
                       // Shift in the direction of least overlap, favoring Down/Right
                       if (overlapY < overlapX) {
                           // Shift Y
                           if (diffY > 0) { // Below
                               dy = (pusherRect.y + pusherRect.height + 20) - nAbs.y;
                           } else {
                               // Above - normally we don't shift up for expansion, but if overlap exists...
                               // Ignore for now to prevent weird jumps, or shift down anyway?
                               // Let's only shift if it was "originally" below or if we are forced.
                               // For expansion, we usually only push out.
                               if (pusherId === groupId) {
                                   // If it's the expanding group, strictly push away
                                   dy = (pusherRect.y + pusherRect.height + 20) - nAbs.y;
                               }
                           }
                       } else {
                           // Shift X
                           if (diffX > 0) { // Right
                               dx = (pusherRect.x + pusherRect.width + 20) - nAbs.x;
                           } else {
                               // Left
                               if (pusherId === groupId) {
                                   dx = (pusherRect.x + pusherRect.width + 20) - nAbs.x;
                               }
                           }
                       }
                  }
                  
                  // Force check: if originally below/right logic from previous step is preferred?
                  // The previous logic used "original position". Here we use dynamic.
                  // Let's stick to "Push Down or Right" if ambiguous.
                  if (dx === 0 && dy === 0) {
                      // Fallback if centers are aligned or something
                      dy = (pusherRect.y + pusherRect.height + 20) - nAbs.y;
                  }

                  if (dx !== 0 || dy !== 0) {
                      // Determine affected nodes (pushee + descendants) to move their stickies
                      const getDescendants = (parentId: string, allNodes: ScenarioNode[]): string[] => {
                          const children = allNodes.filter(n => n.parentNode === parentId);
                          let ids = children.map(c => c.id);
                          children.forEach(c => {
                              ids = [...ids, ...getDescendants(c.id, allNodes)];
                          });
                          return ids;
                      };
                      const affectedIds = new Set([n.id, ...getDescendants(n.id, currentNodes)]);

                      currentNodes = currentNodes.map(node => {
                          if (node.id === n.id) {
                              return {
                                  ...node,
                                  position: { x: node.position.x + dx, y: node.position.y + dy }
                              };
                          }
                          // Move stickies attached to the pushed node OR its descendants
                          if (node.type === 'sticky' && node.data.targetNodeId && affectedIds.has(node.data.targetNodeId)) {
                               return {
                                  ...node,
                                  position: { x: node.position.x + dx, y: node.position.y + dy }
                              };
                          }
                          return node;
                      });
                      if (!queue.includes(n.id)) {
                          queue.push(n.id);
                      }
                  }
              });
          }
          
          updatedNodes = currentNodes;

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
          set({ nodes: updatedNodes });

          // Recursively update parent group size
          if (groupNode.parentNode) {
              get().updateGroupSize(groupNode.parentNode);
          }
      }
  },
  
  bringNodeToFront: (nodeId: string) => {
      const state = get();
      
      // 1. Identify all nodes to move (target + descendants)
      const nodesToMove = new Set<string>();
      const queue = [nodeId];
      
      while(queue.length > 0) {
          const id = queue.shift()!;
          if (!nodesToMove.has(id)) {
              nodesToMove.add(id);
              // Find children
              const children = state.nodes.filter(n => n.parentNode === id);
              children.forEach(c => queue.push(c.id));
          }
      }
      
      // 2. Split nodes into "stay" and "move"
      // We preserve the relative order of the moving nodes to maintain existing parent-child layering
      const remainingNodes: ScenarioNode[] = [];
      const movingNodes: ScenarioNode[] = [];
      
      state.nodes.forEach(n => {
          if (nodesToMove.has(n.id)) {
              movingNodes.push(n);
          } else {
              remainingNodes.push(n);
          }
      });
      
      // Optimization: Check if already at front
      const len = movingNodes.length;
      const lastNodes = state.nodes.slice(-len);
      const isAlreadyAtFront = lastNodes.length === len && lastNodes.every((n, i) => n.id === movingNodes[i].id);
      
      if (isAlreadyAtFront) return;

      set({ nodes: [...remainingNodes, ...movingNodes] });
  },

  resolveGroupOverlaps: (nodeId: string) => {
      const state = get();
      const node = state.nodes.find(n => n.id === nodeId);
      if (!node || node.type !== 'group') return;

      let currentNodes = [...state.nodes];
      const queue: string[] = [nodeId];
      const MAX_ITERATIONS = 500;
      let iterations = 0;
      let hasChanges = false;

      // Helper to get absolute position
      const getAbsPos = (n: ScenarioNode, allNodes: ScenarioNode[]) => {
          // Always calculate from relative positions
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

      // Helper to check rect overlap
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
          const pusher = currentNodes.find(n => n.id === pusherId);
          if (!pusher) continue;

          const pusherAbs = getAbsPos(pusher, currentNodes);
          const pusherW = (pusher.style?.width as number) || pusher.width || 150;
          const pusherH = (pusher.style?.height as number) || pusher.height || 50;
          
          const pusherRect = { x: pusherAbs.x, y: pusherAbs.y, width: pusherW, height: pusherH };
          const pusherCenter = { x: pusherRect.x + pusherRect.width / 2, y: pusherRect.y + pusherRect.height / 2 };

          // Find overlaps with SIBLING GROUPS only
          const overlaps = currentNodes.filter(n => {
              if (n.id === pusherId) return false;
              if (n.type !== 'group') return false; 
              if (n.parentNode !== pusher.parentNode) return false;

              const nAbs = getAbsPos(n, currentNodes);
              const nW = (n.style?.width as number) || n.width || 150;
              const nH = (n.style?.height as number) || n.height || 50;
              
              return checkRectOverlap(pusherRect, { x: nAbs.x, y: nAbs.y, width: nW, height: nH });
          });

          overlaps.forEach(n => {
              const nAbs = getAbsPos(n, currentNodes);
              const nW = (n.style?.width as number) || n.width || 150;
              const nH = (n.style?.height as number) || n.height || 50;
              const nCenter = { x: nAbs.x + nW / 2, y: nAbs.y + nH / 2 };

              let dx = 0;
              let dy = 0;

              // Determine shift direction
              const diffX = nCenter.x - pusherCenter.x;
              const diffY = nCenter.y - pusherCenter.y;

              const overlapX = (pusherRect.width / 2 + nW / 2) - Math.abs(diffX);
              const overlapY = (pusherRect.height / 2 + nH / 2) - Math.abs(diffY);

              if (overlapX > 0 && overlapY > 0) {
                   if (overlapY < overlapX) {
                       // Shift Y
                       if (diffY > 0) { // Below
                           dy = (pusherRect.y + pusherRect.height + 20) - nAbs.y;
                       } else {
                           // Above - force push down if pusher is the original mover?
                           // Or push up? Let's push away.
                           dy = -((nAbs.y + nH) - (pusherRect.y - 20));
                       }
                   } else {
                       // Shift X
                       if (diffX > 0) { // Right
                           dx = (pusherRect.x + pusherRect.width + 20) - nAbs.x;
                       } else {
                           // Left
                           dx = -((nAbs.x + nW) - (pusherRect.x - 20));
                       }
                   }
              }
              
              // Fallback
              if (dx === 0 && dy === 0) {
                  dy = (pusherRect.y + pusherRect.height + 20) - nAbs.y;
              }

              if (dx !== 0 || dy !== 0) {
                  currentNodes = currentNodes.map(node => {
                      if (node.id === n.id) {
                          return {
                              ...node,
                              position: { x: node.position.x + dx, y: node.position.y + dy }
                          };
                      }
                      return node;
                  });
                  if (!queue.includes(n.id)) {
                      queue.push(n.id);
                  }
                  hasChanges = true;
              }
          });
      }

      if (hasChanges) {
          set({ nodes: currentNodes });
          // If we moved things inside a group, update parent size
          if (node.parentNode) {
              get().updateGroupSize(node.parentNode);
          }
      }
  },
  reset: () => {
    set({
      nodes: [],
      edges: [],
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

  // LocalStorage Persistence Methods
  saveToLocalStorage: () => {
    const state = get();
    const dataToSave = {
      nodes: state.nodes,
      edges: state.edges,
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
      console.error('Failed to save to LocalStorage:', error);
    }
  },

  loadFromLocalStorage: () => {
    if (initialStoredState) {
      set({
        nodes: initialStoredState.nodes || get().nodes,
        edges: initialStoredState.edges || get().edges,
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

    set({
      nodes: [
        {
          id: 'memo-initial-warning',
          type: 'memo',
          position: { x: 100, y: 100 },
          data: {
            label: '注意事項 / Warnings',
            description: '・本ツールには自動保存機能が実装されています。\n ページを再読み込みしても、最後の作業状態が自動的に復元されます。\n ただし、ブラウザのキャッシュをクリアすると保存データも削除されます。\n 重要なデータは「ファイル→保存」で手動保存することをお勧めします。\n・使用例を見たい場合は、「ファイル→サンプルデータ読込」を実行して下さい。\n・その他の注意事項や使い方は「ヘルプ→マニュアル」をご覧下さい。\n\n上記を読み終わったらこのノードは削除して問題有りません。'
          },
          width: 400,
          height: 200,
          draggable: true
        }
      ],
      edges: [],
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
  },
}));
