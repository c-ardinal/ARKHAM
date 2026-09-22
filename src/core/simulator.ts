/**
 * ARKHAM Core Engine - Monte Carlo Simulator Module
 * Simulates thousands of playtests to quantify game balance, route selection, SAN loss, and session duration.
 * Based on ARKHAM_HANDOVER.md Section 4 (Feature 3)
 */

import type { CoreGraph, SimulationConfig, SimulationResult, ScenarioNode, ScenarioEdge } from './schema';
import { evaluateExpression } from './expression';

/**
 * Rolls standard TRPG dice formula (e.g., "1D6", "2D4+1", "1D3", "0", "1")
 */
export function rollDice(formula: string): number {
  if (!formula || formula.trim() === '0') return 0;
  const clean = formula.trim().toUpperCase();

  // Simple number
  const num = Number(clean);
  if (!isNaN(num)) return num;

  // Dice formula: XDY or XDY+Z or XDY-Z
  const match = clean.match(/^(\d+)?D(\d+)([+-]\d+)?$/);
  if (!match) {
    const fallback = parseInt(clean, 10);
    return isNaN(fallback) ? 0 : fallback;
  }

  const count = match[1] ? parseInt(match[1], 10) : 1;
  const sides = parseInt(match[2], 10);
  const modifier = match[3] ? parseInt(match[3], 10) : 0;

  let sum = 0;
  for (let i = 0; i < count; i++) {
    sum += Math.floor(Math.random() * sides) + 1;
  }
  return Math.max(0, sum + modifier);
}

interface Investigator {
  san: number;
  isLost: boolean;
}

/**
 * Executes Monte Carlo Virtual Playtest on a CoreGraph
 */
export function runSimulation(graph: CoreGraph, config: SimulationConfig = {}): SimulationResult {
  const {
    runs = 10000,
    partySize = 4,
    defaultSkillValue = 60,
    skillValues = {},
    initialSan = 50,
    diceStockCount = 3,
    targetSessionMinutes = 220,
  } = config;

  const { nodes, edges, startNodeId } = graph;
  const nodeMap = new Map<string, ScenarioNode>(nodes.map((n) => [n.id, n]));
  const effectiveStartId = startNodeId && nodeMap.has(startNodeId) ? startNodeId : nodes[0]?.id;

  if (!effectiveStartId || nodes.length === 0) {
    return {
      totalRuns: 0,
      completedRuns: 0,
      lostRuns: 0,
      lostRate: 0,
      nodeLostCounts: {},
      edgeTraversalCounts: {},
      edgeTraversalRates: {},
      averageSanByChapter: {},
      insanityOccurrences: 0,
      averagePlayTimeMinutes: 0,
      playTimePercentiles: { p50: 0, p90: 0, p95: 0 },
      timeDistribution: { underTargetCount: 0, targetMinutes: targetSessionMinutes, percentUnderTarget: 0 },
    };
  }

  // Pre-build adjacency
  const outgoingEdges = new Map<string, ScenarioEdge[]>();
  for (const edge of edges) {
    if (!outgoingEdges.has(edge.fromNodeId)) {
      outgoingEdges.set(edge.fromNodeId, []);
    }
    outgoingEdges.get(edge.fromNodeId)!.push(edge);
  }

  let lostRuns = 0;
  let completedRuns = 0;
  let totalInsanityCount = 0;
  const nodeLostCounts: Record<string, number> = {};
  const nodeVisitCounts: Record<string, number> = {};
  const edgeTraversalCounts: Record<string, number> = {};
  const chapterSanSamples: Record<number, number[]> = {};
  const playTimes: number[] = [];

  for (let r = 0; r < runs; r++) {
    // Initialize Party
    const party: Investigator[] = Array.from({ length: partySize }, () => ({
      san: initialSan,
      isLost: false,
    }));

    const inventory = new Set<string>();
    const runtimeVariables: Record<string, any> = {};
    if (graph.masterData.variables) {
      for (const v of graph.masterData.variables) {
        runtimeVariables[v.name] = v.initialValue;
      }
    }

    let diceStock = diceStockCount;
    let currentNodeId = effectiveStartId;
    let totalTime = 0;
    let stepCount = 0;
    const maxSteps = 200; // Safety guard against cycles

    let isWipedOut = false;

    while (currentNodeId && stepCount < maxSteps) {
      stepCount++;
      const node = nodeMap.get(currentNodeId);
      if (!node) break;

      nodeVisitCounts[node.id] = (nodeVisitCounts[node.id] || 0) + 1;

      totalTime += node.timeCostMinutes || 0;

      // Handle Resource / SAN check
      const check = node.resourceCheck || node.sanCheck;
      if (check) {
        for (const inv of party) {
          if (inv.isLost) continue;

          // Roll 1D100 vs current SAN / resource
          const sanRoll = Math.floor(Math.random() * 100) + 1;
          const isSanSuccess = sanRoll <= inv.san;
          const lossFormula = isSanSuccess ? check.successLoss : check.failLoss;
          const loss = rollDice(lossFormula);

          if (loss >= 5) {
            totalInsanityCount++;
          }

          inv.san = Math.max(0, inv.san - loss);
          if (inv.san <= 0) {
            inv.isLost = true;
          }
        }

        // Record SAN by chapter
        const ch = node.chapter || 1;
        if (!chapterSanSamples[ch]) chapterSanSamples[ch] = [];
        const livingSan = party.filter((p) => !p.isLost).map((p) => p.san);
        if (livingSan.length > 0) {
          const avgLivingSan = livingSan.reduce((a, b) => a + b, 0) / livingSan.length;
          chapterSanSamples[ch].push(avgLivingSan);
        }
      }

      // Check if all party members are lost
      if (party.every((p) => p.isLost)) {
        isWipedOut = true;
        nodeLostCounts[node.id] = (nodeLostCounts[node.id] || 0) + 1;
        lostRuns++;
        break;
      }

      // Acquire and consume items
      for (const it of node.acquiredItems) inventory.add(it);
      for (const it of node.consumedItems) inventory.delete(it);

      // Apply variable operations
      if (node.variableOperations && node.variableOperations.length > 0) {
        for (const op of node.variableOperations) {
          const currentVal = runtimeVariables[op.variableName];
          if (op.operator === 'set') {
            runtimeVariables[op.variableName] = op.value;
          } else if (op.operator === 'add') {
            const num = Number(currentVal) || 0;
            runtimeVariables[op.variableName] = num + (Number(op.value) || 0);
          } else if (op.operator === 'subtract') {
            const num = Number(currentVal) || 0;
            runtimeVariables[op.variableName] = num - (Number(op.value) || 0);
          }
        }
      }

      // Check if ending node reached
      if (node.type === 'ending') {
        completedRuns++;
        break;
      }

      // Pick next edge
      const candidates = outgoingEdges.get(node.id) || [];
      if (candidates.length === 0) {
        completedRuns++;
        break;
      }

      const validEdges: ScenarioEdge[] = [];
      for (const edge of candidates) {
        if (edge.conditionType === 'item_held' && edge.conditionValue) {
          const reqs = edge.conditionValue.split(',').map((s) => s.trim());
          if (reqs.every((r) => inventory.has(r))) {
            validEdges.push(edge);
          }
        } else if (edge.conditionType === 'variable' && (edge.variableCondition || edge.conditionValue)) {
          const expr = edge.variableCondition || edge.conditionValue || '';
          if (evaluateExpression(expr, runtimeVariables)) {
            validEdges.push(edge);
          }
        } else if (edge.conditionType === 'check_success' || edge.conditionType === 'check_fail') {
          // Skill check
          const skillVal = (edge.conditionValue && skillValues[edge.conditionValue]) || defaultSkillValue;
          let checkRoll = Math.floor(Math.random() * 100) + 1;
          let success = checkRoll <= skillVal;

          // Dice stock gimmick: if failed and dice stock > 0, party may reroll
          if (!success && diceStock > 0) {
            diceStock--;
            checkRoll = Math.floor(Math.random() * 100) + 1;
            success = checkRoll <= skillVal;
          }

          if (edge.conditionType === 'check_success' && success) {
            validEdges.push(edge);
          } else if (edge.conditionType === 'check_fail' && !success) {
            validEdges.push(edge);
          }
        } else {
          validEdges.push(edge);
        }
      }

      if (validEdges.length === 0) {
        // Dead end without explicit ending
        completedRuns++;
        break;
      }

      // Choose one edge uniformly from valid candidates
      const chosenEdge = validEdges[Math.floor(Math.random() * validEdges.length)];
      edgeTraversalCounts[chosenEdge.id] = (edgeTraversalCounts[chosenEdge.id] || 0) + 1;

      currentNodeId = chosenEdge.toNodeId;
    }

    if (!isWipedOut) {
      playTimes.push(totalTime);
    }
  }

  // Calculate statistics
  playTimes.sort((a, b) => a - b);
  const avgPlayTime =
    playTimes.length > 0 ? playTimes.reduce((a, b) => a + b, 0) / playTimes.length : 0;

  const p50 = playTimes[Math.floor(playTimes.length * 0.5)] || 0;
  const p90 = playTimes[Math.floor(playTimes.length * 0.9)] || 0;
  const p95 = playTimes[Math.floor(playTimes.length * 0.95)] || 0;

  const underTargetCount = playTimes.filter((t) => t <= targetSessionMinutes).length;
  const percentUnderTarget = playTimes.length > 0 ? (underTargetCount / playTimes.length) * 100 : 0;

  const edgeTraversalRates: Record<string, number> = {};
  for (const edgeId of Object.keys(edgeTraversalCounts)) {
    edgeTraversalRates[edgeId] = runs > 0 ? edgeTraversalCounts[edgeId] / runs : 0;
  }

  const averageSanByChapter: Record<number, number> = {};
  for (const ch of Object.keys(chapterSanSamples)) {
    const samples = chapterSanSamples[Number(ch)];
    averageSanByChapter[Number(ch)] =
      samples.length > 0 ? Math.round(samples.reduce((a, b) => a + b, 0) / samples.length) : 0;
  }

  return {
    totalRuns: runs,
    completedRuns,
    lostRuns,
    lostRate: runs > 0 ? lostRuns / runs : 0,
    nodeLostCounts,
    nodeVisitCounts,
    edgeTraversalCounts,
    edgeTraversalRates,
    averageSanByChapter,
    insanityOccurrences: totalInsanityCount,
    averagePlayTimeMinutes: Math.round(avgPlayTime),
    playTimePercentiles: { p50, p90, p95 },
    timeDistribution: {
      underTargetCount,
      targetMinutes: targetSessionMinutes,
      percentUnderTarget: Math.round(percentUnderTarget * 10) / 10,
    },
  };
}
