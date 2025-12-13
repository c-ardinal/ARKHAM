# 実装不一致レポート (Implementation Gap Report)

**文書バージョン**: 1.0.0
**最終更新日**: 2025-12-13

## 概要
本ドキュメントは、仕様書と実際のソースコード実装との間に存在する不一致、未実装項目、または仕様上の矛盾を記録する。

## ステータス定義
- **Pending**: 確認待ち
- **Confirmed**: 不一致を確認済み（修正待ち）
- **Resolved**: 解消済み（仕様修正または実装修正）
- **Intentional**: 意図的な差異として許容

## レポート一覧

### [GAP-001] 付箋ハンドルオフセットの微細な不一致
- **関連仕様書**: [04_Visual_Design.md](./04_Visual_Design.md)
- **関連ファイル**: `src/nodes/*`
- **ステータス**: Intentional (Minor visual inconsistency)
- **詳細**:
  仕様上のオフセット値（例: -7px）と実装値（例: -6px）に微細な差異がある。
  RequirementSpecification.json にて `sticky_handle_offset` として報告されていた項目。
- **対応方針**:
  視覚的・機能的な問題がないため、現状維持とする。

### [GAP-002] iOSにおけるMarkdownテーブル制限
- **関連仕様書**: [03_UI_Interaction.md](./03_UI_Interaction.md)
- **関連ファイル**: `src/components/*Modal.tsx`
- **ステータス**: Intentional
- **詳細**:
  古いiOS Safariにおける正規表現処理の不具合（Lookbehind非対応等）によるクラッシュを回避するため、`remark-gfm` プラグインを使用していない。
  そのため、ヘルプや更新履歴内でMarkdownテーブル記法が正しくレンダリングされない。
- **対応方針**:
  iOSの互換性を最優先し、テーブルを使用しないMarkdown記述を行う運用とする。

---
