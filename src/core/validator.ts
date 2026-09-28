/**
 * ARKHAM Core Engine - Graph Validator Module
 * Implements directed graph reachability, soft-lock (prerequisite item) detection, and infinite loop detection.
 * Based on ARKHAM_HANDOVER.md Section 4 (Feature 2)
 */

import type { CoreGraph, ValidationIssue, ScenarioNode, ScenarioEdge } from './schema';

/**
 * Validates graph reachability, prerequisite items (soft-locks), and deadlocks.
 */
export function validateGraph(graph: CoreGraph): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { nodes, edges, startNodeId, masterData } = graph;

  if (nodes.length === 0) return issues;

  const nodeMap = new Map<string, ScenarioNode>(nodes.map((n) => [n.id, n]));
  const itemMap = new Map(masterData.items.map((it) => [it.id, it]));

  const hasExplicitStart = Boolean(startNodeId && nodeMap.has(startNodeId));
  if (!hasExplicitStart) {
    issues.push({
      code: 'missing_start_node',
      severity: 'warning',
      message: 'シナリオの開始ノード（Start）が設定されていません。いずれかのイベントノードで「開始ノード」を指定してください。',
    });
  }

  const effectiveStartId = hasExplicitStart ? startNodeId! : nodes[0].id;

  // Build adjacency list with edges
  const outgoingEdges = new Map<string, ScenarioEdge[]>();
  for (const edge of edges) {
    if (!outgoingEdges.has(edge.fromNodeId)) {
      outgoingEdges.set(edge.fromNodeId, []);
    }
    outgoingEdges.get(edge.fromNodeId)!.push(edge);
  }

  // --- 1. Soft-lock / Prerequisite Item Detection ---
  // For any node requiring item A, verify that EVERY path from start to N acquires A beforehand.

  const nodesWithRequiredItems: { node: ScenarioNode; requiredItemId: string }[] = [];
  for (const node of nodes) {
    for (const itemId of node.requiredItems) {
      nodesWithRequiredItems.push({ node, requiredItemId: itemId });
    }
  }

  // Also check edges with conditionType === 'item_held'
  for (const edge of edges) {
    if (edge.conditionType === 'item_held' && edge.conditionValue) {
      const targetNode = nodeMap.get(edge.toNodeId);
      if (targetNode) {
        for (const req of edge.conditionValue.split(',').map((s) => s.trim())) {
          nodesWithRequiredItems.push({ node: targetNode, requiredItemId: req });
        }
      }
    }
  }

  for (const { node: targetNode, requiredItemId } of nodesWithRequiredItems) {
    const itemName = itemMap.get(requiredItemId)?.name || requiredItemId;

    // Check if there is any path from start to targetNode where hasItem is false
    // State: [nodeId, hasItem: boolean]
    const visited = new Set<string>();
    let problematicPath: { nodeIds: string[]; edgeIds: string[] } | null = null;

    function dfs(
      currentNodeId: string,
      hasItem: boolean,
      currentPathNodes: string[],
      currentPathEdges: string[]
    ): boolean {
      if (problematicPath) return true; // already found

      const stateKey = `${currentNodeId}:${hasItem}`;
      if (visited.has(stateKey)) return false;
      visited.add(stateKey);

      const currNode = nodeMap.get(currentNodeId);
      if (!currNode) return false;

      // Update item state for current node
      let nextHasItem = hasItem;
      if (currNode.acquiredItems.includes(requiredItemId)) {
        nextHasItem = true;
      }
      if (currNode.consumedItems.includes(requiredItemId)) {
        nextHasItem = false;
      }

      // If we reached the target node
      if (currentNodeId === targetNode.id) {
        // Did we arrive without the required item?
        if (!hasItem) {
          problematicPath = {
            nodeIds: [...currentPathNodes],
            edgeIds: [...currentPathEdges],
          };
          return true;
        }
      }

      const outEdges = outgoingEdges.get(currentNodeId) || [];
      for (const edge of outEdges) {
        // If edge requires this item to be crossed, and we don't have it, we cannot traverse this edge
        const edgeReqs = (edge.conditionValue || '').split(',').map((s) => s.trim());
        if (edge.conditionType === 'item_held' && edgeReqs.includes(requiredItemId) && !nextHasItem) {
          continue;
        }

        const found = dfs(
          edge.toNodeId,
          nextHasItem,
          [...currentPathNodes, edge.toNodeId],
          [...currentPathEdges, edge.id]
        );
        if (found) return true;
      }

      return false;
    }

    dfs(effectiveStartId, false, [effectiveStartId], []);

    if (problematicPath) {
      const pathTitles = (problematicPath as { nodeIds: string[]; edgeIds: string[] }).nodeIds
        .map((id: string) => `「${nodeMap.get(id)?.title || id}」`)
        .join(' -> ');

      issues.push({
        code: 'soft_lock_missing_item',
        severity: 'error',
        message: `前提アイテム「【${itemName}】」を所持せずにノード「${targetNode.title}」に到達するルート（${pathTitles}）が存在し、進行不能（ソフトロック）になります。`,
        nodeId: targetNode.id,
        edgeIds: (problematicPath as { nodeIds: string[]; edgeIds: string[] }).edgeIds,
        details: {
          missingItemId: requiredItemId,
          problematicPath: (problematicPath as { nodeIds: string[]; edgeIds: string[] }).nodeIds,
        },
      });
    }
  }

  // --- 2. Infinite Loop / Trapping Cycle Detection ---
  // Find cycles that have no exit condition or no edges leading out to an ending node

  const endingNodeIds = new Set(nodes.filter((n) => n.type === 'ending').map((n) => n.id));

  // Find all nodes that can reach at least one ending node (or have no outgoing edges if no ending nodes defined)
  const canReachEnd = new Set<string>();

  if (endingNodeIds.size > 0) {
    // Reverse BFS from ending nodes
    const reverseAdjacency = new Map<string, string[]>();
    for (const edge of edges) {
      if (!reverseAdjacency.has(edge.toNodeId)) reverseAdjacency.set(edge.toNodeId, []);
      reverseAdjacency.get(edge.toNodeId)!.push(edge.fromNodeId);
    }

    const endQueue = Array.from(endingNodeIds);
    endQueue.forEach((id) => canReachEnd.add(id));

    while (endQueue.length > 0) {
      const curr = endQueue.shift()!;
      const predecessors = reverseAdjacency.get(curr) || [];
      for (const pred of predecessors) {
        if (!canReachEnd.has(pred)) {
          canReachEnd.add(pred);
          endQueue.push(pred);
        }
      }
    }
  }

  // Detect strongly connected components (Tarjan's algorithm)
  let index = 0;
  const indices = new Map<string, number>();
  const lowlinks = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const sccs: string[][] = [];

  function strongConnect(nodeId: string) {
    indices.set(nodeId, index);
    lowlinks.set(nodeId, index);
    index++;
    stack.push(nodeId);
    onStack.add(nodeId);

    const outEdges = outgoingEdges.get(nodeId) || [];
    for (const edge of outEdges) {
      const neighbor = edge.toNodeId;
      if (!indices.has(neighbor)) {
        strongConnect(neighbor);
        lowlinks.set(nodeId, Math.min(lowlinks.get(nodeId)!, lowlinks.get(neighbor)!));
      } else if (onStack.has(neighbor)) {
        lowlinks.set(nodeId, Math.min(lowlinks.get(nodeId)!, indices.get(neighbor)!));
      }
    }

    if (lowlinks.get(nodeId) === indices.get(nodeId)) {
      const scc: string[] = [];
      let w: string;
      do {
        w = stack.pop()!;
        onStack.delete(w);
        scc.push(w);
      } while (w !== nodeId);

      if (scc.length > 1 || (outgoingEdges.get(nodeId) || []).some((e) => e.toNodeId === nodeId)) {
        sccs.push(scc);
      }
    }
  }

  for (const node of nodes) {
    if (!indices.has(node.id)) {
      strongConnect(node.id);
    }
  }

  // Analyze each cycle (SCC)
  for (const scc of sccs) {
    const sccSet = new Set(scc);
    // Find all outgoing edges from this SCC
    const exitEdges: ScenarioEdge[] = [];
    for (const nodeId of scc) {
      const out = outgoingEdges.get(nodeId) || [];
      for (const e of out) {
        if (!sccSet.has(e.toNodeId)) {
          exitEdges.push(e);
        }
      }
    }

    // If there are no exit edges at all, it's an inescapable black-hole trap
    if (exitEdges.length === 0) {
      const cycleTitles = scc.map((id) => `「${nodeMap.get(id)?.title || id}」`).join(', ');
      issues.push({
        code: 'infinite_loop',
        severity: 'error',
        message: `脱出不可能な無限ループ（閉路: ${cycleTitles}）が検出されました。ループを脱出するエッジまたは条件を追加してください。`,
        nodeId: scc[0],
        details: { cycleNodeIds: scc },
      });
    } else if (endingNodeIds.size > 0 && !scc.some((id) => canReachEnd.has(id))) {
      // SCC has exits, but none can reach any ending
      const cycleTitles = scc.map((id) => `「${nodeMap.get(id)?.title || id}」`).join(', ');
      issues.push({
        code: 'infinite_loop',
        severity: 'warning',
        message: `ループ（${cycleTitles}）からの出口は存在しますが、いずれもエンディングに到達できません。`,
        nodeId: scc[0],
        details: { cycleNodeIds: scc },
      });
    }
  }

  // --- 3. Reachability from Start (Unreachable Node Detection) ---
  const reachableFromStart = new Set<string>();
  const forwardQueue = [effectiveStartId];
  reachableFromStart.add(effectiveStartId);

  while (forwardQueue.length > 0) {
    const curr = forwardQueue.shift()!;
    const outs = outgoingEdges.get(curr) || [];
    for (const edge of outs) {
      if (!reachableFromStart.has(edge.toNodeId) && nodeMap.has(edge.toNodeId)) {
        reachableFromStart.add(edge.toNodeId);
        forwardQueue.push(edge.toNodeId);
      }
    }
  }

  for (const node of nodes) {
    if (!reachableFromStart.has(node.id)) {
      issues.push({
        code: 'unreachable_node',
        severity: 'error',
        message: `ノード「${node.title}」は開始地点から到達できません（フローが切断されています）。`,
        nodeId: node.id,
      });
    }
  }

  // --- 4. Dead-End (Cannot Reach Any Ending) Detection ---
  if (endingNodeIds.size > 0) {
    for (const node of nodes) {
      if (reachableFromStart.has(node.id) && !endingNodeIds.has(node.id) && !canReachEnd.has(node.id)) {
        issues.push({
          code: 'dead_end',
          severity: 'error',
          message: `ノード「${node.title}」から到達可能なエンディングが存在しません（途中で行き止まりになっています）。`,
          nodeId: node.id,
        });
      }
    }
  } else {
    // When no ending nodes are defined, check for non-jump, non-check nodes with no outgoing edges
    for (const node of nodes) {
      if (reachableFromStart.has(node.id) && node.type !== 'jump' && node.type !== 'check') {
        const outs = outgoingEdges.get(node.id) || [];
        if (outs.length === 0) {
          issues.push({
            code: 'dead_end_unconnected',
            severity: 'warning',
            message: `ノード「${node.title}」から後続へ進むエッジが接続されておらず、途中で行き止まりになっています。`,
            nodeId: node.id,
          });
        }
      }
    }
  }

  // --- 5. Branch Route Validation (Dangling Branch & Unconnected Routes) ---
  // Evaluated for all branch nodes regardless of start-reachability so authoring feedback is immediate.
  for (const node of nodes) {
    if (node.type === 'check') {
      const outs = outgoingEdges.get(node.id) || [];
      const nodeBranches = node.branches && node.branches.length > 0
        ? node.branches
        : [
            { id: 'true', label: 'True (一致)' },
            { id: 'false', label: 'False (不一致 / その他)' },
          ];

      if (outs.length === 0) {
        issues.push({
          code: 'dangling_branch',
          severity: 'error',
          message: `分岐ノード「${node.title}」に出力エッジが接続されていません。`,
          nodeId: node.id,
        });
      }

      for (const branch of nodeBranches) {
        const hasConnectedEdge = outs.some((e) => {
          const h = (e.sourceHandle || '').replace(/-(left|right)$/, '');
          if (h === branch.id) return true;
          if (branch.id === 'true' && (h === 'true' || (!h && outs.length === 1))) return true;
          if ((branch.id === 'false' || branch.id === 'else') && (h === 'false' || h === 'else')) return true;
          return false;
        });

        if (!hasConnectedEdge) {
          issues.push({
            code: 'unconnected_branch_route',
            severity: 'error',
            message: `分岐ノード「${node.title}」のルート「${branch.label || branch.id}」に出力エッジが接続されていません。`,
            nodeId: node.id,
            details: { branchId: branch.id, branchLabel: branch.label },
          });
        }
      }

      // Check fallback Else route for multi-branch nodes (warning severity)
      const isMulti = nodeBranches.length >= 2;
      const hasExplicitElse = nodeBranches.some((b) => b.id === 'else');
      if (isMulti && !hasExplicitElse && outs.length > 0) {
        const hasElseConnected = outs.some((e) => {
          const h = (e.sourceHandle || '').replace(/-(left|right)$/, '');
          return h === 'else';
        });
        if (!hasElseConnected) {
          issues.push({
            code: 'unconnected_else_route',
            severity: 'warning',
            message: `分岐ノード「${node.title}」のフォールバックルート「その他 (Else)」に出力エッジが接続されていません。条件に一致しない場合の進路が未定義です。`,
            nodeId: node.id,
            details: { branchId: 'else', branchLabel: 'その他 (Else)' },
          });
        }
      }
    }
  }

  // --- 6. Event Node 1:1 Flow Edge Enforcement ---
  for (const node of nodes) {
    if (node.type === 'event' || node.type === 'scene') {
      const outs = outgoingEdges.get(node.id) || [];
      if (outs.length > 1) {
        issues.push({
          code: 'multiple_event_outgoing_edges',
          severity: 'error',
          message: `イベントノード「${node.title}」から出力フローエッジが複数接続されています（${outs.length}本）。イベントノードの出力は1本のみ許可されています。進路の枝分かれには「分岐ノード」を使用してください。`,
          nodeId: node.id,
        });
      }
    }
  }

  // --- 7. Jump Node Target Validation ---
  const validTargetIds = new Set([
    ...Array.from(nodeMap.keys()),
    ...(graph.allNodeIds || []),
  ]);

  for (const node of nodes) {
    if (node.type === 'jump') {
      const target = node.jumpTarget;
      const targetNodeId = typeof target === 'string' ? target : target?.nodeId;
      if (!targetNodeId || !validTargetIds.has(targetNodeId)) {
        issues.push({
          code: 'invalid_jump_target',
          severity: 'error',
          message: !targetNodeId
            ? `ジャンプノード「${node.title}」のジャンプ先が設定されていません。`
            : `ジャンプノード「${node.title}」のジャンプ先ノード（ID: ${targetNodeId}）が見つかりません（リンク切れ）。`,
          nodeId: node.id,
        });
      }
    }
  }

  return issues;
}
