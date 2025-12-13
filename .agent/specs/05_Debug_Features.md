# デバッグ機能仕様 (Debug Features)

**文書バージョン**: 1.0.0
**最終更新日**: 2025-12-13
**対象バージョン**: 1.0.2

## 1. 概要
TRPGシナリオマネージャーのデバッグ機能を拡張し、開発者およびAIエージェントによる問題診断を効率化する。

## 2. 機能一覧

### 2.1 パフォーマンスモニター
**目的**: レンダリング性能とメモリ使用状況の可視化

#### 計測項目
- **コンポーネントレンダリング回数**: 主要コンポーネントのRPS計測
- **レンダリング時間**: 各レンダリングの所要時間(ms)
- **メモリ使用量**: `performance.memory` (Chrome/Edge)
- **FPS**: フレームレート

#### UI表示
- リアルタイム更新(500ms間隔)
- LocalStorage使用率の表示
- 計測データクリア機能

### 2.2 フィルタリング・検索機能
**目的**: 大量のログから必要な情報を素早く抽出

#### フィルタ種別
- ログレベル (Log, Warn, Error, Info)
- キーワード検索 (Regex対応)
- タグフィルタ (`[Viewport]`, `[DEBUG]` 等)
- 時間範囲フィルタ

### 2.3 アサーション機能
**目的**: 期待される状態との差異を自動検出

#### デフォルトルール一覧
| ID | ルール名 | 重大度 | 説明・条件 |
| :--- | :--- | :--- | :--- |
| `start-node-exists` | 開始ノード存在チェック | Warning | `isStart`フラグを持つノードが1つ以上存在するか |
| `orphan-nodes` | 孤立ノード検出 | Info | エッジに接続されていないノード（付箋・メモ・グループを除く）を検出 |
| `undefined-variables` | 変数未定義参照 | Error | `${VarName}`形式で参照されているが未定義の変数を検出 |
| `jump-target-validity` | ジャンプノードターゲット検証 | Error | ジャンプノードのターゲットIDが存在するノードか |
| `empty-title` | タイトル未設定 | Warning | タイトルが空、または空白のみのノードを検出（付箋・メモ・グループを除く） |
| `dead-end-nodes` | 行き止まりノード | Info | アウトゴーイングエッジがないノードを検出（エンディングの可能性あり） |
| `long-description` | 長文テキスト検出 | Warning | 本文が400文字を超えるノードを検出 |

#### 永続化の技術詳細
- **ログフィルタ**: `Set` オブジェクトを含む設定は、JSONシリアライズ時に配列へ変換・復元されることで永続化される。

#### カスタムルール (Dynamic Assertion)
- 「アサーションタブ」から動的にルールを追加可能
- JavaScriptコード (`state`引数を受け取り`boolean`を返す関数) を記述
- `new Function` による実行（セキュリティリスクあり、開発者責任）
- **永続化**: 現在は非対応（リロードで消失）

### 2.4 状態スナップショット
**目的**: 特定時点でのアプリケーション状態を保存・確認

- 機密データマスキング (LocalStorage生データ等)
- JSON形式での表示・折りたたみ
- 差分比較機能
- **永続化**: スナップショットおよびUI状態はLocalStorageに保存される

### 2.5 エクスポート機能
- **スナップショット**: データ種別を選択してJSONエクスポート
- **ログ**: フィルタ後のログをテキストエクスポート
- **警告**: 機密情報を含む可能性がある旨の警告ダイアログを表示

## 3. データモデル (Data Models)

### 3.1 ログエントリ (`LogEntry`)
```typescript
interface LogEntry {
  timestamp: string;      // "HH:MM:SS.mmm"
  level: 'log' | 'warn' | 'error' | 'info';
  message: string;
  args: any[];            // 元の引数リスト
  tags: string[];         // 自動抽出されたタグ ("[Tag]")
}
```

### 3.2 ログフィルタ (`LogFilter`)
永続化時には `Set` が `Array` に変換される。
```typescript
interface LogFilter {
  levels: Set<'log' | 'warn' | 'error' | 'info'>;
  keyword: string;
  isRegex: boolean;       // 正規表現モード
  tags: Set<string>;      // 選択されたタグ
  timeRange: { 
    start: string | null; 
    end: string | null; 
  };
}
```

### 3.3 アサーションルール (`AssertionRule`)
```typescript
interface AssertionRule {
  id: string;
  name: string;
  description: string;
  condition: (state: any) => boolean; // 検証関数
  severity: 'error' | 'warning' | 'info';
  enabled: boolean;
  conditionCode?: string; // カスタムルール用のソースコード文字列
}
```

## 4. UI/UX仕様
- **デスクトップ**: フローティングウィンドウ (React Rnd)
- **モバイル**: フルスクリーンモーダル (Overlay)
- **タブ構成**: ログ, パフォーマンス, スナップショット, アサーション

## 5. データフロー
- パフォーマンス: Component -> useEffect -> Performance API -> Store
- アサーション: Store Update -> Debounce -> Engine Run -> Log/Store

## 5. 技術スタック
- Zustand (Store)
- React Rnd (Floating Window)
- React Window (Virtual Scroll)

## 6. 実装優先順位
(全フェーズ実装済み)

## 7. 補足事項
- 将来的には詳細な差分ビジュアライゼーションやネットワークモニターを検討。
- カスタムルールの永続化はセキュリティ設計検討後に対応予定。

---
*End of Document*
