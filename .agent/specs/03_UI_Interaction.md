# UIインタラクション仕様 (UI/UX Interaction)

**文書バージョン**: 1.0.0
**最終更新日**: 2025-12-13
**対象バージョン**: 1.0.2

## 1. 概要
本ドキュメントは、ユーザーインターフェースの振る舞い、入力補助、ショートカット、およびデバイス固有の操作仕様を定義する。

## 2. 定義と前提
### 2.1 関連ドキュメント
- [00_System_Overview.md](./00_System_Overview.md)

## 3. 詳細仕様

### 3.1 テーマ (Theme)
- **デフォルト**: Dark Mode
- **切替**: ヘッダーのボタンでトグル。設定は `LocalStorage` に保存される。
- **実装**: Tailwind CSSの `.dark` クラスを使用。

### 3.2 テキスト入力挙動
#### 3.2.1 変数サジェスト
 `${` を入力した際、定義済みの変数リストをサジェストし、選択することで自動補完する。
- **対象フィールド**: ノードタイトル、説明文、リソース効果、分岐条件値など。
- **除外フィールド**: 読み仮名、数量などの単純値フィールド。

### 3.3 クリップボード操作
OSのクリップボードとアプリ内メモリを使い分ける設計となっている。

#### 3.3.1 テキストコピー
- **トリガー**: コンテキストメニュー "Copy Text"
- **動作**: 選択ノードのテキスト（変数展開後の値）をOSのクリップボードに書き込む。

#### 3.3.2 ノードのコピー＆ペースト
- **トリガー**: `Ctrl + C` / `Ctrl + V`
- **動作**:
  - `Ctrl + C`: 選択ノードを**アプリ内メモリ**に保存する（OSクリップボードは汚染しない）。
  - `Ctrl + V`: アプリ内メモリにあるノードを複製（Reduplicate）する。
  - **位置**: オリジナルの座標から `{x+20, y+20}` ずらして配置。
  - **ラベル**: 末尾に `(Copy)` を付与。

### 3.4 ショートカットキー
| キー | アクション |
| :--- | :--- |
| `Ctrl + C` | ノード複製（コピー） |
| `Ctrl + V` | 複製実行（ペースト） |
| `Ctrl + R` | 公開/非公開 トグル |
| `Delete` | 選択要素の削除 |
| `Ctrl + Z` | 元に戻す (Undo) |
| `Ctrl + Y` | やり直し (Redo) |
| `Ctrl + S` | 保存 (Save) |
| `Ctrl + +` | 拡大 (Zoom In) |
| `Ctrl + -` | 縮小 (Zoom Out) |

### 3.5 モバイル操作仕様
#### 3.5.1 タッチ最適化
- **タッチアクション**: ノード要素に `touch-action: none !important` を適用し、ブラウザのデフォルトスクロール挙動（リフレッシュ等）を無効化。
- **テキスト選択**: 入力フィールド以外でのテキスト選択を無効化（`user-select: none`）し、誤操作を防ぐ。
- **ハンドル**: React Flowのハンドルサイズを拡大 (14px) し、タッチ操作での結線を容易にする。
- **ドラッグ**: 長押し(300ms)でリストアイテムの並べ替えドラッグを開始。
- **スワイプ**: リストアイテムを左スワイプ(-70px)で「削除」ボタンを表示。

#### 3.5.2 デバッグモード起動
- **トリガー**: バージョン情報モーダル内のバージョン番号を7回連続タップ。
- **フィードバック**:
  - 3回目: 小さな振動 (Haptic / Animation)
  - 5回目: 「あと2回」等のヒント表示
  - 7回目: 「デバッグモードが有効になりました」トースト通知
- **無効化**: バージョン番号を10回連続タップで無効化。

### 3.6 コンテキストメニュー構造
- **Copy Text**: サブメニューあり (All, Label, Description, Value, Condition, Cases)
- **Edit Actions**: Duplicate, Reduplicate (編集モードのみ)
- **State Actions**: Mark Revealed/Unrevealed, Hide Sticky
- **Group Actions**: Ungroup, Detach from Group

### 3.7 レイアウトサイズ仕様
- **サイドバー**:
  - Desktop: 固定幅 (約320px)
  - Mobile: オーバーレイ (256px), ブレークポイント 768px
- **プロパティパネル**:
  - Desktop: リサイズ可能 (最小250px ～ 最大600px)
  - Mobile: 全画面オーバーレイ (固定)。※外側タップでの閉じる動作は無効（閉じるボタン必須）。

### 3.8 ダブルクリック/タップ挙動
- **Jumpノード**: ターゲットノードへビューポートを移動。
- **Stickyノード**: プロパティパネルを開く。
- **Any Node (Mobile)**: ダブルタップでプロパティパネルを開く。
- **コンテキストメニュー (Mobile)**: 長押し (500ms) で起動。

### 3.9 メインメニュー構造 (Header Menu)
- **File**:
  - Save (Ctrl+S), Load, Load Sample (Story, Nested Group Nodes)
  - Export (Simple Text, Markdown), Reset (Danger)
- **Edit**:
  - Sticky Notes (Show All, Hide All, Delete All, Delete Free/Node Stickies)
  - Bulk Reveal (Reveal All, Unreveal All)
- **View**: Zoom In, Zoom Out, Fit View
- **Settings**:
  - Switch Theme (Dark/Light), Switch Language (En/Ja)
  - Edge Style (Default, Straight, Step, SmoothStep)
- **Help**: Manual, Update History, About

### 3.10 インタラクションマトリクス (Interaction Matrix)
デバイスごとの入力操作フローを以下に示す。

```mermaid
graph TD
    User((ユーザー))
    
    subgraph Desktop [デスクトップレイアウト >1366px]
        D_Mouse[マウス操作]
        D_Sidebar[サイドバー （常時表示）]
        D_Prop[プロパティパネル （右側）]
        D_DnD[HTML5 ドラッグ＆ドロップ]
        D_Debug[デバッグパネル (Floating/Overlay)]
        
        D_Mouse -->|右クリック| D_Ctx[コンテキストメニュー]
        D_Mouse -->|クリック| D_Select[ノード選択]
        D_Mouse -->|ドラッグ| D_DnD
    end
    
    subgraph Mobile [モバイルレイアウト <=1366px]
        M_Touch[タッチ操作]
        M_Sidebar[サイドバー （オーバーレイ / 非表示）]
        M_Prop[プロパティパネル （オーバーレイ / フル）]
        M_TouchDnD[タッチドラッグ （ポータルゴースト）]
        M_Debug[デバッグモーダル (Overlay)]
        
        M_Touch -->|タップ| M_Select[選択 / プロパティを開く]
        M_Touch -->|長押し| M_Ctx[コンテキストメニュー]
        M_Touch -->|タッチ移動| M_TouchDnD
    end
    
    User -->|デバイス判定| Desktop
    User -->|デバイス判定| Mobile
    User -.->|隠しコマンド| D_Debug
    User -.->|隠しコマンド| M_Debug
```

---
*End of Document*
