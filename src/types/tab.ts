import type { ScenarioNode, ScenarioEdge } from '../types';

export const SCHEMA_VERSION = 2 as const;

export interface TabViewport {
  x: number;
  y: number;
  zoom: number;
}

export interface Tab {
  id: string;
  name: string;
  nodes: ScenarioNode[];
  edges: ScenarioEdge[];
  viewport?: TabViewport;
}

export function generateTabId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `tab_${crypto.randomUUID()}`;
  }
  return `tab_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
