# ARKHAM UI/UX レビュー

- **対象リポジトリ**: TRPGScenarioManager (ARKHAM)
- **対象バージョン**: `package.json` v2.0.1
- **レビュー実施日**: 2026-04-17
- **レビュー観点**: UI/UX Pro Max スキル（Quick Reference §1〜§10）および App UI 向け専門ガイドラインに基づく定性レビュー
- **スコープ**: `src/App.tsx` / `src/components/**` / `src/nodes/**` / `src/styles/**` 中心の静的コードレビュー（実機動作確認は未実施）

---

## 0. 全体所感

lucide-react 中心のアイコン運用、セマンティックカラートークン（`bg-card` / `text-card-foreground` 等）、ダーク/ライト両対応、`isMobile` クエリによるモバイル/PC 分岐、Undo/Redo・キーボードショートカット・サンプル読込時の検証モーダルなど、基盤は十分にモダンです。

一方で以下が散見され、UI の品位とアクセシビリティ、運用体験の面で改善余地があります。

- 構造的アイコンに `✓` `★` `▶` `◀` `⚠️` などの文字・絵文字が混在
- アクセシビリティ記述（`aria-label` / focus-visible / 見出し階層）の不足
- タッチターゲット 44pt 下限の未達箇所
- 5 タブ構造のサイドバーによる情報分散
- 保存/エクスポート時のフィードバック欠如
- 大規模シナリオでの探索支援（検索・MiniMap・コマンドパレット）不足

本ドキュメントでは、**A. 機能性を維持したまま改善可能な箇所（Must/Should Fix 寄り）** と、**B. 機能性を変えてでも UI/UX を変えるべき箇所（体験変革）** に分けて提案します。

---

## A. 機能性を維持したまま改善可能な箇所

### A-1. 絵文字・Unicode 文字がアイコン化している（`no-emoji-icons` 違反）

プラットフォームで字形が変わる / テーマや色の制御が効かない / スクリーンリーダで不定発音、という問題があります。すべて lucide-react の SVG アイコンに統一。

| 場所 | 現状 | 提案 |
|---|---|---|
| 全ノード（Event/Branch/Variable/Resource/Memo/Jump/Group/Element/Character）の revealed バッジ | `<span className="text-white font-bold text-xs">✓</span>` | `<Check size={12} className="text-white" strokeWidth={3} />` |
| `src/nodes/EventNode.tsx:38` 開始ノード印 | `<span className="mr-2 text-yellow-500">★</span>` | `<Star size={14} className="fill-yellow-400 text-yellow-500" />` |
| `src/components/ContextMenu.tsx:135` サブメニュー矢印 | `{subMenuDirection === 'right' ? '▶' : '◀'}` | `<ChevronRight size={12} />` / `<ChevronLeft size={12} />` |
| `src/components/ValidationErrorModal.tsx:489` 警告ヘッダ | `<span className="text-2xl">⚠️</span>` | `<AlertTriangle size={24} className="text-amber-500" />` |
| `src/components/DebugPanel/PerformanceTab.tsx:102, 143, 186` 警告 | `⚠️ ...` プレフィクス | `<AlertTriangle />` をテキスト左にアイコン配置 |

**該当ファイル一覧**:

- `src/nodes/EventNode.tsx:27, 38`
- `src/nodes/BranchNode.tsx:29`
- `src/nodes/VariableNode.tsx:44`
- `src/nodes/ResourceNode.tsx:56`
- `src/nodes/MemoNode.tsx:26`
- `src/nodes/JumpNode.tsx:38`
- `src/nodes/GroupNode.tsx:47`
- `src/nodes/ElementNode.tsx:33`
- `src/nodes/CharacterNode.tsx:40`
- `src/components/ContextMenu.tsx:135`
- `src/components/ValidationErrorModal.tsx:489`
- `src/components/DebugPanel/PerformanceTab.tsx:102, 143, 186`

### A-2. アクセシビリティ（WCAG 4.5:1 / focus / ARIA）

- **アイコンのみボタンの `aria-label` 不在**
  - 該当: ヘッダ Undo/Redo (`src/components/Layout.tsx:713-718`)、PropertyPanel の閉じる `X` (`src/components/PropertyPanel.tsx:85-87`)、Sidebar の TabButton (`src/components/Sidebar.tsx:246-260`)、Canvas ズーム/FitView ボタン (`src/components/Canvas.tsx:1436-1500`)。`title` のみではスクリーンリーダが読まない環境がある。
  - 対応: 各ボタンに `aria-label={t(...)}` を追加。
- **フォーカスリング不足**
  - 該当: `src/styles/common.ts` の `INPUT_CLASS` が `focus:outline-none focus:border-primary` だけで、キーボード操作時の可視性が弱い。
  - 対応: `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background` を共通化。
- **見出し階層**
  - モーダル内で `h3` から始まる箇所あり（`src/components/Layout.tsx:200` ConfirmationModal）。`h2` 起点に整えるか、モーダル自身の `role="dialog"` + `aria-labelledby` で代替。
- **色のみで意味を伝える警戒ポイント**
  - Branch の True/False は緑/赤＋テキストラベルあり（OK）。
  - ノードタイプ色（event=orange / branch=purple 等）は色依存が強いが、アイコン同梱でカバーされている（OK）。
- **モーダル ESC で閉じる**
  - ConfirmationModal / ManualModal / AboutModal が ESC キー対応しているか要確認（`src/components/Layout.tsx` の ConfirmationModal に `onKeyDown` ハンドラなし）。
  - 対応: `useEffect` で `keydown` 監視し `Escape` で `onClose`。

### A-3. タッチターゲット（44×44pt 基準）

| 場所 | 現状サイズ | 提案 |
|---|---|---|
| ヘッダ Undo/Redo (`Layout.tsx:713`) | `p-2` + 18px icon ≒ 34px | `p-2.5`〜`p-3` に拡大、または `hitSlop` 相当の透明パディングを拡張 |
| Canvas ズーム/FitView ControlButton (`Canvas.tsx:1436, 1468, 1498`) | `w-8 h-8` = 32px | `w-11 h-11`(44px) に拡張 |
| ContextMenu 項目 (`ContextMenu.tsx:22-40`) | `px-4 py-2` ≒ 36px | `py-2.5` 以上に |
| Sidebar TabButton (`Sidebar.tsx:254`) | `w-12 h-12` = 48px（OK） | 現状維持 |

### A-4. タイポグラフィ最小サイズ

本文 16px、UI ラベル 12px を最小ラインに。

| 場所 | 現状 | 提案 |
|---|---|---|
| `Layout.tsx:689` ヘッダタグライン | `text-[0.6rem]`（9.6px） | `text-xs`(12px) へ。もしくはタグライン自体をツールチップ化 |
| `Sidebar.tsx:258` TabButton ラベル | `text-[10px]` | `text-xs`(12px) |

### A-5. ドロップダウン/サブメニューの操作方式

- **デスクトップ SubMenu が純ホバー開閉**: `src/components/Layout.tsx:94-120` で `onMouseEnter/Leave` のみ。キーボード不可、かつ開閉が過敏。
  - 対応: `onClick` トグルを基本とし、`onMouseEnter` は 150ms 遅延で補助的に開く。キーボード対応として `aria-expanded` と `Tab`/`Enter` ハンドリングを追加。
- **ContextMenu のコピーテキスト子メニュー**: `src/components/ContextMenu.tsx:138` が `hidden group-hover:flex`。モバイルではホバー不可で操作不能の恐れ。
  - 対応: `useState` で `isSubOpen` を持ち、タップ/クリックで開閉する実装へ切替。

### A-6. 色コントラスト・ダークモード

- **ノード本体の透過背景**: `dark:bg-orange-900/20` など 20% 透過が多く、ダーク背景でカード境界が曖昧になりやすい。
  - 対応: `dark:bg-orange-900/60` 以上、または不透明トークンへ。併せて `dark:border-orange-800` のコントラストも 3:1 以上を確保。
- **モード切替ボタンの raw hex**: `src/components/Layout.tsx:724-728` の `bg-green-600` / `bg-blue-600` は `tailwind.config.js` のセマンティックトークンに寄せる。
  - 対応: `tailwind.config.js` に `success` / `info` などを追加し、`bg-success` / `bg-info` として参照。

### A-7. 操作フィードバック不足

- 保存 (`Ctrl+S` / handleSave in `Layout.tsx:349-382`)、エクスポート (`onExport` in `Layout.tsx:590`)、サンプル読込成功時にトースト通知が無く、ユーザーは「押せたか」不安になる。
  - 対応: `sonner` や軽量自作トーストを導入。「シナリオを保存しました」「Markdownを書き出しました」等の短文 + 2〜3 秒 auto-dismiss。
- ConfirmationModal (`Layout.tsx:195-222`) の Confirm/Cancel ラベルが固定英語。
  - 対応: `t('common.confirm')` / `t('common.cancel')` に置換し、message 本文で「データを破棄して読込む」等の具体文言を i18n キー化。

### A-8. モバイルのスワイプ削除の発見性（`swipe-clarity`）

`CharacterList` / `VariableList` / `ResourceList` の左スワイプ削除（`translateX(-70px)`）は視覚的手がかりが無い。

- 対応: アイテム右端に 8〜10px の半透明 `<ChevronLeft />` アフォーダンスを常時表示、または初回起動時に 1 件目をプリスワイプしてヒントする。

### A-9. プロパティパネルのリサイズハンドル

`src/components/Layout.tsx:777-782` の `w-1 cursor-col-resize` はヒット領域が 4px と細すぎ、ドラッグ開始が難しい。

- 対応: 透明ラッパーを `w-3` に拡張し、中央 1px に視覚的ガイドを置く。ホバー時 `bg-primary/40`、ドラッグ中 `bg-primary` でフィードバック。

### A-10. ヘッダ ARKHAM ブランディングの CLS

`src/components/Layout.tsx:688` で Cinzel Decorative 読込待ち中 `opacity-0 → 100` にフェードするため、64px 高のヘッダ左が一時空白になり CLS に寄与する。

- 対応:
  - `@font-face` に `font-display: swap` を指定。
  - もしくは SVG ロゴ化して常時表示、テキストはフォールバック。

### A-11. 破壊的アクションの視覚分離

「全削除」「シナリオリセット」系がメニュー通常項目と並ぶ。

- 対応:
  - `<div className="my-1 border-t border-border" />` で区切り、メニュー最下段へ配置。
  - ConfirmationModal の Confirm ボタンを `bg-destructive` に変え、`aria-describedby` で警告文言を紐付け。
  - 影響が大きい操作は「`DELETE` と入力してください」のようなタイプ確認をオプション化。

### A-12. ReactFlow の俯瞰支援

大規模シナリオで迷子になりやすい。

- 対応: `reactflow` 標準の `<MiniMap />` を `src/components/Canvas.tsx` に追加（右下、折畳可能）。既存フローは非破壊で追加のみ。

---

## B. 機能性を変えてでも UI/UX を変えるべき箇所

### B-1. サイドバーの「5 タブ切替」構造を再設計

**現状** (`src/components/Sidebar.tsx`):
- nodes / characters / resources / variables / menu を縦アイコンレールでタブ切替。
- タップのたびに別セクションに入れ替わり、プレイ中に「所持品」と「変数」を同時参照できない。

**提案**:
1. **Accordion 型の単一スクロール**に切替。Nodes, Characters, Resources, Variables, GameState を縦並びで開閉。
2. プレイモードでは GameState セクションを**自動ピン留め**（常時先頭展開）。
3. メニュー（menu タブ）はヘッダ左ドロップダウン実装に寄せてサイドバーから除去し、サイドバーを「コンテンツ投入と可視化」に一本化。

### B-2. コマンドパレット（Ctrl/Cmd+K）の新設

現状、機能はヘッダ多段メニューにしか到達できず、ショートカット一覧は README のみ。

- 実装: `cmdk` 相当の軽量 UI。
- 対応アクション例: ノード追加 / 変数追加 / キャラ追加 / サンプル読込 / 進行モード切替 / FitView / 言語切替 / テーマ切替 / デバッグパネル。
- 追加ショートカット: `/` = 検索、`?` = ショートカットヘルプ、`g n` = ノードに移動、等。

### B-3. グラフ内グローバル検索

- ラベル / 説明 / 変数名 / キャラ名を横断する全文検索。
- 結果クリックで対象ノードにカメラがパン + ズーム。
- ヘッダ中央 or `/` キーで呼出し。モバイルでは下部シート。

### B-4. 編集/進行モードのセグメントコントロール化

単一ボタン + 色変化（`src/components/Layout.tsx:722-741`）は状態把握が一瞬遅れる。

- `[ 編集 | 進行 ]` の 2 セグメントトグルへ。
- アクティブ側を `bg-primary text-primary-foreground`、非アクティブは `bg-muted text-muted-foreground`。
- 色に頼らず、どのブレークポイントでもテキスト + アイコン併記。

### B-5. プロパティパネルの変更プレビュー/確定モデル

現状は入力即反映＋ Ctrl+Z でのみ巻き戻し可能。

- 軽微編集（ラベル / 説明）: 現状の即時反映を維持。
- 構造変更（ノードタイプ変換、分岐モード切替、参照差替など破壊的）: パネル上部に「変更をプレビュー中」バナーを表示し、`確定` / `取消` を明示。`Ctrl+Z` で取り消せることも同時に案内。

### B-6. コンテキストメニューの階層フラット化

`src/components/ContextMenu.tsx:133-154` の Copy Text サブメニューは `all/label/description/value/condition/cases` と深い。

- 主要 3 項目（All / Label / Description）をトップレベル化。
- それ以外は「もっと…」に畳む。
- モバイルはクリック開閉必須（A-5 と合わせて対応）。

### B-7. プレイモード専用レイアウト

進行中に「所持品 / 知識 / スキル / ステータス」が常時視界に無いと KP 運用が辛い。

- プレイモードのみ**右ドックに常駐する GameState パネル**（折畳可）を追加。
- 現行サイドバーはノード選択 / 検索専用に。
- ノード右クリックから直接「開示 / 未開示切替」が 1 タップでできる UI ショートカットも追加。

### B-8. キーボードショートカットの可視化

`?` キー、またはヘルプメニューから Cheatsheet オーバーレイを呼び出せるようにする（Linear / Notion 風）。モーダル内でグルーピング表示（ファイル / 編集 / 表示 / 進行モード / デバッグ）。

### B-9. ゼロステート / 空状態

`CharacterList` / `ResourceList` / `VariableList` の空表示が弱い。

- 対応: 軽量イラスト or アイコン + 「最初のキャラクターを追加」一次 CTA を配置。チュートリアルリンクを併設。

### B-10. サンプル読込時のデータ保全

「確認」→ 即上書きロードは過去分を失う恐れ。

- ConfirmationModal に「現在のシナリオをバックアップ保存してから読み込む」チェックボックス（既定 ON）を追加。
- 内部的には undo スタックに push し、誤操作時に Ctrl+Z 一発で戻れるようにする。

---

## C. 優先度付け（上から着手推奨）

| 優先 | 項目 | 想定工数 | 効果 |
|---|---|---|---|
| 1 | **A-1**（絵文字 → SVG 置換） | 1〜2h | 見た目の品位が一段上がる |
| 2 | **A-2 / A-3**（a11y・タッチ） | 0.5 日 | WCAG 4.5:1 / 44pt 基準クリア |
| 3 | **A-7**（トースト通知） | 1 日 | 既存機能の信頼感向上 |
| 4 | **B-2**（コマンドパレット） | 2〜3 日 | 熟練者の生産性桁上げ |
| 5 | **B-1** + **B-7**（サイドバー再設計 + プレイ専用 UI） | 1 週間 | 本質的 UX 改善 |
| 6 | **B-3** + **A-12**（検索 + MiniMap） | 3〜4 日 | 大規模シナリオ対応 |

---

## D. 推奨実装フロー

本ドキュメントの CLAUDE.md ルールに準拠：

1. **TDD**: 改修対象ごとに振る舞いを Playwright/Vitest テストで先に記述（Red → Green → Refactor）。
2. **アプローチ事前提示**: 着手前に実装計画を 2〜3 箇条書きで提示し、承認後に着手。
3. **E2E**: UI 変更後は `npx playwright test --grep-invert coverage` を全件パス確認（該当プロジェクトで E2E 構成がある場合）。
4. **コードレビュー**: `code-reviewer` エージェントで CRITICAL / HIGH を解消。
5. **セキュリティレビュー**: `security-reviewer` エージェントで最終確認。

---

## E. 付録: 参照ファイル一覧

- `src/App.tsx`
- `src/components/Layout.tsx`
- `src/components/Sidebar.tsx`
- `src/components/PropertyPanel.tsx`
- `src/components/Canvas.tsx`
- `src/components/ContextMenu.tsx`
- `src/components/ValidationErrorModal.tsx`
- `src/components/CharacterList.tsx`
- `src/components/ResourceList.tsx`
- `src/components/VariableList.tsx`
- `src/components/DebugPanel/PerformanceTab.tsx`
- `src/nodes/EventNode.tsx`
- `src/nodes/BranchNode.tsx`
- `src/nodes/VariableNode.tsx`
- `src/nodes/ResourceNode.tsx`
- `src/nodes/MemoNode.tsx`
- `src/nodes/JumpNode.tsx`
- `src/nodes/GroupNode.tsx`
- `src/nodes/ElementNode.tsx`
- `src/nodes/CharacterNode.tsx`
- `src/styles/common.ts`
