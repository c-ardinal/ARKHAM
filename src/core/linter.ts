/**
 * ARKHAM Core Engine - Linter Module
 * Implements static checks, bracket parsing, reference integrity, and fuzzy matching
 * Based on ARKHAM_HANDOVER.md Section 2 & Section 4 (Feature 1)
 */

import type { CoreGraph, LintIssue, ScenarioNode } from './schema';
import { validateExpression } from './expression';

/**
 * Forbidden meta-gaming terms for PL read-aloud text
 */
export const FORBIDDEN_READ_ALOUD_TERMS = [
  'ボス',
  '中ボス',
  'エネミー',
  'ボス異形',
  '1T',
  'ターン',
  'NPC',
  '戦闘フェーズ',
] as const;

/**
 * Calculates Levenshtein distance between two strings
 */
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,      // deletion
        dp[i][j - 1] + 1,      // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return dp[m][n];
}

/**
 * Extracts items enclosed in 【 】
 */
export function extractItemNames(text: string): string[] {
  if (!text) return [];
  const regex = /【([^】]+)】/g;
  const matches: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    matches.push(m[1].trim());
  }
  return matches;
}

/**
 * Checks for unclosed semantic brackets
 */
export function checkBracketSyntax(text: string, nodeId?: string): LintIssue[] {
  const issues: LintIssue[] = [];
  const bracketPairs: [string, string, string][] = [
    ['【', '】', 'アイテム'],
    ['［', '］', '場所'],
    ['《', '》', '探索点/調査対象'],
    ['〈', '〉', '技能'],
    ['〔', '〕', 'マスタリング指示'],
    ['『', '』', '引用/セリフ'],
  ];

  for (const [open, close, name] of bracketPairs) {
    const openCount = (text.match(new RegExp(open, 'g')) || []).length;
    const closeCount = (text.match(new RegExp(close, 'g')) || []).length;
    if (openCount !== closeCount) {
      issues.push({
        code: 'bracket_syntax_error',
        severity: 'warning',
        message: `${name}括弧 ${open}${close} の対応が取れていません (開き: ${openCount}回, 閉じ: ${closeCount}回)`,
        nodeId,
      });
    }
  }

  return issues;
}

/**
 * Finds closest matching item name in master data
 */
export function findClosestItem(name: string, masterNames: string[]): { name: string; distance: number } | null {
  if (masterNames.length === 0) return null;
  let bestMatch = masterNames[0];
  let minDistance = levenshteinDistance(name, bestMatch);

  for (let i = 1; i < masterNames.length; i++) {
    const dist = levenshteinDistance(name, masterNames[i]);
    if (dist < minDistance) {
      minDistance = dist;
      bestMatch = masterNames[i];
    }
  }

  return { name: bestMatch, distance: minDistance };
}

/**
 * Collects all texts from a node for linting
 */
function collectNodeTexts(node: ScenarioNode): { field: string; text: string }[] {
  const list: { field: string; text: string }[] = [];
  if (node.title) list.push({ field: 'title', text: node.title });
  if (node.purpose) list.push({ field: 'purpose', text: node.purpose });
  if (node.readAloudText) list.push({ field: 'readAloudText', text: node.readAloudText });
  for (let i = 0; i < node.kpInstructions.length; i++) {
    list.push({ field: `kpInstructions[${i}]`, text: node.kpInstructions[i] });
  }
  for (let i = 0; i < node.investigationPoints.length; i++) {
    const ip = node.investigationPoints[i];
    list.push({ field: `investigationPoints[${i}].name`, text: ip.name });
    list.push({ field: `investigationPoints[${i}].description`, text: ip.description });
  }
  return list;
}

/**
 * Runs the ARKHAM Linter on a CoreGraph
 */
export function lintGraph(graph: CoreGraph): LintIssue[] {
  const issues: LintIssue[] = [];
  const { masterData, nodes, edges, startNodeId } = graph;

  const itemMapById = new Map(masterData.items.map((it) => [it.id, it]));
  const itemMapByName = new Map(masterData.items.map((it) => [it.name, it]));
  const masterItemNames = masterData.items.map((it) => it.name);
  const masterVariables = new Set((masterData.variables || []).map((v) => v.name));

  // Set of items ever referenced or acquired
  const acquiredItemIds = new Set<string>();
  const usedItemIds = new Set<string>();

  // Track referenced item names for dead item check
  const usedItemNames = new Set<string>();

  // 1. Lint each node
  for (const node of nodes) {
    // Check variable operations if any
    if (node.variableOperations && masterVariables.size > 0) {
      for (const op of node.variableOperations) {
        if (!masterVariables.has(op.variableName)) {
          issues.push({
            code: 'undefined_variable',
            severity: 'warning',
            message: `ノード「${node.title}」の変数操作「${op.variableName}」が MasterData に未登録です。`,
            nodeId: node.id,
            location: 'variableOperations',
          });
        }
      }
    }
    // 1.1 Check readAloudText for forbidden terms
    if (node.readAloudText) {
      for (const term of FORBIDDEN_READ_ALOUD_TERMS) {
        const isMatched =
          term === 'ターン'
            ? /(?<!パ)ターン/.test(node.readAloudText)
            : node.readAloudText.includes(term);
        if (isMatched) {
          issues.push({
            code: 'forbidden_read_aloud_term',
            severity: 'error',
            message: `KP描写テキストに禁則用語「${term}」が含まれています。クトゥルフの世界観に沿った恐怖描写に置き換えてください。`,
            nodeId: node.id,
            location: 'readAloudText',
            suggestion: term === 'ボス' || term === '中ボス' || term === 'エネミー' || term === 'ボス異形'
              ? '「体長3メートルを超える異様な肉塊の巨躯」「咆哮を轟かせる怪異」など'
              : undefined,
          });
        }
      }
    }

    // 1.2 Collect texts and check brackets & item references
    const texts = collectNodeTexts(node);
    for (const { field, text } of texts) {
      // Syntax check
      const syntaxIssues = checkBracketSyntax(text, node.id);
      issues.push(...syntaxIssues);

      // Extract 【アイテム名】
      const itemsInText = extractItemNames(text);
      for (const itemName of itemsInText) {
        usedItemNames.add(itemName);
        if (!itemMapByName.has(itemName)) {
          // Check fuzzy matching
          const closest = findClosestItem(itemName, masterItemNames);
          if (closest && closest.distance <= Math.max(3, Math.floor(itemName.length * 0.5))) {
            issues.push({
              code: 'fuzzy_item_match',
              severity: 'warning',
              message: `「【${itemName}】」は未登録です。「【${closest.name}】」の表記揺れではありませんか？`,
              nodeId: node.id,
              location: field,
              suggestion: closest.name,
            });
          } else {
            issues.push({
              code: 'undefined_item',
              severity: 'error',
              message: `未定義のアイテム「【${itemName}】」が参照されています。ItemMaster に登録してください。`,
              nodeId: node.id,
              location: field,
            });
          }
        }
      }
    }

    // 1.3 Check structured requiredItems / acquiredItems / consumedItems
    for (const itemId of node.requiredItems) {
      usedItemIds.add(itemId);
      if (!itemMapById.has(itemId)) {
        issues.push({
          code: 'undefined_item',
          severity: 'error',
          message: `ノード「${node.title}」の必要アイテム(ID: ${itemId})が ItemMaster に存在しません。`,
          nodeId: node.id,
          location: 'requiredItems',
        });
      }
    }

    for (const itemId of node.acquiredItems) {
      acquiredItemIds.add(itemId);
      if (!itemMapById.has(itemId)) {
        issues.push({
          code: 'undefined_item',
          severity: 'error',
          message: `ノード「${node.title}」の獲得アイテム(ID: ${itemId})が ItemMaster に存在しません。`,
          nodeId: node.id,
          location: 'acquiredItems',
        });
      }
    }

    for (const itemId of node.consumedItems) {
      usedItemIds.add(itemId);
      if (!itemMapById.has(itemId)) {
        issues.push({
          code: 'undefined_item',
          severity: 'error',
          message: `ノード「${node.title}」の消費アイテム(ID: ${itemId})が ItemMaster に存在しません。`,
          nodeId: node.id,
          location: 'consumedItems',
        });
      }
    }

    // 1.4 Check investigation point checks
    for (const ip of node.investigationPoints) {
      if (ip.checks) {
        for (const check of ip.checks) {
          if ((check as any).requiredItemIds) {
            for (const id of (check as any).requiredItemIds) {
              usedItemIds.add(id);
              if (!itemMapById.has(id)) {
                issues.push({
                  code: 'undefined_item',
                  severity: 'error',
                  message: `探索点「${ip.name}」の必要アイテム(ID: ${id})が ItemMaster に存在しません。`,
                  nodeId: node.id,
                });
              }
            }
          }
          const checkActions = [check.onSuccess, check.onFailure, check.onCritical].filter(Boolean);
          for (const act of checkActions) {
            if (act?.acquireItemIds) {
              for (const id of act.acquireItemIds) {
                acquiredItemIds.add(id);
                if (!itemMapById.has(id)) {
                  issues.push({
                    code: 'undefined_item',
                    severity: 'error',
                    message: `探索点「${ip.name}」の獲得アイテム(ID: ${id})が ItemMaster に存在しません。`,
                    nodeId: node.id,
                  });
                }
              }
            }
            if (act?.consumeItemIds) {
              for (const id of act.consumeItemIds) {
                usedItemIds.add(id);
                if (!itemMapById.has(id)) {
                  issues.push({
                    code: 'undefined_item',
                    severity: 'error',
                    message: `探索点「${ip.name}」の消費アイテム(ID: ${id})が ItemMaster に存在しません。`,
                    nodeId: node.id,
                  });
                }
              }
            }
          }
        }
      }
    }
  }

  // 2. Check edges for item condition references & variable expressions
  for (const edge of edges) {
    if (edge.conditionType === 'item_held' && edge.conditionValue) {
      const vals = edge.conditionValue.split(',').map((s) => s.trim());
      for (const v of vals) {
        usedItemIds.add(v);
        usedItemNames.add(v);
      }
    } else if (edge.conditionType === 'variable') {
      const expr = edge.variableCondition || edge.conditionValue;
      if (expr && expr.trim()) {
        const valRes = validateExpression(
          expr,
          masterVariables.size > 0 ? Array.from(masterVariables) : undefined
        );
        if (!valRes.isValid) {
          if (valRes.undefinedVariables.length > 0) {
            issues.push({
              code: 'undefined_variable',
              severity: 'error',
              message: `エッジの条件式に未定義の変数「${valRes.undefinedVariables.join(', ')}」が使用されています (式: "${expr}")`,
              location: 'variableCondition',
            });
          } else {
            issues.push({
              code: 'expression_syntax_error',
              severity: 'error',
              message: `エッジの条件式に構文エラーがあります: ${valRes.error} (式: "${expr}")`,
              location: 'variableCondition',
            });
          }
        }
      }
    }
  }

  // 3. Check for Dead / Unused items (acquired but never used or required)
  // Consumables, medicine, recovery items, weapons, and narrative lore/clues (data/clue)
  // are player resources or story info, not progression blockers.
  // Only progression key items (category === 'key') that are acquired but never checked/consumed are flagged.
  for (const item of masterData.items) {
    if (item.category !== 'key' || item.isConsumable) {
      continue;
    }
    const isAcquired = acquiredItemIds.has(item.id);
    const isUsed = usedItemIds.has(item.id);
    // If it's acquired in some node, but never required/consumed anywhere
    if (isAcquired && !isUsed) {
      issues.push({
        code: 'dead_item',
        severity: 'warning',
        message: `進行キーアイテム「【${item.name}】」は入手可能ですが、後続のどの条件や消費処理にも使用されていない「死にアイテム」です。`,
      });
    }
  }

  // 4. Check for Isolated Nodes (unreachable from start node)
  if (nodes.length > 0) {
    const effectiveStartId = startNodeId || nodes[0].id;
    const reachableNodes = new Set<string>();
    const adjacency = new Map<string, string[]>();

    for (const edge of edges) {
      if (!adjacency.has(edge.fromNodeId)) adjacency.set(edge.fromNodeId, []);
      adjacency.get(edge.fromNodeId)!.push(edge.toNodeId);
    }

    const queue: string[] = [effectiveStartId];
    reachableNodes.add(effectiveStartId);

    while (queue.length > 0) {
      const current = queue.shift()!;
      const neighbors = adjacency.get(current) || [];
      for (const next of neighbors) {
        if (!reachableNodes.has(next)) {
          reachableNodes.add(next);
          queue.push(next);
        }
      }
    }

    for (const node of nodes) {
      if (!reachableNodes.has(node.id)) {
        issues.push({
          code: 'isolated_node',
          severity: 'warning',
          message: `ノード「${node.title}」は開始ノードから到達できない孤立ノードです。`,
          nodeId: node.id,
        });
      }
    }
  }

  return issues;
}
