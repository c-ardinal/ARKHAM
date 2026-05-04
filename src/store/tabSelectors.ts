// src/store/tabSelectors.ts
import { useShallow } from 'zustand/react/shallow';
import { useScenarioStore } from './scenarioStore';
import type { ScenarioNode, ScenarioEdge } from '../types';
import type { Tab } from '../types/tab';

export const useActiveTab = (): Tab | undefined =>
  useScenarioStore((s) => s.tabs.find((t) => t.id === s.activeTabId));

export const useActiveNodes = (): ScenarioNode[] =>
  useScenarioStore((s) => s.tabs.find((t) => t.id === s.activeTabId)?.nodes ?? []);

export const useActiveEdges = (): ScenarioEdge[] =>
  useScenarioStore((s) => s.tabs.find((t) => t.id === s.activeTabId)?.edges ?? []);

/**
 * Returns all nodes across every tab.
 *
 * Uses `useShallow` so that the selector only triggers a re-render when the
 * flattened array actually changes in content, not on every store write that
 * produces a new intermediate array reference.
 */
export const useAllNodes = (): ScenarioNode[] =>
  useScenarioStore(useShallow((s) => s.tabs.flatMap((t) => t.nodes)));

export function findNodeAcrossTabs(
  tabs: Tab[],
  nodeId: string
): { tabId: string; node: ScenarioNode } | null {
  for (const tab of tabs) {
    const node = tab.nodes.find((n) => n.id === nodeId);
    if (node) return { tabId: tab.id, node };
  }
  return null;
}
