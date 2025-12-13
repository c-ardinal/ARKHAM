# ビジュアルデザイン仕様 (Visual Design)

**文書バージョン**: 1.0.0
**最終更新日**: 2025-12-13
**対象バージョン**: 1.0.2

## 1. 概要
本ドキュメントは、アプリケーションの色彩設計、コンポーネントスタイル、およびZ-Index階層構造を定義する。

## 2. 定義と前提
### 2.1 関連ドキュメント
- [00_System_Overview.md](./00_System_Overview.md)

## 3. 詳細仕様

### 3.1 デザイン・ branding
- **背景**: Dot Grid Pattern (Interactivityあり)
- **ロゴフォント**: Cinzel Decorative
- **タイトルカラー**: Purple(600) to Green(800) のグラデーション
- **サブタイトル**: Adventure Routing & Keeper Handling Assistant Manager (頭文字強調)

### 3.2 カラーパレット
Tailwind CSSフレームワークをベースに、Light/Darkモードに対応したHSL変数を定義している。

| トークン | Light | Dark | 用途 |
| :--- | :--- | :--- | :--- |
| `background` | Slate-50 | Slate-900 | 背景色 (Dot Grid Pattern) |
| `foreground` | Slate-900 | Slate-50 | 文字色 |
| `primary` | Blue-600 | Blue-500 | メインアクション |
| `destructive` | Red-500 | Red-900 | 削除・警告 |
| `border` | Slate-200 | Slate-700 | 境界線 |

### 3.3 ノードスタイル定義
各ノードタイプは独自のテーマカラーを持ち、視認性を高めている。

| ノードタイプ | Light Theme | Dark Theme |
| :--- | :--- | :--- |
| **Event** | Orange (bg-slate-50, border-orange-200) | Orange (bg-orange-900/20, border-orange-800) |
| **Element** | Blue | Blue |
| **Branch** | Purple | Purple |
| **Variable** | Red | Red |
| **Group** | Slate | Slate |
| **Jump** | Yellow | Yellow |
| **Memo** | Gray/White | Gray |
| **Character** | Yellow | Yellow |
| **Resource** | Green | Green |

### 3.4 ビジュアルインジケータ
ノードの状態を示すための小型アイコン/バッジ。位置はノードの絶対座標に対する相対位置。

- **開始ノード**: ★ 金色の星 (text-yellow-500) - ラベル左
- **公開済み (Revealed)**: ✓ 緑の円 (bg-green-500, white check) - 左上 (-8px, -8px) ※ノード本体の枠線色は変更しない
- **付箋あり (Has Sticky)**: 📝 黄色の付箋 (bg-yellow-400, rotate-6deg, shadow-md) - 右上 (-20px, -20px)
- **Resource Type**: リソース種別に応じた枠線色（Item=緑, Equip=青, etc.）

### 3.5 Z-Index レイヤー構造
要素の重なり順序を管理し、適切なインタラクションを保証する。

| レイヤー名 | Z-Index | 説明 |
| :--- | :--- | :--- |
| **Loading Overlay** | 2000 | 最前面ロード画面 |
| **Mobile Drag Ghost** | 2500 | ドラッグ中のポータル要素 |
| **Sticky Note** | 2000-2001 | 付箋およびそのエッジ |
| **Modals** | 100-150 | モーダルウィンドウ |
| **Mobile Sidebar/Panel** | 60 | モバイル用オーバーレイパネル |
| **Header/ContextMenu** | 50 | ヘッダー、右クリックメニュー |
| **Sidebar** | 40 | PC用サイドバー |
| **Canvas Nodes** | 0 | 通常ノード |
| **Canvas Groups** | -1 | グループノード（最背面） |

### 3.6 エッジスタイル
| エッジタイプ | 説明 | ビジュアル |
| :--- | :--- | :--- |
| **Default** | 通常の接続線 | Gray-400, Smooth Step |
| **Selected** | 選択時のハイライト | Stroke: 6px, Color: Primary |
| **StickyEdge** | 付箋と親ノードを結ぶ線 | Straight Line, 始点を親ノード中心からオフセット |

---
*End of Document*
