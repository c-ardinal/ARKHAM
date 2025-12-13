# データモデル (Data Models)

**文書バージョン**: 1.0.0
**最終更新日**: 2025-12-13
**対象バージョン**: 1.0.2

## 1. 概要
本ドキュメントは、アプリケーションで使用される主要なデータ構造およびTypeScriptのインターフェース定義について記述する。

## 2. 定義と前提
### 2.1 関連ドキュメント
- [00_System_Overview.md](./00_System_Overview.md)

## 3. 詳細仕様

### 3.1 ノード (ScenarioNode)
React Flowの `Node<T>` を拡張したデータ構造。
すべてのノードタイプで `ScenarioNodeData` インターフェースを共有するが、使用するフィールドはタイプによって異なる。

#### 3.1.1 ノードタイプ (`NodeType`)
| タイプ | 説明 |
| :--- | :--- |
| **event** | 基本的なイベントノード |
| **element** | アイテムや情報の獲得/消費 |
| **branch** | 条件分岐 (if/else, switch) |
| **variable** | 変数操作 |
| **group** | ノードのグルーピング |
| **jump** | 他ノードへの参照・遷移 |
| **memo** | メモ・注釈 |
| **sticky** | 付箋 |
| **character** | キャラクター参照 |
| **resource** | リソース参照 |

#### 3.1.2 ノードデータ (`ScenarioNodeData`)
```typescript
interface ScenarioNodeData {
  label: string;           // タイトル
  description?: string;    // 詳細説明
  
  // Element Node Props
  infoType?: 'knowledge' | 'item' | 'skill' | 'stat' | 'equipment';
  infoValue?: string;      // リソース名
  quantity?: number;       // 数量
  actionType?: 'obtain' | 'consume';
  
  // Branch Node Props
  branchType?: 'if_else' | 'switch';
  branches?: { id: string; label: string }[];
  conditionVariable?: string;
  conditionValue?: string;
  
  // Event Node Props
  isStart?: boolean;       // 開始ノードフラグ
  
  // Group Node Props
  expanded?: boolean;
  contentWidth?: number;
  contentHeight?: number;
  
  // Variable Node Props
  targetVariable?: string;
  variableValue?: string;
  previousValue?: any;     // 内部状態復元用
  
  // Jump Node Props
  jumpTarget?: string;     // ターゲットノードID
  
  // Sticky Node Props
  targetNodeId?: string;   // 添付先ノードID
  hasSticky?: boolean;     // 添付されているかフラグ（他ノード側）
  
  // Reference Props
  referenceId?: string;    // Character/Resource ID
  
  // State
  revealed?: boolean;      // 公開状態
}
```

### 3.2 変数とゲーム状態

#### 3.2.1 変数 (`Variable`)
```typescript
type VariableType = 'boolean' | 'number' | 'string';

interface Variable {
  name: string;
  type: VariableType;
  value: any;
}
```

#### 3.2.2 ゲーム状態 (`GameState`)
シミュレーション実行時の状態を保持するオブジェクト。
```typescript
interface GameState {
  currentNodes: string[]; // 現在のアクティブなノードIDリスト
  revealedNodes: string[]; // プレイヤーに公開済みのノードIDリスト
  variables: Record<string, Variable>; // 変数マップ
  
  // リソースカテゴリごとの所持数マップ (Name -> Quantity)
  inventory: Record<string, number>;
  equipment: Record<string, number>;
  knowledge: Record<string, number>;
  skills: Record<string, number>;
  stats: Record<string, number>;
}
```

### 3.3 マスターデータ

#### 3.3.1 キャラクター (`CharacterData`)
```typescript
interface CharacterData {
  id: string;
  type: 'Person' | 'Participant' | 'Monster' | 'Other';
  name: string;
  reading?: string;      // 読み仮名
  description?: string;
  abilities?: string;
  skills?: string;
  note?: string;
}
```

#### 3.3.2 リソース (`ResourceData`)
```typescript
interface ResourceData {
  id: string;
  type: 'Item' | 'Equipment' | 'Knowledge' | 'Skill' | 'Status';
  name: string;
  reading?: string;
  description?: string;
  cost?: string;
  effect?: string;
  note?: string;
}
```
---
*End of Document*
