/**
 * ARKHAM Human-Centric Scenario Exporter
 * Exports ARKHAM Graph and Stores into a clean, human-readable HumanScenarioDocument and YAML string.
 * Strips all internal system jargon (IDs, coordinates, handles) while retaining 100% of narrative and structural flow.
 */

import YAML from 'yaml';
import { isReferenceEdge } from '../utils/autoLayout';
import type { ScenarioNode, ScenarioEdge, CharacterData, ResourceData, StageData, ScenarioMetadata, SystemConfig } from '../types';
import type { Tab } from '../types/tab';
import type {
  HumanScenarioDocument,
  HumanScenarioBasicInfo,
  HumanAdvanceInfo,
  HumanCharacter,
  HumanResource,
  HumanStage,
  HumanScene,
  HumanBranch,
  HumanBranchChoice,
  HumanResourceCheck,
  HumanInvestigationArea,
} from './humanSchema';

export interface HumanExportInput {
  scenarioMetadata?: ScenarioMetadata;
  scenarioTitle?: string;
  systemConfig?: SystemConfig;
  characters?: CharacterData[];
  resources?: ResourceData[];
  stages?: StageData[];
  nodes?: ScenarioNode[];
  edges?: ScenarioEdge[];
  tabs?: Tab[];
}

export function exportToHumanDocument(input: HumanExportInput): HumanScenarioDocument {
  const meta = input.scenarioMetadata;
  const nodes = input.nodes || [];
  const edges = input.edges || [];
  const characters = input.characters || [];
  const resources = input.resources || [];
  const stages = input.stages || [];
  const sysConfig = input.systemConfig;
  const tabs = input.tabs;
  const hasMultipleTabs = Boolean(tabs && tabs.length > 1);

  // Build ID to Name lookups
  const charMap = new Map<string, string>();
  for (const c of characters) charMap.set(c.id, c.name);

  const resMap = new Map<string, string>();
  for (const r of resources) resMap.set(r.id, r.name);

  const stageMap = new Map<string, string>();
  for (const s of stages) stageMap.set(s.id, s.name);

  const nodeMap = new Map<string, ScenarioNode>();
  for (const n of nodes) nodeMap.set(n.id, n);

  // 1. シナリオ基本情報
  const basicInfo: HumanScenarioBasicInfo = {
    タイトル: meta?.title || input.scenarioTitle || '無題のシナリオ',
    作者: meta?.author || undefined,
    システム: meta?.system || sysConfig?.name || undefined,
    想定時間: meta?.targetTime || (meta?.targetTimeMinutes ? `${meta.targetTimeMinutes}分` : undefined),
    推奨人数: meta?.recommendedParty || undefined,
    推奨技能: meta?.recommendedSkills && meta.recommendedSkills.length > 0 ? meta.recommendedSkills : undefined,
    ロスト率: meta?.lossRate || undefined,
    レギュレーション: meta?.regulations || undefined,
    あらすじ: meta?.overview || undefined,
  };

  // 2. 事前情報・ハンドアウト
  let advanceInfo: HumanAdvanceInfo | undefined;
  if (meta?.handouts) {
    advanceInfo = {
      全体共有: meta.handouts.shared || undefined,
      ハンドアウト一覧: meta.handouts.list?.map((ho) => ({
        HO: ho.title,
        役割: ho.role || undefined,
        公開情報: ho.publicInfo || undefined,
        個別秘密: ho.secretInfo || undefined,
        推奨職業: ho.recommendedRole || undefined,
      })),
    };
  }

  // 3. 登場人物
  const humanCharacters: HumanCharacter[] = characters.map((c) => {
    let typeJp: HumanCharacter['種別'] = '人物';
    if (c.type === 'Monster') typeJp = 'エネミー';
    else if (c.type === 'Participant') typeJp = '参加者';
    else if (c.type === 'Other') typeJp = 'その他';

    return {
      ID: c.id,
      名前: c.name,
      種別: typeJp,
      ふりがな: c.reading || undefined,
      概要: c.description || undefined,
      能力値: c.abilities || undefined,
      技能: c.skills || undefined,
      備考: c.note || undefined,
    };
  });

  // 4. アイテム
  const humanResources: HumanResource[] = resources.map((r) => {
    let typeJp: HumanResource['種別'] = 'アイテム';
    if (r.type === 'Equipment') typeJp = '装備';
    else if (r.type === 'Knowledge') typeJp = '手がかり';
    else if (r.type === 'Status') typeJp = 'その他';

    return {
      ID: r.id,
      名前: r.name,
      種別: typeJp,
      概要: r.description || undefined,
      効果: r.effect || undefined,
      備考: r.note || undefined,
    };
  });

  // 5. 舞台
  const humanStages: HumanStage[] = stages.map((s) => {
    let typeJp: HumanStage['種別'] = '場所';
    if (s.type === 'Faction') typeJp = '組織';
    else if (s.type === 'Lore') typeJp = '世界観';

    return {
      ID: s.id,
      名前: s.name,
      種別: typeJp,
      概要: s.description || undefined,
      詳細: s.details || undefined,
      備考: s.note || undefined,
    };
  });

  // 6. 場面一覧
  // Find outgoing edges for each node
  const outgoingEdges = new Map<string, ScenarioEdge[]>();
  for (const edge of edges) {
    if (!outgoingEdges.has(edge.source)) outgoingEdges.set(edge.source, []);
    outgoingEdges.get(edge.source)!.push(edge);
  }

  const isAttachedHelperNode = (n: ScenarioNode) => {
    if (n.type === 'branch' && n.id.endsWith('_branch') && n.data?.label?.endsWith(' の分岐')) return true;
    if (n.type === 'jump' && (n.id.includes('_cross_jump') || (n.id.endsWith('_jump') && n.data?.label?.startsWith('合流: ')))) return true;
    return false;
  };

  const sceneNodes = nodes.filter((n) => !isAttachedHelperNode(n));

  const getAbsY = (n: ScenarioNode): number => {
    if (typeof n.positionAbsolute?.y === 'number') return n.positionAbsolute.y;
    if (n.parentNode) {
      const parent = nodeMap.get(n.parentNode);
      return (parent?.position?.y ?? 0) + (n.position?.y ?? 0);
    }
    return n.position?.y ?? 0;
  };

  const getAbsX = (n: ScenarioNode): number => {
    if (typeof n.positionAbsolute?.x === 'number') return n.positionAbsolute.x;
    if (n.parentNode) {
      const parent = nodeMap.get(n.parentNode);
      return (parent?.position?.x ?? 0) + (n.position?.x ?? 0);
    }
    return n.position?.x ?? 0;
  };

  // Sort scenes: if explicit order exists, respect it; otherwise sort by start node, chapter, then absolute y and x
  sceneNodes.sort((a, b) => {
    if (typeof a.data?.order === 'number' && typeof b.data?.order === 'number') {
      return a.data.order - b.data.order;
    }
    if (a.data?.isStart && !b.data?.isStart) return -1;
    if (!a.data?.isStart && b.data?.isStart) return 1;
    const chA = a.data?.chapter ?? 1;
    const chB = b.data?.chapter ?? 1;
    if (chA !== chB) return chA - chB;
    const yDiff = getAbsY(a) - getAbsY(b);
    if (Math.abs(yDiff) > 10) return yDiff;
    return getAbsX(a) - getAbsX(b);
  });

  const humanScenes: HumanScene[] = [];

  for (const node of sceneNodes) {
    const d = node.data || {};

    let typeJp: HumanScene['種別'] = undefined;
    if (node.type === 'group') typeJp = 'グループ';
    else if (node.type === 'branch') {
      typeJp = d.label?.includes('判定') ? '判定' : (d.branchType === 'switch' ? '行動選択' : '分岐');
    } else if (node.type === 'element') {
      typeJp = d.infoType?.toLowerCase() === 'knowledge' ? '手がかり' : 'アイテム';
    } else if (node.type === 'memo') {
      typeJp = 'メモ';
    } else if (node.type === 'character') {
      typeJp = '登場人物';
    } else if (node.type === 'jump') {
      typeJp = 'ジャンプ';
    }

    // Determine parent group
    let parentGroupLabel: string | undefined;
    if (node.parentNode) {
      const parent = nodeMap.get(node.parentNode);
      if (parent) parentGroupLabel = parent.data?.label || parent.id;
    }

    // Determine location name
    const locName = d.locationId ? (stageMap.get(d.locationId) || d.locationId) : undefined;

    // Characters present
    const charNames: string[] = [];
    if (d.associatedCharacterIds && Array.isArray(d.associatedCharacterIds)) {
      for (const cid of d.associatedCharacterIds) {
        charNames.push(charMap.get(cid) || cid);
      }
    }
    if (node.type === 'character' && d.referenceId) {
      const refName = charMap.get(d.referenceId) || d.referenceId;
      if (!charNames.includes(refName)) {
        charNames.push(refName);
      }
    }
    // Include characters connected via outgoing reference edges
    const outEdgesAll = outgoingEdges.get(node.id) || [];
    for (const re of outEdgesAll) {
      if (isReferenceEdge(re)) {
        const tgtNode = nodeMap.get(re.target);
        if (tgtNode && tgtNode.type === 'character') {
          const cId = tgtNode.data?.referenceId;
          const cName = (cId && charMap.get(cId)) || tgtNode.data?.label;
          if (cName && !charNames.includes(cName)) {
            charNames.push(cName);
          }
        }
      }
    }

    // Items
    const acquired = (d.acquiredItems || []).map((id: string) => resMap.get(id) || id);
    const consumed = (d.consumedItems || []).map((id: string) => resMap.get(id) || id);
    const required = (d.requiredItems || []).map((id: string) => resMap.get(id) || id);

    // Resource check
    const rc = d.resourceCheck || d.sanCheck;
    let resourceCheckJp: HumanResourceCheck | undefined;
    if (rc) {
      resourceCheckJp = {
        トリガー: rc.trigger,
        成功時: rc.successLoss,
        失敗時: rc.failLoss,
        対象リソース: rc.resourceName || undefined,
      };
    }

    // Investigation area
    let investigationAreaJp: HumanInvestigationArea | undefined;
    if (d.investigationPoints && d.investigationPoints.length > 0) {
      investigationAreaJp = {
        エリア名: d.label,
        調査ポイント: d.investigationPoints.map((ip: any) => ({
          名前: ip.name,
          概要: ip.description,
          詳細: ip.details || undefined,
          発見アイテム: ip.discoveredItems ? ip.discoveredItems.map((id: string) => resMap.get(id) || id) : undefined,
          判定: ip.checks?.map((chk: any) => ({
            技能: chk.skillName,
            難易度: chk.difficulty || undefined,
            成功時: chk.onSuccess ? JSON.stringify(chk.onSuccess) : undefined,
            失敗時: chk.onFailure ? JSON.stringify(chk.onFailure) : undefined,
          })),
        })),
      };
    }

    // Helper to resolve destination label or ID
    const resolveTargetTitle = (tgt: ScenarioNode): string => {
      if (tgt.type === 'jump') return tgt.id;
      const sameLabelCount = sceneNodes.filter((n) => n.data?.label === tgt.data?.label).length;
      if (sameLabelCount > 1) return tgt.id;
      return tgt.data?.label || tgt.id;
    };

    // Find outgoing transitions (excluding reference edges)
    const outEdges = outEdgesAll.filter((e) => !isReferenceEdge(e));
    const directDestinations: string[] = [];
    let branchJp: HumanBranch | undefined;
    let jumpTargetJp: string | undefined;

    if (node.type === 'branch') {
      const choices: HumanBranchChoice[] = [];
      if (d.branches && Array.isArray(d.branches)) {
        for (const bCase of d.branches) {
          const matchEdge = outEdges.find((e) => e.sourceHandle === bCase.id || e.label === bCase.label);
          const tgt = matchEdge ? nodeMap.get(matchEdge.target) : null;
          if (tgt) {
            choices.push({
              条件: bCase.label || bCase.conditionValue || '選択',
              行き先: resolveTargetTitle(tgt),
            });
          }
        }
      } else {
        for (const edge of outEdges) {
          const tgt = nodeMap.get(edge.target);
          if (tgt) {
            choices.push({
              条件: edge.label || (edge.sourceHandle === 'true' ? '成功' : '失敗'),
              行き先: resolveTargetTitle(tgt),
            });
          }
        }
      }
      branchJp = {
        分岐種別: d.branchType === 'if_else' ? '成否' : '選択',
        選択肢: choices,
      };
    } else if (node.type === 'jump') {
      const jt = d.jumpTarget;
      if (jt) {
        const tgt = nodeMap.get(jt.nodeId);
        jumpTargetJp = tgt?.data?.label || jt.nodeId;
      } else if (outEdges.length > 0) {
        const tgt = nodeMap.get(outEdges[0].target);
        jumpTargetJp = tgt?.data?.label || outEdges[0].target;
      }
    } else {
      for (const edge of outEdges) {
        const targetNode = nodeMap.get(edge.target);
        if (!targetNode) continue;

        if (targetNode.type === 'branch' && isAttachedHelperNode(targetNode)) {
          // Attached branch in compact mode
          const branchData = targetNode.data || {};
          const branchOutEdges = (outgoingEdges.get(targetNode.id) || []).filter((e) => !isReferenceEdge(e));
          const choices: HumanBranchChoice[] = [];

          if (branchData.branches && Array.isArray(branchData.branches)) {
            for (const bCase of branchData.branches) {
              const matchingEdge = branchOutEdges.find((e) => e.sourceHandle === bCase.id || e.label === bCase.label);
              const targetOfCase = matchingEdge ? nodeMap.get(matchingEdge.target) : null;
              if (targetOfCase) {
                choices.push({
                  条件: bCase.label || bCase.conditionValue || '条件一致',
                  行き先: resolveTargetTitle(targetOfCase),
                });
              }
            }
          } else {
            for (const bEdge of branchOutEdges) {
              const destNode = nodeMap.get(bEdge.target);
              if (destNode) {
                choices.push({
                  条件: bEdge.label ? String(bEdge.label) : (bEdge.sourceHandle === 'true' ? '成功' : bEdge.sourceHandle === 'false' ? '失敗' : undefined),
                  行き先: resolveTargetTitle(destNode),
                });
              }
            }
          }

          branchJp = {
            分岐種別: branchData.branchType === 'if_else' ? '成否' : '選択',
            選択肢: choices,
          };
        } else if (targetNode.type === 'jump' && isAttachedHelperNode(targetNode)) {
          const jt = targetNode.data?.jumpTarget;
          if (jt) {
            const tgt = nodeMap.get(jt.nodeId);
            jumpTargetJp = tgt?.data?.label || jt.nodeId;
          }
        } else {
          directDestinations.push(resolveTargetTitle(targetNode));
        }
      }
    }

    humanScenes.push({
      ID: node.id,
      参照ID: d.referenceId || undefined,
      章: d.chapter,
      場面: d.label || (node.type === 'character' && d.referenceId ? charMap.get(d.referenceId) : undefined) || node.id,
      種別: typeJp,
      グループ: parentGroupLabel,
      場所: locName,
      目的: d.purpose || undefined,
      KP情報: d.kpInstructions && d.kpInstructions.length > 0 ? (d.kpInstructions.length === 1 ? d.kpInstructions[0] : d.kpInstructions) : undefined,
      描写: d.readAloudText || d.description || undefined,
      登場: charNames.length > 0 ? (charNames.length === 1 ? charNames[0] : charNames) : undefined,
      獲得アイテム: acquired.length > 0 ? (acquired.length === 1 ? acquired[0] : acquired) : undefined,
      消費アイテム: consumed.length > 0 ? (consumed.length === 1 ? consumed[0] : consumed) : undefined,
      必要アイテム: required.length > 0 ? (required.length === 1 ? required[0] : required) : undefined,
      所要時間: d.timeCostMinutes || undefined,
      リソース判定: resourceCheckJp,
      調査エリア: investigationAreaJp,
      分岐: branchJp,
      行き先: directDestinations.length > 0 ? (directDestinations.length === 1 ? directDestinations[0] : directDestinations) : undefined,
      合流先: jumpTargetJp,
      ジャンプ先: jumpTargetJp,
      エンディング: d.isEnding ? true : undefined,
      タブ: hasMultipleTabs ? (d.tab || (tabs ? tabs.find((t) => t.nodes.some((n) => n.id === node.id))?.name : undefined)) : undefined,
    });
  }

  return {
    シナリオ基本情報: basicInfo,
    シナリオの真相: meta?.truth || undefined,
    事前情報: advanceInfo,
    タブ一覧: hasMultipleTabs ? tabs!.map((t) => ({ ID: t.id, 名前: t.name })) : undefined,
    登場人物: humanCharacters.length > 0 ? humanCharacters : undefined,
    アイテム: humanResources.length > 0 ? humanResources : undefined,
    舞台: humanStages.length > 0 ? humanStages : undefined,
    場面一覧: humanScenes,
  };
}

/**
 * Serializes a HumanScenarioDocument to a clean YAML string
 */
export function exportToHumanYaml(input: HumanExportInput): string {
  const doc = exportToHumanDocument(input);
  return YAML.stringify(doc, {
    indent: 2,
    lineWidth: 0, // Avoid wrapping long text lines
  });
}
