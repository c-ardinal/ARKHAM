// src/store/migration.ts
import type { ScenarioNode, GameState, CharacterData, ResourceData, StageData } from '../types';
import { SCHEMA_VERSION, generateTabId, type Tab } from '../types/tab';

// H-T3: MigratedState の gameState/characters/resources を any から厳密型へ変更
interface MigratedState {
  version: typeof SCHEMA_VERSION;
  tabs: Tab[];
  activeTabId: string;
  gameState: GameState;
  characters: CharacterData[];
  stages: StageData[];
  resources: ResourceData[];
  language?: 'en' | 'ja';
  theme?: 'light' | 'dark';
  edgeType?: string;
  mode?: 'edit' | 'play';
}

export function isLegacyFormat(data: unknown): boolean {
  if (!data || typeof data !== 'object') return true;
  const d = data as Record<string, unknown>;
  return !('tabs' in d) || !Array.isArray(d.tabs);
}

export function isFutureFormat(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const v = (data as Record<string, unknown>).version;
  return typeof v === 'number' && v > SCHEMA_VERSION;
}

export function migrateJumpTargets(nodes: ScenarioNode[], defaultTabId: string): ScenarioNode[] {
  return nodes.map((n) => {
    if (n.type !== 'jump') return n;
    const t = n.data?.jumpTarget;
    if (typeof t === 'string') {
      return {
        ...n,
        data: { ...n.data, jumpTarget: { tabId: defaultTabId, nodeId: t } },
      };
    }
    return n;
  });
}

export function migrateLegacyToTabbed(legacy: any, defaultTabName: string): MigratedState {
  const tabId = generateTabId();
  const rawNodes: ScenarioNode[] = Array.isArray(legacy?.nodes) ? legacy.nodes : [];
  const migratedNodes = migrateJumpTargets(rawNodes, tabId);
  const edges = Array.isArray(legacy?.edges) ? legacy.edges : [];

  const stages: StageData[] = (Array.isArray(legacy?.stages) ? legacy.stages : []) as StageData[];
  const rawResources: ResourceData[] = Array.isArray(legacy?.resources) ? legacy.resources : [];
  const resources: ResourceData[] = [];

  for (const r of rawResources) {
    if (r.type === 'Location') {
      if (!stages.some((s) => s.id === r.id)) {
        stages.push({
          id: r.id,
          type: 'Location',
          name: r.name,
          reading: r.reading,
          description: r.description,
          note: r.note,
        });
      }
    } else {
      resources.push(r);
    }
  }

  return {
    version: SCHEMA_VERSION,
    tabs: [
      {
        id: tabId,
        name: defaultTabName,
        nodes: migratedNodes,
        edges,
        viewport: legacy?.viewport,
      },
    ],
    activeTabId: tabId,
    // H-T3: gameState フォールバックを GameState 型と整合させる
    gameState: (legacy?.gameState ?? {
      currentNodes: [],
      revealedNodes: [],
      inventory: {},
      equipment: {},
      knowledge: {},
      skills: {},
      stats: {},
      variables: {},
    }) as GameState,
    characters: (Array.isArray(legacy?.characters) ? legacy.characters : []) as CharacterData[],
    stages,
    resources,
    language: legacy?.language ?? 'ja',
    theme: legacy?.theme ?? 'light',
    edgeType: legacy?.edgeType,
    mode: legacy?.mode ?? 'edit',
  };
}
