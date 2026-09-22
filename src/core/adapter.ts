/**
 * ARKHAM Core Engine - Adapter Layer
 * Bridges Zustand ScenarioStore data with Core Engine CoreGraph
 */

import type { ScenarioNode as StoreNode, ScenarioEdge as StoreEdge, ResourceData, StageData } from '../types';
import type {
  CoreGraph,
  MasterData,
  ScenarioNode as CoreNode,
  ScenarioEdge as CoreEdge,
  ItemDefinition,
  LocationDefinition,
  SkillDefinition,
  ScenarioNodeType,
  EdgeConditionType,
} from './schema';

/**
 * Converts ResourceData[] and optional StageData[] to Core MasterData
 */
export function resourcesToMasterData(
  resources: ResourceData[] = [],
  stages?: StageData[],
  variablesInput?: any[]
): MasterData {
  const items: ItemDefinition[] = [];
  const locations: LocationDefinition[] = [];
  const skills: SkillDefinition[] = [];

  if (stages) {
    for (const stage of stages) {
      if (stage.type === 'Location') {
        locations.push({
          id: stage.id,
          name: stage.name,
          chapter: 1,
        });
      }
    }
  }

  for (const res of resources || []) {
    if (res.type === 'Item' || res.type === 'Equipment' || res.type === 'Knowledge') {
      const resName = res.name || '';
      const resDesc = res.description || '';
      const resEffect = res.effect || '';

      let category: 'key' | 'data' | 'weapon' | 'consumable' | 'clue' = 'key';
      let isConsumable = false;

      if (res.type === 'Knowledge') {
        category = 'clue';
      } else if (res.type === 'Equipment') {
        category = 'weapon';
      } else {
        const isMedicineOrFood = /薬|安定剤|鎮静剤|アンプル|回復|スプレー|食料|食塩水|キット|包帯|ポーション|電池|バッテリー/i.test(resName + resDesc + resEffect);
        if (isMedicineOrFood || (res as any).isConsumable || (res as any).category === 'consumable') {
          category = 'consumable';
          isConsumable = true;
        } else if (/データ|メモ|手記|日誌|日記|概要|録音|書類|手帳/i.test(resName)) {
          category = 'data';
        } else if (/コード|キー|カード|鍵|バイパス/i.test(resName)) {
          category = 'key';
        } else if (/銃|メス|武器|ベスト|防具/i.test(resName)) {
          category = 'weapon';
        } else {
          category = 'key';
        }
      }

      items.push({
        id: res.id,
        name: res.name,
        category,
        description: res.description || '',
        isConsumable,
      });
    } else if (res.type === 'Location') {
      if (!locations.some(l => l.id === res.id)) {
        locations.push({
          id: res.id,
          name: res.name,
          chapter: 1,
        });
      }
    } else if (res.type === 'Skill') {
      skills.push({
        id: res.id,
        name: res.name,
        description: res.description,
      } as SkillDefinition);
    }
  }

  const variables: MasterData['variables'] = [];
  if (variablesInput && Array.isArray(variablesInput)) {
    for (const v of variablesInput) {
      variables.push({
        name: v.name,
        type: v.type || 'number',
        initialValue: v.initialValue ?? (v.type === 'boolean' ? false : v.type === 'string' ? '' : 0),
      });
    }
  }

  return { items, locations, skills, variables };
}

/**
 * Maps React Flow node type to Core Engine node type
 */
function mapNodeType(node: StoreNode): ScenarioNodeType {
  switch (node.type) {
    case 'event': {
      const label = node.data.label || '';
      const isEnding = Boolean(node.data.isEnding) || /^(End|Ending|結末|エピローグ|True\s*End|Bad\s*End|\d+-\d+\.\s*(End|Bad End|True End))/i.test(label);
      if (isEnding) return 'ending';
      return node.data.isStart ? 'scene' : 'event';
    }
    case 'branch':
      return 'check';
    default:
      return 'scene';
  }
}

/**
 * Converts a StoreNode to a CoreNode
 */
export function storeNodeToCoreNode(node: StoreNode): CoreNode {
  const d = node.data;

  // Infer acquired/consumed items if legacy Element node was used
  const acquiredItems = [...(d.acquiredItems || [])];
  const consumedItems = [...(d.consumedItems || [])];

  if (node.type === 'element' && d.referenceId) {
    if (d.actionType === 'consume') {
      if (!consumedItems.includes(d.referenceId)) consumedItems.push(d.referenceId);
    } else {
      if (!acquiredItems.includes(d.referenceId)) acquiredItems.push(d.referenceId);
    }
  }

  // Variable operations
  const variableOperations: import('./schema').VariableOperation[] = [...(d.variableOperations || [])];
  if (node.type === 'variable' && d.targetVariable) {
    const rawVal = d.variableValue ?? '';
    let parsedVal: number | boolean | string = rawVal;
    if (rawVal === 'true') parsedVal = true;
    else if (rawVal === 'false') parsedVal = false;
    else if (!isNaN(Number(rawVal)) && rawVal !== '' && typeof rawVal === 'string') {
      parsedVal = Number(rawVal);
    }

    variableOperations.push({
      variableName: d.targetVariable,
      operator: d.variableOperator || 'set',
      value: parsedVal,
    });
  }

  return {
    id: node.id,
    chapter: d.chapter ?? 1,
    title: d.label || '無題ノード',
    type: mapNodeType(node),
    locationId: d.locationId || '',
    purpose: d.purpose || d.description || '',
    kpInstructions: d.kpInstructions || [],
    investigationPoints: d.investigationPoints || [],
    readAloudText: d.readAloudText || '',
    requiredItems: d.requiredItems || [],
    acquiredItems,
    consumedItems,
    variableOperations: variableOperations.length > 0 ? variableOperations : undefined,
    sanCheck: d.resourceCheck || d.sanCheck,
    resourceCheck: d.resourceCheck || d.sanCheck,
    timeCostMinutes: d.timeCostMinutes ?? 10,
  };
}

/**
 * Converts a StoreEdge to a CoreEdge
 */
export function storeEdgeToCoreEdge(edge: StoreEdge, nodeMap?: Map<string, StoreNode>): CoreEdge {
  let conditionType: EdgeConditionType = 'always';
  let conditionValue: string | undefined = undefined;

  const edgeData = edge.data as any;
  if (edgeData?.conditionType) {
    conditionType = edgeData.conditionType;
    conditionValue = edgeData.conditionValue;
  } else if (typeof edge.label === 'string' && edge.label.trim().length > 0) {
    conditionValue = edge.label.trim();
    if (conditionValue.includes('成功') || conditionValue.includes('success')) {
      conditionType = 'check_success';
    } else if (conditionValue.includes('失敗') || conditionValue.includes('fail')) {
      conditionType = 'check_fail';
    } else {
      conditionType = 'choice';
    }
  } else if (nodeMap) {
    const srcNode = nodeMap.get(edge.source);
    if (srcNode?.type === 'branch') {
      const branches: any[] = srcNode.data?.branches || [];
      const hasLegacy = Boolean(srcNode.data?.conditionValue);
      const effectiveBranches = branches.length > 0
        ? branches
        : (hasLegacy ? [{
            id: 'true',
            label: 'True',
            conditionType: srcNode.data?.conditionType || 'variable',
            conditionValue: srcNode.data?.conditionValue,
          }] : []);

      const matchedCase = effectiveBranches.find(
        (b) => b.id === edge.sourceHandle || (edge.sourceHandle === 'true' && (b.id === 'true' || effectiveBranches.length === 1))
      );

      if (matchedCase) {
        conditionType = (matchedCase.conditionType as EdgeConditionType) || 'variable';
        conditionValue = matchedCase.conditionValue || matchedCase.targetId || '';
      } else if (edge.sourceHandle === 'else' || edge.sourceHandle === 'false') {
        const varConditions = effectiveBranches
          .filter((b) => (b.conditionType === 'variable' || !b.conditionType) && b.conditionValue)
          .map((b) => `!(${b.conditionValue})`);
        if (varConditions.length > 0) {
          conditionType = 'variable';
          conditionValue = varConditions.join(' && ');
        } else {
          conditionType = 'always';
        }
      } else if (srcNode.data?.branchType === 'switch') {
        const targetVar = srcNode.data.conditionValue || srcNode.data.conditionVariable;
        if (targetVar) {
          conditionType = 'variable';
          conditionValue = `${targetVar} == "${edge.label || ''}"`;
        }
      }
    }
  }

  return {
    id: edge.id,
    fromNodeId: edge.source,
    toNodeId: edge.target,
    conditionType,
    conditionValue,
    variableCondition: conditionType === 'variable' ? conditionValue : undefined,
    label: typeof edge.label === 'string' ? edge.label : undefined,
  };
}

const FLOW_NODE_TYPES = new Set(['event', 'element', 'branch', 'jump', 'variable']);

/**
 * Converts the full scenario state into CoreGraph
 */
export function buildCoreGraph(
  nodes: StoreNode[],
  edges: StoreEdge[],
  resources: ResourceData[],
  stagesOrSystemConfig?: StageData[] | import('./schema').SystemConfig,
  maybeSystemConfig?: import('./schema').SystemConfig,
  variablesInput?: Record<string, any>
): CoreGraph {
  let stages: StageData[] | undefined;
  let systemConfig: import('./schema').SystemConfig | undefined;

  if (Array.isArray(stagesOrSystemConfig)) {
    stages = stagesOrSystemConfig;
    systemConfig = maybeSystemConfig;
  } else {
    systemConfig = stagesOrSystemConfig;
  }

  const masterData = resourcesToMasterData(resources, stages);
  if (variablesInput) {
    masterData.variables = Object.values(variablesInput).map((v: any) => ({
      name: v.name,
      type: v.type || 'string',
      initialValue: v.value !== undefined ? v.value : (v.type === 'number' ? 0 : v.type === 'boolean' ? false : ''),
      description: v.description,
    }));
  }

  // Inspect reference edges and attach supplement IDs to primary flow nodes
  const allNodeMap = new Map(nodes.map((n) => [n.id, n]));
  const refStagesMap = new Map<string, Set<string>>();
  const refCharsMap = new Map<string, Set<string>>();
  const refCluesMap = new Map<string, Set<string>>();

  edges.forEach((edge) => {
    const isRef = edge.type === 'reference' || edge.sourceHandle?.startsWith('ref-') || edge.targetHandle?.startsWith('ref-');
    if (!isRef) return;

    const src = allNodeMap.get(edge.source);
    const tgt = allNodeMap.get(edge.target);
    if (!src || !tgt) return;

    // Identify primary flow node vs supplement node
    const isSrcFlow = FLOW_NODE_TYPES.has(src.type || '');
    const isTgtFlow = FLOW_NODE_TYPES.has(tgt.type || '');
    const [primary, supplement] = isSrcFlow && !isTgtFlow ? [src, tgt] : (isTgtFlow && !isSrcFlow ? [tgt, src] : [null, null]);

    if (!primary || !supplement) return;

    const suppRefId = supplement.data?.referenceId || supplement.id;
    if (supplement.type === 'stage') {
      if (!refStagesMap.has(primary.id)) refStagesMap.set(primary.id, new Set());
      refStagesMap.get(primary.id)!.add(suppRefId);
    } else if (supplement.type === 'character') {
      if (!refCharsMap.has(primary.id)) refCharsMap.set(primary.id, new Set());
      refCharsMap.get(primary.id)!.add(suppRefId);
    } else if (supplement.type === 'resource' || supplement.type === 'element') {
      if (!refCluesMap.has(primary.id)) refCluesMap.set(primary.id, new Set());
      refCluesMap.get(primary.id)!.add(suppRefId);
    }
  });

  const flowNodes = nodes.filter((n) => Boolean(n.type && FLOW_NODE_TYPES.has(n.type)));
  const coreNodes = flowNodes.map((n) => {
    const core = storeNodeToCoreNode(n);
    if (refStagesMap.has(n.id)) {
      core.associatedStageIds = Array.from(refStagesMap.get(n.id)!);
    }
    if (refCharsMap.has(n.id)) {
      core.associatedCharacterIds = Array.from(refCharsMap.get(n.id)!);
    }
    if (refCluesMap.has(n.id)) {
      core.associatedClueIds = Array.from(refCluesMap.get(n.id)!);
    }
    return core;
  });
  const nodeMap = new Map(flowNodes.map((n) => [n.id, n]));
  const narrativeEdges = edges.filter(
    (e) => e.type !== 'reference' && !e.sourceHandle?.startsWith('ref-') && !e.targetHandle?.startsWith('ref-')
  );
  const coreEdges = narrativeEdges.map((e) => storeEdgeToCoreEdge(e, nodeMap));

  // Synthesize logical transition edges for JumpNodes so that
  // validator (reachability, ending path), linter, and simulator can traverse jumps seamlessly
  for (const node of flowNodes) {
    if (node.type === 'jump') {
      const jumpTarget = node.data?.jumpTarget;
      const targetNodeId = typeof jumpTarget === 'string' ? jumpTarget : jumpTarget?.nodeId;
      if (targetNodeId && flowNodes.some((n) => n.id === targetNodeId)) {
        coreEdges.push({
          id: `jump_edge_${node.id}_${targetNodeId}`,
          fromNodeId: node.id,
          toNodeId: targetNodeId,
          conditionType: 'always',
          label: 'ジャンプ',
        });
      }
    }
  }

  const startNode = flowNodes.find((n) => n.data.isStart) || flowNodes[0];

  return {
    masterData,
    nodes: coreNodes,
    edges: coreEdges,
    startNodeId: startNode?.id,
    systemConfig,
  };
}
