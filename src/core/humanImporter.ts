/**
 * ARKHAM Human-Centric Scenario Importer
 * Parses non-engineer-friendly YAML/Markdown into ARKHAM Graph, Metadata, and Entity Stores.
 * Automatically generates IDs, connections, and clean layout coordinates without data loss.
 */

import YAML from 'yaml';
import type { ScenarioNode, ScenarioEdge, CharacterData, ResourceData, StageData, ScenarioMetadata, Tab } from '../types';
import type {
  HumanScenarioDocument,
  HumanScene,
} from './humanSchema';
import { getLayoutedElements, isReferenceEdge } from '../utils/autoLayout';

export interface HumanImportResult {
  scenarioMetadata: ScenarioMetadata;
  characters: CharacterData[];
  resources: ResourceData[];
  stages: StageData[];
  nodes: ScenarioNode[];
  edges: ScenarioEdge[];
  tabs?: Tab[];
}

function sanitizeIdPart(str: string): string {
  return str
    .replace(/[^\w\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/g, '_')
    .slice(0, 20)
    .replace(/^_+|_+$/g, '');
}

export function importFromHumanDocument(doc: HumanScenarioDocument): HumanImportResult {
  // 1. シナリオ基本情報の解析
  const basic = doc.シナリオ基本情報 || ({} as any);
  let targetTimeMinutes: number | undefined;
  if (typeof basic.想定時間 === 'number') {
    targetTimeMinutes = basic.想定時間;
  } else if (typeof basic.想定時間 === 'string') {
    const match = basic.想定時間.match(/\d+/);
    if (match) targetTimeMinutes = parseInt(match[0], 10);
  }

  const recommendedSkills = Array.isArray(basic.推奨技能)
    ? basic.推奨技能
    : typeof basic.推奨技能 === 'string'
    ? basic.推奨技能.split(/[,、\s]+/).map((s) => s.trim()).filter(Boolean)
    : undefined;

  const scenarioMetadata: ScenarioMetadata = {
    title: basic.タイトル || '無題のシナリオ',
    author: basic.作者,
    system: basic.システム,
    targetTime: typeof basic.想定時間 === 'string' ? basic.想定時間 : (typeof basic.想定時間 === 'number' ? `${basic.想定時間}分` : undefined),
    targetTimeMinutes,
    recommendedParty: basic.推奨人数,
    recommendedSkills,
    lossRate: basic.ロスト率,
    regulations: basic.レギュレーション,
    overview: basic.あらすじ,
    truth: doc.シナリオの真相,
    handouts: doc.事前情報
      ? {
          shared: doc.事前情報.全体共有,
          list: doc.事前情報.ハンドアウト一覧?.map((ho, idx) => ({
            id: `ho_${idx + 1}`,
            title: ho.HO,
            role: ho.役割,
            publicInfo: ho.公開情報,
            secretInfo: ho.個別秘密,
            recommendedRole: ho.推奨職業,
          })),
        }
      : undefined,
  };

  function getBaseName(str: string): string {
    return str
      .replace(/（.*?）|\(.*?\)|［.*?］|\[.*?\]|【.*?】|《.*?》|<.*?>|[×x]\d+.*$/g, '')
      .trim();
  }

  // 2. 登場人物の自動登録
  const characters: CharacterData[] = [];
  const charNameToId = new Map<string, string>();
  const charBaseNameToId = new Map<string, string>();
  const charIdToData = new Map<string, CharacterData>();

  if (doc.登場人物 && Array.isArray(doc.登場人物)) {
    doc.登場人物.forEach((c, idx) => {
      const id = c.ID || `char_${idx + 1}_${sanitizeIdPart(c.名前)}`;
      charNameToId.set(c.名前, id);
      const base = getBaseName(c.名前);
      if (base) charBaseNameToId.set(base, id);

      let type: CharacterData['type'] = 'Person';
      if (c.種別 === 'エネミー' || c.種別 === '怪物') type = 'Monster';
      else if (c.種別 === '参加者' || c.種別 === 'PC') type = 'Participant';
      else if (c.種別 === 'その他') type = 'Other';

      const charData: CharacterData = {
        id,
        name: c.名前,
        type,
        reading: c.ふりがな,
        description: c.概要,
        abilities: c.能力値,
        skills: c.技能,
        note: c.備考,
      };
      characters.push(charData);
      charIdToData.set(id, charData);
    });
  }

  // 3. アイテム・リソースの自動登録
  const resources: ResourceData[] = [];
  const resNameToId = new Map<string, string>();
  const resBaseNameToId = new Map<string, string>();
  const resIdToData = new Map<string, ResourceData>();

  if (doc.アイテム && Array.isArray(doc.アイテム)) {
    doc.アイテム.forEach((r, idx) => {
      const id = r.ID || `item_${idx + 1}_${sanitizeIdPart(r.名前)}`;
      resNameToId.set(r.名前, id);
      const base = getBaseName(r.名前);
      if (base) resBaseNameToId.set(base, id);

      let type: ResourceData['type'] = 'Item';
      if (r.種別 === '装備') type = 'Equipment';
      else if (r.種別 === '手がかり' || r.種別 === '情報') type = 'Knowledge';
      else if (r.種別 === 'その他') type = 'Status';

      const isMedicineOrFood = /薬|安定剤|鎮静剤|アンプル|回復|スプレー|食料|食塩水|キット|包帯|ポーション|電池|バッテリー|使い捨て/i.test(
        (r.名前 || '') + (r.概要 || '') + (r.効果 || '') + (r.備考 || '')
      );
      const isConsumable = isMedicineOrFood || (r as any).種別 === '消耗品' || (r as any).消耗品 === true || (r as any).isConsumable === true;
      if ((r as any).種別 === '消耗品') type = 'Item';

      const resData: ResourceData = {
        id,
        name: r.名前,
        type,
        description: r.概要,
        effect: r.効果,
        note: r.備考,
        isConsumable,
        category: isConsumable ? 'consumable' : undefined,
      };
      resources.push(resData);
      resIdToData.set(id, resData);
    });
  }

  // 4. 舞台・ロケーションの自動登録
  const stages: StageData[] = [];
  const stageNameToId = new Map<string, string>();
  const stageBaseNameToId = new Map<string, string>();
  const stageIdToData = new Map<string, StageData>();

  if (doc.舞台 && Array.isArray(doc.舞台)) {
    doc.舞台.forEach((s, idx) => {
      const id = s.ID || `stage_${idx + 1}_${sanitizeIdPart(s.名前)}`;
      stageNameToId.set(s.名前, id);
      const base = getBaseName(s.名前);
      if (base) stageBaseNameToId.set(base, id);

      let type: StageData['type'] = 'Location';
      if (s.種別 === '組織') type = 'Faction';
      else if (s.種別 === '世界観') type = 'Lore';

      const stageData: StageData = {
        id,
        name: s.名前,
        type,
        description: s.概要,
        details: s.詳細 || s.備考,
        note: s.備考,
      };
      stages.push(stageData);
      stageIdToData.set(id, stageData);
    });
  }

  // Helper to resolve Item IDs by name
  const resolveItemIds = (names?: string | string[]): string[] => {
    if (!names) return [];
    const list = Array.isArray(names) ? names : [names];
    return list.map((n) => {
      const cleanName = n.replace(/^【|】$/g, '').trim();
      if (resIdToData.has(cleanName)) return cleanName;
      if (resNameToId.has(cleanName)) return resNameToId.get(cleanName)!;
      const base = getBaseName(cleanName);
      if (base && resBaseNameToId.has(base)) return resBaseNameToId.get(base)!;
      return cleanName;
    });
  };

  // Helper to resolve Character IDs by name, base name, or partial match
  const resolveCharacterIds = (names?: string | string[]): string[] => {
    if (!names) return [];
    const list = Array.isArray(names) ? names : [names];
    return list.map((n) => {
      const cleanName = n.replace(/^[［\[《<【（(]|[\］\]》>】）)]$/g, '').trim();
      if (charIdToData.has(cleanName)) return cleanName;
      if (charNameToId.has(cleanName)) return charNameToId.get(cleanName)!;
      const base = getBaseName(cleanName);
      if (base && charBaseNameToId.has(base)) return charBaseNameToId.get(base)!;
      for (const [name, id] of charNameToId.entries()) {
        const b = getBaseName(name);
        if (b && (base.includes(b) || b.includes(base))) return id;
      }
      return cleanName;
    });
  };

  // Helper to resolve a single Character ID for character nodes, auto-registering if novel
  const resolveSingleCharacterId = (scene: HumanScene, kind?: string): string => {
    // 1. Explicit 参照ID
    if (scene.参照ID) {
      if (charIdToData.has(scene.参照ID)) return scene.参照ID;
      if (charNameToId.has(scene.参照ID)) return charNameToId.get(scene.参照ID)!;
    }

    // 2. scene.登場
    if (scene.登場) {
      const resolved = resolveCharacterIds(scene.登場);
      if (resolved.length > 0 && charIdToData.has(resolved[0])) {
        return resolved[0];
      }
    }

    // 3. Exact match on scene.場面
    const cleanSceneTitle = scene.場面.trim();
    if (charNameToId.has(cleanSceneTitle)) {
      return charNameToId.get(cleanSceneTitle)!;
    }

    // 4. Base name match on scene.場面
    const baseScene = getBaseName(cleanSceneTitle);
    if (baseScene && charBaseNameToId.has(baseScene)) {
      return charBaseNameToId.get(baseScene)!;
    }

    // 5. Substring match
    if (baseScene) {
      for (const [name, id] of charNameToId.entries()) {
        const b = getBaseName(name);
        if (b && (baseScene.includes(b) || b.includes(baseScene))) {
          return id;
        }
      }
    }

    // 6. Auto-register novel character so it is NEVER missing / "Deleted Character"
    const newId = `char_auto_${characters.length + 1}_${sanitizeIdPart(scene.場面)}`;
    const newChar: CharacterData = {
      id: newId,
      name: scene.場面,
      type: (kind === 'エネミー' || kind === '怪物') ? 'Monster' : 'Person',
      description: scene.描写,
      note: scene.KP情報 ? (Array.isArray(scene.KP情報) ? scene.KP情報.join('\n') : scene.KP情報) : undefined,
    };
    characters.push(newChar);
    charNameToId.set(newChar.name, newId);
    const newBase = getBaseName(newChar.name);
    if (newBase) charBaseNameToId.set(newBase, newId);
    charIdToData.set(newId, newChar);
    return newId;
  };

  // 5. 場面一覧からノードとエッジを再構築
  const rawScenes: HumanScene[] = doc.場面一覧 || [];

  // Group handling
  const groupNodes: ScenarioNode[] = [];
  const groupLabelToId = new Map<string, string>();
  const createdGroupIds = new Set<string>();

  // Pass 1: Discover groups
  rawScenes.forEach((scene, idx) => {
    if (scene.種別 === 'グループ' || scene.種別 === 'フェーズ') {
      const groupId = scene.ID || `group_${idx + 1}_${sanitizeIdPart(scene.場面)}`;
      groupLabelToId.set(scene.場面, groupId);
      if (scene.ID) groupLabelToId.set(scene.ID, groupId);
    } else if (scene.グループ && !groupLabelToId.has(scene.グループ)) {
      const groupId = `group_auto_${groupLabelToId.size + 1}_${sanitizeIdPart(scene.グループ)}`;
      groupLabelToId.set(scene.グループ, groupId);
    }
  });

  // Instantiate Group nodes
  rawScenes.forEach((scene, idx) => {
    if (scene.種別 === 'グループ' || scene.種別 === 'フェーズ') {
      const groupId = groupLabelToId.get(scene.場面)!;
      createdGroupIds.add(groupId);
      groupNodes.push({
        id: groupId,
        type: 'group',
        position: { x: 0, y: 0 },
        data: {
          label: scene.場面,
          expanded: true,
          description: scene.描写 || scene.目的 || scene.場面,
          chapter: scene.章 !== undefined ? scene.章 : 1,
          tab: scene.タブ,
          order: idx,
        },
        style: { width: 1400, height: 900, zIndex: -1 },
      });
    }
  });

  for (const [gLabel, gId] of groupLabelToId.entries()) {
    if (!createdGroupIds.has(gId)) {
      createdGroupIds.add(gId);
      const gScenes = rawScenes.filter((s) => s.グループ === gLabel);
      const gChapter = gScenes.find((s) => s.章 !== undefined)?.章 ?? 1;
      const gTab = gScenes.find((s) => s.タブ)?.タブ;
      groupNodes.push({
        id: gId,
        type: 'group',
        position: { x: 0, y: 0 },
        data: {
          label: gLabel,
          expanded: true,
          description: gLabel,
          chapter: gChapter,
          tab: gTab,
        },
        style: { width: 1400, height: 900, zIndex: -1 },
      });
    }
  }

  // Pass 2: Register non-group scene IDs and titles with support for duplicate labels
  const idToNodeId = new Map<string, string>();
  const titleToNodeIds = new Map<string, string[]>();
  const nodeMapParent = new Map<string, string | undefined>();
  const nodeKindMap = new Map<string, string | undefined>();

  const registerTitle = (title: string, nodeId: string) => {
    if (!title) return;
    if (!titleToNodeIds.has(title)) titleToNodeIds.set(title, []);
    titleToNodeIds.get(title)!.push(nodeId);
  };

  rawScenes.forEach((scene, idx) => {
    if (scene.種別 === 'グループ' || scene.種別 === 'フェーズ') {
      const gId = groupLabelToId.get(scene.場面)!;
      idToNodeId.set(scene.場面, gId);
      registerTitle(scene.場面, gId);
      return;
    }
    const nodeId = scene.ID || `node_${idx + 1}_${sanitizeIdPart(scene.場面)}`;
    if (scene.ID) {
      idToNodeId.set(scene.ID, nodeId);
    }
    registerTitle(scene.場面, nodeId);
    const trimmedTitle = scene.場面.replace(/^\d+-\d+\.\s*/, '');
    if (trimmedTitle !== scene.場面) {
      registerTitle(trimmedTitle, nodeId);
    }
    const parentNode = scene.グループ ? groupLabelToId.get(scene.グループ) : undefined;
    nodeMapParent.set(nodeId, parentNode);
    nodeKindMap.set(nodeId, scene.種別);
  });

  const flowNodes: ScenarioNode[] = [];
  const edges: ScenarioEdge[] = [];
  const incomingEdgeCounts = new Map<string, number>();

  const addEdge = (edge: ScenarioEdge) => {
    edges.push(edge);
    if (!isReferenceEdge(edge)) {
      incomingEdgeCounts.set(edge.target, (incomingEdgeCounts.get(edge.target) || 0) + 1);
    }
  };

  const resolveTargetNodeId = (dest?: string, _sourceNodeId?: string, sourceParentNode?: string): string | undefined => {
    if (!dest) return undefined;
    const cleanDest = dest.trim();
    const trimmed = cleanDest.replace(/^\d+-\d+\.\s*/, '');

    // 1. Exact ID match
    if (idToNodeId.has(cleanDest)) return idToNodeId.get(cleanDest);
    if (idToNodeId.has(trimmed)) return idToNodeId.get(trimmed);

    // 2. Candidate list by title
    const candidates = titleToNodeIds.get(cleanDest) || titleToNodeIds.get(trimmed);
    if (!candidates || candidates.length === 0) return undefined;
    if (candidates.length === 1) return candidates[0];

    // 3. Disambiguation among multiple candidates:
    // 3a. Prefer candidates within the same parent group
    if (sourceParentNode) {
      const sameGroup = candidates.filter((cId) => nodeMapParent.get(cId) === sourceParentNode);
      if (sameGroup.length === 1) return sameGroup[0];
      if (sameGroup.length > 1) {
        // Among same group, prefer candidate with 0 incoming edges
        const zeroIn = sameGroup.find((cId) => (incomingEdgeCounts.get(cId) || 0) === 0);
        if (zeroIn) return zeroIn;
        return sameGroup[0];
      }
    }

    // 3b. Global fallback: prefer candidate with 0 incoming edges
    const zeroIn = candidates.find((cId) => (incomingEdgeCounts.get(cId) || 0) === 0);
    if (zeroIn) return zeroIn;

    return candidates[0];
  };

  // Helper to connect an event/scene node to a character node via reference edge
  const connectCharacterReference = (sourceId: string, charNamesOrIds?: string | string[]) => {
    if (!charNamesOrIds) return;
    const resolvedIds = resolveCharacterIds(charNamesOrIds);
    for (const cid of resolvedIds) {
      // Find candidate character scene or node
      const charScene = rawScenes.find((s) => {
        if (s.種別 !== '登場人物' && s.種別 !== 'NPC' && s.種別 !== 'エネミー' && s.種別 !== '怪物') return false;
        if (s.参照ID === cid) return true;
        const rId = resolveSingleCharacterId(s, s.種別);
        return rId === cid;
      });

      if (charScene) {
        const charNodeId = charScene.ID || idToNodeId.get(charScene.ID || '') || titleToNodeIds.get(charScene.場面)?.[0];
        if (charNodeId && charNodeId !== sourceId) {
          const refEdgeId = `edge_ref_${sourceId}_to_${charNodeId}`;
          if (!edges.some((e) => e.source === sourceId && e.target === charNodeId)) {
            addEdge({
              id: refEdgeId,
              source: sourceId,
              target: charNodeId,
              type: 'reference',
              sourceHandle: 'ref-source',
              targetHandle: 'ref-target',
            });
          }
        }
      }
    }
  };

  // Pass 3: Instantiate flow nodes and wire up edges
  rawScenes.forEach((scene, idx) => {
    if (scene.種別 === 'グループ' || scene.種別 === 'フェーズ') return;

    const nodeId = scene.ID || idToNodeId.get(scene.ID || '') || titleToNodeIds.get(scene.場面)?.[0] || `node_${idx + 1}_${sanitizeIdPart(scene.場面)}`;
    const parentNode = scene.グループ ? groupLabelToId.get(scene.グループ) : undefined;
    const kind = scene.種別;

    const kpNotes = Array.isArray(scene.KP情報)
      ? scene.KP情報
      : typeof scene.KP情報 === 'string'
      ? [scene.KP情報]
      : [];

    const locId = scene.場所
      ? stageNameToId.get(scene.場所.replace(/^［|］$/g, '')) || scene.場所
      : undefined;

    // A. Branch Node (Standalone)
    if (kind === '分岐' || kind === '判定' || kind === '行動選択') {
      const branchCases = scene.分岐?.選択肢?.map((choice, cIdx) => ({
        id: `case_${cIdx + 1}`,
        label: choice.条件 || choice.ラベル || `選択肢 ${cIdx + 1}`,
        conditionValue: choice.条件,
      })) || [];

      const branchType = scene.分岐?.分岐種別 === '成否'
        ? 'if_else'
        : (scene.分岐?.分岐種別 === '選択' ? 'switch' : (kind === '行動選択' ? 'switch' : 'switch'));

      flowNodes.push({
        id: nodeId,
        type: 'branch',
        position: { x: 0, y: 0 },
        parentNode,
        data: {
          label: scene.場面,
          branchType,
          branches: branchCases,
          chapter: scene.章 !== undefined ? scene.章 : 1,
          tab: scene.タブ,
          description: scene.描写,
          conditionType: kind === '判定' ? 'check' : 'variable',
          order: idx,
        },
      });

      // Connect branch cases to targets
      scene.分岐?.選択肢?.forEach((choice, cIdx) => {
        const targetNodeId = resolveTargetNodeId(choice.行き先, nodeId, parentNode);
        if (targetNodeId) {
          addEdge({
            id: `edge_${nodeId}_case_${cIdx + 1}_to_${targetNodeId}`,
            source: nodeId,
            target: targetNodeId,
            sourceHandle: `case_${cIdx + 1}`,
            label: choice.条件 || choice.ラベル,
          });
        }
      });

      if (scene.登場) {
        connectCharacterReference(nodeId, scene.登場);
      }
      return;
    }

    // B. Element / Item Node (Standalone)
    if (kind === 'アイテム' || kind === '手がかり' || kind === '情報') {
      const acquiredList = resolveItemIds(scene.獲得アイテム);
      let refItemId: string | undefined = scene.参照ID;
      if (refItemId && !resIdToData.has(refItemId)) {
        if (resNameToId.has(refItemId)) {
          refItemId = resNameToId.get(refItemId);
        } else if (acquiredList.length > 0 && resIdToData.has(acquiredList[0])) {
          refItemId = acquiredList[0];
        }
      }
      if (!refItemId && acquiredList.length > 0) refItemId = acquiredList[0];

      let infoVal = scene.場面;
      const matchBracket = scene.場面.match(/【(.*?)】/);
      if (matchBracket) {
        infoVal = matchBracket[1];
        if (!refItemId) {
          if (resNameToId.has(matchBracket[1])) refItemId = resNameToId.get(matchBracket[1]);
          else if (resBaseNameToId.has(getBaseName(matchBracket[1]))) refItemId = resBaseNameToId.get(getBaseName(matchBracket[1]));
        }
      } else if (!refItemId) {
        if (resNameToId.has(scene.場面)) refItemId = resNameToId.get(scene.場面);
        else if (resBaseNameToId.has(getBaseName(scene.場面))) refItemId = resBaseNameToId.get(getBaseName(scene.場面));
      }

      if (refItemId && resIdToData.has(refItemId)) {
        infoVal = resIdToData.get(refItemId)!.name;
      }

      const combinedAcquired = refItemId
        ? (acquiredList.includes(refItemId) ? acquiredList : [refItemId, ...acquiredList])
        : acquiredList;

      flowNodes.push({
        id: nodeId,
        type: 'element',
        position: { x: 0, y: 0 },
        parentNode,
        data: {
          label: scene.場面,
          referenceId: refItemId,
          infoValue: infoVal,
          infoType: (kind === '手がかり' || kind === '情報') ? 'knowledge' : 'item',
          actionType: 'obtain',
          quantity: 1,
          acquiredItems: combinedAcquired.length > 0 ? combinedAcquired : undefined,
          chapter: scene.章 !== undefined ? scene.章 : 1,
          tab: scene.タブ,
          description: scene.描写,
          order: idx,
        },
      });

      if (scene.行き先) {
        const dests = Array.isArray(scene.行き先) ? scene.行き先 : [scene.行き先];
        dests.forEach((destTitle, dIdx) => {
          const targetNodeId = resolveTargetNodeId(destTitle, nodeId, parentNode);
          if (targetNodeId) {
            addEdge({
              id: `edge_${nodeId}_to_${targetNodeId}_${dIdx}`,
              source: nodeId,
              target: targetNodeId,
            });
          }
        });
      }

      if (scene.登場) {
        connectCharacterReference(nodeId, scene.登場);
      }
      return;
    }

    // C. Memo Node (メモノード)
    if (kind === 'メモ') {
      const memoText = [scene.描写, scene.KP情報 ? (Array.isArray(scene.KP情報) ? scene.KP情報.join('\n') : scene.KP情報) : undefined]
        .filter(Boolean)
        .join('\n\n');

      flowNodes.push({
        id: nodeId,
        type: 'memo',
        position: { x: 0, y: 0 },
        parentNode,
        data: {
          label: scene.場面,
          description: memoText || scene.描写 || '',
          chapter: scene.章 ?? 0,
          tab: scene.タブ,
          order: idx,
        },
      });

      if (scene.行き先) {
        const dests = Array.isArray(scene.行き先) ? scene.行き先 : [scene.行き先];
        dests.forEach((destTitle, dIdx) => {
          const targetNodeId = resolveTargetNodeId(destTitle, nodeId, parentNode);
          if (targetNodeId) {
            addEdge({
              id: `edge_${nodeId}_to_${targetNodeId}_${dIdx}`,
              source: nodeId,
              target: targetNodeId,
            });
          }
        });
      }
      return;
    }

    // D. Character Node (Standalone)
    if (kind === '登場人物' || kind === 'NPC' || kind === 'エネミー' || kind === '怪物') {
      const refCharId = resolveSingleCharacterId(scene, kind);
      const refChar = charIdToData.get(refCharId);

      flowNodes.push({
        id: nodeId,
        type: 'character',
        position: { x: 0, y: 0 },
        parentNode,
        data: {
          label: scene.場面,
          referenceId: refCharId,
          characterType: (kind === 'エネミー' || kind === '怪物' || refChar?.type === 'Monster') ? 'Monster' : 'NPC',
          associatedCharacterIds: [refCharId],
          chapter: scene.章 !== undefined ? scene.章 : 1,
          tab: scene.タブ,
          description: scene.描写 || refChar?.description,
          order: idx,
        },
      });

      if (scene.行き先) {
        const dests = Array.isArray(scene.行き先) ? scene.行き先 : [scene.行き先];
        dests.forEach((destTitle, dIdx) => {
          const targetNodeId = resolveTargetNodeId(destTitle, nodeId, parentNode);
          if (targetNodeId) {
            addEdge({
              id: `edge_${nodeId}_to_${targetNodeId}_${dIdx}`,
              source: nodeId,
              target: targetNodeId,
            });
          }
        });
      }
      return;
    }

    // Stage Node (Standalone)
    if (kind === '舞台' || kind === '場所') {
      const refStageId = scene.参照ID || stageNameToId.get(scene.場面) || stageBaseNameToId.get(getBaseName(scene.場面));
      flowNodes.push({
        id: nodeId,
        type: 'stage',
        position: { x: 0, y: 0 },
        parentNode,
        data: {
          label: scene.場面,
          referenceId: refStageId,
          chapter: scene.章 !== undefined ? scene.章 : 1,
          tab: scene.タブ,
          description: scene.描写,
          order: idx,
        },
      });

      if (scene.行き先) {
        const dests = Array.isArray(scene.行き先) ? scene.行き先 : [scene.行き先];
        dests.forEach((destTitle, dIdx) => {
          const targetNodeId = resolveTargetNodeId(destTitle, nodeId, parentNode);
          if (targetNodeId) {
            addEdge({
              id: `edge_${nodeId}_to_${targetNodeId}_${dIdx}`,
              source: nodeId,
              target: targetNodeId,
            });
          }
        });
      }
      return;
    }

    // D. Jump Node (Standalone)
    if (kind === 'ジャンプ' || kind === '合流') {
      const jumpTargetTitle = scene.ジャンプ先 || scene.合流先 || (Array.isArray(scene.行き先) ? scene.行き先[0] : scene.行き先);
      const targetNodeId = jumpTargetTitle ? resolveTargetNodeId(jumpTargetTitle, nodeId, parentNode) : undefined;

      flowNodes.push({
        id: nodeId,
        type: 'jump',
        position: { x: 0, y: 0 },
        parentNode,
        data: {
          label: scene.場面,
          jumpTarget: targetNodeId ? { tabId: 'tab_main', nodeId: targetNodeId } : undefined,
          chapter: scene.章 !== undefined ? scene.章 : 1,
          tab: scene.タブ,
          description: scene.描写,
          order: idx,
        },
      });
      return;
    }

    // E. Default Event Node
    const invPoints = scene.調査エリア?.調査ポイント?.map((ip: any, pIdx) => ({
      id: `ip_${idx + 1}_${pIdx + 1}`,
      name: ip.name || ip.名前,
      description: ip.description || ip.概要,
      details: ip.details || ip.詳細,
      discoveredItems: resolveItemIds(ip.discoveredItems || ip.発見アイテム),
      checks: (ip.checks || ip.判定)?.map((chk: any) => ({
        skillName: chk.skillName || chk.技能,
        difficulty: (chk.difficulty || chk.難易度 || 'regular') as any,
        onSuccess: chk.onSuccess ? { sanRecovery: chk.onSuccess } : undefined,
        onFailure: chk.onFailure ? { sanRecovery: chk.onFailure } : undefined,
      })),
    }));

    flowNodes.push({
      id: nodeId,
      type: 'event',
      position: { x: 0, y: 0 },
      parentNode,
      data: {
        label: scene.場面,
        isStart: idx === 0,
        chapter: scene.章 !== undefined ? scene.章 : 1,
        tab: scene.タブ,
        order: idx,
        locationId: locId,
        purpose: scene.目的,
        timeCostMinutes: scene.所要時間,
        description: scene.描写 || scene.目的 || scene.場面,
        readAloudText: scene.描写,
        kpInstructions: kpNotes,
        investigationPoints: invPoints,
        acquiredItems: resolveItemIds(scene.獲得アイテム),
        consumedItems: resolveItemIds(scene.消費アイテム),
        requiredItems: resolveItemIds(scene.必要アイテム),
        associatedCharacterIds: resolveCharacterIds(scene.登場),
        isEnding: Boolean(scene.エンディング),
        resourceCheck: scene.リソース判定
          ? {
              trigger: scene.リソース判定.トリガー,
              successLoss: String(scene.リソース判定.成功時),
              failLoss: String(scene.リソース判定.失敗時),
              resourceName: scene.リソース判定.対象リソース,
            }
          : undefined,
      },
    });

    if (scene.登場) {
      connectCharacterReference(nodeId, scene.登場);
    }

    // Attached branch if scene has branch and is not standalone
    if (scene.分岐 && scene.分岐.選択肢 && scene.分岐.選択肢.length > 0) {
      const branchNodeId = `${nodeId}_branch`;
      addEdge({
        id: `edge_${nodeId}_to_branch`,
        source: nodeId,
        target: branchNodeId,
      });

      const branchCases = scene.分岐.選択肢.map((choice, cIdx) => ({
        id: `case_${cIdx + 1}`,
        label: choice.条件 || choice.ラベル || `選択肢 ${cIdx + 1}`,
        conditionValue: choice.条件,
      }));

      flowNodes.push({
        id: branchNodeId,
        type: 'branch',
        position: { x: 0, y: 0 },
        parentNode,
        data: {
          label: `${scene.場面} の分岐`,
          branchType: scene.分岐.分岐種別 === '成否' ? 'if_else' : 'switch',
          branches: branchCases,
          conditionType: 'check',
        },
      });

      scene.分岐.選択肢.forEach((choice, cIdx) => {
        const targetTitle = choice.行き先;
        const targetNodeId = resolveTargetNodeId(targetTitle, branchNodeId, parentNode);
        if (targetNodeId) {
          addEdge({
            id: `edge_${branchNodeId}_case_${cIdx + 1}_to_${targetNodeId}`,
            source: branchNodeId,
            target: targetNodeId,
            sourceHandle: `case_${cIdx + 1}`,
            label: choice.条件 || choice.ラベル,
          });
        }
      });
    } else if (scene.行き先) {
      const dests = Array.isArray(scene.行き先) ? scene.行き先 : [scene.行き先];
      dests.forEach((destTitle, dIdx) => {
        const targetNodeId = resolveTargetNodeId(destTitle, nodeId, parentNode);
        if (targetNodeId) {
          addEdge({
            id: `edge_${nodeId}_to_${targetNodeId}_${dIdx}`,
            source: nodeId,
            target: targetNodeId,
          });
        }
      });
    }

    if (scene.合流先) {
      const jumpTargetTitle = scene.合流先;
      const targetNodeId = resolveTargetNodeId(jumpTargetTitle, nodeId, parentNode);
      if (targetNodeId) {
        const jumpNodeId = `${nodeId}_jump`;
        flowNodes.push({
          id: jumpNodeId,
          type: 'jump',
          position: { x: 0, y: 0 },
          parentNode,
          data: {
            label: `合流: ${jumpTargetTitle}`,
            jumpTarget: { tabId: 'tab_main', nodeId: targetNodeId },
          },
        });
        addEdge({
          id: `edge_${nodeId}_to_jump`,
          source: nodeId,
          target: jumpNodeId,
        });
      }
    }
  });

  // Post-pass A: Ensure all Jump nodes receive their incoming edge
  const jumpNodes = flowNodes.filter((n) => n.type === 'jump');
  for (const jNode of jumpNodes) {
    if ((incomingEdgeCounts.get(jNode.id) || 0) > 0) continue;

    // Jump node has 0 incoming edges. Find its predecessor scene in document order
    const jIdx = rawScenes.findIndex((s) => (s.ID && s.ID === jNode.id) || s.場面 === jNode.data?.label);
    if (jIdx > 0) {
      for (let prevIdx = jIdx - 1; prevIdx >= 0; prevIdx--) {
        const prevScene = rawScenes[prevIdx];
        if (prevScene.種別 === 'グループ' || prevScene.種別 === 'フェーズ') continue;
        const prevParent = prevScene.グループ ? groupLabelToId.get(prevScene.グループ) : undefined;
        if (prevParent !== jNode.parentNode) continue;

        const prevNodeId = prevScene.ID || idToNodeId.get(prevScene.ID || '') || titleToNodeIds.get(prevScene.場面)?.[0];
        if (!prevNodeId) continue;

        // Check if prevScene destination matches this jump's label or ID
        const dests = Array.isArray(prevScene.行き先) ? prevScene.行き先 : (prevScene.行き先 ? [prevScene.行き先] : []);
        const matchesDest = dests.some((d) => d === jNode.id || d === jNode.data?.label || d?.replace(/^\d+-\d+\.\s*/, '') === jNode.data?.label);

        if (matchesDest || prevIdx === jIdx - 1) {
          // Connect predecessor to this jump node
          const existingEdgeIdx = edges.findIndex(
            (e) => e.source === prevNodeId && flowNodes.some((fn) => fn.id === e.target && fn.type === 'jump')
          );
          if (existingEdgeIdx >= 0) {
            const oldTarget = edges[existingEdgeIdx].target;
            incomingEdgeCounts.set(oldTarget, Math.max(0, (incomingEdgeCounts.get(oldTarget) || 1) - 1));
            edges[existingEdgeIdx].target = jNode.id;
            incomingEdgeCounts.set(jNode.id, (incomingEdgeCounts.get(jNode.id) || 0) + 1);
          } else {
            addEdge({
              id: `edge_${prevNodeId}_to_${jNode.id}`,
              source: prevNodeId,
              target: jNode.id,
            });
          }
          break;
        }
      }
    }
  }

  // Post-pass B: Ensure all Character and supplementary reference nodes are connected
  const charNodes = flowNodes.filter((n) => n.type === 'character');
  const eventNodes = flowNodes.filter((n) => n.type === 'event' || n.type === 'branch');

  for (const cNode of charNodes) {
    const hasEdge = edges.some((e) => e.source === cNode.id || e.target === cNode.id);
    if (hasEdge) continue;

    const charRefId = cNode.data?.referenceId;
    const charData = charRefId ? charIdToData.get(charRefId) : undefined;
    const charName = charData?.name || cNode.data?.label || '';
    const charBase = getBaseName(charName);

    let bestEvent: ScenarioNode | null = null;
    let bestScore = -1;

    for (const ev of eventNodes) {
      let score = 0;
      const evDesc = ev.data?.description || '';
      const evLabel = ev.data?.label || '';
      const kpText = Array.isArray(ev.data?.kpInstructions) ? ev.data.kpInstructions.join(' ') : '';
      const allText = `${evLabel} ${evDesc} ${kpText}`;

      if (charRefId && ev.data?.associatedCharacterIds?.includes(charRefId)) {
        score += 30;
      }
      if (charBase && allText.includes(charBase)) score += 15;
      if (charName && allText.includes(charName)) score += 10;
      if (charRefId && allText.includes(charRefId)) score += 10;

      if (ev.data?.chapter && cNode.data?.chapter && ev.data.chapter === cNode.data.chapter) {
        score += 3;
      }

      if (score > bestScore && score > 0) {
        bestScore = score;
        bestEvent = ev;
      }
    }

    if (!bestEvent && eventNodes.length > 0) {
      bestEvent = eventNodes.find((ev) => ev.data?.chapter === cNode.data?.chapter) || eventNodes[0];
    }

    if (bestEvent) {
      addEdge({
        id: `edge_ref_${bestEvent.id}_to_${cNode.id}`,
        source: bestEvent.id,
        target: cNode.id,
        type: 'reference',
        sourceHandle: 'ref-source',
        targetHandle: 'ref-target',
      });
    }
  }

  const rawCombinedNodes = [...groupNodes, ...flowNodes];

  const allNodesMap = new Map<string, ScenarioNode>();
  for (const n of rawCombinedNodes) {
    allNodesMap.set(n.id, n);
  }

  // 6. タブ分割 (ファイルのスキーマでタブ一覧または場面のタブが指定されている場合のみ分割)
  const rawTabs = doc.タブ一覧;
  const hasExplicitTabs = Boolean(
    (rawTabs && rawTabs.length > 0) ||
    rawScenes.some((s) => s.タブ)
  );

  let tabs: Tab[] = [];

  if (!hasExplicitTabs) {
    // スキーマでタブが指定されていない場合: 全ての場面・章を1画面（単一タブ）に集約
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      rawCombinedNodes,
      edges,
      { direction: 'TB' }
    );
    tabs = [
      {
        id: 'tab_main',
        name: scenarioMetadata.title || 'メインフロー',
        nodes: layoutedNodes,
        edges: layoutedEdges,
      },
    ];
  } else {
    // スキーマでタブが指定されている場合: 指定されたタブ定義に従って分割配置
    interface TabInfo {
      id: string;
      name: string;
    }
    const tabsList: TabInfo[] = [];
    const tabKeyToId = new Map<string, string>(); // maps both id and name to tabId

    if (rawTabs && Array.isArray(rawTabs)) {
      rawTabs.forEach((entry, idx) => {
        const tabName = typeof entry === 'string' ? entry : entry.名前;
        const tabId = (typeof entry === 'object' && entry.ID) ? entry.ID : `tab_${idx + 1}_${sanitizeIdPart(tabName)}`;
        const info: TabInfo = { id: tabId, name: tabName };
        tabsList.push(info);
        tabKeyToId.set(tabId, tabId);
        tabKeyToId.set(tabName, tabId);
      });
    }

    rawScenes.forEach((s) => {
      if (s.タブ && !tabKeyToId.has(s.タブ)) {
        const tabId = `tab_${tabsList.length + 1}_${sanitizeIdPart(s.タブ)}`;
        const info: TabInfo = { id: tabId, name: s.タブ };
        tabsList.push(info);
        tabKeyToId.set(tabId, tabId);
        tabKeyToId.set(s.タブ, tabId);
      }
    });

    if (tabsList.length === 0) {
      tabsList.push({ id: 'tab_main', name: scenarioMetadata.title || 'メインフロー' });
    }

    const getTabIdOfNode = (n: ScenarioNode): string => {
      const directTab = n.data?.tab;
      if (directTab && tabKeyToId.has(directTab)) {
        return tabKeyToId.get(directTab)!;
      }
      if (n.parentNode) {
        const pNode = allNodesMap.get(n.parentNode);
        const pTab = pNode?.data?.tab;
        if (pTab && tabKeyToId.has(pTab)) {
          return tabKeyToId.get(pTab)!;
        }
      }
      const ch = n.data?.chapter;
      if (ch !== undefined) {
        const matchTab = tabsList.find((t) => {
          if (ch === 0 && (t.name.includes('事前') || t.id.includes('ch0') || t.id.includes('intro'))) return true;
          return t.name.includes(`第${ch}章`) || t.id.includes(`ch${ch}`);
        });
        if (matchTab) return matchTab.id;
      }
      return tabsList[0].id;
    };

    const nodesByTabId = new Map<string, ScenarioNode[]>();
    const edgesByTabId = new Map<string, ScenarioEdge[]>();
    for (const t of tabsList) {
      nodesByTabId.set(t.id, []);
      edgesByTabId.set(t.id, []);
    }

    for (const n of rawCombinedNodes) {
      const tid = getTabIdOfNode(n);
      if (!nodesByTabId.has(tid)) nodesByTabId.set(tid, []);
      nodesByTabId.get(tid)!.push(n);
    }

    // Update existing jump nodes' target tabId
    for (const n of rawCombinedNodes) {
      if (n.type === 'jump' && n.data?.jumpTarget?.nodeId) {
        const targetNode = allNodesMap.get(n.data.jumpTarget.nodeId);
        if (targetNode) {
          const targetTabId = getTabIdOfNode(targetNode);
          n.data.jumpTarget.tabId = targetTabId;
        }
      }
    }

    // Process edges: partition within-tab, or bridge cross-tab
    for (const e of edges) {
      const srcNode = allNodesMap.get(e.source);
      const tgtNode = allNodesMap.get(e.target);
      if (!srcNode || !tgtNode) continue;

      const srcTabId = getTabIdOfNode(srcNode);
      const tgtTabId = getTabIdOfNode(tgtNode);

      if (srcTabId === tgtTabId) {
        if (!edgesByTabId.has(srcTabId)) edgesByTabId.set(srcTabId, []);
        edgesByTabId.get(srcTabId)!.push(e);
      } else {
        const targetTabInfo = tabsList.find((t) => t.id === tgtTabId) || { id: tgtTabId, name: tgtTabId };
        const jumpId = `jump_${e.source}_to_${e.target}_cross_jump`;
        const jumpLabel = `${targetTabInfo.name}へ進む`;

        const jumpNode: ScenarioNode = {
          id: jumpId,
          type: 'jump',
          position: { x: (srcNode.position?.x ?? 0) + 200, y: srcNode.position?.y ?? 0 },
          parentNode: srcNode.parentNode,
          data: {
            label: jumpLabel,
            jumpTarget: { tabId: tgtTabId, nodeId: tgtNode.id },
            chapter: srcNode.data?.chapter,
            tab: srcTabId,
            description: tgtNode.data?.label ? `「${tgtNode.data.label}」へジャンプします` : '別タブへ遷移します',
          },
        };
        nodesByTabId.get(srcTabId)!.push(jumpNode);
        allNodesMap.set(jumpId, jumpNode);

        edgesByTabId.get(srcTabId)!.push({
          ...e,
          id: `${e.id}_to_cross_jump`,
          target: jumpId,
        });
      }
    }

    // Apply auto layout per tab
    for (const t of tabsList) {
      const tabNodes = nodesByTabId.get(t.id) || [];
      const tabEdges = edgesByTabId.get(t.id) || [];
      const { nodes: layoutedTabNodes, edges: layoutedTabEdges } = getLayoutedElements(
        tabNodes,
        tabEdges,
        { direction: 'TB' }
      );
      tabs.push({
        id: t.id,
        name: t.name,
        nodes: layoutedTabNodes,
        edges: layoutedTabEdges,
      });
    }
  }

  const allLayoutedNodes = tabs.flatMap((t) => t.nodes);
  const allLayoutedEdges = tabs.flatMap((t) => t.edges);

  return {
    scenarioMetadata,
    characters,
    resources,
    stages,
    nodes: allLayoutedNodes,
    edges: allLayoutedEdges,
    tabs,
  };
}

/**
 * Parses a YAML string into ARKHAM scenario elements
 */
export function importFromHumanYaml(yamlText: string): HumanImportResult {
  const parsed = YAML.parse(yamlText);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('YAMLの解析に失敗しました。正しいYAML形式で記述されているか確認してください。');
  }
  return importFromHumanDocument(parsed as HumanScenarioDocument);
}
