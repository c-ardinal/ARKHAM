import type { Tab } from '../types/tab';
import type { ScenarioEdge } from '../types';

export function retargetJumpReferencesForMove(
  tabs: Tab[],
  movedNodeIds: string[],
  targetTabId: string
): Tab[] {
  const movedSet = new Set(movedNodeIds);
  return tabs.map((tab) => ({
    ...tab,
    nodes: tab.nodes.map((n) => {
      if (n.type !== 'jump') return n;
      const jt = (n as any).data?.jumpTarget;
      if (jt && typeof jt === 'object' && movedSet.has(jt.nodeId)) {
        return {
          ...n,
          data: { ...(n as any).data, jumpTarget: { ...jt, tabId: targetTabId } },
        };
      }
      return n;
    }),
  }));
}

export function detectBrokenEdges(
  edges: ScenarioEdge[],
  movedNodeIds: Set<string>
): ScenarioEdge[] {
  return edges.filter((e) => {
    const srcMoved = movedNodeIds.has(e.source);
    const tgtMoved = movedNodeIds.has(e.target);
    return srcMoved !== tgtMoved;
  });
}

export function countJumpReferencesToTab(tabs: Tab[], targetTabId: string): number {
  let count = 0;
  for (const tab of tabs) {
    for (const n of tab.nodes) {
      if (n.type === 'jump' && (n as any).data?.jumpTarget?.tabId === targetTabId) count++;
    }
  }
  return count;
}
