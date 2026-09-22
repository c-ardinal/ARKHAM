import type { Node, Edge } from 'reactflow';

export type NodeType = 'event' | 'element' | 'branch' | 'group' | 'memo' | 'variable' | 'jump' | 'sticky' | 'character' | 'resource' | 'stage';

export interface BranchCase {
  id: string;
  label: string;
  conditionType?: 'variable' | 'item_held' | 'always';
  conditionValue?: string;
}

export interface ScenarioNodeData {
  label: string;
  description?: string;
  // For Element nodes (formerly Information)
  infoType?: 'knowledge' | 'item' | 'skill' | 'stat' | 'equipment';
  infoValue?: string; // Renamed to "Name" in UI, but keeping key for compatibility or refactor? User said "Value/Name" -> "Name". Let's keep infoValue as the internal key for Name to avoid massive refactor, or rename it. Let's keep it but treat it as Name.
  quantity?: number;
  actionType?: 'obtain' | 'consume';
  
  // For Branch nodes
  branchType?: 'if_else' | 'switch' | 'multi';
  branches?: BranchCase[]; // For switch cases, multi-branches or if/else
  conditionType?: 'variable' | 'item_held' | 'check' | string;
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
  // TODO(Task 5.2): Replace PropertyPanel shim (as any) with JumpTargetCombobox
  jumpTarget?: { tabId: string; nodeId: string } | null;

  // For Sticky nodes
  targetNodeId?: string; // If attached to a node
  hasSticky?: boolean; // If this node has an attached sticky

  // For Reference nodes (Character/Resource)
  referenceId?: string;

  // State
  revealed?: boolean;
  
  // Group Node Content Size
  contentWidth?: number;
  contentHeight?: number;

  // ARKHAM Core Engine Extensions
  chapter?: number;
  locationId?: string;
  purpose?: string;
  kpInstructions?: string[];
  investigationPoints?: import('./core/schema').InvestigationPoint[];
  readAloudText?: string;
  requiredItems?: string[];
  acquiredItems?: string[];
  consumedItems?: string[];
  resourceCheck?: import('./core/schema').ResourceCheckConfig;
  sanCheck?: import('./core/schema').SanCheckConfig; // Backward compatibility
  timeCostMinutes?: number;
  isEnding?: boolean;
  variableOperator?: 'set' | 'add' | 'subtract';
  variableOperations?: import('./core/schema').VariableOperation[];
}

export type {
  SystemConfig,
  SupportedSystemId,
  ResourceCheckConfig,
  SanCheckConfig,
} from './core/schema';
export { DEFAULT_SYSTEM_PRESETS, DEFAULT_SYSTEM_CONFIG } from './core/schema';

export interface BranchNodeData extends ScenarioNodeData {
    branchType: 'if_else' | 'switch' | 'multi';
    branches?: BranchCase[];
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
  inventory: Record<string, number>; // Name -> Quantity (Tools)
  equipment: Record<string, number>; // Name -> Quantity
  knowledge: Record<string, number>; // Name -> Quantity
  skills: Record<string, number>; // Name -> Quantity
  stats: Record<string, number>;
  variables: Record<string, Variable>;
}

export type CharacterType = 'Person' | 'Participant' | 'Monster' | 'Other';

export interface CharacterData {
  id: string;
  type: CharacterType;
  name: string;
  reading?: string;
  description?: string;
  abilities?: string;
  skills?: string;
  note?: string;
}

export type StageType = 'Location' | 'Faction' | 'Lore';

export interface StageData {
  id: string;
  type: StageType;
  name: string;
  reading?: string;
  description?: string;
  details?: string;
  note?: string;
}

export type ResourceType = 'Item' | 'Equipment' | 'Knowledge' | 'Skill' | 'Status' | 'Location';

export interface ResourceData {
  id: string;
  type: ResourceType;
  name: string;
  reading?: string;
  description?: string;
  cost?: string;
  effect?: string;
  note?: string;
}


