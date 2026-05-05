# タブ機能 v2.3.0 マルチパースペクティブレビュー計画

- **作成日**: 2026-05-04
- **対象ブランチ**: `feature/tab-feature-spec` (33 commits, 35 files, +6568/-821)
- **対象範囲**: `c7af0ab..HEAD` のタブ機能 PR 一式
- **背景**: `/ultrareview` がクラッシュしたため、ローカルで同等の観点をマルチペルソナサブエージェントで代替実施
- **目的**: PR マージ前の最終品質ゲート — Critical/Important/Minor の分類で issue を網羅し、リリース判断に資する

---

## 1. レビュー観点(7 ペルソナ)

| # | ペルソナ | 主担当領域 | サブエージェント |
|---|---|---|---|
| P1 | セキュリティレビュアー | 入力検証、XSS/injection、secret 漏洩、OWASP、storage への信用境界 | `security-reviewer` |
| P2 | TypeScript レビュアー | 型安全、`any`/`unknown` 濫用、idiomatic 型設計、async correctness | `typescript-reviewer` |
| P3 | コード品質レビュアー | 可読性、命名、責務分離、DRY/YAGNI、ファイルサイズ、テスト品質 | `code-reviewer` |
| P4 | パフォーマンスレビュアー | 再レンダ、メモ化、N+1 走査、bundle サイズ、メモリリーク、React Flow ノード数増加時の挙動 | `general-purpose` |
| P5 | UX/アクセシビリティレビュアー | ARIA、キーボード操作、モバイル touch、i18n 完備性、ハードコード文字列 | `general-purpose` |
| P6 | データ整合性レビュアー | マイグレーション安全性、後方互換、永続化、history 整合、複数タブ間のグローバル状態同期 | `general-purpose` |
| P7 | アーキテクトレビュアー | 全体設計、tech debt、拡張性、Phase 1-8 の積み残し、将来パッチ計画への影響 | `general-purpose` |

---

## 2. 共通プロンプトヘッダ

すべてのペルソナに共通で渡す前提:

```
あなたは ARKHAM (TRPGScenarioManager, https://github.com/c-ardinal/ARKHAM) の
{persona} です。

## レビュー対象
- ブランチ: feature/tab-feature-spec (HEAD: 7c6eea3)
- ベース: main (c7af0ab, v2.2.0)
- スコープ: 33 commits, 35 files (+6568/-821)
- 主な変更: ノードを「タブ」単位で論理分割する機能追加。Store の `nodes`/`edges` を
  `tabs: Tab[]` + `activeTabId` 構造化、jumpTarget の `{tabId, nodeId}` 拡張、
  クロスタブジャンプ、移動時のエッジ分断ハンドリング、レガシー v1→v2 マイグレーション、
  完全 ja/en i18n、TabBar UI 等。

## 関連ドキュメント
- 仕様: docs/superpowers/specs/2026-05-01-tab-feature-design.md
- 計画: docs/superpowers/plans/2026-05-02-tab-feature.md

## Working dir
C:\_Workspace\TRPGScenarioManager (Windows / git bash)

## レビュー方針
- {persona} の専門観点に焦点を絞る(他観点は別ペルソナで網羅するため重複不要)
- 既存 v2.2.0 から存在する pre-existing issue は対象外。タブ機能パッチ起因の
  新規 issue のみフラグする
- ソースコードを実際に読んで根拠を示す(`git show` / Read / Grep を活用)
- 推測のみは不可
```

## 3. ペルソナ別プロンプト

### P1 セキュリティレビュアー

```
あなたは ARKHAM のセキュリティレビュアーです。タブ機能パッチで以下を重点確認:

1. 信用境界
   - localStorage 経由のデータ復元時の入力検証
   - JSON ファイルロード時の sanitization
   - migration.ts の v1→v2 変換における悪意ある入力耐性
   - `__ARKHAM_FUTURE_VERSION_DETECTED__` などグローバル変数経由の情報漏洩
   - URL/ハッシュ経由のシナリオ共有想定時の影響(現状未実装でも将来リスク)

2. XSS / injection
   - `substituteVariables` でユーザ入力を含むテキスト処理
   - i18n 文字列の `{n}` / `{label}` 置換でのインジェクション可能性
   - dangerouslySetInnerHTML 使用箇所(あれば)

3. データ漏洩
   - エラーメッセージ・トーストでの sensitive 情報露出
   - DebugPanel が新構造でどのデータを露出するか

4. その他
   - crypto.randomUUID フォールバック実装(types/tab.ts)の予測可能性

レポートは Critical/High/Medium/Low で分類し、合計 600 語以内。
```

### P2 TypeScript レビュアー

```
あなたは ARKHAM の TypeScript レビュアー(typescript-reviewer)です。
タブ機能パッチで以下を重点確認:

1. 型安全性
   - `as any` 残留(Phase 1.2 のシム解消後の取りこぼし)
   - `(window as any).__ARKHAM_FUTURE_VERSION_DETECTED__` の型付け
   - Tab/jumpTarget 拡張型 (`{tabId, nodeId} | null`) の扱いの一貫性
   - migration.ts の `MigratedState.gameState: any` 等の許容範囲

2. async / Promise correctness
   - executeJump → setActiveTab → React Flow remount → setCenter のレース対策

3. idiomatic patterns
   - zustand selector の使い方(`useScenarioStore((s) => ...)` の粒度)
   - 派生 selector(tabSelectors.ts)が React 再レンダを最小化しているか
   - structuredClone vs JSON.parse(JSON.stringify) の選択

4. tsconfig との整合
   - `strict`, `noUnusedLocals`, `noUnusedParameters` 違反

レポートは Critical/Important/Minor で分類、合計 700 語以内。
```

### P3 コード品質レビュアー

```
あなたは ARKHAM のコード品質レビュアー(code-reviewer)です。
タブ機能パッチで以下を重点確認:

1. ファイル分割と責務
   - scenarioStore.ts(2700+ 行)に追加された変更の凝集度
   - 新規コンポーネント(TabBar/TabBarItem/JumpTargetCombobox/EdgeBreakDialog/
     MoveToTabSubmenu)の責務分離
   - 派生 selector とロジックの配置の妥当性

2. DRY/YAGNI
   - moveNodesToTab 内の重複ロジック(source側/移動先側のジャンプノード生成等)
   - countJumpReferencesToTab と Layout.tsx 内のジャンプ参照算出ロジックの重複
   - レガシー string jumpTarget の typeof 分岐が複数箇所(将来統一可能か)

3. 命名
   - Tab/タブ/Chapter の用語使い分け
   - `pendingCrossTabFocus`, `pendingMove` 等の命名の一貫性

4. テスト品質
   - migration.test, tabActions.test, tabSelectors.test, jumpReferences.test の
     テストカバレッジ妥当性
   - エッジケースの抜け
   - assertion の粒度

5. 既知の Phase 1.2 シム残存(scenarioStore:656 cascading delete の `typeof === 'string'`)が
   許容範囲か / 後続パッチで解消すべきか

レポートは Critical/Important/Minor で分類、合計 800 語以内。
```

### P4 パフォーマンスレビュアー

```
あなたは ARKHAM のパフォーマンスレビュアーです。
タブ機能パッチで以下を重点確認:

1. 再レンダ最適化
   - useScenarioStore の destructure 範囲(全フィールド購読 vs selector 単位)
   - tabs.find() が毎レンダで実行される箇所のメモ化検討
   - useActiveNodes 等の selector が ref equality を保つか
   - JumpTargetCombobox の candidates useMemo の有効性(全ノード平坦化のコスト)

2. 大規模シナリオ時の挙動
   - recalculateGameState が全タブ走査になり O(N) 全体
   - pushHistory の structuredClone (今は JSON.parse(JSON.stringify) フォールバック) の
     全タブ deepClone コスト
   - moveNodesToTab の broken edges 検出が O(E) で許容範囲か
   - countJumpReferencesToTab が O(全ノード) で削除確認毎に走るコスト

3. メモリ
   - history (past/future) の保持上限とメモリ消費
   - localStorage 容量(タブ機能でデータサイズ増加)、QuotaExceededError ハンドリング

4. bundle サイズ
   - 新規コンポーネント追加による増加(現状 dist/index.js = 655KB)
   - 不要な import、未使用コード

5. クロスタブ jump のリトライ(最大 1s ポーリング)が UX 上許容か

レポートは High/Medium/Low で分類、合計 700 語以内。
```

### P5 UX/アクセシビリティレビュアー

```
あなたは ARKHAM の UX/A11y レビュアーです。
タブ機能パッチで以下を重点確認:

1. アクセシビリティ
   - TabBar/TabBarItem の WAI-ARIA tab pattern 準拠(role, aria-selected,
     aria-controls 等)
   - JumpTargetCombobox の combobox pattern 準拠(role, aria-expanded,
     aria-activedescendant 等)
   - EdgeBreakDialog のフォーカストラップ・aria-modal
   - キーボード操作: タブ切替(矢印キー?)、追加(Tab+Enter?)、削除のキーバインド
   - スクリーンリーダ: 削除確認ダイアログの動的メッセージが読み上げられるか

2. i18n 完備性
   - ハードコード文字列の残留(コメントテスト固定文字を含む)
   - aria-label / title / placeholder の i18n 化
   - `defaultTabName('タブ {n}' / 'Tab {n}')` の {n} 置換が常に動くか
   - 言語切替時のタブ既存名(ユーザ命名)の扱い(変えないのが正解だが明示確認)

3. モバイル UX
   - touch reorder の操作性(10px 閾値の妥当性、誤動作)
   - インライン rename がタップ-タップで起動するか
   - EdgeBreakDialog のタップ領域

4. 視覚デザイン
   - アクティブタブの強調(下線 2px primary)が十分目立つか、ライト/ダーク両テーマ
   - タブ多数時のオーバーフロー UX(現状: 横スクロール、検索・dropdown 等は無)
   - JumpTargetCombobox の broken 表示と clear ボタンの分かりやすさ

レポートは High/Medium/Low で分類、合計 800 語以内。
```

### P6 データ整合性レビュアー

```
あなたは ARKHAM のデータ整合性レビュアーです。
タブ機能パッチで以下を重点確認:

1. マイグレーション
   - migrate v1→v2 の冪等性(同じデータを 2 回走らせて結果が同じか)
   - レガシーフォーマットで欠損フィールドが多い場合のフォールバック網羅
   - jumpTarget の string→object 変換漏れ(jump 以外のノードに jumpTarget が
     書かれているケースは想定外と扱って良いか)
   - バックアップ退避(arkham_legacy_backup_*)が QuotaExceededError 時に
     どう振る舞うか

2. 複数タブ間の global state 同期
   - 変数(batchRenameVariables/deleteVariable)が全タブ伝播 ✓ 修正済
   - キャラ/リソース削除が全タブ伝播 ✓ 修正済
   - sticky bulk 操作が全タブ ✓ 修正済
   - addResource/updateResource の自動割当が全タブ伝播 ✓ 確認推奨
   - 「他にも全タブで処理すべきが active タブのみになっている関数」の網羅検査

3. history(undo/redo)
   - タブ追加→削除→undo→redo の整合性
   - moveNodesToTab → undo で完全に元に戻るか(broken エッジ削除 + ジャンプ
     置換が undo 可能か)
   - structuredClone 失敗時の fallback path で深いコピーが本当に取れているか
     (React Flow ノードの参照保持等)

4. 永続化
   - v2 形式で保存→ブラウザリロード→v2 形式読込の round-trip
   - tab.viewport の保存/復元
   - 多タブで容量超過 → 何が起こるか(現状 silent ?)

5. データ消失リスク
   - validateScenarioData で v2 弾かれないか(修正済 ✓)
   - 旧形式 sample データの読込が migration を通るか
   - 「タブを誤削除」→ undo で復元できるか

レポートは Critical/Important/Minor で分類、合計 900 語以内。
```

### P7 アーキテクトレビュアー

```
あなたは ARKHAM のシニアアーキテクトです。
タブ機能パッチで以下を重点確認:

1. 全体設計
   - 完全分離型(タブごとに nodes/edges 独立)の選択が将来要件と整合するか
   - jumpTarget を `{tabId, nodeId}` 化したことによる将来拡張(サブグラフ参照等)への
     影響
   - moveNodesToTab の edge 分断ダイアログという UX 設計の妥当性

2. tech debt
   - Phase 1.2 で導入した typeof === 'string' narrowing 分岐が複数ファイルに残っており、
     永続データが全部 v2 化された後にも残るか?
   - 仕様書で flag されたスコープ外項目(タブ色分け、コピー、階層化等)の優先度

3. テスト戦略
   - E2E (Playwright) が無い状態で本パッチをマージしてリスクは妥当か
   - スナップショットテストの欠如
   - integration テストの欠如(useScenarioStore の selector を React Hook で使う
     パスのテストが無い)

4. 後続パッチへの影響
   - B パック(検索性改善)/ C パック(性能改善)が本パッチの変更を前提としても
     破綻しないか
   - 仕様書 §11 のスコープ外項目について、リリース後のロードマップ示唆

5. リリースリスク
   - v2.2.0 ユーザがこの v2.3.0 をインストールして即座に impact する変更
   - rollback strategy(v2.3.0 → v2.2.0 戻したい場合のデータ救済)

レポートは High/Medium/Low で分類、合計 1000 語以内。
```

---

## 4. 実行手順

1. 本ドキュメントを feature ブランチにコミット
2. 7 ペルソナを **並列** で Agent ツール起動(同一メッセージ内に 7 tool call)
3. 各レポート受信後、controller(私)が以下を統合:
   - 全 issue を Critical / Important / Minor に分類
   - 重複/類似 issue は集約
   - リリース blocker と非 blocker を判別
4. 統合レポートを `docs/superpowers/reviews/2026-05-04-tab-feature-findings.md` に保存
5. ユーザに findings を提示し、修正方針を決定

---

## 5. 出力フォーマット規約

各ペルソナは以下のフォーマットで返す:

```
## ペルソナ名

### Critical/High
1. [カテゴリ] タイトル
   - 該当: src/path/file.tsx:行
   - 症状/影響:
   - 推奨対策:

### Important/Medium
...

### Minor/Low
...

### 問題なしと判断した観点
- (あれば箇条書き)
```

---

## 6. 制約

- レビュアーは修正を行わない(調査のみ)
- 各レビュアーは他ペルソナの担当領域に深入りしない
- 既存 v2.2.0 (commit `c7af0ab` 以前)のバグは対象外
- 最終判断(マージ可否)は controller が統合後にユーザに提示

---

## 7. 失敗時の対応

- レビュアーがクラッシュ/タイムアウトした場合、再起動 1 回まで
- 重複 finding は一方のみ採用
- レビュアー間で結論が割れた場合は controller が両論を併記してユーザ判断を仰ぐ
