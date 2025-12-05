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
import type { ScenarioNode, ScenarioEdge, GameState } from '../types';
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
  setSelectedNode: (id: string | null) => void;
  loadScenario: (data: { nodes: ScenarioNode[], edges: ScenarioEdge[], gameState: GameState }) => void;
  
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

  // Game Logic
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

  // History
  past: { nodes: ScenarioNode[], edges: ScenarioEdge[], gameState: GameState }[];
  future: { nodes: ScenarioNode[], edges: ScenarioEdge[], gameState: GameState }[];
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
}

export const useScenarioStore = create<ScenarioState>((set, get) => ({
  nodes: [
    {
      id: 'memo-initial-warning',
      type: 'memo',
      position: { x: 100, y: 100 },
      data: {
        label: '注意事項 / Warnings',
        description: '・本ツールにはデータの自動保存機能は有りません。\n ページ再読み込み(更新)や再アクセスをするとそれまで編集していたデータは消えます。\n データを保持したい場合は「ファイル→保存」を実行または「Ctrl+S」押下で手動保存して下さい。\n・使用例を見たい場合は、「ファイル→サンプルデータ読込」を実行して下さい。\n・その他の注意事項や使い方は「ヘルプ→マニュアル」をご覧下さい。\n\n上記を読み終わったらこのノードは削除して問題有りません。'
      },
      width: 400,
      height: 200,
    }
  ],
  edges: [],
  gameState: {
    currentNodes: [],
    revealedNodes: [],
    inventory: {},
    knowledge: {},
    skills: {},
    stats: {},
    variables: {},
  },
  mode: 'edit',
  selectedNodeId: null,
  
  // Settings
  language: 'ja', // Default to Japanese as per user preference
  setLanguage: (lang) => set({ language: lang }),
  theme: 'dark',
  setTheme: (theme) => set({ theme }),
  edgeType: 'default',
  setEdgeType: (type) => {
      const { edges } = get();
      const updatedEdges = edges.map(edge => ({ ...edge, type }));
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
    
    // 1. Apply all changes
    const nodesAfterChanges = applyNodeChanges(changes, state.nodes);
    
    // 2. Safety Check: Remove any node whose parent does not exist
    // This effectively implements cascade deletion for groups and prevents crashes
    const nodeIds = new Set(nodesAfterChanges.map(n => n.id));
    const validNodes = nodesAfterChanges.filter(n => {
        if (n.parentNode && !nodeIds.has(n.parentNode)) {
            return false; // Remove orphan
        }
        return true;
    });

    // 3. Update group sizes for moved or resized nodes
    changes.forEach(change => {
        if ((change.type === 'position' && change.position) || change.type === 'dimensions') {
            const node = validNodes.find(n => n.id === change.id);
            if (node && node.parentNode) {
                // Trigger update for the parent group
                // Use setTimeout to avoid conflicts during render cycle
                setTimeout(() => {
                    get().updateGroupSize(node.parentNode!);
                }, 0);
            }
        }
    });

    set({ nodes: validNodes });
    get().recalculateGameState();
  },
  onEdgesChange: (changes: EdgeChange[]) => {
    set({
      edges: applyEdgeChanges(changes, get().edges),
    });
  },
  onConnect: (connection: Connection) => {
    get().pushHistory();
    set({
      edges: addEdge({ ...connection, markerEnd: { type: MarkerType.ArrowClosed } }, get().edges),
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
      
      set({ nodes: [...updatedExistingNodes, ...newNodes] });
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
              if (node.parentNode && idsToDelete.has(node.parentNode) && !idsToDelete.has(node.id)) {
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
  setMode: (mode) => set({ mode }),
  setSelectedNode: (id) => set({ selectedNodeId: id }),
  loadScenario: (data) => set({ nodes: data.nodes, edges: data.edges, gameState: data.gameState }),



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
      const newKnowledge: Record<string, number> = {};
      const newSkills: Record<string, number> = {};
      const newStats: Record<string, number> = {};

      // 1. Scan all Element nodes to populate keys (init 0)
      state.nodes.forEach(node => {
          if ((node.type === 'element' || node.type === 'information') && node.data.infoValue) {
              const type = node.data.infoType || 'knowledge';
              const name = node.data.infoValue;
              
              if (type === 'item') {
                  if (newInventory[name] === undefined) newInventory[name] = 0;
              } else if (type === 'skill') {
                  if (newSkills[name] === undefined) newSkills[name] = 0;
              } else if (type === 'stat') {
                  if (newStats[name] === undefined) newStats[name] = 0;
              } else {
                  if (newKnowledge[name] === undefined) newKnowledge[name] = 0;
              }
          }
      });

      // 2. Scan revealed nodes to update quantities
      state.nodes.forEach(node => {
          if (node.data.revealed && (node.type === 'element' || node.type === 'information') && node.data.infoValue) {
              const type = node.data.infoType || 'knowledge';
              const name = node.data.infoValue;
              const quantity = Number(node.data.quantity) || 1;
              const action = node.data.actionType || 'obtain';
              
              let collection = newKnowledge;
              if (type === 'item') collection = newInventory;
              else if (type === 'skill') collection = newSkills;
              else if (type === 'stat') collection = newStats;
              
              if (action === 'obtain') {
                  collection[name] = (collection[name] || 0) + quantity;
              } else if (action === 'consume') {
                  collection[name] = Math.max(0, (collection[name] || 0) - quantity);
              }
          }
      });

      set({
          gameState: {
              ...state.gameState,
              inventory: newInventory,
              knowledge: newKnowledge,
              skills: newSkills,
              stats: newStats
          }
      });
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
      const nodesToGroup = state.nodes.filter(n => nodeIds.includes(n.id));
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
          const children = state.nodes.filter(n => n.parentNode === groupId);
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
          const MAX_ITERATIONS = 50;
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
      const MAX_ITERATIONS = 50;
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
  }
}));
