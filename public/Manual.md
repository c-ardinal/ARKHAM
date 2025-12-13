<!-- SECTION: ja -->
# ユーザーマニュアル

## はじめに
ARKHAM(アーカム)へようこそ。  
このツールは、TRPGのシナリオを作成・進行管理するためのツールです。  

## 用語集
- **ノード**:  
  シナリオの一部（イベント、情報など）を表すブロック。  
- **ハンドル**:  
  ノード上の小さな円で、ノード同士を接続するために使用します。  
- **エッジ**:  
  2つのノードを結ぶ線で、ストーリーの流れを表します。  

## ノードの種類
- **イベント (Event)**:  
  物語の各場面（シーン）を表す基本的なノードです。  
  タイトルや詳細な描写を記述し、プレイヤーに提示するストーリーの核となります。  
- **要素 (Element)**:  
  アイテムの入手、知識の獲得、ステータスの変化などを表すノードです。  
  プレイヤーが何かを得たり、失ったりするイベントを管理します。  
- **分岐 (Branch)**:  
  条件によってストーリーを分岐させるためのノードです。  
  「アイテムを持っているか？」「変数が特定の値か？」などの判定を行い、展開を変化させます。  
- **グループ (Group)**:  
  複数のノードをまとめて整理するためのノードです。  
  複雑になったキャンバスを、フォルダのように視覚的にすっきりさせることができます。  
- **ジャンプ (Jump)**:  
  離れた場所にあるノードへ処理を移動させるノードです。  
  線（エッジ）をつなぐのが難しい遠くのノードへ飛びたい場合に便利です。  
  ダブルクリックすると、ジャンプ先のノードへ画面を移動できます。  
- **メモ (Memo)**:  
  キャンバス上にメモ書きを残せるノードです。  
  シナリオ作成中の覚書や、自分用の注釈として自由に使えます。  
  ストーリー進行には影響しません。  
- **変数 (Variable)**: 
  変数の値を直接操作するノードです。  
  例えば、フラグを立てたり、カウンターを増やしたりする場合に使用します（例：好感度+1）。  
- **要素 (Ref)**:  
  サイドバーの「要素」タブからドラッグ＆ドロップで追加します。  
  定義したアイテムや情報を、取得イベントとして配置できます。  
- **登場人物 (Ref)**:  
  サイドバーの「登場人物」タブからドラッグ＆ドロップで追加します。  
  定義したキャラクターを、シーンに登場させるために配置できます。  
- **付箋 (Sticky)**:  
  右クリックメニューから追加できる注釈ノードです。  
  【ノード付箋】は特定のノードに紐づき、移動に追従します。任意のノードを右クリックして配置出来ます。  
  【自由配置付箋】はキャンバス上の好きな場所を右クリックして配置できます。  
  用途に応じて使い分けてください。  

## 操作方法
1. サイドバーからキャンバスにノードをドラッグ＆ドロップします。
2. ハンドルをドラッグしてノード同士を接続します。
3. ノードをクリックしてプロパティを編集します。
4. ノードを右クリックしてオプション（複製、グループ化など）を表示します。

## モードについて

### 編集モード
シナリオの構築を行うメインのモードです。
- ノードの追加、移動、接続、削除が可能です。  
- 各ノードのプロパティ設定や、変数の定義もここで行います。  
- 右クリックメニューから、ノードの複製やグループ化などの操作が行えます。  

### 進行モード
進行モードに切り替えてシナリオを進行します。  
進行モードでは、ノードの「開示/未開示」状態を切り替えることで、プレイヤーにどこまで情報を出したかを管理・追跡できます。  

## 変数の管理
シナリオ内で使用する変数を管理します。  

### 追加方法
サイドバーの「変数」セクションにある「変数追加」ボタンをクリックします。  
名前、型（真偽値/数値/文字列）、初期値を入力して作成します。  

### 更新方法
変数リストの値を直接書き換えることで、初期値を変更できます。  
進行モード中は、シナリオの進行に応じて値が変化する様子を確認できます。  

### 削除方法
変数リストの各項目の右側にあるゴミ箱アイコンをクリックします。  

### 変数の参照
テキスト内で変数を使用するには `${変数名}` の形式で記述します。  
シナリオ進行中、自動的にその時点の値に置き換わります。  
（例: 「ようこそ、${PlayerName}さん」→「ようこそ、探索者さん」）  

### 注意点
- 変数の「型」は作成後に変更できません。変更したい場合は、一度削除して作り直す必要があります。  
- 変数名は変更可能です。名前を変更すると、その変数を使用しているノード内の参照も自動的に更新されます。  

## ショートカットキー
- **保存**: `Ctrl + S`
- **元に戻す**: `Ctrl + Z`
- **やり直し**: `Ctrl + Y`
- **削除**: `Del`
- **複製**: `Ctrl + C`
- **再複製**: `Ctrl + V` (最後に複製したノードを再度作成)
- **開示/未開示切り替え**: `Ctrl + R`
- **拡大**: `Ctrl + +`
- **縮小**: `Ctrl + -`


<!-- SECTION: en -->
# User Manual

## Introduction
Welcome to the ARKHAM.  
This tool helps you create and manage branching scenarios for Tabletop RPGs.  

## Glossary
- **Node**: A block representing a part of the scenario (event, info, etc.).  
- **Handle**: The small circles on nodes used to connect them.  
- **Edge**: The line connecting two nodes, representing the flow of the story.  

## Node Types
- **Event**:  
  Represents a scene or event in the story. Use this to describe what happens, dialogue, or narration. It is the core building block of your scenario.
- **Element**:  
  Handles the acquisition or loss of items, knowledge, or status updates. Use this when the player gains or loses something.
- **Branch**:  
  Branches the story based on conditions. Use this to check variables (e.g., "Has Item X?" or "Score > 10") and direct the flow accordingly.
- **Group**:  
  Organizes multiple nodes visually. Use this to group related scenes together and keep your canvas clean.
- **Jump**:  
  Jumps the story flow to another node without a direct connecting line. Useful for looping back or moving to a distant section. Double-click to move the view to the target node.
- **Memo**:  
  A sticky note for the author. Use this to leave comments or reminders for yourself on the canvas. Does not affect the game flow.
- **Variable**:  
  Directly modifies a variable's value. Use this to set flags, increment counters, or update game state (e.g., "Friendship +1").
- **Element (Ref)**:  
  Reference to an Element defined in the "Elements" tab. Drag & Drop from the tab to grant an item or info to the player.
- **Character (Ref)**:  
  Reference to a Character defined in the "Characters" tab. Drag & Drop from the tab to indicate their presence in a scene.
- **Sticky Note**:  
  Annotation nodes added via Right-Click. "Node Sticky" attaches to a node and moves with it. "Free Sticky" can be placed anywhere on the canvas.

## Controls
1. Drag nodes from the sidebar to the canvas.  
2. Connect nodes by dragging from handles.  
3. Click a node to edit its properties.  
4. Right-click a node for more options (Duplicate, Group, etc.).  

## About Modes

### Edit Mode
The main mode for building scenarios.  
- Add, move, connect, and delete nodes.  
- Set properties for each node and define variables.  
- Right-click for options like duplicating or grouping nodes.  

### Play Mode
Switch to Play Mode to test your scenario. Track progress by toggling the "Revealed/Unrevealed" state of nodes to simulate player knowledge.  

## Managing Variables
Manage variables used in the scenario.  

### Adding
Click the "Add Variable" button in the sidebar.  
Enter name, type (Boolean/Number/String), and initial value.  

### Updating
Edit the value directly in the variable list to change the initial value.  
In Play Mode, observe how values change as the scenario progresses.  

### Deleting
Click the trash icon next to each item in the variable list.  

### Referencing Variables
Use the format `${variableName}` to include variable values in text. They will be automatically replaced with their current value during the game.  
(e.g., "Welcome, ${PlayerName}" -> "Welcome, Investigator")  

### Notes
- Variable "Type" cannot be changed after creation. Re-create if needed.  
- Variable names can be changed. References in nodes will update automatically.  

## Keyboard Shortcuts
- **Save**: `Ctrl + S`
- **Undo**: `Ctrl + Z`
- **Redo**: `Ctrl + Y`
- **Delete**: `Del`
- **Duplicate**: `Ctrl + C`
- **Re-duplicate**: `Ctrl + V` (Create copy of last duplicated node)
- **Toggle Reveal**: `Ctrl + R`
- **Zoom In**: `Ctrl + +`
- **Zoom Out**: `Ctrl + -`
