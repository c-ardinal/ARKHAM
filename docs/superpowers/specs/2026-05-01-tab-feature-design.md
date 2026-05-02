# 章/シーン タブ機能 設計仕様

- **作成日**: 2026-05-01
- **対象バージョン**: v2.3.0 候補(リリース時に確定)
- **スコープ**: ARKHAM(TRPGScenarioManager)に「タブ」機能を追加し、ノードを論理的なグループ(章・シーン・幕など)に分割可能にする
- **関連スコープ外**: 大規模シナリオ向け検索性改善(B パック) / 性能・一括操作対策(C パック) は別仕様で扱う

---

## 1. 背景と動機

現状のキャンバスは単一のフラットなノード/エッジ配列を持つ。シナリオ規模が大きくなると以下の問題が顕在化する。

- 視覚的に1枚のキャンバスで全体を扱う必要があり、章・シーンの境界が曖昧
- ジャンプノードのターゲット選択 `<select>` が全ノード列挙となり選択が困難
- レンダリング負荷が常に全ノード分かかる

「タブ」機能は **ユーザが章・シーン・幕などの単位で自由にノードをグルーピングし、独立したサブグラフとして編集・閲覧できる** UI を提供する。命名は中立的に「タブ」とし、用途は利用者に委ねる。

---

## 2. 用語定義

| 用語 | 意味 |
|---|---|
| タブ (Tab) | 独立した `nodes` / `edges` を内包する論理パーティション。ユーザが自由に追加・削除・命名する |
| アクティブタブ | 現在キャンバスに表示されているタブ。常に1つ |
| グローバル状態 | 全タブで共有される `gameState` / `characters` / `resources` |
| ジャンプ実行 | 進行モードでジャンプノードがターゲットノードへ遷移する操作。タブをまたぐ場合がある |
| レガシーフォーマット | v1 保存データ(`tabs` フィールドなし、`nodes`/`edges` がトップレベル) |

---

## 3. 設計決定の要点

| 決定 | 選択 | 理由 |
|---|---|---|
| データ分離方針 | **完全分離型** (各タブが独立した `nodes`/`edges`) | 直感性・性能・既存ジャンプノード概念との親和性 |
| グローバル状態の扱い | **完全グローバル共有** (variables/characters/resources) | TRPG では物語全体の連続性が重要 |
| ジャンプ先選択 UI | **一体型コンボボックス** (検索可能) | 二段選択・モーダルより操作数最小、B パックの基盤先行投入 |
| ジャンプ実行時の挙動 | **自動タブ切替 + ターゲットハイライト** | 「ジャンプ」の意味通り、最も自然 |
| タブ配置 | **キャンバス上部にブラウザ風タブバー** | 標準的・学習コスト最小 |
| タブ CRUD UI | **タブ上で完結** (右クリック+ボタン) | 章数想定 5〜20、専用モーダルは過剰 |
| 削除安全策 | **確認ダイアログ + ジャンプ参照警告 + 最後の1タブ削除不可** | データ消失防止 |
| 既存データ移行 | **自動で「Tab 1」を生成し全ノード内包** | ユーザに余計な操作をさせない後方互換 |
| ノード移動手段 | **右クリック「別のタブへ移動」サブメニュー** (多選択対応) | ドラッグ&ドロップは誤操作リスク高、YAGNI |
| 別タブへの複製 | **提供しない** (同タブ内複製のみ) | 「移動」で代替可能、UI 複雑化を回避 |

---

## 4. データモデル

### 4.1. 型定義

```typescript
interface Tab {
  id: string;                  // 例: "tab_1714528800_a3f"
  name: string;                // ユーザ編集可能
  nodes: ScenarioNode[];
  edges: ScenarioEdge[];
  viewport?: { x: number; y: number; zoom: number };  // タブ毎にズーム/パンを保持
}

interface ScenarioState {
  tabs: Tab[];                 // 順序付き(配列順 = タブ表示順)
  activeTabId: string;         // 必ず tabs[*].id のいずれか
  // 以下グローバル(変更なし)
  gameState: GameState;
  characters: CharacterData[];
  resources: ResourceData[];
  selectedNodeId: string | string[] | null;  // 既存型に準拠(多選択対応)。タブ切替で null にリセット
  // ...その他既存フィールド
}
```

### 4.2. ジャンプノードデータの拡張

```typescript
// 旧 (v1)
data: { jumpTarget: string }   // ノード ID 文字列

// 新 (v2)
data: { jumpTarget: { tabId: string; nodeId: string } | null }
```

**理由**: ジャンプ実行時に所属タブを O(1) で特定できる。文字列だけで保持すると全タブの全ノードを走査する必要がある。

### 4.3. 不変条件

- `tabs.length >= 1` を常に保証
- `activeTabId` は必ず `tabs[*].id` のいずれかを指す
- ノード ID は **全タブをまたいでユニーク**(タブ間移動でも ID 不変)
- `jumpTarget.tabId` の指す Tab が削除されたら `jumpTarget = null` にリセット

---

## 5. ストア API と状態管理

### 5.1. 新規アクション

```typescript
addTab(name?: string): string;                        // 新タブ作成 → 新 ID 返却
renameTab(id: string, newName: string): void;
deleteTab(id: string): void;                          // 安全策込み(5.4 参照)
reorderTabs(fromIdx: number, toIdx: number): void;
setActiveTab(id: string): void;                       // selectedNodeId も null へ
moveNodesToTab(nodeIds: string[], targetTabId: string): void;  // 多選択対応
```

### 5.2. 派生 Selector

```typescript
getActiveTab(): Tab;
getActiveNodes(): ScenarioNode[];
getActiveEdges(): ScenarioEdge[];
findNodeAcrossTabs(nodeId: string): { tabId: string; node: ScenarioNode } | null;
getAllNodes(): ScenarioNode[];                        // ジャンプ先選択 UI 用
```

### 5.3. 既存アクションの動作変更

| アクション | 変更後の挙動 |
|---|---|
| `addNode(node)` | `activeTabId` のタブに追加 |
| `updateNodeData(id, data)` | `findNodeAcrossTabs` で所属タブを特定し更新 |
| `deleteNodes(ids)` | アクティブタブのみから削除 |
| `duplicateNodes(nodes)` | 同一アクティブタブに複製 |
| `onNodesChange/onEdgesChange/onConnect` | アクティブタブのみ操作 |
| `recalculateGameState` | **全タブを走査** (gameState はグローバル) |
| `pushHistory` | スナップショット対象を `{ tabs, activeTabId, gameState }` へ拡張 |
| `loadScenario(data)` | 後方互換マイグレーション実行(7 章) |

### 5.4. `deleteTab` のロジック

```text
1. tabs.length <= 1 ならエラートースト「最後のタブは削除できません」を出して return
2. 削除対象タブの nodes 数を取得
3. 全タブのジャンプノードを走査し、targetTabId === id のものを列挙
4. 確認ダイアログ表示(節 6.4)
5. 確定後:
   - tabs から対象を除外
   - 列挙したジャンプノードの jumpTarget を null にリセット
   - activeTabId が削除対象なら、右隣のタブへ自動切替(右隣がなければ左隣)
6. pushHistory(undo 可能)
```

### 5.5. ジャンプ実行ヘルパー

```typescript
executeJump(target: { tabId: string; nodeId: string }): void {
  if (target.tabId !== activeTabId) {
    setActiveTab(target.tabId);
  }
  setSelectedNode(target.nodeId);
  // カメラ移動とハイライトは Canvas 側 useEffect が selectedNodeId 変化を検知して実施
}
```

### 5.6. エッジケース対応

#### 5.6.1. `moveNodesToTab` の追加処理

```text
1. ジャンプ参照の追従
   全タブのジャンプノードを走査し、jumpTarget.nodeId が移動対象 nodeIds に含まれるものを抽出。
   抽出した jumpTarget.tabId を targetTabId に書き換える。
   → これにより、移動後もジャンプは追従する(broken にならない)。

2. GroupNode の同伴
   移動対象に GroupNode が含まれる場合、その子ノード(parentNode === groupId のノード)を再帰的に同伴。
   グループの子ノードのみを単独で移動した場合は、parentNode を解除して移動(子が孤立しないよう保護)。

3. StickyNode の同伴
   StickyNode が親ノードに紐づいている(parentNode が指定されている)場合:
   - 親が同じ移動セットに含まれる → そのまま同伴
   - 親が含まれない → StickyNode の parentNode を解除して移動(StickyNode は親を失うが残る)

4. 分断エッジの検出
   移動対象 nodeIds と「移動しないノード」の間にあるエッジを「分断エッジ」として列挙。
   分断エッジが 1 件以上ある場合、節 6.5 のダイアログを表示し、ユーザの選択に従う。
   0 件なら即時実行。

5. ジャンプ参照の追従結果と分断エッジの処理は、最後に pushHistory にまとめてスナップショット
   (undo 1回で全部戻る)。
```

#### 5.6.2. `renameTab` の入力バリデーション

- 前後の空白は trim
- 結果が空文字または空白のみの場合は **rename をキャンセル**(元の名前を維持、エラートーストなし)
- 最大 50 文字。超過分はサイレントに切り捨て
- 重複名は **許可**(`id` で一意性が保証されているため)

---

## 6. UI 設計

### 6.1. `TabBar` (新規)

ヘッダ直下、キャンバス上部に高さ 36px の帯として配置。

```
[Tab 1 ✕] [導入 ✕] [本編 ✕] [ボス戦 ✕]  [＋]
```

| 操作 | 挙動 |
|---|---|
| 左クリック | `setActiveTab(id)` |
| ダブルクリック | インライン編集モード(`<input>` 化) → Enter / blur で `renameTab` |
| 右クリック (PC) / 長押し (Mobile) | コンテキストメニュー: Rename / Delete |
| タブ間ドラッグ&ドロップ | `reorderTabs(fromIdx, toIdx)` |
| × ボタン | 確認ダイアログ → `deleteTab` |
| ＋ ボタン | `addTab()` → `setActiveTab(新ID)` → 即インライン編集 |
| アクティブタブ | 下線 + 背景強調(既存テーマカラーに準拠) |
| タブが多い場合 | 横スクロール(touch swipe 対応) |

### 6.2. `JumpTargetCombobox` (新規)

`PropertyPanel.tsx` の Jump ノード設定欄で既存 `<select>` を置換。

```
ジャンプ先: [本編 / イベント01 (Event)         ▼]
            ┌────────────────────────────────┐
            │ 入力欄(自動フォーカス)         │
            ├────────────────────────────────┤
            │ ボス戦 / 戦闘開始 (Event)      │
            │ ボス戦 / 第二形態 (Branch)     │
            │ ボス戦 / 撤退判定 (Branch)     │
            └────────────────────────────────┘
```

- 表示形式: `{tabName} / {nodeLabel} ({nodeType})`
- フィルタ対象: `tabName` + `nodeLabel` + `nodeType` を部分一致(大文字小文字無視)
- キーボード操作: ↑↓ 移動 / Enter 確定 / Esc 閉じる
- 選択結果: `data.jumpTarget = { tabId, nodeId }` を保存
- **broken 状態**: `jumpTarget` の `tabId`/`nodeId` が現存しない場合は赤字「リンク切れ」表示 + クリアボタン(主にノード単体削除時に発生。タブ削除時は 5.4 の処理で null にリセット済みのため「未設定」と表示される)
- 候補 200 件超では先頭 200 件 + 「絞り込んでください」ヒント(暫定)

### 6.3. ノードコンテキストメニューへの追加

`ContextMenu.tsx` に以下のサブメニューを追加。

```
別のタブへ移動 ▶
   ├─ Tab 1
   ├─ 本編
   └─ ボス戦       ← アクティブタブは除外
```

- 多選択時は「N 個のノードを別のタブへ移動 ▶」と表記
- 他タブが存在しない場合は disabled + ツールチップ「他のタブがありません」
- 実行: `moveNodesToTab(selectedIds, targetTabId)` → ターゲットタブへ自動切替

### 6.4. タブ削除確認ダイアログ

```
タブ「本編」を削除しますか?

  • このタブには 27 個のノードが含まれています
  • ⚠ 3 個のジャンプノードがこのタブを参照しています
    (削除後、これらのジャンプ先はリセットされます)

  この操作は元に戻すことができます(Undo)。

      [キャンセル]   [削除]  ← 既存パターンの赤ボタン
```

- ジャンプ参照件数は他タブ全走査で算出。0 件なら警告行は非表示
- 確認文言の数値は動的構築

### 6.5. エッジ分断時の選択ダイアログ (新規)

`moveNodesToTab` 実行時、分断エッジが 1 件以上検出された場合に表示。

```
エッジが分断されます

  この移動により、3 個のエッジがタブをまたぎます。
  どう扱いますか?

  ⦿ エッジを削除する
  ◯ ジャンプノードに置き換える
       (ジャンプノードを新規作成し、論理的な接続を維持)

      [キャンセル]   [実行]
```

**ジャンプノード置換ロジック**:

各分断エッジ A→B について:

- **A が元タブ側・B が移動先タブ側** の場合:
  - 元タブに jump ノード J を A の右側付近に新規作成
  - エッジ A→J を追加
  - `J.data.jumpTarget = { tabId: targetTabId, nodeId: B.id }`
- **A が移動先タブ側・B が元タブ側** の場合:
  - 移動先タブに jump ノード J を A の右側付近に新規作成
  - エッジ A→J を追加
  - `J.data.jumpTarget = { tabId: sourceTabId, nodeId: B.id }`

すべての処理後、元の分断エッジは削除。生成されるジャンプノード名は既定値(例: `Jump → {nodeLabel}`)で、ユーザは後でリネーム可。

### 6.6. モバイル対応

- TabBar は横スワイプスクロール
- 右クリック相当: タブ長押しでコンテキストメニュー
- インライン rename はタップ-タップ(時間差ダブルタップ)で起動

### 6.7. i18n キー (新規)

| キー | ja | en |
|---|---|---|
| `tab.defaultName` | `タブ {n}` | `Tab {n}` |
| `tab.add` | `タブを追加` | `Add tab` |
| `tab.rename` | `名前を変更` | `Rename` |
| `tab.delete` | `削除` | `Delete` |
| `tab.deleteConfirmTitle` | `タブを削除しますか?` | `Delete tab?` |
| `tab.deleteConfirmBodyNodes` | `このタブには {n} 個のノードが含まれています` | `This tab contains {n} nodes` |
| `tab.deleteConfirmBodyJumps` | `{n} 個のジャンプノードがこのタブを参照しています` | `{n} jump nodes reference this tab` |
| `tab.cannotDeleteLast` | `最後のタブは削除できません` | `Cannot delete the last tab` |
| `tab.moveNodesTo` | `別のタブへ移動` | `Move to tab` |
| `tab.moveNodesToWithCount` | `{n} 個のノードを別のタブへ移動` | `Move {n} nodes to tab` |
| `tab.noOtherTabs` | `他のタブがありません` | `No other tabs` |
| `jumpTarget.search` | `ノードを検索…` | `Search nodes…` |
| `jumpTarget.noResults` | `該当するノードがありません` | `No matching nodes` |
| `jumpTarget.broken` | `リンク切れ` | `Broken link` |
| `jumpTarget.tooMany` | `候補が多すぎます。絞り込んでください` | `Too many results. Please refine` |
| `moveNodesToTab.edgeBreakTitle` | `エッジが分断されます` | `Edges will be broken` |
| `moveNodesToTab.edgeBreakBody` | `この移動により、{n} 個のエッジがタブをまたぎます。どう扱いますか?` | `This move will break {n} edges across tabs. How do you want to handle them?` |
| `moveNodesToTab.choiceDelete` | `エッジを削除する` | `Delete the edges` |
| `moveNodesToTab.choiceReplaceJump` | `ジャンプノードに置き換える` | `Replace with jump nodes` |
| `moveNodesToTab.jumpNodeDefaultLabel` | `Jump → {label}` | `Jump → {label}` |
| `migration.futureVersion` | `このシナリオはより新しいバージョン (v{n}) で作成されています。ARKHAM を更新してください` | `This scenario was created with a newer version (v{n}). Please update ARKHAM.` |

---

## 7. マイグレーション

### 7.1. 保存データ構造 (v2)

```json
{
  "version": 2,
  "tabs": [
    {
      "id": "tab_1714528800_a3f",
      "name": "Tab 1",
      "nodes": [...],
      "edges": [...],
      "viewport": { "x": 0, "y": 0, "zoom": 1 }
    }
  ],
  "activeTabId": "tab_1714528800_a3f",
  "gameState": { ... },
  "characters": [...],
  "resources": [...],
  "language": "ja",
  "theme": "light"
}
```

### 7.2. 検出ロジック

```typescript
function isLegacyFormat(data: unknown): boolean {
  return !(data && typeof data === 'object' && 'tabs' in data && Array.isArray((data as any).tabs));
}
```

### 7.3. 変換関数

```typescript
function migrateLegacyToTabbed(legacy: LegacyState): ScenarioStateV2 {
  const tabId = generateTabId();
  const migratedNodes = migrateJumpTargets(legacy.nodes ?? [], tabId);
  return {
    version: 2,
    tabs: [{
      id: tabId,
      name: t('tab.defaultName', { n: 1 }),
      nodes: migratedNodes,
      edges: legacy.edges ?? [],
      viewport: undefined,
    }],
    activeTabId: tabId,
    gameState: legacy.gameState,
    characters: legacy.characters ?? [],
    resources: legacy.resources ?? [],
    language: legacy.language ?? 'ja',
    theme: legacy.theme ?? 'light',
  };
}

function migrateJumpTargets(nodes: ScenarioNode[], defaultTabId: string): ScenarioNode[] {
  return nodes.map(n => {
    if (n.type !== 'jump') return n;
    const t = n.data?.jumpTarget;
    if (typeof t === 'string') {
      return { ...n, data: { ...n.data, jumpTarget: { tabId: defaultTabId, nodeId: t } } };
    }
    return n;
  });
}
```

### 7.4. 実行タイミングと安全策

- `loadScenario` / localStorage 読込時に同期実行
- 失敗時はトースト通知し、空の v2 状態で起動
- マイグレーション開始前に旧データを `arkham_legacy_backup_<timestamp>` キーで localStorage に退避
- バックアップは最新3世代のみ保持(古いものから順に削除)

### 7.5. 未来バージョン (version > 2) の検出

ロード時に `data.version > 2` を検出した場合:

- マイグレーションは **実行しない**(構造未知のため触らない)
- 旧データを `arkham_future_format_backup_<timestamp>` に退避
- エラートースト表示: 「このシナリオはより新しいバージョン (v{n}) で作成されています。ARKHAM を更新してください」(i18n: `migration.futureVersion`)
- 安全側として **空の v2 状態で起動** (ユーザのデータは退避済みなので復旧可能)

### 7.6. 既存コンシューマの更新方針

`store.nodes` / `store.edges` をトップレベルから **削除**(後方互換 alias を残さない)。理由:

- alias を残すと「フラットだと思って読む」バグを温存しがち
- TypeScript コンパイルエラーで網羅的に検出可能
- 派生 selector (`useActiveNodes()` 等) のフックを用意し、機械的に置換可能

---

## 8. テスト戦略

ユーザの CLAUDE.md ルールに従い **TDD (Red → Green → Refactor)** を厳守し、最小 80% カバレッジを目標とする。

### 8.1. Unit (vitest)

| # | 対象 | 観点 |
|---|---|---|
| U1 | `migrateLegacyToTabbed` | v1→v2 変換 / 空 nodes・edges / 欠損フィールド処理 |
| U2 | `migrateJumpTargets` | string→object 変換 / null・未定義保持 |
| U3 | `addTab` / `renameTab` / `reorderTabs` / `setActiveTab` | 基本 CRUD、selectedNodeId クリア |
| U4 | `deleteTab` | 最後の1タブ保護、ジャンプ参照リセット、隣接タブへの自動切替 |
| U5 | `moveNodesToTab` | 単一・多選択、ID 不変、ターゲットタブへの自動切替 |
| U6 | `findNodeAcrossTabs` / `getActiveNodes` / `getAllNodes` | 既存・存在しない ID |
| U7 | `executeJump` | 同タブ・別タブ両ケース |
| U8 | `pushHistory` / `undo` / `redo` | タブ追加削除を含むシナリオ |
| U9 | `moveNodesToTab` のエッジケース | (a) jumpTarget 追従 (b) GroupNode の子同伴 (c) StickyNode 同伴/解除 (d) 分断エッジの削除選択 (e) 分断エッジのジャンプノード置換 |
| U10 | `renameTab` バリデーション | 空文字・空白のみ・前後空白 trim・50 文字超え・重複名許可 |
| U11 | 未来バージョン検出 | `version > 2` 時にバックアップ退避+空起動+トースト表示 |

### 8.2. Component (vitest + RTL)

| # | 対象 | 観点 |
|---|---|---|
| C1 | `TabBar` | render、クリック切替、+/× ボタン、インライン rename、ドラッグ並べ替え |
| C2 | `JumpTargetCombobox` | フィルタ、キーボード操作、選択保存、broken 表示 |
| C3 | `ContextMenu` Move-to-tab | サブメニュー表示 / disabled / 実行 |
| C4 | エッジ分断ダイアログ | 表示判定(0件時は省略) / 削除選択 / ジャンプ置換選択 / キャンセル |

### 8.3. E2E (playwright)

| # | シナリオ |
|---|---|
| E1 | レガシー JSON 読込 → 「Tab 1」自動作成、全ノード内包 |
| E2 | タブ追加 → 別タブにノード作成 → 元タブへ移動 → 状態確認 |
| E3 | 別タブ間にまたがるジャンプ作成 → 進行モードで実行 → 自動タブ切替+ハイライト |
| E4 | 最後のタブ削除試行 → 拒否トースト |
| E5 | ジャンプ参照されたタブの削除 → 警告ダイアログ表示 → 削除後ジャンプの `jumpTarget` が null(「未設定」表示)になることを確認 |
| E6 | 保存 → リロード → activeTabId / viewport 復元 |
| E7 | ノード移動でジャンプ参照が追従(broken にならない) |
| E8 | グループノード移動で子ノードも同伴 |
| E9 | エッジ分断ダイアログでジャンプ置換を選択 → 両タブにジャンプノードが生成され論理接続が維持される |
| E10 | 既存 E2E (208件) 全件パス確認(リグレッション無し) |

### 8.4. パフォーマンス検証

- タブ切替で React Flow が再マウントされ、非アクティブタブのノードはレンダリングされないこと(DOM 確認)
- アクティブタブのみのノード追加・削除が他タブの状態に影響しないこと

---

## 9. 実装フェーズと検証

| Phase | 内容 | 検証 |
|---|---|---|
| 1 | `Tab` 型定義、マイグレーション関数、レガシー読込テスト | U1, U2 |
| 2 | Store の `tabs/activeTabId` 化、派生 selector、CRUD アクション | U3〜U8 |
| 3 | 既存コンシューマ全更新(TypeScript エラー駆動) | tsc + 既存 E2E パス |
| 4 | `TabBar` 実装 + Layout 統合 | C1 + 手動確認 |
| 5 | `JumpTargetCombobox` 実装 + PropertyPanel 差替え | C2 |
| 6 | ContextMenu Move-to-tab + 削除ダイアログのジャンプ警告 | C3 |
| 7 | i18n キー追加、モバイル UX 検証 | 手動 + E2E |
| 8 | E2E E1〜E9 + 既存 E2E 全件パス + パフォーマンス計測 | E2E 全件 |

---

## 10. リスクと対策

| リスク | 対策 |
|---|---|
| 既存コンシューマの修正漏れ | TS で alias 残さない、エラーで網羅検出 |
| マイグレーション失敗 → データ消失 | 旧データを `arkham_legacy_backup_<timestamp>` に退避してから移行 |
| タブ多数(50+)時のタブバー UX 劣化 | 横スクロール対応のみ。タブ検索は B パックで対応 |
| `recalculateGameState` の全タブ走査による遅延 | 既存と同等コスト。本格対策は C スコープ |
| undo/redo でタブ追加削除が混乱 | E2E (U8) で挙動保証 |
| viewport を保持しないと UX が悪化 | `Tab.viewport` フィールドで対応(節 4.1) |
| ノード移動でジャンプ参照が壊れる | `moveNodesToTab` 内で `jumpTarget.tabId` を自動追従(節 5.6.1) |
| ノード移動で分断エッジが発生 | エッジ削除 / ジャンプノード置換のユーザ選択ダイアログ(節 6.5) |
| グループ/付箋ノードの単独移動で子・親が孤立 | 同伴ロジックで保護(節 5.6.1) |
| 未知の将来フォーマット読込で破損 | バージョン検出 + バックアップ退避 + 空起動(節 7.5) |

---

## 11. スコープ外 (将来作業)

以下は本仕様の範囲外。別仕様で扱う。

- B パック: 検索性改善(キャラ・変数・リソース一覧の検索ボックス、コマンドパレット、逆引き、変数サジェストの仮想化)
- C パック: 性能最適化(`recalculateGameState` の O(N×R) 改善、`pushHistory` の最適化、Toaster の上限制御 等)
- タブの色分け・アイコン
- 別タブへのコピー(ペースト)
- タブ階層化(ネスト)
- タブ間のテンプレート流用機能

---

## 12. 完了基準

- [ ] 全 Unit / Component / E2E テストがパス
- [ ] 既存 E2E (208件) リグレッション無し
- [ ] レガシー保存データを正しく v2 にマイグレーション可能
- [ ] タブ追加・削除・並べ替え・リネームが直感的に動作
- [ ] ジャンプノードがタブを跨いで動作し、進行モードで自動タブ切替
- [ ] 日本語/英語 i18n が完備
- [ ] モバイルでタブバーが操作可能
- [ ] ChangeLog.md と README.md (機能一覧) を更新
