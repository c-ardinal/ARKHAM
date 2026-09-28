import { describe, it, expect } from 'vitest';
import { importFromHumanYaml } from '../humanImporter';
import { exportToHumanDocument, exportToHumanYaml } from '../humanExporter';

const sampleHumanYaml = `
# ==========================================
# シナリオ基本情報
# ==========================================
シナリオ基本情報:
  タイトル: 不確定性器官の拍動
  作者: c-ardinal
  システム: クトゥルフ神話TRPG
  想定時間: 220分
  推奨人数: 3〜4人
  推奨技能: 目星, 聞き耳, 医学, 科学/物理学
  ロスト率: 中〜高
  レギュレーション: 新クトゥルフ神話TRPGルールブック準拠
  あらすじ: |
    吹雪が吹き荒れる北極圏の極秘研究施設「ヘイズ・ラボ」。
    連絡を絶った施設へ派遣された探索者たちが目撃したのは、
    停止した生命維持装置と、静寂の中に響く不可解な心音だった――。

シナリオの真相: |
  施設長Dr.ヘイズは、宇宙的知性体「因果律アンカー」と脳摘出装置を直結し、
  時間改変と生体演算の実験を行っていた。
  実験は暴走し、施設全域が因果の乱れに囚われている。

事前情報:
  全体共有: |
    探索者たちは調査チームとして北極基地へ向かうヘリに搭乗している。
  ハンドアウト一覧:
    - HO: HO1
      役割: 調査隊パイロット
      公開情報: 操縦のプロ。悪天候の中、機体を基地まで送り届けた。
      個別秘密: 基地から発信された「自分宛ての遭難通信」を隠し持っている。
      推奨職業: パイロット、自衛官
    - HO: HO2
      役割: 医療担当
      公開情報: 隊員の健康管理と生体サンプルの採取が任務。
      個別秘密: かつてヘイズ・ラボで何らかの実験に関わっていた。
      推奨職業: 医師、教授

登場人物:
  - 名前: Dr.サトウ（瀕死の研究員）
    種別: 人物
    ふりがな: どくたーさとう
    概要: 受入検疫室で血溜まりの中に倒れている主任研究員。
    備考: 視覚野の出目99の激痛に苦しみながら鍵を託す。

  - 名前: ミ＝ゴの生体防衛端末（結晶変異体）
    種別: エネミー
    概要: 地下採掘抗に待ち受ける結晶変異体。全身が青い鉱石と化している。
    能力値: |
      STR: 16, CON: 14, SIZ: 15, DEX: 12, HP: 15, 装甲: 3点
    技能: |
      鉤爪: 45% (1D6+1D4)
    備考: 音や熱に反応して襲いかかる。

アイテム:
  - 名前: 警備室のカードキー
    種別: アイテム
    概要: 施設内のセキュリティドアを開錠するカード。
  - 名前: 機密暗号USB
    種別: 手がかり
    概要: キャビネットから回収した極秘データ。生還時にボーナス。

舞台:
  - 名前: ヘリポートとエアロック
    種別: 場所
    概要: 吹雪の吹き荒れる屋外ヘリポートと気密室。
  - 名前: 受入検疫室
    種別: 場所
    概要: 最初の遺体が発見される検疫エリア。

場面一覧:
  - 章: 1
    場面: 1-1. 北極圏への到着とエアロックでの異変
    場所: ヘリポートとエアロック
    目的: 施設内への進入および未知の脳神経異変の初知覚
    所要時間: 10
    描写: |
      吹雪が吹き荒れる北極圏の白銀の世界。調査ヘリが施設前哨に着陸した。
      エアロックに入った瞬間、鼓膜を突き刺す高周波音とともに視覚野に青い数字が固着する。
    KP情報:
      - エアロック内側の通路を進む
    リソース判定:
      トリガー: 未知の異常知覚への激しい困惑
      成功時: 0
      失敗時: 1D3
    行き先: 1-2. 受入検疫室の探索

  - 章: 1
    場面: 1-2. 受入検疫室の探索
    場所: 受入検疫室
    目的: Dr.サトウからの情報聴取と鍵の入手
    登場:
      - Dr.サトウ（瀕死の研究員）
    獲得アイテム:
      - 警備室のカードキー
    調査エリア:
      エリア名: 受入検疫室
      調査ポイント:
        - 名前: 《血溜まりの倒れた研究員》
          概要: 床に倒れているDr.サトウ。
          詳細: 息絶える寸前にカードキーを差し出す。
    分岐:
      分岐種別: 成否
      選択肢:
        - 条件: 成功 (治療判定)
          行き先: 1-3. 警備室の突破
        - 条件: 失敗
          行き先: 1-3. 警備室の突破

  - 章: 1
    場面: 1-3. 警備室の突破
    場所: 受入検疫室
    目的: 次のエリアへの進行
    合流先: 1-1. 北極圏への到着とエアロックでの異変
    エンディング: true
`;

describe('Human-Centric Scenario System (Bidirectional Lossless Conversion)', () => {
  it('correctly imports human-readable YAML into ARKHAM entities', () => {
    const result = importFromHumanYaml(sampleHumanYaml);

    // 1. Scenario Metadata Verification
    expect(result.scenarioMetadata.title).toBe('不確定性器官の拍動');
    expect(result.scenarioMetadata.author).toBe('c-ardinal');
    expect(result.scenarioMetadata.system).toBe('クトゥルフ神話TRPG');
    expect(result.scenarioMetadata.targetTimeMinutes).toBe(220);
    expect(result.scenarioMetadata.lossRate).toBe('中〜高');
    expect(result.scenarioMetadata.recommendedSkills).toContain('目星');
    expect(result.scenarioMetadata.recommendedSkills).toContain('聞き耳');
    expect(result.scenarioMetadata.truth).toContain('施設長Dr.ヘイズは');

    // Handouts
    expect(result.scenarioMetadata.handouts?.list?.length).toBe(2);
    expect(result.scenarioMetadata.handouts?.list?.[0].title).toBe('HO1');
    expect(result.scenarioMetadata.handouts?.list?.[0].secretInfo).toContain('遭難通信');
    expect(result.scenarioMetadata.handouts?.list?.[1].title).toBe('HO2');

    // 2. Character Registration Verification
    expect(result.characters.length).toBe(2);
    const satou = result.characters.find((c) => c.name.includes('Dr.サトウ'));
    expect(satou).toBeDefined();
    expect(satou?.type).toBe('Person');
    expect(satou?.reading).toBe('どくたーさとう');

    const migo = result.characters.find((c) => c.name.includes('ミ＝ゴ'));
    expect(migo).toBeDefined();
    expect(migo?.type).toBe('Monster');
    expect(migo?.abilities).toContain('STR: 16');

    // 3. Resource (Item) Registration Verification
    expect(result.resources.length).toBe(2);
    const key = result.resources.find((r) => r.name.includes('カードキー'));
    expect(key).toBeDefined();
    expect(key?.type).toBe('Item');

    const usb = result.resources.find((r) => r.name.includes('USB'));
    expect(usb).toBeDefined();
    expect(usb?.type).toBe('Knowledge');

    // 4. Stage (Location) Registration Verification
    expect(result.stages.length).toBe(2);
    const airlock = result.stages.find((s) => s.name.includes('エアロック'));
    expect(airlock).toBeDefined();
    expect(airlock?.type).toBe('Location');

    // 5. Node & Edge Graph Construction Verification
    expect(result.nodes.length).toBeGreaterThanOrEqual(4); // 3 scenes + 1 branch + 1 jump
    const node1 = result.nodes.find((n) => n.data.label.includes('1-1. 北極圏'));
    expect(node1).toBeDefined();
    expect(node1?.data.readAloudText).toContain('吹雪が吹き荒れる北極圏');
    expect(node1?.data.resourceCheck?.successLoss).toBe('0');
    expect(node1?.data.resourceCheck?.failLoss).toBe('1D3');

    const node2 = result.nodes.find((n) => n.data.label.includes('1-2. 受入検疫室'));
    expect(node2).toBeDefined();
    expect(node2?.data.investigationPoints?.length).toBe(1);
    expect(node2?.data.acquiredItems?.length).toBe(1); // card key resolved ID

    // Branch node created from scene 1-2
    const branch = result.nodes.find((n) => n.type === 'branch');
    expect(branch).toBeDefined();
    expect(branch?.data.branches?.length).toBe(2);

    // Edges
    expect(result.edges.length).toBeGreaterThan(0);
    // Edge from 1-1 to 1-2
    const edge1to2 = result.edges.find((e) => e.source === node1?.id && e.target === node2?.id);
    expect(edge1to2).toBeDefined();
  });

  it('performs roundtrip lossless export without internal developer jargon', () => {
    // Import first
    const imported = importFromHumanYaml(sampleHumanYaml);

    // Export back to Human Document
    const exportedDoc = exportToHumanDocument({
      scenarioMetadata: imported.scenarioMetadata,
      characters: imported.characters,
      resources: imported.resources,
      stages: imported.stages,
      nodes: imported.nodes,
      edges: imported.edges,
    });

    // Verify metadata fidelity
    expect(exportedDoc.シナリオ基本情報.タイトル).toBe('不確定性器官の拍動');
    expect(exportedDoc.シナリオ基本情報.作者).toBe('c-ardinal');
    expect(exportedDoc.シナリオ基本情報.システム).toBe('クトゥルフ神話TRPG');
    expect(exportedDoc.シナリオ基本情報.想定時間).toBe('220分');
    expect(exportedDoc.シナリオの真相).toContain('施設長Dr.ヘイズは');

    // Verify characters fidelity
    expect(exportedDoc.登場人物?.length).toBe(2);
    expect(exportedDoc.登場人物?.[0].名前).toContain('Dr.サトウ');
    expect(exportedDoc.登場人物?.[0].種別).toBe('人物');
    expect(exportedDoc.登場人物?.[1].名前).toContain('ミ＝ゴ');
    expect(exportedDoc.登場人物?.[1].種別).toBe('エネミー');

    // Verify resources fidelity
    expect(exportedDoc.アイテム?.length).toBe(2);
    expect(exportedDoc.アイテム?.[0].名前).toContain('カードキー');
    expect(exportedDoc.アイテム?.[0].種別).toBe('アイテム');
    expect(exportedDoc.アイテム?.[1].名前).toContain('USB');
    expect(exportedDoc.アイテム?.[1].種別).toBe('手がかり');

    // Verify scenes fidelity
    expect(exportedDoc.場面一覧.length).toBe(3);
    const scene1 = exportedDoc.場面一覧[0];
    expect(scene1.場面).toBe('1-1. 北極圏への到着とエアロックでの異変');
    expect(scene1.描写).toContain('吹雪が吹き荒れる北極圏');
    expect(scene1.リソース判定?.トリガー).toBe('未知の異常知覚への激しい困惑');
    expect(scene1.行き先).toBe('1-2. 受入検疫室の探索');

    const scene2 = exportedDoc.場面一覧[1];
    expect(scene2.場面).toBe('1-2. 受入検疫室の探索');
    expect(scene2.分岐).toBeDefined();
    expect(scene2.分岐?.選択肢.length).toBe(2);

    const scene3 = exportedDoc.場面一覧[2];
    expect(scene3.場面).toBe('1-3. 警備室の突破');
    expect(scene3.エンディング).toBe(true);

    // Export to YAML string and verify no developer jargon exists
    const yamlString = exportToHumanYaml({
      scenarioMetadata: imported.scenarioMetadata,
      characters: imported.characters,
      resources: imported.resources,
      stages: imported.stages,
      nodes: imported.nodes,
      edges: imported.edges,
    });

    // Must NOT contain internal system keys as top-level or node attributes
    expect(yamlString).not.toContain('nodeId');
    expect(yamlString).not.toContain('sourceHandle');
    expect(yamlString).not.toContain('targetHandle');
    expect(yamlString).not.toContain('position:');
    expect(yamlString).not.toContain('type: "event"');
  });

  it('successfully imports and verifies full converted source scenario YAML', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const fullYamlPath = path.resolve('source_scenario/scenario_indeterminate_organ.yaml');
    expect(fs.existsSync(fullYamlPath)).toBe(true);

    const fullYaml = fs.readFileSync(fullYamlPath, 'utf-8');
    const result = importFromHumanYaml(fullYaml);
    expect(result.scenarioMetadata.title).toContain('不確定性器官の拍動');
    expect(result.scenarioMetadata.truth).toContain('因果律アンカー');
    expect(result.scenarioMetadata.handouts?.list?.length).toBe(4);
    expect(result.characters.length).toBe(5);
    expect(result.resources.length).toBeGreaterThan(10);
    expect(result.stages.length).toBeGreaterThan(10);
    expect(result.nodes.length).toBeGreaterThanOrEqual(20);
    expect(result.edges.length).toBeGreaterThan(0);
  });

  it('preserves complete semantic identity on roundtrip import -> export without edits', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const YAML = await import('yaml');

    const fullYamlPath = path.resolve('source_scenario/scenario_indeterminate_organ.yaml');
    const originalYaml = fs.readFileSync(fullYamlPath, 'utf-8');
    const originalDoc = YAML.parse(originalYaml);

    // 1. Import
    const imported = importFromHumanYaml(originalYaml);

    // 2. Export without any edits
    const exportedDoc = exportToHumanDocument({
      scenarioMetadata: imported.scenarioMetadata,
      characters: imported.characters,
      resources: imported.resources,
      stages: imported.stages,
      nodes: imported.nodes,
      edges: imported.edges,
    });

    // 3. Deep verify field by field
    // Basic Info
    expect(exportedDoc.シナリオ基本情報.タイトル).toBe(originalDoc.シナリオ基本情報.タイトル);
    expect(exportedDoc.シナリオ基本情報.作者).toBe(originalDoc.シナリオ基本情報.作者);
    expect(exportedDoc.シナリオ基本情報.システム).toBe(originalDoc.シナリオ基本情報.システム);
    expect(exportedDoc.シナリオ基本情報.想定時間).toBe(originalDoc.シナリオ基本情報.想定時間);
    expect(exportedDoc.シナリオ基本情報.推奨人数).toBe(originalDoc.シナリオ基本情報.推奨人数);
    expect(exportedDoc.シナリオ基本情報.推奨技能).toEqual(originalDoc.シナリオ基本情報.推奨技能);
    expect(exportedDoc.シナリオ基本情報.ロスト率).toBe(originalDoc.シナリオ基本情報.ロスト率);
    expect(exportedDoc.シナリオ基本情報.レギュレーション).toBe(originalDoc.シナリオ基本情報.レギュレーション);
    expect(exportedDoc.シナリオ基本情報.あらすじ?.trim()).toBe(originalDoc.シナリオ基本情報.あらすじ?.trim());

    // Truth
    expect(exportedDoc.シナリオの真相?.trim()).toBe(originalDoc.シナリオの真相?.trim());

    // Advance Info & HO
    expect(exportedDoc.事前情報?.全体共有?.trim()).toBe(originalDoc.事前情報?.全体共有?.trim());
    expect(exportedDoc.事前情報?.ハンドアウト一覧?.length).toBe(originalDoc.事前情報?.ハンドアウト一覧?.length);
    for (let i = 0; i < (originalDoc.事前情報?.ハンドアウト一覧?.length || 0); i++) {
      expect(exportedDoc.事前情報?.ハンドアウト一覧?.[i].HO).toBe(originalDoc.事前情報?.ハンドアウト一覧?.[i].HO);
      expect(exportedDoc.事前情報?.ハンドアウト一覧?.[i].役割).toBe(originalDoc.事前情報?.ハンドアウト一覧?.[i].役割);
      expect(exportedDoc.事前情報?.ハンドアウト一覧?.[i].公開情報).toBe(originalDoc.事前情報?.ハンドアウト一覧?.[i].公開情報);
    }

    // Characters count and names
    expect(exportedDoc.登場人物?.length).toBe(originalDoc.登場人物?.length);
    for (let i = 0; i < (originalDoc.登場人物?.length || 0); i++) {
      expect(exportedDoc.登場人物?.[i].名前).toBe(originalDoc.登場人物?.[i].名前);
      expect(exportedDoc.登場人物?.[i].種別).toBe(originalDoc.登場人物?.[i].種別);
    }

    // Items count and names
    expect(exportedDoc.アイテム?.length).toBe(originalDoc.アイテム?.length);
    for (let i = 0; i < (originalDoc.アイテム?.length || 0); i++) {
      expect(exportedDoc.アイテム?.[i].名前).toBe(originalDoc.アイテム?.[i].名前);
      expect(exportedDoc.アイテム?.[i].種別).toBe(originalDoc.アイテム?.[i].種別);
    }

    // Stages count and names
    expect(exportedDoc.舞台?.length).toBe(originalDoc.舞台?.length);
    for (let i = 0; i < (originalDoc.舞台?.length || 0); i++) {
      expect(exportedDoc.舞台?.[i].名前).toBe(originalDoc.舞台?.[i].名前);
      expect(exportedDoc.舞台?.[i].種別).toBe(originalDoc.舞台?.[i].種別);
    }

    // Scenes count and content
    expect(exportedDoc.場面一覧.length).toBe(originalDoc.場面一覧.length);
    for (let i = 0; i < originalDoc.場面一覧.length; i++) {
      expect(exportedDoc.場面一覧[i].場面).toBe(originalDoc.場面一覧[i].場面);
      if (originalDoc.場面一覧[i].描写) {
        expect(exportedDoc.場面一覧[i].描写?.trim()).toBe(originalDoc.場面一覧[i].描写?.trim());
      }
      if (originalDoc.場面一覧[i].目的) {
        expect(exportedDoc.場面一覧[i].目的).toBe(originalDoc.場面一覧[i].目的);
      }
    }
  });

  it('accurately reflects arbitrary edits made after import when exported back to YAML', async () => {
    const fs = await import('fs');
    const path = await import('path');

    const fullYamlPath = path.resolve('source_scenario/scenario_indeterminate_organ.yaml');
    const originalYaml = fs.readFileSync(fullYamlPath, 'utf-8');
    const state = importFromHumanYaml(originalYaml);

    // --- Perform Arbitrary Edits ---
    // 1. Edit Scenario Metadata
    state.scenarioMetadata.title = '【改変版】不確定性器官の拍動・深淵の目覚め';
    state.scenarioMetadata.author = 'c-ardinal & アシスタントKP';
    state.scenarioMetadata.lossRate = '極高（ロスト必至）';
    state.scenarioMetadata.truth += '\n【追加真相】因果律アンカーの真の目的は異星知性体の受肉である。';
    state.scenarioMetadata.handouts?.list?.push({
      id: 'ho_5',
      title: 'HO5',
      role: '密航者',
      publicInfo: '救助ヘリの貨物室に忍び込んでいた謎の人物。',
      recommendedRole: '犯罪者、狂信者',
    });

    // 2. Add New Character
    state.characters.push({
      id: 'char_albert',
      name: '特務調査員アルバート',
      type: 'Person',
      reading: 'あるばーと',
      description: '後発で潜入してきた謎の調査員。',
      abilities: 'STR: 18, CON: 16, HP: 17',
      skills: '拳銃: 85%, 回避: 70%',
      note: '実は財団からの二重スパイ。',
    });

    // 3. Edit Existing Character
    const satou = state.characters.find((c) => c.name.includes('Dr.サトウ'));
    expect(satou).toBeDefined();
    if (satou) {
      satou.abilities = '瀕死のため全能力値半減 (STR: 4, CON: 3)';
      satou.note = '最期の言葉「アンカーを止めろ…」を遺す。';
    }

    // 4. Add New Resource (Item)
    state.resources.push({
      id: 'item_master_key',
      name: 'マスター非常電子キー',
      type: 'Item',
      description: '全エリアの緊急用オーバーライドキー。',
      effect: '隔壁を一撃で解錠できる。',
    });

    // 5. Edit Existing Scene (Read aloud text, acquired items, KP notes)
    const scene1 = state.nodes.find((n) => n.data.label.includes('北極圏'));
    expect(scene1).toBeDefined();
    if (scene1) {
      scene1.data.readAloudText = '【改変描写】吹雪が猛威を振るい、ヘリは不時着寸前で辛うじて着陸した。';
      scene1.data.kpInstructions = [
        '【追加指示】プレイヤーの緊張感を高めるためBGMを嵐の音に切り替えること。',
      ];
      // Add the new item to acquired items in scene 1
      scene1.data.acquiredItems = [...(scene1.data.acquiredItems || []), 'item_master_key'];
      // Associate the new character
      scene1.data.associatedCharacterIds = [...(scene1.data.associatedCharacterIds || []), 'char_albert'];
    }

    // 6. Export Modified State to YAML
    const modifiedYaml = exportToHumanYaml({
      scenarioMetadata: state.scenarioMetadata,
      characters: state.characters,
      resources: state.resources,
      stages: state.stages,
      nodes: state.nodes,
      edges: state.edges,
    });

    // --- Verify All Modifications Are Faithfully Present in Exported YAML ---
    expect(modifiedYaml).toContain('【改変版】不確定性器官の拍動・深淵の目覚め');
    expect(modifiedYaml).toContain('c-ardinal & アシスタントKP');
    expect(modifiedYaml).toContain('極高（ロスト必至）');
    expect(modifiedYaml).toContain('【追加真相】因果律アンカーの真の目的は異星知性体の受肉である。');
    expect(modifiedYaml).toContain('HO5');
    expect(modifiedYaml).toContain('密航者');

    // New Character
    expect(modifiedYaml).toContain('特務調査員アルバート');
    expect(modifiedYaml).toContain('STR: 18, CON: 16, HP: 17');
    expect(modifiedYaml).toContain('実は財団からの二重スパイ。');

    // Modified Character
    expect(modifiedYaml).toContain('瀕死のため全能力値半減 (STR: 4, CON: 3)');
    expect(modifiedYaml).toContain('最期の言葉「アンカーを止めろ…」を遺す。');

    // New Resource
    expect(modifiedYaml).toContain('マスター非常電子キー');
    expect(modifiedYaml).toContain('全エリアの緊急用オーバーライドキー。');

    // Modified Scene & Associations
    expect(modifiedYaml).toContain('【改変描写】吹雪が猛威を振るい、ヘリは不時着寸前で辛うじて着陸した。');
    expect(modifiedYaml).toContain('【追加指示】プレイヤーの緊張感を高めるためBGMを嵐の音に切り替えること。');
    expect(modifiedYaml).toContain('マスター非常電子キー');
    expect(modifiedYaml).toContain('特務調査員アルバート');

    // Re-importing modified YAML should preserve all modified values
    const reimported = importFromHumanYaml(modifiedYaml);
    expect(reimported.scenarioMetadata.title).toBe('【改変版】不確定性器官の拍動・深淵の目覚め');
    expect(reimported.characters.some((c) => c.name === '特務調査員アルバート')).toBe(true);
    expect(reimported.resources.some((r) => r.name === 'マスター非常電子キー')).toBe(true);
    const reimportedScene1 = reimported.nodes.find((n) => n.data.label.includes('北極圏'));
    expect(reimportedScene1?.data.readAloudText).toContain('【改変描写】吹雪が猛威を振るい');
  });

  it('correctly maps character referenceId for all character nodes in source scenario (0 Deleted Character)', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const yamlPath = path.resolve(process.cwd(), 'source_scenario/scenario_indeterminate_organ.yaml');
    if (!fs.existsSync(yamlPath)) return;

    const yamlContent = fs.readFileSync(yamlPath, 'utf8');
    const result = importFromHumanYaml(yamlContent);

    const charNodes = result.nodes.filter((n) => n.type === 'character');
    expect(charNodes.length).toBe(5);

    for (const node of charNodes) {
      expect(node.data.referenceId).toBeDefined();
      const matchedChar = result.characters.find((c) => c.id === node.data.referenceId);
      expect(matchedChar).toBeDefined();
      expect(matchedChar?.name).toBeTruthy();
    }
  });

  it('resolves character referenceId via base name matching even without explicit ID or 参照ID', () => {
    const yamlWithoutIds = `
シナリオ基本情報:
  タイトル: テストシナリオ
登場人物:
  - 名前: Dr.サトウ（瀕死の研究員）
    種別: 人物
  - 名前: 大型ミ＝ゴ生体防衛端末（最深部の変異体）
    種別: エネミー
場面一覧:
  - 場面: Dr.サトウ（主任研究員）
    種別: 登場人物
  - 場面: 大型ミ＝ゴ生体防衛端末（最深部の怪異）
    種別: エネミー
`;
    const result = importFromHumanYaml(yamlWithoutIds);
    const charNodes = result.nodes.filter((n) => n.type === 'character');
    expect(charNodes.length).toBe(2);

    const satouNode = charNodes.find((n) => n.data.label.includes('サトウ'));
    expect(satouNode).toBeDefined();
    const satouChar = result.characters.find((c) => c.id === satouNode?.data.referenceId);
    expect(satouChar).toBeDefined();
    expect(satouChar?.name).toBe('Dr.サトウ（瀕死の研究員）');

    const migoNode = charNodes.find((n) => n.data.label.includes('ミ＝ゴ'));
    expect(migoNode).toBeDefined();
    const migoChar = result.characters.find((c) => c.id === migoNode?.data.referenceId);
    expect(migoChar).toBeDefined();
    expect(migoChar?.name).toBe('大型ミ＝ゴ生体防衛端末（最深部の変異体）');
  });

  it('loads YAML package into scenarioStore and ensures zero Deleted Character across tabs', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { useScenarioStore } = await import('../../store/scenarioStore');

    const yamlPath = path.resolve(process.cwd(), 'source_scenario/scenario_indeterminate_organ.yaml');
    if (!fs.existsSync(yamlPath)) return;

    const yamlContent = fs.readFileSync(yamlPath, 'utf8');
    const result = importFromHumanYaml(yamlContent);

    const scenarioPackage: any = {
      version: 2,
      scenarioTitle: result.scenarioMetadata.title,
      scenarioMetadata: result.scenarioMetadata,
      characters: result.characters,
      resources: result.resources,
      stages: result.stages,
      activeTabId: 'tab_main',
      tabs: [
        {
          id: 'tab_main',
          name: result.scenarioMetadata.title,
          nodes: result.nodes,
          edges: result.edges,
        },
      ],
    };

    useScenarioStore.getState().loadScenario(scenarioPackage);

    const state = useScenarioStore.getState();
    expect(state.characters.length).toBeGreaterThanOrEqual(5);

    const activeTab = state.tabs.find((t) => t.id === state.activeTabId);
    const charNodes = activeTab?.nodes.filter((n) => n.type === 'character') || [];
    expect(charNodes.length).toBe(5);

    // Verify each character node finds its character (CharacterNode render condition)
    for (const node of charNodes) {
      expect(node.data.referenceId).toBeTruthy();
      const char = state.characters.find((c) => c.id === node.data.referenceId);
      expect(char).toBeDefined();
      expect(char?.name).toBeTruthy();
    }

    // Verify all jump nodes have incoming edges (zero unconnected jump nodes)
    const jumpNodes = activeTab?.nodes.filter((n) => n.type === 'jump') || [];
    expect(jumpNodes.length).toBe(22);
    for (const jNode of jumpNodes) {
      const inEdges = activeTab?.edges.filter((e) => e.target === jNode.id) || [];
      expect(inEdges.length).toBeGreaterThanOrEqual(1);
    }

    // Verify all character nodes are connected via reference edges
    for (const cNode of charNodes) {
      const refEdges = activeTab?.edges.filter(
        (e) => (e.source === cNode.id || e.target === cNode.id) && e.type === 'reference'
      ) || [];
      expect(refEdges.length).toBeGreaterThanOrEqual(1);
    }
  });
});
