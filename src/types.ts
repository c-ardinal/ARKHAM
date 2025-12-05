import type { Node, Edge } from 'reactflow';

export type NodeType = 'event' | 'element' | 'branch' | 'group' | 'memo' | 'variable' | 'jump' | 'sticky';

export interface ScenarioNodeData {
  label: string;
  description?: string;
  // For Element nodes (formerly Information)
  infoType?: 'knowledge' | 'item' | 'skill' | 'stat';
  infoValue?: string; // Renamed to "Name" in UI, but keeping key for compatibility or refactor? User said "Value/Name" -> "Name". Let's keep infoValue as the internal key for Name to avoid massive refactor, or rename it. Let's keep it but treat it as Name.
  quantity?: number;
  actionType?: 'obtain' | 'consume';
  
  // For Branch nodes
  branchType?: 'if_else' | 'switch';
  branches?: { id: string; label: string }[]; // For switch cases or if/else
  conditionVariable?: string;
  conditionValue?: string; // Used for branch condition/variable
  
  // For Event nodes
  isStart?: boolean;
  
  // For Group nodes
  expanded?: boolean;
  
  // For Variable nodes
  targetVariable?: string;
  variableValue?: string;
  previousValue?: any; // To restore value when un-revealed

  // For Jump nodes
  jumpTarget?: string;

  // For Sticky nodes
  targetNodeId?: string; // If attached to a node
  hasSticky?: boolean; // If this node has an attached sticky

  // State
  revealed?: boolean;
  
  // Group Node Content Size
  contentWidth?: number;
  contentHeight?: number;
}

export interface BranchNodeData extends ScenarioNodeData {
    branchType: 'if_else' | 'switch';
    branches?: { id: string; label: string }[];
}

export interface GroupNodeData extends ScenarioNodeData {
    expanded?: boolean;
    contentWidth?: number;
    contentHeight?: number;
}

export type ScenarioNode = Node<ScenarioNodeData>;
export type ScenarioEdge = Edge;

export type VariableType = 'boolean' | 'number' | 'string';

export interface Variable {
  name: string;
  type: VariableType;
  value: any;
}

export interface GameState {
  currentNodes: string[]; // IDs of active nodes
  revealedNodes: string[]; // IDs of revealed nodes
  inventory: Record<string, number>; // Name -> Quantity
  knowledge: Record<string, number>; // Name -> Quantity
  skills: Record<string, number>; // Name -> Quantity
  stats: Record<string, number>;
  variables: Record<string, Variable>;
}
