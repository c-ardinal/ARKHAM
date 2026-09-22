/**
 * ARKHAM Core Engine - Markdown Exporter Module
 * Generates standardized scenario documentation adhering strictly to the Semantic Bracket System.
 * Based on ARKHAM_HANDOVER.md Section 2 & Section 4 (Feature 4)
 */

import type { CoreGraph, ScenarioNode, NodeAction } from './schema';

/**
 * Formats a NodeAction into human-readable markdown with semantic brackets
 */
function formatAction(action: NodeAction | undefined, itemMap: Map<string, string>): string {
  if (!action) return 'なし';
  const parts: string[] = [];

  if (action.acquireItemIds && action.acquireItemIds.length > 0) {
    const itemNames = action.acquireItemIds
      .map((id) => `【${itemMap.get(id) || id}】`)
      .join(', ');
    parts.push(`${itemNames} を獲得。`);
  }

  if (action.consumeItemIds && action.consumeItemIds.length > 0) {
    const itemNames = action.consumeItemIds
      .map((id) => `【${itemMap.get(id) || id}】`)
      .join(', ');
    parts.push(`${itemNames} を消費。`);
  }

  if (action.sanRecovery) {
    parts.push(`正気度(SAN)が ${action.sanRecovery} 回復する。`);
  }

  return parts.length > 0 ? parts.join(' ') : '情報を獲得。';
}

/**
 * Generates the standardized scenario_body.md text from a CoreGraph
 */
export function exportToScenarioMarkdown(graph: CoreGraph): string {
  const { masterData, nodes, edges } = graph;

  const itemMap = new Map(masterData.items.map((it) => [it.id, it.name]));
  const locationMap = new Map(masterData.locations.map((loc) => [loc.id, loc.name]));
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // Build outgoing targets map
  const outgoingTargets = new Map<string, string[]>();
  for (const edge of edges) {
    if (!outgoingTargets.has(edge.fromNodeId)) {
      outgoingTargets.set(edge.fromNodeId, []);
    }
    outgoingTargets.get(edge.fromNodeId)!.push(edge.toNodeId);
  }

  // Group nodes by chapter
  const chapters = new Map<number, ScenarioNode[]>();
  for (const node of nodes) {
    const ch = node.chapter ?? 1;
    if (!chapters.has(ch)) chapters.set(ch, []);
    chapters.get(ch)!.push(node);
  }

  const sortedChapterNumbers = Array.from(chapters.keys()).sort((a, b) => a - b);
  const outputLines: string[] = [];

  outputLines.push('# シナリオ本文 (Scenario Body)');
  outputLines.push('');

  for (const chNum of sortedChapterNumbers) {
    outputLines.push(`## 第${chNum}章`);
    outputLines.push('');

    const chapterNodes = chapters.get(chNum)!;
    let sectionIdx = 1;

    for (const node of chapterNodes) {
      const locName = locationMap.get(node.locationId) || node.locationId || '未設定';
      const locBracket = locName.startsWith('［') ? locName : `［${locName}］`;

      // Section title: ### [章番号]-[節番号]. [ノードタイトル]
      const cleanTitle = node.title.replace(/^\d+-\d+\.\s*/, '');
      outputLines.push(`### ${chNum}-${sectionIdx}. ${cleanTitle}`);
      outputLines.push('');

      // 〔KP向け接続案内（マスタリング情報）〕
      outputLines.push('〔KP向け接続案内（マスタリング情報）〕');
      outputLines.push(`- **現在地 / 入口**: ${locBracket}`);
      outputLines.push(`- **目的**: ${node.purpose || '特になし'}`);

      // 接続・次の行き先
      const nextNodeIds = outgoingTargets.get(node.id) || [];
      const nextDestinations = nextNodeIds.map((targetId) => {
        const targetNode = nodeMap.get(targetId);
        if (!targetNode) return '［不明］';
        const targetLoc = locationMap.get(targetNode.locationId) || targetNode.title;
        const targetLocBracket = targetLoc.startsWith('［') ? targetLoc : `［${targetLoc}］`;
        return `${targetLocBracket} (${targetNode.title})`;
      });

      outputLines.push(`- **接続・次の行き先**: ${nextDestinations.length > 0 ? nextDestinations.join('、 ') : 'なし（終端）'}`);

      if (node.kpInstructions && node.kpInstructions.length > 0) {
        outputLines.push('- **KP留意事項**:');
        for (const inst of node.kpInstructions) {
          outputLines.push(`  - ${inst}`);
        }
      }

      const check = node.resourceCheck || node.sanCheck;
      if (check) {
        const checkLabel = graph.systemConfig?.checkLabel || 'リソース判定';
        outputLines.push(`- **${checkLabel}**: ${check.trigger} (成功: ${check.successLoss} / 失敗: ${check.failLoss})`);
      }

      outputLines.push('');

      // 〔PL向け探索可能ポイント一覧〕
      if (node.investigationPoints && node.investigationPoints.length > 0) {
        outputLines.push('〔PL向け探索可能ポイント一覧〕');
        for (const ip of node.investigationPoints) {
          const pointName = ip.name.startsWith('《') ? ip.name : `《${ip.name}》`;
          outputLines.push(`- **${pointName}**: ${ip.description}`);
        }
        outputLines.push('');
      }

      // 〔KP描写テキスト〕
      if (node.readAloudText && node.readAloudText.trim().length > 0) {
        outputLines.push('〔KP描写テキスト〕');
        const lines = node.readAloudText.split('\n');
        for (const line of lines) {
          outputLines.push(`> ${line}`);
        }
        outputLines.push('');
      }

      // Detailed investigation points
      if (node.investigationPoints && node.investigationPoints.length > 0) {
        for (const ip of node.investigationPoints) {
          const pointName = ip.name.startsWith('《') ? ip.name : `《${ip.name}》`;
          outputLines.push(`##### 【調査】${pointName}`);

          if (ip.checks && ip.checks.length > 0) {
            for (const chk of ip.checks) {
              const skillName = chk.skillName.startsWith('〈') ? chk.skillName : `〈${chk.skillName}〉`;
              outputLines.push(`- **判定**: ${skillName}`);
              if (chk.onSuccess) {
                outputLines.push(`  - **成功時**: ${formatAction(chk.onSuccess, itemMap)}`);
              }
              if (chk.onFailure) {
                outputLines.push(`  - **失敗時**: ${formatAction(chk.onFailure, itemMap)}`);
              }
              if (chk.onCritical) {
                outputLines.push(`  - **クリティカル時**: ${formatAction(chk.onCritical, itemMap)}`);
              }
            }
          } else {
            outputLines.push(`- ${ip.description}`);
          }
          outputLines.push('');
        }
      }

      outputLines.push('---');
      outputLines.push('');
      sectionIdx++;
    }
  }

  return outputLines.join('\n');
}
