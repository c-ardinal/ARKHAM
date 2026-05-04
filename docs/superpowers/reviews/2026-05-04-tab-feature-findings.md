# タブ機能 v2.3.0 マルチパースペクティブレビュー結果

- **実施日**: 2026-05-04
- **対象ブランチ**: `feature/tab-feature-spec` (HEAD: `dc5f9b1`)
- **ベース**: `main` (`c7af0ab`, v2.2.0)
- **レビュー計画**: `docs/superpowers/reviews/2026-05-04-tab-feature-multi-perspective-review.md`
- **実施ペルソナ**: 7 (P1〜P7)

---

## エグゼクティブサマリー

| ペルソナ | Critical | High/Important | Medium/Minor | 判定 |
|---|---|---|---|---|
| P1 セキュリティ | 0 | 2 | 4 | 🟡 |
| P2 TypeScript | 0 | 6 | 4 | 🟡 |
| P3 コード品質 | 0 | 5 | 3 | 🟡 |
| P4 パフォーマンス | - | 3 | 5 | 🟡 |
| P5 UX/A11y | - | 3 | 7 | 🟡 |
| P6 データ整合性 | **2** | 3 | 2 | 🔴 |
| P7 アーキテクト | - | 3 | 7 | 🟡 (Conditional Go) |

**総合判定: 🔴 Critical 2件 + データ消失リスク 2件あり、main マージ前に最低限の修正が必要**

---

## リリース blocker(必修正)

### 🔴 BL-1: 変数操作に「全タブ伝播の修正漏れ」がまだ 2 関数残存

過去の Phase 1-4 regression 修正で `batchRenameVariables` / `deleteVariable` を全タブ走査に直したが、同類の関数が 2 件未対応:

- **`updateVariableMetadata`** (`scenarioStore.ts:1307-1341`) — 変数名変更時、非アクティブタブの VariableNode の `targetVariable` / `${old}→${new}` 置換が走らない (P6 C-1)
- **`addVariable`** (`scenarioStore.ts:1150-1165`) — 新変数追加時の Auto-assign が active タブの未割当 VariableNode のみに伝播 (P6 C-2)

### 🔴 BL-2: グループの「孫ノード」が `moveNodesToTab` 同伴対象から漏れ → データ消失

ネストしたグループ(group 内に group)を移動した時、孫ノードが `movedSet` に入らず元タブに残る → `parentNode` 不在で onNodesChange の orphan 除去によって**自動削除される** (P6 I-1, `scenarioStore.ts:2651-2658`)

### 🔴 BL-3: `tab.viewport` が定義済みだが実際には保存/復元されていない

`Tab` 型に `viewport?: TabViewport` フィールドあり、`handleSave` でも値を入れているが、**タブ切替時の退避/復元処理が実装されていない**。Canvas は依然として単一の `localStorage:'canvas-viewport'` を読むため、タブ切替で zoom/pan が引き継がれない (P6 I-3)

### 🔴 BL-4: `updateNodeData` がアクティブタブ限定で仕様乖離

仕様書 §5.3 は「`findNodeAcrossTabs` で所属タブを特定し更新」と規定するが、実装は `getActiveTabFrom` のみ参照。現状の UI フローでは顕在化しないが、後続のクロスタブ参照 UI で即座に regression する (P7 H-1, `scenarioStore.ts:693-706`)

---

## リリース前推奨(High/Important、まとめて修正可能)

### データ・ロジック

| ID | 内容 | 該当 |
|---|---|---|
| H-D1 | `saveToLocalStorage` の QuotaExceededError がサイレント失敗 | `scenarioStore.ts:2798-2802` (P4 M, P6 I-2) |
| H-D2 | `moveNodesToTab` のジャンプ参照追従ロジックが `retargetJumpReferencesForMove` と重複インライン実装 | `scenarioStore.ts:2758-2768` vs `jumpReferences.ts:4-24` (P7 H-2) |
| H-D3 | jumpRefs 件数算出が Layout に重複インライン (`countJumpReferencesToTab` 未利用) | `Layout.tsx:949-951` (P3) |

### TypeScript / 型安全性

| ID | 内容 | 該当 |
|---|---|---|
| H-T1 | `(window as any).__ARKHAM_FUTURE_VERSION_DETECTED__` のグローバル汚染 + `as any` | `scenarioStore.ts:197`, `Layout.tsx:382-385` (P1 H-2, P2 I-1, P3 命名) |
| H-T2 | `loadScenario(data: any)` — シグネチャの型消失 | `scenarioStore.ts:62` (P2 I-2) |
| H-T3 | `MigratedState.gameState/characters/resources: any` で `as any` 連鎖 | `migration.ts:9-11` (P2 I-5) |
| H-T4 | `jumpReferences.ts` で `n.data` への `as any` アクセス(型は揃ってる) | `jumpReferences.ts:14,18,41` (P2 I-6) |
| H-T5 | `reorderTabs` が splice in-place mutation(immutability ルール違反) | `scenarioStore.ts:2628-2631` (P2 I-3) |

### パフォーマンス

| ID | 内容 | 該当 |
|---|---|---|
| H-P1 | Canvas.tsx の useScenarioStore 全フィールド destructure → 全 state 変更で再レンダ | `Canvas.tsx:64-90` (P4 H) |
| H-P2 | `nodes = activeTab?.nodes ?? []` が毎レンダ新配列 → useMemo/useCallback 依存崩れ | `Canvas.tsx:91-93` (P2 I-4, P4 H) |
| H-P3 | `useAllNodes` の `flatMap` が毎レンダ新配列 → ref equality 破壊 | `tabSelectors.ts:15-16` (P4 H) |

### UX / アクセシビリティ

| ID | 内容 | 該当 |
|---|---|---|
| H-A1 | TabBarItem に WAI-ARIA tab pattern 必須属性が欠落 (`tabIndex` / 矢印キー / `aria-controls`) | `TabBarItem.tsx`, `TabBar.tsx` (P5 H-1) |
| H-A2 | JumpTargetCombobox に WAI-ARIA combobox pattern が欠落 | `JumpTargetCombobox.tsx:79-163` (P5 H-2) |
| H-A3 | LoadingOverlay の `"シナリオを読み込んでいます..."` がハードコード日本語 | `Layout.tsx:992` (P5 H-3) |

### セキュリティ

| ID | 内容 | 該当 |
|---|---|---|
| H-S1 | v2 形式の `node.data` 内容が無検証 (`tab.name` / `jumpTarget` 等) | `scenarioStore.ts:220-235`, `scenarioValidator.ts` (P1 M-1) |

---

## Minor(次パッチで段階対応可能)

### コード品質
- `scenarioStore.ts` が 2868 行 → ルール上限 800 行を大幅超過、`tabActions.ts` 等への分割推奨 (P3)
- Phase 1.2 シム残存(`typeof === 'string'` narrowing 5箇所)→ v2 完全移行確認後に削除 (P3, P7)
- `pendingCrossTabFocus` 命名(`pendingFocusNodeId` がより明示的) (P3, P2 M-1)
- `replace-jump` の `srcMoved` 経路がテスト未カバー (P3)
- `prefer-const` 違反 8箇所 (P2 M-4)
- `createInitialMemoNode` 末尾 `as any` 不要 (P2 M-2)
- `useActiveNodes`/`useActiveEdges` 未使用 → Canvas で利用すべき (P2 M-3)
- `jmp_${Date.now()}_random6` の ID 衝突リスク → `crypto.randomUUID` 推奨 (P3)
- `moveNodesToTab` 内のジャンプノード生成コード重複(srcMoved/!srcMoved) (P3)

### A11y / UX
- EdgeBreakDialog にフォーカストラップ・初期フォーカス未実装 (P5 M-1)
- Combobox の clear ボタンが `<span role="button">` でキーボード操作不可 (P5 M-2)
- タブ長押しコンテキストメニュー未実装(仕様 §6.6) (P5 M-3)
- タブ rename タップ-タップ未実装(仕様 §6.6) (P5 M-4)
- 削除 aria-label にタブ名含まれず(複数タブで区別不能) (P5 M-5)
- アクティブタブ強調が border 色のみ(WCAG 1.4.11 リスク) (P5 L-1)
- EdgeBreakDialog `aria-describedby` 欠落 (P5 L-2)
- `defaultTabName` ヘルパが i18n と二重管理 (P5 L-3)
- broken 状態の視覚手がかりが色のみ(色覚配慮) (P5 L-4)

### セキュリティ
- 既存 `evaluateFormula` の `new Function` (textUtils.ts:113) — pre-existing だが攻撃面拡大 (P1 H-1)
- `crypto.randomUUID` フォールバック ID の予測可能性(将来 URL 共有時リスク) (P1 M-2)
- DebugPanel が LocalStorage キー名一覧をエクスポート(バックアップキー名露出) (P1 M-3)
- 未来バージョン値の Number.isFinite 検証なし → トーストに `Infinity` 表示可能性 (P1 L-1)

### パフォーマンス
- `recalculateGameState` の Element ノード×Resource Map 化(現状 O(N×R)) (P4 M)
- Layout の jumpRefs 算出を useMemo 化 (P4 M)
- クロスタブ jump ポーリング → `onNodesInitialized` イベントへ (P4 M)
- bundle サイズ +22.4KB(現状 655KB)→ TabBar 等を React.lazy(優先度低) (P4 L)

### アーキテクチャ / その他
- E2E (Playwright) 未整備 — 本パッチでも導入されていない (P7 H-3)
- v2.3.0 → v2.2.0 ダウングレード時の救済手順未文書化 (P7 M)
- スコープ外項目「タブ間コピー」需要が高い(優先バックログ化推奨) (P7 M)
- `moveNodesToTab` の `edgeStrategy` デフォルト値あり → ダイアログバイパス可能 (P7 M)

---

## リリース可否判断

**🔴 No-Go(マージ前に Blocker 4件の修正が必須)**

理由:
- BL-1 は変数を多用するシナリオで**サイレントなデータ整合不整合**を起こす
- BL-2 は「グループ移動」で**ユーザのデータが消える**(undo しなければ確定)
- BL-3 は仕様で約束した機能(viewport per-tab)が**動いていない**
- BL-4 は仕様/実装乖離。現状は顕在化しないが後続パッチで即座に regression

その他 Critical は全カテゴリで0だが、Important が累積 22件。リリース blocker(BL-1〜4)以外は段階対応可能だが、データ整合性関連(H-D1)とアクセシビリティ(H-A1, H-A2)は v2.3.0 のリリース文言と整合性が悪いため同梱推奨。

---

## 推奨アクション

### Phase R-1: Blocker 即修正(リリース必須)
1. `updateVariableMetadata` を全タブ走査化
2. `addVariable` Auto-assign を全タブ走査化
3. `moveNodesToTab` のグループ子孫を再帰収集化
4. tab.viewport の保存/復元を Canvas で実装(`setActiveTab` 連動の useEffect)
5. `updateNodeData` を `findNodeAcrossTabs` 経由に修正(または仕様書側を実装に合わせる)

### Phase R-2: リリース推奨修正(マージと同タイミングが理想)
6. `saveToLocalStorage` の QuotaExceededError をユーザ通知
7. `moveNodesToTab` のジャンプ追従を `retargetJumpReferencesForMove` に統一
8. Layout の jumpRefs 算出を `countJumpReferencesToTab` に統一
9. `Window` 型拡張で `__ARKHAM_FUTURE_VERSION_DETECTED__` の `as any` 解消(Zustand store フィールド化推奨)
10. `loadScenario(data)` の型を弁別ユニオン化
11. `MigratedState` の `any` を厳密型化
12. Canvas を `useActiveNodes`/`useActiveEdges` selector に移行
13. TabBarItem の WAI-ARIA tab pattern 実装
14. JumpTargetCombobox の WAI-ARIA combobox pattern 実装
15. LoadingOverlay 文字列 i18n 化

### Phase R-3: 次パッチ以降
- Phase 1.2 シム削除(v2 完全移行確認後)
- scenarioStore.ts のファイル分割
- E2E 導入(E1〜E10)
- A11y minor 改善(focus trap, タップ-タップ rename, 長押しメニュー等)
- パフォーマンス最適化(C スコープ既定)
