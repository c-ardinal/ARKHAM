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

  // History
  past: { nodes: ScenarioNode[], edges: ScenarioEdge[], gameState: GameState }[];
  future: { nodes: ScenarioNode[], edges: ScenarioEdge[], gameState: GameState }[];
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
}

export const useScenarioStore = create<ScenarioState>((set, get) => ({
  nodes: [],
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

    // 3. Update group sizes for moved nodes
    changes.forEach(change => {
        if (change.type === 'position' && change.position) {
            const node = validNodes.find(n => n.id === change.id);
            if (node && node.parentNode) {
                const parentId = node.parentNode;
                const parent = validNodes.find(p => p.id === parentId);
                if (parent && parent.type === 'group' && parent.data.expanded) {
                     const children = validNodes.filter(n => n.parentNode === parentId);
                     if (children.length > 0) {
                         let maxX = 0, maxY = 0;
                         children.forEach(c => {
                             const cW = c.width || 150;
                             const cH = c.height || 50;
                             maxX = Math.max(maxX, c.position.x + cW);
                             maxY = Math.max(maxY, c.position.y + cH);
                         });
                         
                         const padding = 40;
                         const newWidth = Math.max(300, maxX + padding);
                         const newHeight = Math.max(300, maxY + padding);
                         
                         if (parent.style?.width !== newWidth || parent.style?.height !== newHeight) {
                             parent.style = { ...parent.style, width: newWidth, height: newHeight };
                         }
                     }
                }
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
      
      // Filter out nodes
      const remainingNodes = state.nodes.filter(n => !nodeIds.includes(n.id));
      
      // Filter out edges connected to deleted nodes
      const remainingEdges = state.edges.filter(e => !nodeIds.includes(e.source) && !nodeIds.includes(e.target));

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

    const node = state.nodes.find((n) => n.id === nodeId);
    if (!node) return;

    // Toggle 'revealed' state
    const isRevealed = !node.data.revealed;
    let updatedNodeData = { ...node.data, revealed: isRevealed };
    let newGameState = { ...state.gameState };
    
    // Logic for VariableNode
    if (node.type === 'variable') {
        const targetVar = node.data.targetVariable;
        const valueExpr = node.data.variableValue;
        
        if (targetVar && state.gameState.variables[targetVar]) {
            const currentVar = state.gameState.variables[targetVar];
            
            if (isRevealed) {
                // Apply: Save previous value and assign new
                updatedNodeData.previousValue = currentVar.value;
                
                let newValue: any = valueExpr;
                
                // Use evaluateFormula for robust substitution and calculation
                if (typeof valueExpr === 'string') {
                    // Use current state variables
                    const resolvedValue = evaluateFormula(valueExpr, state.gameState.variables);
                    
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
                
                newGameState.variables = {
                    ...newGameState.variables,
                    [targetVar]: { ...currentVar, value: newValue }
                };
            } else {
                // Revert: Restore previous value
                if (updatedNodeData.previousValue !== undefined) {
                    newGameState.variables = {
                        ...newGameState.variables,
                        [targetVar]: { ...currentVar, value: updatedNodeData.previousValue }
                    };
                    updatedNodeData.previousValue = undefined;
                }
            }
        }
    }

    let updatedNodes = state.nodes.map((n) => 
        n.id === nodeId ? { ...n, data: updatedNodeData } : n
    );

    // If GroupNode, toggle children as well
    if (node.type === 'group') {
        updatedNodes = updatedNodes.map(n => {
            if (n.parentNode === nodeId) {
                return { ...n, data: { ...n.data, revealed: isRevealed } };
            }
            return n;
        });
    }

    set({ nodes: updatedNodes, gameState: newGameState });
    
    // Recalculate game state for ElementNodes
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

      // Calculate new size
      let newWidth = 300;
      let newHeight = 300;
      const padding = 40;

      if (!willCollapse) {
          // Expanding: Calculate size based on children
          const children = state.nodes.filter(n => n.parentNode === nodeId);
          if (children.length > 0) {
              let maxX = -Infinity, maxY = -Infinity;
              children.forEach(c => {
                  const cW = c.width || 150;
                  const cH = c.height || 50;
                  maxX = Math.max(maxX, c.position.x + cW);
                  maxY = Math.max(maxY, c.position.y + cH);
              });
              newWidth = Math.max(newWidth, maxX + padding);
              newHeight = Math.max(newHeight, maxY + padding);
          }
          
          // Also consider content size if available
          if (node.data.contentWidth && node.data.contentHeight) {
             newWidth = Math.max(newWidth, node.data.contentWidth + padding);
             newHeight = Math.max(newHeight, node.data.contentHeight + padding);
          }
      } else {
          // Collapsing: Use content size + small padding
          if (node.data.contentWidth && node.data.contentHeight) {
              newWidth = node.data.contentWidth + 20;
              newHeight = node.data.contentHeight + 20;
          } else {
              newWidth = 150;
              newHeight = 50;
          }
      }
      
      // Ensure minimums
      newWidth = Math.max(newWidth, 150);
      newHeight = Math.max(newHeight, 50);

      let updatedNodes = state.nodes.map(n => {
          if (n.id === nodeId) {
              const { backgroundColor, ...restStyle } = n.style || {};
              return { 
                  ...n, 
                  data: { ...n.data, expanded: !isExpanded },
                  style: { 
                      ...restStyle, 
                      width: newWidth,
                      height: newHeight,
                      zIndex: -1
                  }
              };
          }
          if (n.parentNode === nodeId) {
              return { ...n, hidden: isExpanded }; 
          }
          return n;
      });

      // Overlap prevention when expanding
      if (!willCollapse) {
          // Group position
          const groupX = node.position.x;
          const groupY = node.position.y;
          
          // Find nodes that are NOT children of this group and overlap with the expanded area
          const overlappingNodes = state.nodes.filter(n => {
              if (n.id === nodeId) return false;
              if (n.parentNode === nodeId) return false; // Children are fine
              
              const nX = n.position.x;
              const nY = n.position.y;
              const nW = n.width || 150;
              const nH = n.height || 50;
              
              return (
                  groupX < nX + nW &&
                  groupX + newWidth > nX &&
                  groupY < nY + nH &&
                  groupY + newHeight > nY
              );
          });
          
          if (overlappingNodes.length > 0) {
              const shiftY = newHeight; // Shift by the new height
              
              updatedNodes = updatedNodes.map(n => {
                  if (overlappingNodes.some(on => on.id === n.id)) {
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
      
      // Find children
      // const children = state.nodes.filter(n => n.parentNode === groupId);
      
      // Update children to remove parent and adjust position
      const updatedNodes = state.nodes.map(n => {
          if (n.parentNode === groupId) {
              return {
                  ...n,
                  parentNode: undefined,
                  extent: undefined,
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
          // Only update data if changed to avoid unnecessary writes? 
          // Actually we can just use the passed value for calculation and update data if needed.
          // Let's update data if it's different so we persist it.
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

      if (groupNode.data.expanded) {
          const children = state.nodes.filter(n => n.parentNode === groupId);
          if (children.length > 0) {
              let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
              
              children.forEach(n => {
                  const nX = n.position.x;
                  const nY = n.position.y;
                  const nW = n.width || 150;
                  const nH = n.height || 50;
                  
                  minX = Math.min(minX, nX);
                  minY = Math.min(minY, nY);
                  maxX = Math.max(maxX, nX + nW);
                  maxY = Math.max(maxY, nY + nH);
              });

              const childrenWidth = maxX + padding;
              const childrenHeight = maxY + padding;

              newWidth = Math.max(newWidth + padding, childrenWidth);
              newHeight = Math.max(newHeight + padding, childrenHeight);
          } else {
              // No children, just content + padding
              // Ensure minimum size of 300x300 for empty groups
              newWidth = Math.max(newWidth + padding, 300);
              newHeight = Math.max(newHeight + padding, 300);
          }
      } else {
          // Collapsed: Content size + padding
           newWidth += 20; // Smaller padding for collapsed
           newHeight += 20;
      }

      // Ensure minimums
      newWidth = Math.max(newWidth, 150);
      newHeight = Math.max(newHeight, 50);

      // Check if update is needed
      const styleChanged = groupNode.style?.width !== newWidth || groupNode.style?.height !== newHeight;
      const dataChanged = contentSize && (groupNode.data.contentWidth !== contentSize.width || groupNode.data.contentHeight !== contentSize.height);

      if (styleChanged || dataChanged) {
          const updatedNodes = state.nodes.map(n => {
              if (n.id === groupId) {
                  // Explicitly remove backgroundColor to fix issue with persisting styles
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
      }
  }
}));
