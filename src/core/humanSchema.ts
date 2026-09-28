/**
 * ARKHAM Human-Centric Scenario Schema
 * Non-engineer-friendly, lossless TRPG scenario structure.
 * Designed for bidirectional conversion between natural language (YAML/Markdown) and ARKHAM Graph.
 */

export interface HumanScenarioBasicInfo {
  タイトル: string;
  作者?: string;
  システム?: string;
  想定時間?: string | number;
  推奨人数?: string;
  推奨技能?: string | string[];
  ロスト率?: string;
  レギュレーション?: string;
  あらすじ?: string;
}

export interface HumanHandout {
  HO: string;
  役割?: string;
  公開情報?: string;
  個別秘密?: string;
  推奨職業?: string;
}

export interface HumanAdvanceInfo {
  全体共有?: string;
  ハンドアウト一覧?: HumanHandout[];
}

export type HumanCharacterType = '人物' | 'エネミー' | '怪物' | '参加者' | 'PC' | 'その他';

export interface HumanCharacter {
  ID?: string;
  名前: string;
  種別?: HumanCharacterType;
  ふりがな?: string;
  概要?: string;
  能力値?: string;
  技能?: string;
  備考?: string;
}

export type HumanResourceType = 'アイテム' | '装備' | '手がかり' | '情報' | 'その他';

export interface HumanResource {
  ID?: string;
  名前: string;
  種別?: HumanResourceType;
  概要?: string;
  効果?: string;
  備考?: string;
}

export type HumanStageType = '場所' | '組織' | '世界観';

export interface HumanStage {
  ID?: string;
  名前: string;
  種別?: HumanStageType;
  概要?: string;
  備考?: string;
}

export interface HumanInvestigationCheck {
  技能: string;
  難易度?: string;
  成功時?: string;
  失敗時?: string;
  クリティカル時?: string;
  ファンブル時?: string;
}

export interface HumanInvestigationPoint {
  名前: string;
  概要: string;
  詳細?: string;
  発見アイテム?: string[];
  判定?: HumanInvestigationCheck[];
}

export interface HumanInvestigationArea {
  エリア名: string;
  概要?: string;
  調査ポイント: HumanInvestigationPoint[];
}

export interface HumanBranchChoice {
  条件?: string; // 例: "成功", "失敗", "大成功", "大失敗", "調査A", "警備室のカードキーを所持"
  行き先: string; // 遷移先の場面タイトル
  ラベル?: string;
}

export interface HumanBranch {
  分岐種別?: '成否' | '4段階' | '選択' | '条件';
  選択肢: HumanBranchChoice[];
  その他?: string; // Elseルートの遷移先場面タイトル
}

export interface HumanResourceCheck {
  トリガー: string;
  成功時: string;
  失敗時: string;
  対象リソース?: string;
}

export type HumanSceneNodeType =
  | '場面'
  | 'イベント'
  | '分岐'
  | '判定'
  | '行動選択'
  | 'アイテム'
  | '手がかり'
  | '情報'
  | '登場人物'
  | 'エネミー'
  | '怪物'
  | 'NPC'
  | 'ジャンプ'
  | '合流'
  | 'グループ'
  | 'フェーズ';

export interface HumanScene {
  ID?: string; // ノード固有ID（省略時は自動採番）
  参照ID?: string; // 登場人物・アイテム・舞台の関連付けID（character, element, stageノード用）
  章?: number;
  場面: string; // 場面タイトル / ノード表示名
  種別?: HumanSceneNodeType; // ノードの種別（省略時は '場面'）
  グループ?: string; // 所属するグループ・フェーズ名
  場所?: string;
  目的?: string;
  KP情報?: string | string[];
  描写?: string;
  登場?: string | string[];
  獲得アイテム?: string | string[];
  消費アイテム?: string | string[];
  必要アイテム?: string | string[];
  所要時間?: number; // 想定所要時間（分）
  リソース判定?: HumanResourceCheck;
  調査エリア?: HumanInvestigationArea;
  分岐?: HumanBranch;
  行き先?: string | string[]; // 次のノード名（複数可）
  合流先?: string; // ジャンプ先ノード名
  ジャンプ先?: string; // ジャンプ先ノード名
  エンディング?: boolean | string;
}

export interface HumanScenarioDocument {
  シナリオ基本情報: HumanScenarioBasicInfo;
  シナリオの真相?: string;
  事前情報?: HumanAdvanceInfo;
  登場人物?: HumanCharacter[];
  アイテム?: HumanResource[];
  舞台?: HumanStage[];
  場面一覧: HumanScene[];
}
