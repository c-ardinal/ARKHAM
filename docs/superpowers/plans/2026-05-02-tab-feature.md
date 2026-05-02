# タブ機能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ノードを「タブ」単位で論理分割し、章/シーン/幕などの自由な単位で編集・閲覧できるようにする(完全分離型データモデル + ジャンプノードによるタブ間遷移)。

**Architecture:** Zustand ストアの `nodes`/`edges` を `tabs: Tab[]` + `activeTabId` に置換。各 Tab が独立した nodes/edges/viewport を保持。jumpTarget は `{tabId, nodeId}` オブジェクト化。レガシー v1 データは「Tab 1」自動生成で v2 に変換。

**Tech Stack:** React 19, TypeScript, Zustand, ReactFlow 11, Vite 5, Vitest 3, TailwindCSS, lucide-react

**Spec:** `docs/superpowers/specs/2026-05-01-tab-feature-design.md`

---

## File Structure

### 新規ファイル

| パス | 責務 |
|---|---|
| `src/types/tab.ts` | `Tab` 型定義、`SchemaVersion` 定数 |
| `src/store/migration.ts` | レガシー v1 → v2 変換、未来バージョン検出 |
| `src/store/migration.test.ts` | マイグレーションのユニットテスト |
| `src/store/tabSelectors.ts` | 派生 selector (`getActiveNodes` 等) |
| `src/store/tabActions.test.ts` | タブ CRUD のユニットテスト |
| `src/components/TabBar.tsx` | タブバー本体 |
| `src/components/TabBarItem.tsx` | 個別タブ(タブ1つ) |
| `src/components/JumpTargetCombobox.tsx` | ジャンプ先選択コンボボックス |
| `src/components/MoveToTabSubmenu.tsx` | コンテキストメニューの「別のタブへ移動」サブメニュー |
| `src/components/EdgeBreakDialog.tsx` | エッジ分断時の選択ダイアログ |
| `src/utils/jumpReferences.ts` | ジャンプ参照の検出・更新ヘルパー |
| `src/utils/jumpReferences.test.ts` | ヘルパーのユニットテスト |

### 修正ファイル

| パス | 主な変更 |
|---|---|
| `src/types.ts` | `jumpTarget: string` → `{tabId, nodeId} \| null` に拡張 |
| `src/store/scenarioStore.ts` | `nodes`/`edges` 削除、`tabs`/`activeTabId` 化、CRUD アクション追加、history 構造変更 |
| `src/components/Layout.tsx` | TabBar 挿入、`nodes`/`edges` 参照を `getActiveNodes()` 等に置換 |
| `src/components/Canvas.tsx` | 同上 + viewport をタブ毎に保存/復元 |
| `src/components/PropertyPanel.tsx` | Jump 設定を `JumpTargetCombobox` に置換 |
| `src/components/ContextMenu.tsx` | 「別のタブへ移動」サブメニュー追加 |
| `src/i18n/types.ts` | 新規キーの型追加 |
| `src/i18n/ja.ts` | 日本語訳追加 |
| `src/i18n/en.ts` | 英語訳追加 |
| `vitest.config.ts` | jsdom 環境追加(コンポーネントテスト用) |
| `package.json` | 必要なら `jsdom`, `@testing-library/react`, `@testing-library/user-event` を追加 |

---

## Phase 1: 型定義とマイグレーション基盤

### Task 1.1: Tab 型と SchemaVersion 定数の追加

**Files:**
- Create: `src/types/tab.ts`

- [ ] **Step 1: ファイル作成**

```typescript
// src/types/tab.ts
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
  return `tab_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
```

- [ ] **Step 2: TypeScript ビルド確認**

Run: `npx tsc --noEmit`
Expected: PASS (新規ファイルのみ、エラー無し)

- [ ] **Step 3: コミット**

```bash
git add src/types/tab.ts
git commit -m "feat(types): add Tab type and SCHEMA_VERSION constant"
```

---

### Task 1.2: jumpTarget 型を拡張形式に変更

**Files:**
- Modify: `src/types.ts:32` (jumpTarget 型変更)

- [ ] **Step 1: 型変更を編集**

`src/types.ts` の 32 行目付近:

```typescript
// 旧
// jumpTarget?: string;

// 新
jumpTarget?: { tabId: string; nodeId: string } | null;
```

- [ ] **Step 2: ビルドエラーを一時抑制(後続タスクで全置換するため)**

`PropertyPanel.tsx:533` の `selectedNode.data.jumpTarget` などビルドエラーが出るが、Task 5.x で完全に解消されるまで一時的に `as any` でビルド通すか、`@ts-expect-error` を入れる。

```typescript
// PropertyPanel.tsx 一時対応(Task 5.2 で削除)
value={(selectedNode.data.jumpTarget as any) || ''}
onChange={(e) => updateNodeData(selectedNode.id, { jumpTarget: e.target.value as any })}
```

- [ ] **Step 3: ビルド確認**

Run: `npx tsc --noEmit`
Expected: PASS(一時対応で通る)

- [ ] **Step 4: コミット**

```bash
git add src/types.ts src/components/PropertyPanel.tsx
git commit -m "refactor(types): widen jumpTarget to {tabId, nodeId} object (temp shim in PropertyPanel)"
```

---

### Task 1.3: マイグレーションユニットテストを書く (RED)

**Files:**
- Create: `src/store/migration.test.ts`

- [ ] **Step 1: テストファイル作成**

```typescript
// src/store/migration.test.ts
import { describe, it, expect } from 'vitest';
import { isLegacyFormat, isFutureFormat, migrateLegacyToTabbed, migrateJumpTargets } from './migration';
import type { ScenarioNode } from '../types';

const makeJumpNode = (id: string, target: any): ScenarioNode => ({
  id,
  type: 'jump',
  position: { x: 0, y: 0 },
  data: { label: id, jumpTarget: target },
} as ScenarioNode);

describe('isLegacyFormat', () => {
  it('tabs フィールドが無いデータを legacy と判定', () => {
    expect(isLegacyFormat({ nodes: [], edges: [] })).toBe(true);
  });

  it('tabs フィールドを持つデータは legacy ではない', () => {
    expect(isLegacyFormat({ tabs: [], activeTabId: '' })).toBe(false);
  });

  it('null/undefined は legacy 扱い', () => {
    expect(isLegacyFormat(null)).toBe(true);
    expect(isLegacyFormat(undefined)).toBe(true);
  });
});

describe('isFutureFormat', () => {
  it('version > 2 を future と判定', () => {
    expect(isFutureFormat({ version: 3, tabs: [] })).toBe(true);
  });

  it('version === 2 は future ではない', () => {
    expect(isFutureFormat({ version: 2, tabs: [] })).toBe(false);
  });

  it('version 未指定は future ではない', () => {
    expect(isFutureFormat({ tabs: [] })).toBe(false);
  });
});

describe('migrateLegacyToTabbed', () => {
  it('レガシーデータを単一タブにラップ', () => {
    const legacy = {
      nodes: [{ id: 'n1', type: 'event', position: {x:0,y:0}, data: { label: 'A' } }],
      edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
      gameState: { variables: {}, inventory: {}, equipment: {}, knowledge: {}, skills: {}, stats: {}, currentNodes: [], revealedNodes: [] },
      characters: [],
      resources: [],
    };
    const result = migrateLegacyToTabbed(legacy as any, 'タブ 1');
    expect(result.version).toBe(2);
    expect(result.tabs).toHaveLength(1);
    expect(result.tabs[0].name).toBe('タブ 1');
    expect(result.tabs[0].nodes).toHaveLength(1);
    expect(result.tabs[0].edges).toHaveLength(1);
    expect(result.activeTabId).toBe(result.tabs[0].id);
  });

  it('nodes/edges 欠損は空配列で補う', () => {
    const result = migrateLegacyToTabbed({} as any, 'Tab 1');
    expect(result.tabs[0].nodes).toEqual([]);
    expect(result.tabs[0].edges).toEqual([]);
    expect(result.characters).toEqual([]);
    expect(result.resources).toEqual([]);
  });
});

describe('migrateJumpTargets', () => {
  it('文字列 jumpTarget を {tabId, nodeId} に変換', () => {
    const nodes = [makeJumpNode('j1', 'target_node')];
    const result = migrateJumpTargets(nodes, 'tab_x');
    expect(result[0].data.jumpTarget).toEqual({ tabId: 'tab_x', nodeId: 'target_node' });
  });

  it('null/undefined はそのまま保持', () => {
    const nodes = [makeJumpNode('j1', null), makeJumpNode('j2', undefined)];
    const result = migrateJumpTargets(nodes, 'tab_x');
    expect(result[0].data.jumpTarget).toBeNull();
    expect(result[1].data.jumpTarget).toBeUndefined();
  });

  it('jump 以外のノードは変更しない', () => {
    const eventNode = { id: 'e1', type: 'event', position: {x:0,y:0}, data: { label: 'E' } } as ScenarioNode;
    const result = migrateJumpTargets([eventNode], 'tab_x');
    expect(result[0]).toBe(eventNode);
  });

  it('既に {tabId, nodeId} 形式のものはそのまま', () => {
    const nodes = [makeJumpNode('j1', { tabId: 'tab_a', nodeId: 'n_b' })];
    const result = migrateJumpTargets(nodes, 'tab_x');
    expect(result[0].data.jumpTarget).toEqual({ tabId: 'tab_a', nodeId: 'n_b' });
  });
});
```

- [ ] **Step 2: テスト実行で失敗を確認**

Run: `npm test -- migration.test`
Expected: FAIL ("Cannot find module './migration'" 等)

---

### Task 1.4: マイグレーション実装 (GREEN)

**Files:**
- Create: `src/store/migration.ts`

- [ ] **Step 1: 実装ファイル作成**

```typescript
// src/store/migration.ts
import type { ScenarioNode } from '../types';
import { SCHEMA_VERSION, generateTabId, type Tab } from '../types/tab';

interface MigratedState {
  version: typeof SCHEMA_VERSION;
  tabs: Tab[];
  activeTabId: string;
  gameState: any;
  characters: any[];
  resources: any[];
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
    gameState: legacy?.gameState ?? {
      currentNodes: [],
      revealedNodes: [],
      inventory: {},
      equipment: {},
      knowledge: {},
      skills: {},
      stats: {},
      variables: {},
    },
    characters: Array.isArray(legacy?.characters) ? legacy.characters : [],
    resources: Array.isArray(legacy?.resources) ? legacy.resources : [],
    language: legacy?.language ?? 'ja',
    theme: legacy?.theme ?? 'light',
    edgeType: legacy?.edgeType,
    mode: legacy?.mode ?? 'edit',
  };
}
```

- [ ] **Step 2: テスト実行で全件 PASS を確認**

Run: `npm test -- migration.test`
Expected: PASS (すべてのテストが通る)

- [ ] **Step 3: コミット**

```bash
git add src/store/migration.ts src/store/migration.test.ts
git commit -m "feat(store): add legacy v1 → v2 migration with jumpTarget conversion"
```

---

## Phase 2: Store の tabs 化と CRUD アクション

### Task 2.1: タブ CRUD のテストを書く (RED)

**Files:**
- Create: `src/store/tabActions.test.ts`

- [ ] **Step 1: テストファイル作成**

```typescript
// src/store/tabActions.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useScenarioStore } from './scenarioStore';

function reset() {
  useScenarioStore.getState().resetToInitialState();
}

describe('addTab', () => {
  beforeEach(reset);

  it('新規タブを追加し、ID を返す', () => {
    const before = useScenarioStore.getState().tabs.length;
    const newId = useScenarioStore.getState().addTab('テストタブ');
    const after = useScenarioStore.getState().tabs.length;
    expect(after).toBe(before + 1);
    const found = useScenarioStore.getState().tabs.find((t) => t.id === newId);
    expect(found?.name).toBe('テストタブ');
    expect(found?.nodes).toEqual([]);
    expect(found?.edges).toEqual([]);
  });

  it('name 省略時は既定名を付与', () => {
    const id = useScenarioStore.getState().addTab();
    const tab = useScenarioStore.getState().tabs.find((t) => t.id === id);
    expect(tab?.name).toMatch(/(タブ|Tab)/);
  });
});

describe('renameTab', () => {
  beforeEach(reset);

  it('タブ名を変更', () => {
    const id = useScenarioStore.getState().addTab('A');
    useScenarioStore.getState().renameTab(id, 'B');
    expect(useScenarioStore.getState().tabs.find((t) => t.id === id)?.name).toBe('B');
  });

  it('前後空白は trim', () => {
    const id = useScenarioStore.getState().addTab('A');
    useScenarioStore.getState().renameTab(id, '  C  ');
    expect(useScenarioStore.getState().tabs.find((t) => t.id === id)?.name).toBe('C');
  });

  it('空文字/空白のみは無視(元の名前を維持)', () => {
    const id = useScenarioStore.getState().addTab('A');
    useScenarioStore.getState().renameTab(id, '   ');
    expect(useScenarioStore.getState().tabs.find((t) => t.id === id)?.name).toBe('A');
    useScenarioStore.getState().renameTab(id, '');
    expect(useScenarioStore.getState().tabs.find((t) => t.id === id)?.name).toBe('A');
  });

  it('50 文字超は切り捨て', () => {
    const id = useScenarioStore.getState().addTab('A');
    const long = 'x'.repeat(100);
    useScenarioStore.getState().renameTab(id, long);
    expect(useScenarioStore.getState().tabs.find((t) => t.id === id)?.name.length).toBe(50);
  });
});

describe('deleteTab', () => {
  beforeEach(reset);

  it('最後の1タブは削除されない', () => {
    const beforeLen = useScenarioStore.getState().tabs.length;
    const id = useScenarioStore.getState().tabs[0].id;
    useScenarioStore.getState().deleteTab(id);
    expect(useScenarioStore.getState().tabs.length).toBe(beforeLen);
  });

  it('複数タブのうち1つを削除できる', () => {
    const id2 = useScenarioStore.getState().addTab('B');
    const before = useScenarioStore.getState().tabs.length;
    useScenarioStore.getState().deleteTab(id2);
    expect(useScenarioStore.getState().tabs.length).toBe(before - 1);
    expect(useScenarioStore.getState().tabs.find((t) => t.id === id2)).toBeUndefined();
  });

  it('アクティブタブを削除すると右隣に切替', () => {
    const id1 = useScenarioStore.getState().tabs[0].id;
    const id2 = useScenarioStore.getState().addTab('B');
    useScenarioStore.getState().setActiveTab(id1);
    useScenarioStore.getState().deleteTab(id1);
    expect(useScenarioStore.getState().activeTabId).toBe(id2);
  });

  it('右端のアクティブタブを削除すると左隣に切替', () => {
    const id1 = useScenarioStore.getState().tabs[0].id;
    const id2 = useScenarioStore.getState().addTab('B');
    useScenarioStore.getState().setActiveTab(id2);
    useScenarioStore.getState().deleteTab(id2);
    expect(useScenarioStore.getState().activeTabId).toBe(id1);
  });
});

describe('reorderTabs', () => {
  beforeEach(reset);

  it('インデックス指定でタブ順を入れ替え', () => {
    const id1 = useScenarioStore.getState().tabs[0].id;
    const id2 = useScenarioStore.getState().addTab('B');
    const id3 = useScenarioStore.getState().addTab('C');
    useScenarioStore.getState().reorderTabs(0, 2);
    const tabs = useScenarioStore.getState().tabs;
    expect(tabs.map((t) => t.id)).toEqual([id2, id3, id1]);
  });
});

describe('setActiveTab', () => {
  beforeEach(reset);

  it('アクティブタブを切替、selectedNodeId を null に', () => {
    const id2 = useScenarioStore.getState().addTab('B');
    useScenarioStore.getState().setSelectedNode('some_node');
    useScenarioStore.getState().setActiveTab(id2);
    expect(useScenarioStore.getState().activeTabId).toBe(id2);
    expect(useScenarioStore.getState().selectedNodeId).toBeNull();
  });

  it('存在しない id を渡しても変更しない', () => {
    const before = useScenarioStore.getState().activeTabId;
    useScenarioStore.getState().setActiveTab('nonexistent');
    expect(useScenarioStore.getState().activeTabId).toBe(before);
  });
});
```

- [ ] **Step 2: テスト実行で失敗を確認**

Run: `npm test -- tabActions.test`
Expected: FAIL (アクションが未実装)

---

### Task 2.2: Store を tabs/activeTabId 構造に変更

**Files:**
- Modify: `src/store/scenarioStore.ts` (大規模リファクタ)
- Modify: `vitest.config.ts` (jsdom 環境追加)

- [ ] **Step 1: vitest 設定を jsdom 化**

`vitest.config.ts` を更新:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    globals: true,
  },
});
```

- [ ] **Step 2: jsdom と testing-library 導入**

```bash
npm install --save-dev jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom
```

- [ ] **Step 3: Store の `ScenarioState` を更新**

`src/store/scenarioStore.ts` を編集。主要な変更点:

```typescript
// import 追加
import type { Tab } from '../types/tab';
import { SCHEMA_VERSION, generateTabId } from '../types/tab';
import { isLegacyFormat, isFutureFormat, migrateLegacyToTabbed } from './migration';

// ScenarioState インターフェイスを以下のように変更
interface ScenarioState {
  // 旧: nodes, edges を削除
  tabs: Tab[];
  activeTabId: string;
  
  gameState: GameState;
  mode: 'edit' | 'play';
  selectedNodeId: string | string[] | null;

  // 既存メソッドは active タブ操作にリダイレクト(後述)
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  onReconnect: (oldEdge: ScenarioEdge, newConnection: Connection) => void;
  addNode: (node: ScenarioNode) => void;
  updateNodeData: (id: string, data: any) => void;
  updateNodeStyle: (id: string, style: any) => void;
  duplicateNodes: (nodes: ScenarioNode[]) => string[];
  deleteNodes: (nodeIds: string[]) => void;
  setMode: (mode: 'edit' | 'play') => void;
  setSelectedNode: (id: string | string[] | null) => void;
  loadScenario: (data: any) => void;

  // 新規 タブアクション
  addTab: (name?: string) => string;
  renameTab: (id: string, newName: string) => void;
  deleteTab: (id: string) => void;
  reorderTabs: (fromIdx: number, toIdx: number) => void;
  setActiveTab: (id: string) => void;
  moveNodesToTab: (nodeIds: string[], targetTabId: string, edgeStrategy?: 'delete' | 'replace-jump') => void;

  // 派生 selector(getter として実装)
  // 注: zustand では getState を介してアクセス
  
  // 既存(変更なし)の他フィールド ...
  language: 'en' | 'ja';
  setLanguage: (lang: 'en' | 'ja') => void;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  edgeType: string;
  setEdgeType: (type: string) => void;
  
  addVariable: (name: string, type: 'boolean' | 'number' | 'string', initialValue: any) => void;
  // ... (他既存メソッドそのまま)
  
  characters: CharacterData[];
  resources: ResourceData[];
  // ... 

  // History
  past: { tabs: Tab[], activeTabId: string, gameState: GameState }[];
  future: { tabs: Tab[], activeTabId: string, gameState: GameState }[];
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  
  saveToLocalStorage: () => void;
  loadFromLocalStorage: () => void;
  clearLocalStorage: () => void;
  resetToInitialState: () => void;
}
```

- [ ] **Step 4: `loadInitialState` を migration に統合**

```typescript
const STORAGE_KEY = 'trpg-scenario-storage';
const LEGACY_BACKUP_PREFIX = 'arkham_legacy_backup_';
const FUTURE_BACKUP_PREFIX = 'arkham_future_format_backup_';
const MAX_BACKUPS = 3;

function pruneBackups(prefix: string) {
  const keys = Object.keys(localStorage).filter((k) => k.startsWith(prefix)).sort();
  while (keys.length > MAX_BACKUPS) {
    const oldest = keys.shift()!;
    localStorage.removeItem(oldest);
  }
}

const loadInitialState = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const parsed = JSON.parse(stored);

    if (isFutureFormat(parsed)) {
      const key = `${FUTURE_BACKUP_PREFIX}${Date.now()}`;
      localStorage.setItem(key, stored);
      pruneBackups(FUTURE_BACKUP_PREFIX);
      return { __futureFormat: true, version: parsed.version };
    }

    if (isLegacyFormat(parsed)) {
      const key = `${LEGACY_BACKUP_PREFIX}${Date.now()}`;
      localStorage.setItem(key, stored);
      pruneBackups(LEGACY_BACKUP_PREFIX);
      return migrateLegacyToTabbed(parsed, 'タブ 1');
    }

    // Sanitize each tab's nodes
    if (Array.isArray(parsed.tabs)) {
      parsed.tabs = parsed.tabs.map((tab: any) => ({
        ...tab,
        nodes: Array.isArray(tab.nodes)
          ? tab.nodes.filter((n: any) => n && typeof n.id === 'string' && n.position && typeof n.position.x === 'number' && !isNaN(n.position.x) && typeof n.position.y === 'number' && !isNaN(n.position.y)).map((n: any) => ({ ...n, selected: false }))
          : [],
        edges: Array.isArray(tab.edges) ? tab.edges : [],
      }));
    }

    return parsed;
  } catch (error) {
    console.error('Failed to load from LocalStorage:', error);
  }
  return null;
};
```

- [ ] **Step 5: 初期 state を新構造に**

```typescript
const initialStoredState = loadInitialState();

const createInitialTab = (): Tab => ({
  id: generateTabId(),
  name: 'タブ 1',
  nodes: [
    {
      id: 'memo-initial-warning',
      type: 'memo',
      position: { x: 100, y: 100 },
      data: {
        label: '注意事項 / Warnings',
        description: '・本ツールには自動保存機能が実装されています。\n ページを再読み込みしても、最後の作業状態が自動的に復元されます。\n ただし、ブラウザのキャッシュをクリアすると保存データも削除されます。\n 重要なデータは「ファイル→保存」で手動保存することをお勧めします。\n・使用例を見たい場合は、「ファイル→サンプルデータ読込」を実行して下さい。\n・その他の注意事項や使い方は「ヘルプ→マニュアル」をご覧下さい。\n\n上記を読み終わったらこのノードは削除して問題有りません。',
      },
      width: 400,
      height: 200,
      draggable: true,
    } as any,
  ],
  edges: [],
});

const initialTab = createInitialTab();
const initialTabs: Tab[] = initialStoredState?.tabs ?? [initialTab];
const initialActiveTabId: string = initialStoredState?.activeTabId ?? initialTabs[0].id;
```

- [ ] **Step 6: 既存 nodes/edges 直接アクセスを active タブ参照に置換**

Store 内のすべての `state.nodes`, `state.edges` を以下のヘルパー経由に置換:

```typescript
const getActiveTabFromState = (state: ScenarioState): Tab | undefined =>
  state.tabs.find((t) => t.id === state.activeTabId);

const updateActiveTab = (state: ScenarioState, updater: (tab: Tab) => Partial<Tab>): Tab[] =>
  state.tabs.map((t) => (t.id === state.activeTabId ? { ...t, ...updater(t) } : t));
```

例えば `addNode` は:

```typescript
addNode: (node) => set((state) => ({
  tabs: updateActiveTab(state, (tab) => ({ nodes: [...tab.nodes, node] })),
})),
```

`onNodesChange` は:

```typescript
onNodesChange: (changes) => set((state) => ({
  tabs: updateActiveTab(state, (tab) => ({
    nodes: applyNodeChanges(changes, tab.nodes),
  })),
})),
```

(全アクションを同様に置換。`recalculateGameState` は全タブ走査するため別扱い。)

- [ ] **Step 7: タブ CRUD アクション実装**

```typescript
addTab: (name) => {
  const id = generateTabId();
  set((state) => ({
    tabs: [...state.tabs, { id, name: name?.trim().slice(0, 50) || `タブ ${state.tabs.length + 1}`, nodes: [], edges: [] }],
  }));
  get().pushHistory();
  return id;
},

renameTab: (id, newName) => {
  const trimmed = newName.trim().slice(0, 50);
  if (!trimmed) return;
  set((state) => ({
    tabs: state.tabs.map((t) => (t.id === id ? { ...t, name: trimmed } : t)),
  }));
  get().pushHistory();
},

deleteTab: (id) => {
  const state = get();
  if (state.tabs.length <= 1) {
    // toast はインポートが必要。toast.error(t('tab.cannotDeleteLast'))
    return;
  }
  const idx = state.tabs.findIndex((t) => t.id === id);
  if (idx < 0) return;

  // ジャンプ参照のリセット
  const newTabs = state.tabs
    .filter((t) => t.id !== id)
    .map((t) => ({
      ...t,
      nodes: t.nodes.map((n) =>
        n.type === 'jump' && (n.data?.jumpTarget as any)?.tabId === id
          ? { ...n, data: { ...n.data, jumpTarget: null } }
          : n
      ),
    }));

  // 隣接タブへ自動切替
  let nextActiveId = state.activeTabId;
  if (state.activeTabId === id) {
    const nextIdx = idx < state.tabs.length - 1 ? idx + 1 : idx - 1;
    nextActiveId = state.tabs[nextIdx].id;
  }

  set({ tabs: newTabs, activeTabId: nextActiveId, selectedNodeId: null });
  get().pushHistory();
},

reorderTabs: (fromIdx, toIdx) => {
  set((state) => {
    const tabs = [...state.tabs];
    const [moved] = tabs.splice(fromIdx, 1);
    tabs.splice(toIdx, 0, moved);
    return { tabs };
  });
  get().pushHistory();
},

setActiveTab: (id) => {
  const state = get();
  if (!state.tabs.some((t) => t.id === id)) return;
  set({ activeTabId: id, selectedNodeId: null });
},
```

- [ ] **Step 8: ビルドとテスト実行**

Run: `npx tsc --noEmit`
Expected: コンシューマ(Layout, Canvas 等)で多数エラー → Phase 3 で解消

Run: `npm test -- tabActions.test`
Expected: 全件 PASS

- [ ] **Step 9: コミット(ビルドエラーは Phase 3 で解消する旨をメッセージに記載)**

```bash
git add src/store/scenarioStore.ts src/store/tabActions.test.ts vitest.config.ts package.json package-lock.json
git commit -m "refactor(store): convert to tabs/activeTabId model with CRUD actions

Existing consumer files (Layout, Canvas, PropertyPanel) will fail to type-check;
they will be updated in Phase 3."
```

---

### Task 2.3: 派生 selector を追加

**Files:**
- Create: `src/store/tabSelectors.ts`

- [ ] **Step 1: ファイル作成**

```typescript
// src/store/tabSelectors.ts
import { useScenarioStore } from './scenarioStore';
import type { ScenarioNode, ScenarioEdge } from '../types';
import type { Tab } from '../types/tab';

export const useActiveTab = (): Tab | undefined =>
  useScenarioStore((s) => s.tabs.find((t) => t.id === s.activeTabId));

export const useActiveNodes = (): ScenarioNode[] =>
  useScenarioStore((s) => s.tabs.find((t) => t.id === s.activeTabId)?.nodes ?? []);

export const useActiveEdges = (): ScenarioEdge[] =>
  useScenarioStore((s) => s.tabs.find((t) => t.id === s.activeTabId)?.edges ?? []);

export const useAllNodes = (): ScenarioNode[] =>
  useScenarioStore((s) => s.tabs.flatMap((t) => t.nodes));

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
```

- [ ] **Step 2: ビルド確認**

Run: `npx tsc --noEmit src/store/tabSelectors.ts`
Expected: PASS

- [ ] **Step 3: コミット**

```bash
git add src/store/tabSelectors.ts
git commit -m "feat(store): add tab-aware selectors (useActiveNodes, useAllNodes, findNodeAcrossTabs)"
```

---

### Task 2.4: 派生 selector とユーティリティのユニットテスト

**Files:**
- Create: `src/store/tabSelectors.test.ts`

- [ ] **Step 1: テスト作成**

```typescript
// src/store/tabSelectors.test.ts
import { describe, it, expect } from 'vitest';
import { findNodeAcrossTabs } from './tabSelectors';
import type { Tab } from '../types/tab';

const makeTab = (id: string, nodes: any[]): Tab => ({
  id,
  name: id,
  nodes,
  edges: [],
});

describe('findNodeAcrossTabs', () => {
  it('指定 nodeId がいずれかのタブに存在すればそのタブと共に返す', () => {
    const tabs: Tab[] = [
      makeTab('tab_a', [{ id: 'n1', type: 'event', position: {x:0,y:0}, data: { label: 'n1' } } as any]),
      makeTab('tab_b', [{ id: 'n2', type: 'event', position: {x:0,y:0}, data: { label: 'n2' } } as any]),
    ];
    const r = findNodeAcrossTabs(tabs, 'n2');
    expect(r?.tabId).toBe('tab_b');
    expect(r?.node.id).toBe('n2');
  });

  it('存在しない nodeId は null', () => {
    const tabs: Tab[] = [makeTab('tab_a', [])];
    expect(findNodeAcrossTabs(tabs, 'missing')).toBeNull();
  });
});
```

- [ ] **Step 2: テスト実行**

Run: `npm test -- tabSelectors.test`
Expected: PASS

- [ ] **Step 3: コミット**

```bash
git add src/store/tabSelectors.test.ts
git commit -m "test(store): add unit tests for findNodeAcrossTabs selector"
```

---

## Phase 3: 既存コンシューマの全更新

### Task 3.1: Layout.tsx の nodes/edges 参照を置換

**Files:**
- Modify: `src/components/Layout.tsx`

- [ ] **Step 1: useScenarioStore の分割代入を更新**

`Layout.tsx:277` 付近:

```typescript
// 旧
// const { mode, setMode, nodes, edges, gameState, ... } = useScenarioStore();

// 新
const { mode, setMode, gameState, language, setLanguage, theme, setTheme, undo, redo, past, future, edgeType, selectedNodeId, setSelectedNode, characters, resources, tabs, activeTabId } = useScenarioStore();
const activeTab = tabs.find((t) => t.id === activeTabId);
const nodes = activeTab?.nodes ?? [];
const edges = activeTab?.edges ?? [];
```

- [ ] **Step 2: ビルド確認**

Run: `npx tsc --noEmit`
Expected: Layout.tsx のエラーは消える(他ファイルは残る)

- [ ] **Step 3: コミット**

```bash
git add src/components/Layout.tsx
git commit -m "refactor(layout): read nodes/edges from active tab"
```

---

### Task 3.2: Canvas.tsx の更新 + viewport per-tab 保存

**Files:**
- Modify: `src/components/Canvas.tsx`

- [ ] **Step 1: nodes/edges 参照を更新**

```typescript
// Canvas 内の useScenarioStore 呼び出しを更新
const { tabs, activeTabId, ... 他必要なフィールド } = useScenarioStore();
const activeTab = tabs.find((t) => t.id === activeTabId);
const nodes = activeTab?.nodes ?? [];
const edges = activeTab?.edges ?? [];
```

- [ ] **Step 2: タブ切替時に viewport 復元、移動時に保存**

ReactFlow の `onMove` ハンドラで、現在のアクティブタブの viewport を保存:

```typescript
const handleMove = useCallback((_, viewport) => {
  // タブ毎の viewport 保存
  useScenarioStore.setState((state) => ({
    tabs: state.tabs.map((t) =>
      t.id === state.activeTabId ? { ...t, viewport } : t
    ),
  }));
}, []);

// ReactFlow に渡す
<ReactFlow ... onMove={handleMove} />
```

タブ切替時の viewport 復元は `useEffect` で activeTabId 変化を監視:

```typescript
useEffect(() => {
  if (activeTab?.viewport) {
    reactFlowInstance.setViewport(activeTab.viewport);
  } else {
    reactFlowInstance.fitView();
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [activeTabId]);
```

- [ ] **Step 3: ビルド確認**

Run: `npx tsc --noEmit`
Expected: Canvas.tsx のエラー消失

- [ ] **Step 4: コミット**

```bash
git add src/components/Canvas.tsx
git commit -m "refactor(canvas): read from active tab + save/restore viewport per tab"
```

---

### Task 3.3: 残コンシューマ全部の置換

**Files:**
- Modify: `src/components/Sidebar.tsx`, `VariableList.tsx`, `CharacterList.tsx`, `ResourceList.tsx`, `ContextMenu.tsx`, `NodeInfoModal.tsx`, `DebugPanel/*` 等(grep で検出する)

- [ ] **Step 1: 残存する `state.nodes` / `state.edges` 直接参照を grep**

Run:
```bash
grep -rn "useScenarioStore" src/ | grep -v ".test." | grep -v "tabSelectors"
```

各ヒットファイルで `nodes`, `edges` フィールドを参照していないか確認。

- [ ] **Step 2: 検出した各ファイルでアクティブタブ参照に置換**

パターン1: 派生 selector 利用(推奨)
```typescript
import { useActiveNodes, useActiveEdges } from '../store/tabSelectors';
const nodes = useActiveNodes();
const edges = useActiveEdges();
```

パターン2: 直接参照(分割代入の場合)
```typescript
const { tabs, activeTabId, ... } = useScenarioStore();
const activeTab = tabs.find((t) => t.id === activeTabId);
const nodes = activeTab?.nodes ?? [];
```

- [ ] **Step 3: 全コンシューマ更新後にビルド**

Run: `npx tsc --noEmit`
Expected: PASS(エラー 0)

- [ ] **Step 4: 既存ユニットテストが通ることを確認**

Run: `npm test`
Expected: PASS(`edgeVisibility.test`, `libraryList.test`, `nodeAbsolutePosition.test`, `migration.test`, `tabActions.test`)

- [ ] **Step 5: dev サーバ起動・手動確認(基本動作)**

```bash
npm run dev
```

ブラウザで http://localhost:5173 を開き:
- 既存の編集モードでノード追加/削除/接続
- Save/Load 動作確認
- レガシー JSON ファイル(Save で保存したものを開けば現状で OK)を Load → 「タブ 1」が自動生成され全ノード配置確認

- [ ] **Step 6: コミット**

```bash
git add src/
git commit -m "refactor(consumers): update all scenarioStore consumers to use active tab"
```

---

### Task 3.4: history 構造の更新と動作確認

**Files:**
- Modify: `src/store/scenarioStore.ts` (pushHistory, undo, redo)

- [ ] **Step 1: pushHistory のスナップショット対象を変更**

```typescript
pushHistory: () => {
  // デバウンスは既存の実装を保つ
  const state = get();
  const snapshot = {
    tabs: structuredClone(state.tabs),
    activeTabId: state.activeTabId,
    gameState: structuredClone(state.gameState),
  };
  set((s) => ({
    past: [...s.past.slice(-49), snapshot],
    future: [],
  }));
},

undo: () => {
  const state = get();
  if (state.past.length === 0) return;
  const previous = state.past[state.past.length - 1];
  const currentSnapshot = {
    tabs: structuredClone(state.tabs),
    activeTabId: state.activeTabId,
    gameState: structuredClone(state.gameState),
  };
  set({
    tabs: previous.tabs,
    activeTabId: previous.activeTabId,
    gameState: previous.gameState,
    past: state.past.slice(0, -1),
    future: [currentSnapshot, ...state.future],
    selectedNodeId: null,
  });
},

redo: () => {
  const state = get();
  if (state.future.length === 0) return;
  const next = state.future[0];
  const currentSnapshot = {
    tabs: structuredClone(state.tabs),
    activeTabId: state.activeTabId,
    gameState: structuredClone(state.gameState),
  };
  set({
    tabs: next.tabs,
    activeTabId: next.activeTabId,
    gameState: next.gameState,
    past: [...state.past, currentSnapshot],
    future: state.future.slice(1),
    selectedNodeId: null,
  });
},
```

- [ ] **Step 2: ユニットテスト追加**

`src/store/tabActions.test.ts` の末尾に追加:

```typescript
describe('history with tabs', () => {
  beforeEach(reset);

  it('addTab → undo でタブ削除', () => {
    const before = useScenarioStore.getState().tabs.length;
    useScenarioStore.getState().addTab('B');
    expect(useScenarioStore.getState().tabs.length).toBe(before + 1);
    useScenarioStore.getState().undo();
    expect(useScenarioStore.getState().tabs.length).toBe(before);
  });

  it('deleteTab → undo でタブ復元', () => {
    const id2 = useScenarioStore.getState().addTab('B');
    useScenarioStore.getState().deleteTab(id2);
    expect(useScenarioStore.getState().tabs.find((t) => t.id === id2)).toBeUndefined();
    useScenarioStore.getState().undo();
    expect(useScenarioStore.getState().tabs.find((t) => t.id === id2)).toBeDefined();
  });
});
```

- [ ] **Step 3: テスト実行**

Run: `npm test -- tabActions.test`
Expected: PASS

- [ ] **Step 4: コミット**

```bash
git add src/store/scenarioStore.ts src/store/tabActions.test.ts
git commit -m "feat(store): tab-aware history (pushHistory/undo/redo)"
```

---

## Phase 4: TabBar UI

### Task 4.1: TabBarItem コンポーネント

**Files:**
- Create: `src/components/TabBarItem.tsx`

- [ ] **Step 1: コンポーネント作成**

```tsx
// src/components/TabBarItem.tsx
import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import type { Tab } from '../types/tab';
import { useTranslation } from '../hooks/useTranslation';

interface TabBarItemProps {
  tab: Tab;
  isActive: boolean;
  onActivate: () => void;
  onDelete: () => void;
  onRename: (newName: string) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  startInRenameMode?: boolean;
}

export function TabBarItem({
  tab,
  isActive,
  onActivate,
  onDelete,
  onRename,
  onContextMenu,
  onDragStart,
  onDragOver,
  onDrop,
  startInRenameMode = false,
}: TabBarItemProps) {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(startInRenameMode);
  const [draft, setDraft] = useState(tab.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(tab.name);
  }, [tab.name]);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const commit = () => {
    setIsEditing(false);
    if (draft.trim() && draft.trim() !== tab.name) {
      onRename(draft.trim());
    } else {
      setDraft(tab.name);
    }
  };

  return (
    <div
      role="tab"
      aria-selected={isActive}
      draggable={!isEditing}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onClick={onActivate}
      onDoubleClick={() => setIsEditing(true)}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu(e);
      }}
      className={`group inline-flex items-center gap-1 px-3 py-1.5 min-h-[36px] border-r border-border cursor-pointer select-none ${
        isActive ? 'bg-card text-foreground border-b-2 border-b-primary' : 'bg-muted text-muted-foreground hover:bg-accent'
      }`}
    >
      {isEditing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, 50))}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') {
              setIsEditing(false);
              setDraft(tab.name);
            }
          }}
          className="bg-transparent border-b border-primary outline-none text-sm w-32"
          maxLength={50}
        />
      ) : (
        <span className="text-sm whitespace-nowrap max-w-[160px] truncate">{tab.name}</span>
      )}
      <button
        type="button"
        aria-label={t('tab.delete' as any)}
        className="opacity-50 hover:opacity-100 hover:bg-destructive/20 rounded p-0.5 ml-1"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
      >
        <X size={12} />
      </button>
    </div>
  );
}
```

- [ ] **Step 2: ビルド確認**

Run: `npx tsc --noEmit`
Expected: PASS(useTranslation の `t('tab.delete' as any)` は Phase 7 で型解決)

- [ ] **Step 3: コミット**

```bash
git add src/components/TabBarItem.tsx
git commit -m "feat(ui): add TabBarItem component (rename, delete, drag handlers)"
```

---

### Task 4.2: TabBar コンポーネント

**Files:**
- Create: `src/components/TabBar.tsx`

- [ ] **Step 1: コンポーネント作成**

```tsx
// src/components/TabBar.tsx
import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { useScenarioStore } from '../store/scenarioStore';
import { useTranslation } from '../hooks/useTranslation';
import { TabBarItem } from './TabBarItem';

interface TabBarProps {
  onRequestDeleteConfirm: (tabId: string) => void;
}

export function TabBar({ onRequestDeleteConfirm }: TabBarProps) {
  const { t } = useTranslation();
  const tabs = useScenarioStore((s) => s.tabs);
  const activeTabId = useScenarioStore((s) => s.activeTabId);
  const setActiveTab = useScenarioStore((s) => s.setActiveTab);
  const renameTab = useScenarioStore((s) => s.renameTab);
  const reorderTabs = useScenarioStore((s) => s.reorderTabs);
  const addTab = useScenarioStore((s) => s.addTab);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [newlyAddedTabId, setNewlyAddedTabId] = useState<string | null>(null);

  const handleAdd = () => {
    const id = addTab();
    setActiveTab(id);
    setNewlyAddedTabId(id);
  };

  return (
    <div
      role="tablist"
      className="flex items-center bg-background border-b border-border h-9 overflow-x-auto"
    >
      {tabs.map((tab, idx) => (
        <TabBarItem
          key={tab.id}
          tab={tab}
          isActive={tab.id === activeTabId}
          startInRenameMode={tab.id === newlyAddedTabId}
          onActivate={() => {
            setActiveTab(tab.id);
            if (newlyAddedTabId === tab.id) setNewlyAddedTabId(null);
          }}
          onDelete={() => onRequestDeleteConfirm(tab.id)}
          onRename={(newName) => {
            renameTab(tab.id, newName);
            if (newlyAddedTabId === tab.id) setNewlyAddedTabId(null);
          }}
          onContextMenu={() => {
            // 簡易実装: コンテキストメニューは今後拡張
          }}
          onDragStart={(e) => {
            setDraggedIdx(idx);
            e.dataTransfer.effectAllowed = 'move';
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
          }}
          onDrop={(e) => {
            e.preventDefault();
            if (draggedIdx !== null && draggedIdx !== idx) {
              reorderTabs(draggedIdx, idx);
            }
            setDraggedIdx(null);
          }}
        />
      ))}
      <button
        type="button"
        onClick={handleAdd}
        aria-label={t('tab.add' as any)}
        className="inline-flex items-center justify-center min-w-[36px] min-h-[36px] hover:bg-accent text-muted-foreground"
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
```

- [ ] **Step 2: ビルド確認**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: コミット**

```bash
git add src/components/TabBar.tsx
git commit -m "feat(ui): add TabBar with drag-reorder and new-tab inline rename"
```

---

### Task 4.3: Layout に TabBar を統合 + 削除確認ダイアログ

**Files:**
- Modify: `src/components/Layout.tsx`

- [ ] **Step 1: TabBar インポートと挿入**

`Layout.tsx` の return ブロック内、ヘッダ直下・キャンバス直前に追加:

```tsx
import { TabBar } from './TabBar';

// State 追加
const [tabDeleteTarget, setTabDeleteTarget] = useState<string | null>(null);

// JSX:
<header>...</header>
<TabBar onRequestDeleteConfirm={(id) => setTabDeleteTarget(id)} />
<div className="flex-1 flex overflow-hidden relative">
  ...
</div>

// 削除確認モーダル(他の confirmModal とは別管理)
{tabDeleteTarget && (() => {
  const tab = tabs.find(tt => tt.id === tabDeleteTarget);
  if (!tab) return null;
  if (tabs.length <= 1) {
    toast.error(t('tab.cannotDeleteLast' as any));
    setTabDeleteTarget(null);
    return null;
  }
  // ジャンプ参照件数の算出
  const jumpRefs = tabs.flatMap(tt =>
    tt.nodes.filter(n => n.type === 'jump' && (n.data?.jumpTarget as any)?.tabId === tabDeleteTarget)
  ).length;
  
  const message = [
    t('tab.deleteConfirmBodyNodes' as any).replace('{n}', String(tab.nodes.length)),
    jumpRefs > 0 ? `⚠ ${t('tab.deleteConfirmBodyJumps' as any).replace('{n}', String(jumpRefs))}` : null,
  ].filter(Boolean).join('\n');

  return (
    <ConfirmationModal
      isOpen={true}
      title={t('tab.deleteConfirmTitle' as any)}
      message={message}
      danger={true}
      confirmLabel={t('tab.delete' as any)}
      cancelLabel={t('common.cancel' as any)}
      onConfirm={() => {
        useScenarioStore.getState().deleteTab(tabDeleteTarget);
        setTabDeleteTarget(null);
      }}
      onClose={() => setTabDeleteTarget(null)}
    />
  );
})()}
```

- [ ] **Step 2: ビルド確認**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: dev サーバで手動確認**

```bash
npm run dev
```

確認項目:
- ヘッダ直下にタブバーが表示される
- 「タブ 1」が初期表示
- ＋ボタンで新タブ追加できる
- 新タブ追加後に即インライン編集モードになる
- タブクリックで切替できる(キャンバスの内容も切り替わる)
- ×ボタンで削除確認ダイアログが出る
- 最後の1タブは削除できない
- ダブルクリックでリネームできる
- ドラッグでタブを並べ替えできる

- [ ] **Step 4: コミット**

```bash
git add src/components/Layout.tsx
git commit -m "feat(layout): integrate TabBar with delete confirmation dialog"
```

---

## Phase 5: JumpTargetCombobox

### Task 5.1: コンボボックスコンポーネント作成

**Files:**
- Create: `src/components/JumpTargetCombobox.tsx`

- [ ] **Step 1: コンポーネント作成**

```tsx
// src/components/JumpTargetCombobox.tsx
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useScenarioStore } from '../store/scenarioStore';
import { useTranslation } from '../hooks/useTranslation';
import { ChevronDown, X } from 'lucide-react';

interface JumpTargetComboboxProps {
  value: { tabId: string; nodeId: string } | null;
  onChange: (target: { tabId: string; nodeId: string } | null) => void;
  excludeNodeId?: string;
}

const RESULT_LIMIT = 200;

export function JumpTargetCombobox({ value, onChange, excludeNodeId }: JumpTargetComboboxProps) {
  const { t } = useTranslation();
  const tabs = useScenarioStore((s) => s.tabs);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // 全候補をフラット化
  const candidates = useMemo(() => {
    const items: { tabId: string; tabName: string; node: any; key: string; label: string }[] = [];
    for (const tab of tabs) {
      for (const n of tab.nodes) {
        if (n.id === excludeNodeId) continue;
        if (n.type === 'sticky' || n.type === 'character' || n.type === 'resource') continue;
        items.push({
          tabId: tab.id,
          tabName: tab.name,
          node: n,
          key: `${tab.id}::${n.id}`,
          label: `${tab.name} / ${n.data?.label ?? n.id} (${n.type})`,
        });
      }
    }
    return items;
  }, [tabs, excludeNodeId]);

  // フィルタ
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return candidates.slice(0, RESULT_LIMIT);
    return candidates
      .filter((c) => c.label.toLowerCase().includes(q))
      .slice(0, RESULT_LIMIT);
  }, [candidates, query]);

  const tooMany = !query.trim() && candidates.length > RESULT_LIMIT;

  // 現在の選択値を表示用ラベルに変換
  const currentLabel = useMemo(() => {
    if (!value) return '';
    const cand = candidates.find((c) => c.tabId === value.tabId && c.node.id === value.nodeId);
    return cand?.label ?? '';
  }, [value, candidates]);

  const isBroken = value !== null && currentLabel === '';

  // 外クリックで閉じる
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left border border-input rounded px-2 py-1 bg-background flex items-center justify-between gap-2"
      >
        <span className={`truncate ${isBroken ? 'text-destructive' : ''}`}>
          {isBroken ? t('jumpTarget.broken' as any) : (currentLabel || t('jumpTarget.search' as any))}
        </span>
        <div className="flex items-center gap-1">
          {value && (
            <span
              role="button"
              aria-label="clear"
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
              }}
              className="hover:bg-destructive/20 rounded p-0.5"
            >
              <X size={12} />
            </span>
          )}
          <ChevronDown size={14} />
        </div>
      </button>

      {open && (
        <div className="absolute left-0 right-0 mt-1 bg-popover border border-border rounded shadow-lg z-50 max-h-80 overflow-hidden flex flex-col">
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIdx(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActiveIdx((i) => Math.min(filtered.length - 1, i + 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActiveIdx((i) => Math.max(0, i - 1));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                const c = filtered[activeIdx];
                if (c) {
                  onChange({ tabId: c.tabId, nodeId: c.node.id });
                  setOpen(false);
                  setQuery('');
                }
              } else if (e.key === 'Escape') {
                setOpen(false);
              }
            }}
            placeholder={t('jumpTarget.search' as any)}
            className="border-b border-border px-2 py-1 outline-none bg-background"
          />
          <div className="overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-2 py-2 text-sm text-muted-foreground">{t('jumpTarget.noResults' as any)}</div>
            ) : (
              filtered.map((c, i) => (
                <div
                  key={c.key}
                  className={`px-2 py-1 text-sm cursor-pointer truncate ${i === activeIdx ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'}`}
                  onMouseEnter={() => setActiveIdx(i)}
                  onClick={() => {
                    onChange({ tabId: c.tabId, nodeId: c.node.id });
                    setOpen(false);
                    setQuery('');
                  }}
                >
                  {c.label}
                </div>
              ))
            )}
            {tooMany && (
              <div className="px-2 py-1 text-xs text-muted-foreground border-t border-border">
                {t('jumpTarget.tooMany' as any)}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: ビルド確認**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: コミット**

```bash
git add src/components/JumpTargetCombobox.tsx
git commit -m "feat(ui): add JumpTargetCombobox with cross-tab search and broken state"
```

---

### Task 5.2: PropertyPanel の Jump 設定を Combobox に置換

**Files:**
- Modify: `src/components/PropertyPanel.tsx:524-548`

- [ ] **Step 1: 置換**

```tsx
// Import 追加
import { JumpTargetCombobox } from './JumpTargetCombobox';

// 524-548 を置換
{selectedNode.type === 'jump' && (
  <div>
    <label className={labelClass}>{t('properties.jumpTarget')}</label>
    <JumpTargetCombobox
      value={(selectedNode.data.jumpTarget as { tabId: string; nodeId: string } | null) ?? null}
      onChange={(target) => updateNodeData(selectedNode.id, { jumpTarget: target })}
      excludeNodeId={selectedNode.id}
    />
  </div>
)}
```

(Task 1.2 で入れた一時 `as any` は削除する)

- [ ] **Step 2: ビルド確認**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: 手動動作確認**

```bash
npm run dev
```

- ジャンプノードを追加
- プロパティパネルでターゲット選択 → コンボボックス表示
- 入力で絞り込み・キーボード操作
- 別タブのノードも選択候補に出る
- 選択後 → 進行モードでジャンプ実行 → 自動タブ切替
- リンク切れ表示確認(別タブ作成 → ジャンプ設定 → 設定先タブ削除)

- [ ] **Step 4: コミット**

```bash
git add src/components/PropertyPanel.tsx
git commit -m "feat(property): replace jump target select with searchable combobox"
```

---

### Task 5.3: ジャンプ実行時の自動タブ切替

**Files:**
- Modify: `src/store/scenarioStore.ts` (executeJump アクション追加)
- Modify: ジャンプを呼び出している既存箇所(`triggerNode` 等)

- [ ] **Step 1: executeJump アクション追加**

```typescript
// ScenarioState インターフェイスに追加
executeJump: (target: { tabId: string; nodeId: string } | null) => void;

// 実装
executeJump: (target) => {
  if (!target) return;
  const state = get();
  if (target.tabId !== state.activeTabId) {
    set({ activeTabId: target.tabId });
  }
  set({ selectedNodeId: target.nodeId });
},
```

- [ ] **Step 2: triggerNode で jump ノードを処理する箇所を更新**

`scenarioStore.ts` 内で jumpTarget を読んでいる箇所(Grep で検索):
```bash
grep -n "jumpTarget" src/store/scenarioStore.ts
```

該当箇所で `executeJump` を呼ぶように修正(従来 `setSelectedNode(jumpTarget)` のような処理になっているはず)。

- [ ] **Step 3: 手動確認**

進行モードで別タブにあるノードへジャンプ → 自動タブ切替+ハイライト

- [ ] **Step 4: コミット**

```bash
git add src/store/scenarioStore.ts
git commit -m "feat(store): add executeJump that auto-switches tabs"
```

---

### Task 5.4: executeJump のユニットテスト

**Files:**
- Modify: `src/store/tabActions.test.ts` (テスト追加)

- [ ] **Step 1: テスト追加**

```typescript
describe('executeJump', () => {
  beforeEach(reset);

  it('同タブ内: activeTabId を変更せず selectedNodeId のみ更新', () => {
    const t1 = useScenarioStore.getState().activeTabId;
    useScenarioStore.getState().executeJump({ tabId: t1, nodeId: 'n_x' });
    expect(useScenarioStore.getState().activeTabId).toBe(t1);
    expect(useScenarioStore.getState().selectedNodeId).toBe('n_x');
  });

  it('別タブ: activeTabId を切替+selectedNodeId 更新', () => {
    const t2 = useScenarioStore.getState().addTab('B');
    useScenarioStore.getState().executeJump({ tabId: t2, nodeId: 'n_y' });
    expect(useScenarioStore.getState().activeTabId).toBe(t2);
    expect(useScenarioStore.getState().selectedNodeId).toBe('n_y');
  });

  it('null target は no-op', () => {
    const before = useScenarioStore.getState().selectedNodeId;
    useScenarioStore.getState().executeJump(null);
    expect(useScenarioStore.getState().selectedNodeId).toBe(before);
  });
});
```

- [ ] **Step 2: テスト実行**

Run: `npm test -- tabActions.test`
Expected: PASS

- [ ] **Step 3: コミット**

```bash
git add src/store/tabActions.test.ts
git commit -m "test(store): add unit tests for executeJump cross-tab behavior"
```

---

## Phase 6: Move-to-Tab + エッジ分断ダイアログ

### Task 6.1: ジャンプ参照ヘルパーのテスト → 実装 (TDD)

**Files:**
- Create: `src/utils/jumpReferences.test.ts`
- Create: `src/utils/jumpReferences.ts`

- [ ] **Step 1: テスト作成**

```typescript
// src/utils/jumpReferences.test.ts
import { describe, it, expect } from 'vitest';
import {
  retargetJumpReferencesForMove,
  detectBrokenEdges,
} from './jumpReferences';
import type { Tab } from '../types/tab';

const makeTab = (id: string, nodes: any[], edges: any[] = []): Tab => ({
  id,
  name: id,
  nodes,
  edges,
});

const jumpNode = (id: string, target: any) => ({
  id,
  type: 'jump',
  position: { x: 0, y: 0 },
  data: { label: id, jumpTarget: target },
});

describe('retargetJumpReferencesForMove', () => {
  it('移動対象 nodeId を指すジャンプの tabId を更新', () => {
    const tabs: Tab[] = [
      makeTab('tab_a', [
        jumpNode('j1', { tabId: 'tab_b', nodeId: 'n1' }),
      ]),
      makeTab('tab_b', [
        { id: 'n1', type: 'event', position: {x:0,y:0}, data: { label: 'n1' } },
      ]),
    ];
    const result = retargetJumpReferencesForMove(tabs, ['n1'], 'tab_c');
    const j1 = result.find((t) => t.id === 'tab_a')!.nodes.find((n: any) => n.id === 'j1');
    expect((j1 as any).data.jumpTarget).toEqual({ tabId: 'tab_c', nodeId: 'n1' });
  });

  it('移動対象に含まれないノードへのジャンプは変更しない', () => {
    const tabs: Tab[] = [
      makeTab('tab_a', [jumpNode('j1', { tabId: 'tab_b', nodeId: 'other' })]),
      makeTab('tab_b', []),
    ];
    const result = retargetJumpReferencesForMove(tabs, ['n1'], 'tab_c');
    const j1 = result[0].nodes.find((n: any) => n.id === 'j1');
    expect((j1 as any).data.jumpTarget).toEqual({ tabId: 'tab_b', nodeId: 'other' });
  });

  it('null jumpTarget はそのまま', () => {
    const tabs: Tab[] = [makeTab('tab_a', [jumpNode('j1', null)])];
    const result = retargetJumpReferencesForMove(tabs, ['n1'], 'tab_c');
    expect((result[0].nodes[0] as any).data.jumpTarget).toBeNull();
  });
});

describe('detectBrokenEdges', () => {
  it('移動対象と非移動対象の間のエッジを検出', () => {
    const edges = [
      { id: 'e1', source: 'a', target: 'b' },
      { id: 'e2', source: 'b', target: 'c' },
      { id: 'e3', source: 'd', target: 'e' },
    ];
    const broken = detectBrokenEdges(edges, new Set(['b']));
    expect(broken.map((e) => e.id).sort()).toEqual(['e1', 'e2']);
  });

  it('移動対象同士のエッジは分断されない', () => {
    const edges = [{ id: 'e1', source: 'a', target: 'b' }];
    const broken = detectBrokenEdges(edges, new Set(['a', 'b']));
    expect(broken).toEqual([]);
  });
});
```

- [ ] **Step 2: テスト実行で失敗確認**

Run: `npm test -- jumpReferences.test`
Expected: FAIL

- [ ] **Step 3: 実装**

```typescript
// src/utils/jumpReferences.ts
import type { Tab } from '../types/tab';
import type { ScenarioEdge, ScenarioNode } from '../types';

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
```

- [ ] **Step 4: テスト実行**

Run: `npm test -- jumpReferences.test`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/utils/jumpReferences.ts src/utils/jumpReferences.test.ts
git commit -m "feat(util): add jump reference helpers (retarget for move, detect broken edges)"
```

---

### Task 6.2: moveNodesToTab アクション実装

**Files:**
- Modify: `src/store/scenarioStore.ts`
- Add tests in: `src/store/tabActions.test.ts`

- [ ] **Step 1: テスト追加(RED)**

`tabActions.test.ts` に追加:

```typescript
describe('moveNodesToTab', () => {
  beforeEach(reset);

  it('指定ノードを別タブへ移動', () => {
    const t1 = useScenarioStore.getState().activeTabId;
    const t2 = useScenarioStore.getState().addTab('B');
    const node = { id: 'n_test', type: 'event', position: { x: 0, y: 0 }, data: { label: 'X' } } as any;
    useScenarioStore.getState().setActiveTab(t1);
    useScenarioStore.getState().addNode(node);
    useScenarioStore.getState().moveNodesToTab(['n_test'], t2);

    const state = useScenarioStore.getState();
    expect(state.tabs.find((t) => t.id === t1)!.nodes.some((n) => n.id === 'n_test')).toBe(false);
    expect(state.tabs.find((t) => t.id === t2)!.nodes.some((n) => n.id === 'n_test')).toBe(true);
    expect(state.activeTabId).toBe(t2); // 自動切替
  });

  it('GroupNode 移動時に子ノードも同伴', () => {
    const t1 = useScenarioStore.getState().activeTabId;
    const t2 = useScenarioStore.getState().addTab('B');
    const group = { id: 'g1', type: 'group', position: {x:0,y:0}, data: { label: 'G' } } as any;
    const child = { id: 'c1', type: 'event', position: {x:0,y:0}, data: { label: 'C' }, parentNode: 'g1' } as any;
    useScenarioStore.getState().addNode(group);
    useScenarioStore.getState().addNode(child);
    useScenarioStore.getState().moveNodesToTab(['g1'], t2);

    const tab2 = useScenarioStore.getState().tabs.find((t) => t.id === t2)!;
    expect(tab2.nodes.some((n) => n.id === 'g1')).toBe(true);
    expect(tab2.nodes.some((n) => n.id === 'c1')).toBe(true);
  });

  it('ジャンプ参照が追従', () => {
    const t1 = useScenarioStore.getState().activeTabId;
    const t2 = useScenarioStore.getState().addTab('B');
    const target = { id: 'tgt', type: 'event', position: {x:0,y:0}, data: { label: 'T' } } as any;
    const jump = { id: 'jmp', type: 'jump', position: {x:0,y:0}, data: { label: 'J', jumpTarget: { tabId: t1, nodeId: 'tgt' } } } as any;
    useScenarioStore.getState().addNode(target);
    useScenarioStore.getState().addNode(jump);
    useScenarioStore.getState().moveNodesToTab(['tgt'], t2);
    const movedJump = useScenarioStore.getState().tabs.flatMap((t) => t.nodes).find((n) => n.id === 'jmp') as any;
    expect(movedJump.data.jumpTarget).toEqual({ tabId: t2, nodeId: 'tgt' });
  });
});
```

- [ ] **Step 2: テスト失敗確認**

Run: `npm test -- tabActions.test`
Expected: FAIL (moveNodesToTab 未実装または不完全)

- [ ] **Step 3: 実装**

```typescript
moveNodesToTab: (nodeIds, targetTabId, edgeStrategy = 'delete') => {
  const state = get();
  if (state.activeTabId === targetTabId) return;
  const sourceTab = state.tabs.find((t) => t.id === state.activeTabId);
  const targetTab = state.tabs.find((t) => t.id === targetTabId);
  if (!sourceTab || !targetTab) return;

  // GroupNode の子も同伴
  const movedSet = new Set(nodeIds);
  for (const id of nodeIds) {
    const node = sourceTab.nodes.find((n) => n.id === id);
    if (node?.type === 'group') {
      sourceTab.nodes.forEach((n) => {
        if ((n as any).parentNode === id) movedSet.add(n.id);
      });
    }
  }

  // StickyNode の処理: 親が同伴セットに居なければ親紐付けを解除して同伴
  for (const id of [...movedSet]) {
    const node = sourceTab.nodes.find((n) => n.id === id);
    if (node?.type === 'sticky' && (node as any).parentNode && !movedSet.has((node as any).parentNode)) {
      // detach
      (node as any).parentNode = undefined;
    }
  }

  // 分断エッジを検出
  const broken = sourceTab.edges.filter((e) => {
    const srcMoved = movedSet.has(e.source);
    const tgtMoved = movedSet.has(e.target);
    return srcMoved !== tgtMoved;
  });

  // 移動対象ノード抽出
  const movingNodes = sourceTab.nodes.filter((n) => movedSet.has(n.id));
  const remainingNodes = sourceTab.nodes.filter((n) => !movedSet.has(n.id));

  // タブ内エッジ分割
  const innerSourceEdges = sourceTab.edges.filter(
    (e) => !broken.includes(e) && !movedSet.has(e.source) && !movedSet.has(e.target)
  );
  const innerMovingEdges = sourceTab.edges.filter(
    (e) => movedSet.has(e.source) && movedSet.has(e.target)
  );

  // 分断エッジを edgeStrategy に従い処理
  let extraSourceNodes: any[] = [];
  let extraTargetNodes: any[] = [];
  let extraSourceEdges: any[] = [];
  let extraTargetEdges: any[] = [];

  if (edgeStrategy === 'replace-jump') {
    for (const e of broken) {
      const srcInSrc = !movedSet.has(e.source);
      const newJumpId = `jmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      if (srcInSrc) {
        // source は元タブに残る、target は移動先
        extraSourceNodes.push({
          id: newJumpId,
          type: 'jump',
          position: { x: 0, y: 0 },
          data: { label: `Jump → ${e.target}`, jumpTarget: { tabId: targetTabId, nodeId: e.target } },
        });
        extraSourceEdges.push({ ...e, id: `${e.id}_to_jump`, target: newJumpId });
      } else {
        // source が移動先タブ、target は元タブに残る
        extraTargetNodes.push({
          id: newJumpId,
          type: 'jump',
          position: { x: 0, y: 0 },
          data: { label: `Jump → ${e.target}`, jumpTarget: { tabId: state.activeTabId, nodeId: e.target } },
        });
        extraTargetEdges.push({ ...e, id: `${e.id}_to_jump`, target: newJumpId });
      }
    }
  }
  // 'delete' 戦略の場合は broken は捨てる(extraXxx は空のまま)

  // タブを再構築
  const newTabs = state.tabs.map((t) => {
    if (t.id === state.activeTabId) {
      return {
        ...t,
        nodes: [...remainingNodes, ...extraSourceNodes],
        edges: [...innerSourceEdges, ...extraSourceEdges],
      };
    }
    if (t.id === targetTabId) {
      return {
        ...t,
        nodes: [...t.nodes, ...movingNodes, ...extraTargetNodes],
        edges: [...t.edges, ...innerMovingEdges, ...extraTargetEdges],
      };
    }
    return t;
  });

  // ジャンプ参照追従
  const finalTabs = newTabs.map((tab) => ({
    ...tab,
    nodes: tab.nodes.map((n) => {
      if (n.type !== 'jump') return n;
      const jt = (n as any).data?.jumpTarget;
      if (jt && movedSet.has(jt.nodeId)) {
        return { ...n, data: { ...(n as any).data, jumpTarget: { ...jt, tabId: targetTabId } } };
      }
      return n;
    }),
  }));

  set({ tabs: finalTabs, activeTabId: targetTabId, selectedNodeId: null });
  get().pushHistory();
},
```

- [ ] **Step 4: テスト実行で PASS 確認**

Run: `npm test -- tabActions.test`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/store/scenarioStore.ts src/store/tabActions.test.ts
git commit -m "feat(store): implement moveNodesToTab with group sibling handling and edge break detection"
```

---

### Task 6.3: EdgeBreakDialog コンポーネント

**Files:**
- Create: `src/components/EdgeBreakDialog.tsx`

- [ ] **Step 1: コンポーネント作成**

```tsx
// src/components/EdgeBreakDialog.tsx
import React, { useState } from 'react';
import { useTranslation } from '../hooks/useTranslation';

interface EdgeBreakDialogProps {
  isOpen: boolean;
  edgeCount: number;
  onConfirm: (strategy: 'delete' | 'replace-jump') => void;
  onCancel: () => void;
}

export function EdgeBreakDialog({ isOpen, edgeCount, onConfirm, onCancel }: EdgeBreakDialogProps) {
  const { t } = useTranslation();
  const [strategy, setStrategy] = useState<'delete' | 'replace-jump'>('delete');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4" role="dialog" aria-modal="true">
      <div className="bg-card border border-border rounded-lg shadow-xl p-6 w-[480px] max-w-full">
        <h2 className="text-lg font-bold mb-2">{t('moveNodesToTab.edgeBreakTitle' as any)}</h2>
        <p className="text-muted-foreground mb-4">
          {t('moveNodesToTab.edgeBreakBody' as any).replace('{n}', String(edgeCount))}
        </p>
        <div className="space-y-2 mb-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="strategy"
              checked={strategy === 'delete'}
              onChange={() => setStrategy('delete')}
            />
            <span>{t('moveNodesToTab.choiceDelete' as any)}</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="strategy"
              checked={strategy === 'replace-jump'}
              onChange={() => setStrategy('replace-jump')}
            />
            <span>{t('moveNodesToTab.choiceReplaceJump' as any)}</span>
          </label>
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="min-h-[44px] px-4 py-2 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80"
          >
            {t('common.cancel' as any)}
          </button>
          <button
            onClick={() => onConfirm(strategy)}
            className="min-h-[44px] px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {t('common.confirm' as any)}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: ビルド確認**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: コミット**

```bash
git add src/components/EdgeBreakDialog.tsx
git commit -m "feat(ui): add EdgeBreakDialog for choosing edge handling strategy"
```

---

### Task 6.4: MoveToTabSubmenu と ContextMenu 統合

**Files:**
- Create: `src/components/MoveToTabSubmenu.tsx`
- Modify: `src/components/ContextMenu.tsx`

- [ ] **Step 1: MoveToTabSubmenu 作成**

```tsx
// src/components/MoveToTabSubmenu.tsx
import React from 'react';
import { useScenarioStore } from '../store/scenarioStore';
import { useTranslation } from '../hooks/useTranslation';

interface MoveToTabSubmenuProps {
  selectedNodeIds: string[];
  onMove: (targetTabId: string) => void;
}

export function MoveToTabSubmenu({ selectedNodeIds, onMove }: MoveToTabSubmenuProps) {
  const { t } = useTranslation();
  const tabs = useScenarioStore((s) => s.tabs);
  const activeTabId = useScenarioStore((s) => s.activeTabId);
  const otherTabs = tabs.filter((t) => t.id !== activeTabId);

  const label =
    selectedNodeIds.length > 1
      ? t('tab.moveNodesToWithCount' as any).replace('{n}', String(selectedNodeIds.length))
      : t('tab.moveNodesTo' as any);

  if (otherTabs.length === 0) {
    return (
      <div className="px-3 py-1.5 text-sm text-muted-foreground" title={t('tab.noOtherTabs' as any)}>
        {label} ({t('tab.noOtherTabs' as any)})
      </div>
    );
  }

  return (
    <div className="relative group">
      <div className="px-3 py-1.5 text-sm hover:bg-accent cursor-pointer flex items-center justify-between">
        <span>{label}</span>
        <span>▶</span>
      </div>
      <div className="hidden group-hover:block absolute left-full top-0 bg-popover border border-border rounded shadow-lg min-w-[160px]">
        {otherTabs.map((t) => (
          <div
            key={t.id}
            onClick={() => onMove(t.id)}
            className="px-3 py-1.5 text-sm hover:bg-accent cursor-pointer truncate"
          >
            {t.name}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: ContextMenu に統合**

`ContextMenu.tsx` の該当箇所(ノード単体/多選択時のメニュー)に挿入。具体的な挿入位置は `ContextMenu.tsx` の構造を見ながら、Group/Duplicate などと並べる。

```tsx
import { MoveToTabSubmenu } from './MoveToTabSubmenu';
import { EdgeBreakDialog } from './EdgeBreakDialog';

// State 追加
const [pendingMove, setPendingMove] = useState<{ targetTabId: string; brokenCount: number } | null>(null);

// メニュー項目として
<MoveToTabSubmenu
  selectedNodeIds={selectedIds}
  onMove={(targetTabId) => {
    // 分断エッジ件数を計算
    const activeTab = useScenarioStore.getState().tabs.find((t) => t.id === useScenarioStore.getState().activeTabId);
    const movedSet = new Set(selectedIds);
    const broken = activeTab?.edges.filter((e) => {
      const sm = movedSet.has(e.source);
      const tm = movedSet.has(e.target);
      return sm !== tm;
    }) ?? [];
    if (broken.length > 0) {
      setPendingMove({ targetTabId, brokenCount: broken.length });
    } else {
      useScenarioStore.getState().moveNodesToTab(selectedIds, targetTabId, 'delete');
    }
    onClose();
  }}
/>

// ダイアログレンダ
{pendingMove && (
  <EdgeBreakDialog
    isOpen={true}
    edgeCount={pendingMove.brokenCount}
    onConfirm={(strategy) => {
      useScenarioStore.getState().moveNodesToTab(selectedIds, pendingMove.targetTabId, strategy);
      setPendingMove(null);
    }}
    onCancel={() => setPendingMove(null)}
  />
)}
```

- [ ] **Step 3: ビルド確認 + 手動動作確認**

```bash
npx tsc --noEmit
npm run dev
```

確認項目:
- ノード右クリック → 「別のタブへ移動」サブメニュー表示
- 別タブが無い時は disabled 表示
- 多選択時は件数表示
- 移動でエッジ分断が無いケース → 即座に移動
- エッジ分断ケース → ダイアログが出て削除/置換選択可能

- [ ] **Step 4: コミット**

```bash
git add src/components/MoveToTabSubmenu.tsx src/components/ContextMenu.tsx
git commit -m "feat(context-menu): add Move-to-tab submenu with edge break dialog"
```

---

## Phase 7: i18n キーの追加

### Task 7.1: i18n キーを追加

**Files:**
- Modify: `src/i18n/types.ts`
- Modify: `src/i18n/ja.ts`
- Modify: `src/i18n/en.ts`

- [ ] **Step 1: types.ts にキー追加**

`src/i18n/types.ts` の i18n キー型に以下を追加(構造は既存パターンを参照):

```typescript
'tab.defaultName': string;
'tab.add': string;
'tab.rename': string;
'tab.delete': string;
'tab.deleteConfirmTitle': string;
'tab.deleteConfirmBodyNodes': string;
'tab.deleteConfirmBodyJumps': string;
'tab.cannotDeleteLast': string;
'tab.moveNodesTo': string;
'tab.moveNodesToWithCount': string;
'tab.noOtherTabs': string;
'jumpTarget.search': string;
'jumpTarget.noResults': string;
'jumpTarget.broken': string;
'jumpTarget.tooMany': string;
'moveNodesToTab.edgeBreakTitle': string;
'moveNodesToTab.edgeBreakBody': string;
'moveNodesToTab.choiceDelete': string;
'moveNodesToTab.choiceReplaceJump': string;
'moveNodesToTab.jumpNodeDefaultLabel': string;
'migration.futureVersion': string;
```

- [ ] **Step 2: ja.ts に日本語訳追加**

```typescript
'tab.defaultName': 'タブ {n}',
'tab.add': 'タブを追加',
'tab.rename': '名前を変更',
'tab.delete': '削除',
'tab.deleteConfirmTitle': 'タブを削除しますか?',
'tab.deleteConfirmBodyNodes': 'このタブには {n} 個のノードが含まれています',
'tab.deleteConfirmBodyJumps': '{n} 個のジャンプノードがこのタブを参照しています',
'tab.cannotDeleteLast': '最後のタブは削除できません',
'tab.moveNodesTo': '別のタブへ移動',
'tab.moveNodesToWithCount': '{n} 個のノードを別のタブへ移動',
'tab.noOtherTabs': '他のタブがありません',
'jumpTarget.search': 'ノードを検索…',
'jumpTarget.noResults': '該当するノードがありません',
'jumpTarget.broken': 'リンク切れ',
'jumpTarget.tooMany': '候補が多すぎます。絞り込んでください',
'moveNodesToTab.edgeBreakTitle': 'エッジが分断されます',
'moveNodesToTab.edgeBreakBody': 'この移動により、{n} 個のエッジがタブをまたぎます。どう扱いますか?',
'moveNodesToTab.choiceDelete': 'エッジを削除する',
'moveNodesToTab.choiceReplaceJump': 'ジャンプノードに置き換える',
'moveNodesToTab.jumpNodeDefaultLabel': 'Jump → {label}',
'migration.futureVersion': 'このシナリオはより新しいバージョン (v{n}) で作成されています。ARKHAM を更新してください',
```

- [ ] **Step 3: en.ts に英語訳追加**

```typescript
'tab.defaultName': 'Tab {n}',
'tab.add': 'Add tab',
'tab.rename': 'Rename',
'tab.delete': 'Delete',
'tab.deleteConfirmTitle': 'Delete tab?',
'tab.deleteConfirmBodyNodes': 'This tab contains {n} nodes',
'tab.deleteConfirmBodyJumps': '{n} jump nodes reference this tab',
'tab.cannotDeleteLast': 'Cannot delete the last tab',
'tab.moveNodesTo': 'Move to tab',
'tab.moveNodesToWithCount': 'Move {n} nodes to tab',
'tab.noOtherTabs': 'No other tabs',
'jumpTarget.search': 'Search nodes…',
'jumpTarget.noResults': 'No matching nodes',
'jumpTarget.broken': 'Broken link',
'jumpTarget.tooMany': 'Too many results. Please refine',
'moveNodesToTab.edgeBreakTitle': 'Edges will be broken',
'moveNodesToTab.edgeBreakBody': 'This move will break {n} edges across tabs. How do you want to handle them?',
'moveNodesToTab.choiceDelete': 'Delete the edges',
'moveNodesToTab.choiceReplaceJump': 'Replace with jump nodes',
'moveNodesToTab.jumpNodeDefaultLabel': 'Jump → {label}',
'migration.futureVersion': 'This scenario was created with a newer version (v{n}). Please update ARKHAM.',
```

- [ ] **Step 4: 各コンポーネントの `as any` を外す**

Phase 4-6 で多数の `t('xxx' as any)` を入れたものを、型安全に置換:
```bash
grep -rn "t('tab\." src/components/
grep -rn "t('jumpTarget\." src/components/
grep -rn "t('moveNodesToTab\." src/components/
```

各箇所で `as any` を削除し、型エラーが出ないことを確認。

- [ ] **Step 5: ビルド確認**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: コミット**

```bash
git add src/i18n/ src/components/
git commit -m "feat(i18n): add tab/jumpTarget/moveNodesToTab/migration keys (ja+en)"
```

---

### Task 7.2: 未来バージョン検出時のトースト表示

**Files:**
- Modify: `src/components/Layout.tsx` (起動時に未来バージョン検出をユーザに通知)

- [ ] **Step 1: マウント時に future format フラグを確認**

`Layout.tsx` の最初の useEffect に追加:

```typescript
useEffect(() => {
  // 起動直後に migration による future format 検出があれば通知
  const initialState = (useScenarioStore.getState() as any).__futureFormatVersion;
  // 注: scenarioStore の loadInitialState で {__futureFormat: true, version} を返した場合に
  // この情報を Store の起動時 state に反映する仕組みが必要。
  // 実装: loadInitialState の戻り値が __futureFormat の場合、Store には空 state + 別途グローバル変数で通知
}, []);
```

シンプルな実装方針: `loadInitialState` で `__futureFormat` を検出した場合、`window.__ARKHAM_FUTURE_VERSION_DETECTED__` のようなグローバルフラグを立て、Layout マウント時に検査しトースト表示。

```typescript
// scenarioStore.ts 内 loadInitialState の future format 分岐
if (isFutureFormat(parsed)) {
  const key = `${FUTURE_BACKUP_PREFIX}${Date.now()}`;
  localStorage.setItem(key, stored);
  pruneBackups(FUTURE_BACKUP_PREFIX);
  (window as any).__ARKHAM_FUTURE_VERSION_DETECTED__ = parsed.version;
  return null; // 空状態で起動
}

// Layout.tsx 内
useEffect(() => {
  const v = (window as any).__ARKHAM_FUTURE_VERSION_DETECTED__;
  if (v) {
    toast.error(t('migration.futureVersion').replace('{n}', String(v)));
    delete (window as any).__ARKHAM_FUTURE_VERSION_DETECTED__;
  }
}, []);
```

- [ ] **Step 2: 手動確認**

```bash
npm run dev
```

ブラウザの DevTools コンソールで:
```javascript
localStorage.setItem('trpg-scenario-storage', JSON.stringify({ version: 99, tabs: [] }));
location.reload();
```

→ トースト「このシナリオはより新しいバージョン (v99) で作成されています…」が表示されることを確認

- [ ] **Step 3: コミット**

```bash
git add src/store/scenarioStore.ts src/components/Layout.tsx
git commit -m "feat(migration): warn user when future format detected"
```

---

## Phase 8: 仕上げ・回帰確認・ドキュメント

### Task 8.1: モバイル UX 確認

**Files:**
- (確認のみ、コード変更は問題があれば随時)

- [ ] **Step 1: dev サーバ起動 + DevTools のモバイルエミュレーション**

```bash
npm run dev
```

iPhone/Pixel 等のモバイルプリセットで:
- TabBar が表示され、横スワイプで多数タブをスクロール可能
- タブ長押しでコンテキストメニュー(現状は `onContextMenu` 受け取りまでのスタブ。長押し未対応なら追加実装)
- ＋ボタンの最小タップサイズ(44x44px)を満たしているか

- [ ] **Step 2: 必要なら TabBar/TabBarItem に長押し処理を追加**

(実装はオプション。本パッチ範囲では PC 操作優先、モバイル詳細は次パッチでも可)

- [ ] **Step 3: コミット(変更があれば)**

```bash
git add src/components/TabBar.tsx src/components/TabBarItem.tsx
git commit -m "feat(mobile): touch targets and long-press for tab context menu"
```

---

### Task 8.2: 回帰確認 + パフォーマンス計測

**Files:**
- (確認のみ)

- [ ] **Step 1: 全ユニットテスト実行**

Run: `npm test`
Expected: 全件 PASS(`migration.test`, `tabActions.test`, `jumpReferences.test`, `edgeVisibility.test`, `libraryList.test`, `nodeAbsolutePosition.test`)

- [ ] **Step 2: TypeScript ビルド**

Run: `npm run build`
Expected: SUCCESS

- [ ] **Step 3: dev サーバで包括的手動テスト**

シナリオを実行:
1. 新規起動 → 「タブ 1」表示
2. ノード追加 → タブ 2 追加 → タブ間でノード移動 → ジャンプノードでタブ間遷移
3. 保存 → リロード → 全タブ・viewport 復元
4. レガシー JSON 読込 → 「タブ 1」自動生成
5. アンドゥ/リドゥ(タブ追加・削除・移動)
6. 進行モードでジャンプ実行 → 自動タブ切替
7. タブ削除(ノード入りタブ + ジャンプ参照あり)→ 警告 → 削除 → ジャンプが「未設定」表示

- [ ] **Step 4: 既知の性能関連調査(spec 5.3)**

`recalculateGameState` が全タブを走査する形に変更されているか確認(spec 通り)。
Chrome DevTools のパフォーマンスタブで、200 ノード超の状態でタブ切替やノード追加のフレーム時間を計測し、リグレッションが無いことを確認(主観で OK)。

- [ ] **Step 5: コミット(問題があれば修正)**

(問題発見時のみ)

---

### Task 8.3: ChangeLog & README 更新

**Files:**
- Modify: `public/ChangeLog.md`
- Modify: `README.md`
- Modify: `package.json` (version bump)

- [ ] **Step 1: ChangeLog にエントリ追加**

`public/ChangeLog.md` の先頭(`<!-- SECTION: ja -->` の直下)に:

```markdown
## v2.3.0 ({YYYY-MM-DD})

### 機能追加

- **タブ機能**: シナリオを章/シーン単位の独立したタブに分割可能に
  - キャンバス上部のタブバーから追加・リネーム・削除・並べ替え
  - ノードの右クリックメニューから別タブへ移動可能(エッジ分断時は削除/ジャンプ置換選択)
  - ジャンプノードはタブをまたいで動作し、進行モードで自動タブ切替

### 変更・改善

- ジャンプ先選択を検索可能なコンボボックスに変更(章・ノード名・タイプで絞り込み可能)
- 既存シナリオは初回起動時に自動で「タブ 1」に内包される(後方互換)
```

(英語セクションも同様に追記)

- [ ] **Step 2: README.md の機能一覧に追記**

「機能」セクションに「タブ管理」を追加:

```markdown
- **タブ管理**: 章/シーン/幕などの単位でシナリオを独立したタブに分割。タブバーから追加・リネーム・削除・並べ替え。ノードを別タブへ移動可能で、ジャンプノードはタブを越えて動作。
```

- [ ] **Step 3: package.json の version を bump**

`"version": "2.2.0"` → `"version": "2.3.0"`

- [ ] **Step 4: 最終ビルド & テスト**

Run:
```bash
npm run build
npm test
```
Expected: 両方 PASS

- [ ] **Step 5: コミット**

```bash
git add public/ChangeLog.md README.md package.json
git commit -m "chore: bump version to 2.3.0 with tab feature changelog"
```

---

## Self-Review チェック項目(完了基準)

- [ ] 全 Unit テスト(`migration.test`, `tabActions.test`, `jumpReferences.test`)が PASS
- [ ] 既存 Unit テスト(`edgeVisibility`, `libraryList`, `nodeAbsolutePosition`)に regression なし
- [ ] `npm run build` 成功
- [ ] レガシーフォーマット読込で「タブ 1」自動生成
- [ ] タブ追加・削除・並べ替え・リネームが動作
- [ ] ジャンプノードがタブをまたぐ + 進行モードで自動切替
- [ ] エッジ分断ダイアログで削除/ジャンプ置換が選べる
- [ ] 日本語/英語 i18n が機能
- [ ] ChangeLog・README 更新済み
- [ ] version 2.3.0 bump 済み
- [ ] feature ブランチでのみ作業(main 直接変更なし)

---

## 補足: スコープ外(本計画では実施しない)

- E2E テスト(Playwright)新規セットアップ → プロジェクトに既存無し。次回パッチで導入検討
- B パック(検索性改善: キャラ・変数・リソース一覧の検索ボックス、コマンドパレット、逆引き)
- C パック(性能改善: `recalculateGameState` の O(N×R) 改善、`pushHistory` 最適化、Toaster 上限制御)
- タブの色分け・アイコン
- 別タブへのコピー(ペースト)
- タブ階層化(ネスト)
