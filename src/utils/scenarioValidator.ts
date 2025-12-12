import type { ScenarioNode, ScenarioEdge, GameState } from '../types';

export interface ValidationError {
  message: string;
  path?: string; // e.g., "nodes[0].id"
  line?: number; // Approximate line number in JSON
  snippet?: string; // Code snippet around the error
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  correctedData?: any;
  corrections: string[]; // List of corrections made
}

/**
 * Validates and corrects scenario JSON data
 * @param data - The parsed JSON data
 * @returns ValidationResult with validation status, errors, warnings, and corrected data
 */
export function validateScenarioData(data: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const corrections: string[] = [];
  let correctedData = { ...data };

  // 1. Check if data is an object
  if (typeof data !== 'object' || data === null) {
    return {
      isValid: false,
      errors: ['データがオブジェクトではありません'],
      warnings: [],
      corrections: []
    };
  }

  // 2. Validate nodes array
  if (!Array.isArray(data.nodes)) {
    errors.push('nodesが配列ではありません');
    correctedData.nodes = [];
    corrections.push('nodesを空の配列として補完しました');
  } else {
    // Validate each node
    const validNodes: ScenarioNode[] = [];
    const validTypes = ['event', 'element', 'branch', 'variable', 'group', 'jump', 'memo', 'character', 'resource', 'sticky'];
    
    data.nodes.forEach((node: any, index: number) => {
      const nodeErrors = validateNode(node);
      if (nodeErrors.length > 0) {
        warnings.push(`ノード ${index}: ${nodeErrors.join(', ')}`);
        // Try to correct the node
        const correctedNode = correctNode(node);
        if (correctedNode) {
          validNodes.push(correctedNode);
          
          // Record corrections
          if (!node.id) {
            corrections.push(`ノード ${index}: idを補完しました`);
          }
          if (node.type && !validTypes.includes(node.type)) {
            corrections.push(`ノード ${index}: 不正なtype "${node.type}" をデフォルト値 "event" に修正しました`);
          } else if (!node.type) {
            corrections.push(`ノード ${index}: typeを補完しました (デフォルト値: "event")`);
          }
          if (!node.position || typeof node.position.x !== 'number' || typeof node.position.y !== 'number') {
            corrections.push(`ノード ${index}: positionを補完しました (デフォルト値: {x: 0, y: 0})`);
          }
          if (!node.data) {
            corrections.push(`ノード ${index}: dataを補完しました (デフォルト値: {})`);
          } else if (typeof node.data !== 'object') {
            corrections.push(`ノード ${index}: 不正なdata "${node.data}" をデフォルト値 {} に修正しました`);
          }
        }
      } else {
        validNodes.push(node);
      }
    });
    correctedData.nodes = validNodes;
  }

  // 3. Validate edges array
  if (!Array.isArray(data.edges)) {
    errors.push('edgesが配列ではありません');
    correctedData.edges = [];
    corrections.push('edgesを空の配列として補完しました');
  } else {
    // Validate each edge
    const validEdges: ScenarioEdge[] = [];
    const nodeIds = new Set(correctedData.nodes.map((n: ScenarioNode) => n.id)) as Set<string>;
    
    data.edges.forEach((edge: any, index: number) => {
      const edgeErrors = validateEdge(edge, nodeIds);
      if (edgeErrors.length > 0) {
        warnings.push(`エッジ ${index}: ${edgeErrors.join(', ')}`);
        // Try to correct the edge
        const correctedEdge = correctEdge(edge, nodeIds);
        if (correctedEdge) {
          validEdges.push(correctedEdge);
          
          // Record corrections
          if (!edge.id) {
            corrections.push(`エッジ ${index}: idを補完しました`);
          }
          if (!edge.source) {
            corrections.push(`エッジ ${index}: sourceを補完しました`);
          }
          if (!edge.target) {
            corrections.push(`エッジ ${index}: targetを補完しました`);
          }
        } else {
          // Edge was removed because source or target doesn't exist
          if (edge.source && !nodeIds.has(edge.source)) {
            corrections.push(`エッジ ${index}: 存在しないsourceノード "${edge.source}" を参照しているため削除しました`);
          }
          if (edge.target && !nodeIds.has(edge.target)) {
            corrections.push(`エッジ ${index}: 存在しないtargetノード "${edge.target}" を参照しているため削除しました`);
          }
        }
      } else {
        validEdges.push(edge);
      }
    });
    correctedData.edges = validEdges;
  }

  // 4. Validate gameState
  if (!data.gameState || typeof data.gameState !== 'object') {
    warnings.push('gameStateが不正です。デフォルト値を使用します');
    correctedData.gameState = createDefaultGameState();
    corrections.push('gameStateを補完しました');
  } else {
    correctedData.gameState = validateGameState(data.gameState);
  }

  // 5. Validate characters (optional)
  if (data.characters !== undefined) {
    if (!Array.isArray(data.characters)) {
      warnings.push('charactersが配列ではありません。空配列を使用します');
      correctedData.characters = [];
      corrections.push('charactersを空の配列として補完しました');
    } else {
      correctedData.characters = data.characters.filter((char: any) => validateCharacter(char));
    }
  } else {
    correctedData.characters = [];
  }

  // 6. Validate resources (optional)
  if (data.resources !== undefined) {
    if (!Array.isArray(data.resources)) {
      warnings.push('resourcesが配列ではありません。空配列を使用します');
      correctedData.resources = [];
      corrections.push('resourcesを空の配列として補完しました');
    } else {
      correctedData.resources = data.resources.filter((res: any) => validateResource(res));
    }
  } else {
    correctedData.resources = [];
  }


  // 7. Validate edgeType (optional)
  if (data.edgeType !== undefined) {
    const validEdgeTypes = ['default', 'straight', 'step', 'smoothstep'];
    if (!validEdgeTypes.includes(data.edgeType)) {
      warnings.push(`edgeTypeが不正です: "${data.edgeType}" (有効な値: ${validEdgeTypes.join(', ')})。デフォルト値を使用します`);
      correctedData.edgeType = 'default';
      corrections.push(`edgeTypeを不正な値 "${data.edgeType}" からデフォルト値 "default" に修正しました`);
    }
  }

  // 8. Validate variables in gameState (check for duplicates and type consistency)
  if (correctedData.gameState && correctedData.gameState.variables) {
    const variableNames = new Set<string>();
    const variableErrors: string[] = [];
    const correctedVariables: any = {};
    
    Object.entries(correctedData.gameState.variables).forEach(([name, variable]: [string, any]) => {
      // Check for duplicate names (case-insensitive)
      const lowerName = name.toLowerCase();
      if (variableNames.has(lowerName)) {
        variableErrors.push(`変数名の重複: "${name}"`);
        corrections.push(`重複する変数 "${name}" を削除しました`);
        return; // Skip duplicate variables
      } else {
        variableNames.add(lowerName);
      }
      
      // Check type and value consistency
      if (variable && typeof variable === 'object') {
        const { type, value } = variable;
        
        if (type && value !== undefined) {
          const isValidType = validateVariableType(type, value);
          if (!isValidType) {
            variableErrors.push(`変数 "${name}": 型 "${type}" と値 "${value}" が不整合です`);
            // Correct the value based on type
            let correctedValue = value;
            switch (type) {
              case 'number':
                correctedValue = typeof value === 'number' ? value : parseFloat(value) || 0;
                corrections.push(`変数 "${name}": 値 "${value}" を数値 ${correctedValue} に変換しました`);
                break;
              case 'string':
                correctedValue = String(value);
                corrections.push(`変数 "${name}": 値を文字列 "${correctedValue}" に変換しました`);
                break;
              case 'boolean':
                correctedValue = value === true || value === 'true';
                corrections.push(`変数 "${name}": 値 "${value}" を真偽値 ${correctedValue} に変換しました`);
                break;
            }
            correctedVariables[name] = { ...variable, value: correctedValue };
          } else {
            correctedVariables[name] = variable;
          }
        } else {
          correctedVariables[name] = variable;
        }
      } else {
        correctedVariables[name] = variable;
      }
    });
    
    correctedData.gameState.variables = correctedVariables;
    
    if (variableErrors.length > 0) {
      variableErrors.forEach(err => warnings.push(err));
    }
  }

  // 9. Validate viewport (optional)
  if (data.viewport !== undefined) {
    if (typeof data.viewport !== 'object' || 
        typeof data.viewport.x !== 'number' || 
        typeof data.viewport.y !== 'number' || 
        typeof data.viewport.zoom !== 'number') {
      warnings.push('viewportが不正です。無視します');
      delete correctedData.viewport;
      corrections.push('不正なviewportを削除しました');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    correctedData: errors.length === 0 ? correctedData : undefined,
    corrections
  };
}

function validateNode(node: any): string[] {
  const errors: string[] = [];

  if (!node.id || typeof node.id !== 'string') {
    errors.push(!node.id ? 'idが欠落しています' : 'idが不正です(文字列である必要があります)');
  }

  const validTypes = ['event', 'element', 'branch', 'variable', 'group', 'jump', 'memo', 'character', 'resource', 'sticky'];
  if (!node.type) {
    errors.push('typeが欠落しています');
  } else if (!validTypes.includes(node.type)) {
    errors.push(`typeが不正です: "${node.type}" (有効な値: ${validTypes.join(', ')})`);
  }

  if (!node.position) {
    errors.push('positionが欠落しています');
  } else if (typeof node.position.x !== 'number' || typeof node.position.y !== 'number') {
    errors.push('positionが不正です(xとyは数値である必要があります)');
  }

  if (!node.data) {
    errors.push('dataが欠落しています');
  } else if (typeof node.data !== 'object') {
    errors.push('dataが不正です(オブジェクトである必要があります)');
  }

  return errors;
}

function correctNode(node: any): ScenarioNode | null {
  try {
    const validTypes = ['event', 'element', 'branch', 'variable', 'group', 'jump', 'memo', 'character', 'resource', 'sticky'];
    const nodeType = node.type && validTypes.includes(node.type) ? node.type : 'event';
    
    const corrected: any = {
      id: node.id || `node-${Date.now()}-${Math.random()}`,
      type: nodeType,
      position: {
        x: typeof node.position?.x === 'number' ? node.position.x : 0,
        y: typeof node.position?.y === 'number' ? node.position.y : 0
      },
      data: typeof node.data === 'object' && node.data !== null ? node.data : {}
    };

    // Copy other valid properties
    if (node.selected !== undefined) corrected.selected = !!node.selected;
    if (node.dragging !== undefined) corrected.dragging = !!node.dragging;
    if (node.hidden !== undefined) corrected.hidden = !!node.hidden;

    return corrected as ScenarioNode;
  } catch {
    return null;
  }
}

function validateEdge(edge: any, nodeIds: Set<string>): string[] {
  const errors: string[] = [];

  if (!edge.id || typeof edge.id !== 'string') {
    errors.push(!edge.id ? 'idが欠落しています' : 'idが不正です(文字列である必要があります)');
  }

  if (!edge.source) {
    errors.push('sourceが欠落しています');
  } else if (!nodeIds.has(edge.source)) {
    errors.push(`sourceノードが存在しません: "${edge.source}"`);
  }

  if (!edge.target) {
    errors.push('targetが欠落しています');
  } else if (!nodeIds.has(edge.target)) {
    errors.push(`targetノードが存在しません: "${edge.target}"`);
  }

  return errors;
}

function correctEdge(edge: any, nodeIds: Set<string>): ScenarioEdge | null {
  // Only correct if both source and target exist
  if (!edge.source || !edge.target || !nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
    return null;
  }

  return {
    id: edge.id || `edge-${Date.now()}-${Math.random()}`,
    source: edge.source,
    target: edge.target,
    type: edge.type || 'default',
    data: edge.data || {}
  } as ScenarioEdge;
}

function createDefaultGameState(): GameState {
  return {
    currentNodes: [],
    revealedNodes: [],
    inventory: {},
    equipment: {},
    knowledge: {},
    skills: {},
    stats: {},
    variables: {}
  };
}

function validateGameState(gameState: any): GameState {
  return {
    currentNodes: Array.isArray(gameState.currentNodes) ? gameState.currentNodes : [],
    revealedNodes: Array.isArray(gameState.revealedNodes) ? gameState.revealedNodes : [],
    inventory: typeof gameState.inventory === 'object' ? gameState.inventory : {},
    equipment: typeof gameState.equipment === 'object' ? gameState.equipment : {},
    knowledge: typeof gameState.knowledge === 'object' ? gameState.knowledge : {},
    skills: typeof gameState.skills === 'object' ? gameState.skills : {},
    stats: typeof gameState.stats === 'object' ? gameState.stats : {},
    variables: typeof gameState.variables === 'object' ? gameState.variables : {}
  };
}

function validateCharacter(char: any): boolean {
  return char && 
         typeof char.id === 'string' && 
         typeof char.type === 'string' && 
         typeof char.name === 'string';
}

function validateResource(res: any): boolean {
  return res && 
         typeof res.id === 'string' && 
         typeof res.type === 'string' && 
         typeof res.name === 'string';
}

function validateVariableType(type: string, value: any): boolean {
  switch (type) {
    case 'number':
      return typeof value === 'number' && !isNaN(value);
    case 'string':
      return typeof value === 'string';
    case 'boolean':
      return typeof value === 'boolean';
    default:
      // Unknown type, allow it
      return true;
  }
}
