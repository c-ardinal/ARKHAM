<!-- SECTION: ja -->

# 更新履歴

## v2.2.0 (2026-05-01)

### 変更・改善

- ライトテーマでグループノードと背景の対比を強化し、視認性を改善

### バグ修正

- グループノードを畳んだ際、内部の子ノード間エッジが画面に残ってしまう不具合を修正
- ジャンプノードでグループ内の子ノードへジャンプした際、カメラ位置がずれる不具合を修正

### その他

- パフォーマンスの向上

## v2.1.1 (2026-04-18)

### 機能追加

- ヘルプメニューに「利用規約」「プライバシーポリシー」を追加し、モーダルから日本語／英語で閲覧可能に

## v2.1.0 (2026-04-18)

### 機能追加

- キャンバス右下にミニマップを追加し、大規模シナリオの全体俯瞰を可能に
- 保存・読込・テキスト出力・サンプル読込の成功／失敗時にトースト通知を表示

### 変更・改善

- 全ノードの「開示済」バッジ・「付箋あり」バッジ・開始ノードアイコンをSVGへ統一し、環境による表示差異を解消
- 主要ボタン（元に戻す／やり直す／モード切替／ズーム等）のスクリーンリーダ対応を強化
- 入力欄・メニュー項目にキーボード操作時のフォーカスリングを追加
- モーダルダイアログ（確認／バリデーションエラー／コンテキストメニュー）にEscキーでの閉じる動作を追加
- ヘッダ、ズームコントロール、メニュー項目、モバイル編集ボタン等のタッチ領域を拡大
- ヘッダメニューのサブメニューをホバーだけでなくクリックでも開閉可能に変更し、キーボード・モバイル操作性を向上
- コンテキストメニューの「テキストをコピー」サブメニューもクリック開閉に対応
- モバイル/タブレットのキャラクター・要素・変数一覧に、左スワイプで削除できることを示すアイコンヒントを追加
- プロパティパネルのリサイズハンドル幅を広げ、ホバー／ドラッグ時の視覚フィードバックを追加
- リセットやサンプル読込など破壊的操作の確認ダイアログで確定ボタンを赤色化し、誤操作を抑止
- サブメニュー矢印や警告表示の絵文字を lucide アイコンに置き換え、視認性と一貫性を向上

### その他

- パフォーマンスの向上

## v2.0.1 (2025-12-13)

### バグ修正

- マニュアル・更新履歴が表示されない問題を修正

## v2.0.0 (2025-12-13)

### 機能追加

- モバイルデバイス(スマートフォン・タブレット)向けレイアウトへ対応
- 内部エラーを表示する機能を追加
- 更新履歴表示機能の追加
- データの削除機能追加
- 拡大・縮小のショートカットキーを追加

### 変更・改善

- PC向けレイアウトを調整
- ページを再読み込みしてもデータが消えないように対応
- データ保存/読込時のバリデーションを強化

### バグ修正

- キャンバス上のノードを複数選択できない不具合を修正
- UI上のテキストがコピーできない不具合を修正
- 特定のケースにて変数/要素ノードのプロパティとノード上の表示が不一致になる不具合を修正

### その他

- パフォーマンスの向上

## v1.0.2 (2025-12-06)

### 変更・改善

- メニューおよびサイドバーのデザインを修正

## v1.0.1 (2025-12-06)

### バグ修正

- キャラクターとリソースのデータが保存できない問題を修正

### その他

- README.mdの更新

## v1.0.0 (2025-12-06)

### その他

- 初回リリース

<!-- SECTION: en -->

# Update History

## v2.2.0 (2026-05-01)

### Changes & Improvements

- Improved light-theme group-node visibility by strengthening contrast against the canvas background

### Bug Fixes

- Fixed an issue where edges between child nodes would remain visible on the canvas after collapsing a group node
- Fixed a camera-position offset that occurred when jumping to a child node inside a group via a Jump node

### Others

- Performance improvements (drag during group-node expansion; drag and scroll while zoomed out with many nodes)

## v2.1.1 (2026-04-18)

### New Features

- Added "Terms of Service" and "Privacy Policy" entries to the Help menu, viewable via a modal in both Japanese and English

## v2.1.0 (2026-04-18)

### New Features

- Added a MiniMap at the bottom-right of the canvas for navigating large scenarios
- Added toast notifications for success/failure of save, load, export, and sample data import

### Changes & Improvements

- Unified the "Revealed" badge, "Has Sticky Notes" indicator, and start-node icon on all nodes to use SVG icons, eliminating cross-browser rendering differences
- Improved screen reader support on key buttons (Undo/Redo/Mode toggle/Zoom, etc.)
- Added visible keyboard focus rings on input fields and menu items
- Added Escape-key dismissal to modal dialogs (confirmation/validation error/context menu)
- Enlarged touch targets on the header, zoom controls, menu items, and mobile edit buttons
- Made header submenus openable via click in addition to hover, improving keyboard and mobile usability
- Made the "Copy Text" submenu in the context menu openable via click as well
- Added a left-chevron hint icon to the Character/Resource/Variable lists on mobile/tablet, indicating that swipe-to-delete is available
- Widened the Property Panel resize handle and added hover/drag visual feedback for easier grabbing
- Highlighted the confirm button in red on destructive confirmation dialogs (reset, sample load, etc.) to discourage accidental clicks
- Replaced submenu arrow and warning indicator emojis with Lucide icons for improved clarity and visual consistency

### Others

- Performance improvements

## v2.0.1 (2025-12-13)

### Bug Fixes

- Fixed issue where manual and update history would not display in production environment

## v2.0.0 (2025-12-13)

### New Features

- Added support for mobile device layouts (Smartphones/Tablets)
- Added internal error display feature
- Added update history display feature
- Added data deletion feature
- Added Zoom In/Out shortcut keys

### Changes & Improvements

- Adjusted PC layout
- Persist data across page reloads
- Enhanced validation during data save/load

### Bug Fixes

- Fixed issue where multiple nodes on canvas could not be selected
- Fixed issue where text on UI could not be copied
- Fixed issue where properties of Variable/Element nodes would mismatch with node display in certain cases
- Fixed issue where loading screen would not dismiss on PC

### Others

- Performance improvements

## v1.0.2 (2025-12-06)

### Changes & Improvements

- Corrected menu and sidebar design

## v1.0.1 (2025-12-06)

### Bug Fixes

- Fixed issue where Character and Element data could not be saved

### Others

- Updated README.md

## v1.0.0 (2025-12-06)

### Others

- Initial Release
