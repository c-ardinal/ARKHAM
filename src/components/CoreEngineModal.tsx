import React, { useState, useMemo, useCallback } from 'react';
import {
  X,
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  Play,
  Download,
  Copy,
  Check,
  RotateCcw,
  FileText,
  Activity,
  Sliders,
  ExternalLink,
  Flame,
} from 'lucide-react';
import { useScenarioStore } from '../store/scenarioStore';
import { buildCoreGraph } from '../core/adapter';
import { lintGraph } from '../core/linter';
import { validateGraph } from '../core/validator';
import { runSimulation } from '../core/simulator';
import { exportToScenarioMarkdown } from '../core/exporter';
import type { SimulationConfig, SimulationResult } from '../core/schema';
import { toast } from './common/toast';

interface CoreEngineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFocusNode?: (nodeId: string) => void;
}

type TabType = 'lint' | 'simulator' | 'export';

export const CoreEngineModal: React.FC<CoreEngineModalProps> = ({ isOpen, onClose, onFocusNode }) => {
  const [activeTab, setActiveTab] = useState<TabType>('lint');

  // Scenario Store
  const { tabs, activeTabId, resources, stages, setSelectedNode, setActiveTab: setStoreActiveTab, systemConfig, gameState, setSimulationOverlay } = useScenarioStore();
  const currentTab = tabs.find((t) => t.id === activeTabId);

  // Validation Scope
  const [validationScope, setValidationScope] = useState<'all' | 'current'>('all');

  // Build CoreGraph
  const { targetNodes, targetEdges } = useMemo(() => {
    if (validationScope === 'all') {
      return {
        targetNodes: tabs.flatMap((t) => t.nodes),
        targetEdges: tabs.flatMap((t) => t.edges),
      };
    }
    const currentTab = tabs.find((t) => t.id === activeTabId);
    return {
      targetNodes: currentTab?.nodes || [],
      targetEdges: currentTab?.edges || [],
    };
  }, [tabs, activeTabId, validationScope]);

  const coreGraph = useMemo(() => {
    return buildCoreGraph(targetNodes, targetEdges, resources, stages, systemConfig, gameState?.variables);
  }, [targetNodes, targetEdges, resources, stages, systemConfig, gameState?.variables]);

  // Linter & Validator Results
  const { lintIssues, validationIssues } = useMemo(() => {
    if (!isOpen) return { lintIssues: [], validationIssues: [] };
    const lIssues = lintGraph(coreGraph);
    const vIssues = validateGraph(coreGraph);
    return { lintIssues: lIssues, validationIssues: vIssues };
  }, [coreGraph, isOpen]);

  const totalErrors =
    lintIssues.filter((i) => i.severity === 'error').length +
    validationIssues.filter((i) => i.severity === 'error').length;
  const totalWarnings =
    lintIssues.filter((i) => i.severity === 'warning').length +
    validationIssues.filter((i) => i.severity === 'warning').length;

  // Simulator State
  const [simConfig, setSimConfig] = useState<SimulationConfig>({
    runs: 5000,
    partySize: 4,
    defaultSkillValue: 60,
    initialSan: 50,
    diceStockCount: 3,
    targetSessionMinutes: 220,
  });
  const [simResult, setSimResult] = useState<SimulationResult | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  const handleRunSimulation = useCallback(() => {
    setIsSimulating(true);
    setTimeout(() => {
      try {
        const res = runSimulation(coreGraph, simConfig);
        setSimResult(res);
        toast.success(`仮想テストプレイ(${simConfig.runs}回)が完了しました`);
      } catch (err) {
        console.error(err);
        toast.error('シミュレーション中にエラーが発生しました');
      } finally {
        setIsSimulating(false);
      }
    }, 50);
  }, [coreGraph, simConfig]);

  // Exporter State
  const [copied, setCopied] = useState(false);
  const exportedMarkdown = useMemo(() => {
    if (!isOpen || activeTab !== 'export') return '';
    return exportToScenarioMarkdown(coreGraph);
  }, [coreGraph, isOpen, activeTab]);

  const handleCopyMarkdown = useCallback(() => {
    navigator.clipboard.writeText(exportedMarkdown);
    setCopied(true);
    toast.success('マークダウンをクリップボードにコピーしました');
    setTimeout(() => setCopied(false), 2000);
  }, [exportedMarkdown]);

  const handleDownloadMarkdown = useCallback(() => {
    const blob = new Blob([exportedMarkdown], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scenario_body_${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('scenario_body.md をダウンロードしました');
  }, [exportedMarkdown]);

  const handleJumpToNode = (nodeId: string) => {
    const ownerTab = tabs.find((t) => t.nodes.some((n) => n.id === nodeId));
    if (ownerTab && ownerTab.id !== activeTabId) {
      setStoreActiveTab(ownerTab.id);
    }
    setSelectedNode(nodeId);
    if (onFocusNode) {
      onFocusNode(nodeId);
    }
    onClose();
  };

  const getValidationCodeLabel = (code: string) => {
    switch (code) {
      case 'unconnected_branch_route':
        return '分岐未接続ルート';
      case 'invalid_jump_target':
        return '無効なジャンプ先';
      case 'dangling_branch':
        return '分岐出力エッジなし';
      case 'dead_end':
      case 'dead_end_unconnected':
        return '行き止まり';
      case 'soft_lock_missing_item':
        return 'デッドロック・詰みルート';
      case 'infinite_loop':
        return '無限ループ閉路';
      case 'unreachable_node':
        return '到達不能ノード';
      case 'unreachable_ending':
        return 'エンディング到達不能';
      case 'multiple_event_outgoing_edges':
        return 'イベント複数出力';
      default:
        return 'グラフ検証';
    }
  };

  const getLintCodeLabel = (code: string) => {
    switch (code) {
      case 'undefined_item':
        return '未定義アイテム参照';
      case 'fuzzy_item_match':
        return '表記揺れの可能性';
      case 'dead_item':
        return '未使用（死にアイテム）';
      case 'isolated_node':
        return '孤立ノード';
      case 'forbidden_read_aloud_term':
        return 'PL描写テキストの禁則事項';
      case 'bracket_syntax_error':
        return '括弧文法エラー';
      case 'undefined_variable':
        return '未定義変数';
      case 'expression_syntax_error':
        return '条件式構文エラー';
      default:
        return '静的チェック';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card text-card-foreground border border-border w-full max-w-4xl h-[85vh] rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Activity size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold">ARKHAM Core Engine</h2>
              <p className="text-xs text-muted-foreground">
                静的検査 (Linter) ・ 到達性/デッドロック検証 ・ 仮想テストプレイ ・ 統一Markdown出力
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-border px-6 bg-muted/10 gap-2">
          <button
            onClick={() => setActiveTab('lint')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'lint'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <ShieldCheck size={16} />
            整合性検査・検証
            {totalErrors > 0 && (
              <span className="px-1.5 py-0.5 text-xs font-semibold rounded-full bg-destructive text-destructive-foreground">
                {totalErrors}
              </span>
            )}
            {totalWarnings > 0 && totalErrors === 0 && (
              <span className="px-1.5 py-0.5 text-xs font-semibold rounded-full bg-amber-500 text-white">
                {totalWarnings}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('simulator')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'simulator'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Sliders size={16} />
            モンテカルロ・シミュレータ
          </button>

          <button
            onClick={() => setActiveTab('export')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'export'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <FileText size={16} />
            統一フォーマット出力 (Markdown)
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'lint' && (
            <div className="space-y-6">
              {/* Summary Banner */}
              <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-lg bg-muted/40 border border-border">
                <div className="flex items-center gap-3">
                  <div className="text-sm font-medium">
                    検証対象: {validationScope === 'all' ? 'シナリオ全タブ' : currentTab?.name || '現在のタブ'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    ノード数: {targetNodes.length} | エッジ数: {targetEdges.length} | マスターアイテム数: {resources.filter((r) => r.type === 'Item').length}
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center text-xs bg-muted rounded-md p-0.5 border">
                    <button
                      onClick={() => setValidationScope('all')}
                      className={`px-2 py-1 rounded transition-colors ${
                        validationScope === 'all'
                          ? 'bg-background shadow-xs font-semibold text-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      全タブ (シナリオ全体)
                    </button>
                    <button
                      onClick={() => setValidationScope('current')}
                      className={`px-2 py-1 rounded transition-colors ${
                        validationScope === 'current'
                          ? 'bg-background shadow-xs font-semibold text-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      現在のタブのみ
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm">
                    <AlertCircle size={16} className="text-destructive" />
                    <span className="font-semibold text-destructive">{totalErrors}</span> エラー
                  </div>
                  <div className="flex items-center gap-1.5 text-sm">
                    <AlertTriangle size={16} className="text-amber-500" />
                    <span className="font-semibold text-amber-500">{totalWarnings}</span> 警告
                  </div>
                </div>
              </div>

              {/* No Issues State */}
              {totalErrors === 0 && totalWarnings === 0 && (
                <div className="text-center py-12 border border-dashed border-border rounded-lg">
                  <ShieldCheck size={48} className="mx-auto text-emerald-500 mb-3" />
                  <h3 className="text-base font-semibold text-foreground">問題は検出されませんでした</h3>
                  <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                    アイテムの未定義参照、表記揺れ、前提アイテム未所持の詰みルート（ソフトロック）、分岐の未接続、無限ループは一切存在しません。
                  </p>
                </div>
              )}

              {/* Issues List */}
              {(validationIssues.length > 0 || lintIssues.length > 0) && (
                <div className="space-y-3">
                  {/* Validation Issues (Graph level) */}
                  {validationIssues.map((v, idx) => (
                    <div
                      key={`val-${idx}`}
                      className={`p-4 rounded-lg border flex items-start justify-between gap-4 ${
                        v.severity === 'error'
                          ? 'bg-destructive/5 border-destructive/30'
                          : 'bg-amber-500/5 border-amber-500/30'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {v.severity === 'error' ? (
                          <AlertCircle size={18} className="text-destructive shrink-0 mt-0.5" />
                        ) : (
                          <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
                        )}
                        <div>
                          <div className="text-sm font-semibold flex items-center gap-2">
                            <span>{getValidationCodeLabel(v.code)}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-muted font-normal text-muted-foreground">
                              グラフ検証
                            </span>
                          </div>
                          <p className="text-xs text-foreground/80 mt-1">{v.message}</p>
                        </div>
                      </div>
                      {v.nodeId && (
                        <button
                          onClick={() => handleJumpToNode(v.nodeId!)}
                          className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md bg-background border border-border hover:bg-accent text-foreground shrink-0 transition-colors"
                        >
                          <ExternalLink size={12} />
                          該当ノードへ
                        </button>
                      )}
                    </div>
                  ))}

                  {/* Linter Issues */}
                  {lintIssues.map((issue, idx) => (
                    <div
                      key={`lint-${idx}`}
                      className={`p-4 rounded-lg border flex items-start justify-between gap-4 ${
                        issue.severity === 'error'
                          ? 'bg-destructive/5 border-destructive/30'
                          : 'bg-amber-500/5 border-amber-500/30'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {issue.severity === 'error' ? (
                          <AlertCircle size={18} className="text-destructive shrink-0 mt-0.5" />
                        ) : (
                          <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
                        )}
                        <div>
                          <div className="text-sm font-semibold flex items-center gap-2">
                            <span>{getLintCodeLabel(issue.code)}</span>
                            {issue.location && (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-muted font-mono text-muted-foreground">
                                {issue.location}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-foreground/80 mt-1">{issue.message}</p>
                          {issue.suggestion && (
                            <div className="text-xs text-primary font-medium mt-1">
                              サジェスト: {issue.suggestion}
                            </div>
                          )}
                        </div>
                      </div>
                      {issue.nodeId && (
                        <button
                          onClick={() => handleJumpToNode(issue.nodeId!)}
                          className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md bg-background border border-border hover:bg-accent text-foreground shrink-0 transition-colors"
                        >
                          <ExternalLink size={12} />
                          該当ノードへ
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'simulator' && (
            <div className="space-y-6">
              {/* Configuration */}
              <div className="p-4 rounded-lg bg-muted/20 border border-border space-y-4">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Sliders size={16} />
                  シミュレーション設定
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                  <div>
                    <label className="text-muted-foreground block mb-1">試行回数 (Runs)</label>
                    <input
                      type="number"
                      value={simConfig.runs}
                      onChange={(e) => setSimConfig({ ...simConfig, runs: Number(e.target.value) })}
                      className="w-full px-3 py-1.5 bg-background border border-border rounded-md"
                      min={100}
                      max={50000}
                      step={500}
                    />
                  </div>
                  <div>
                    <label className="text-muted-foreground block mb-1">探索者人数 (Party Size)</label>
                    <input
                      type="number"
                      value={simConfig.partySize}
                      onChange={(e) => setSimConfig({ ...simConfig, partySize: Number(e.target.value) })}
                      className="w-full px-3 py-1.5 bg-background border border-border rounded-md"
                      min={1}
                      max={6}
                    />
                  </div>
                  <div>
                    <label className="text-muted-foreground block mb-1">初期{systemConfig.resourceName}</label>
                    <input
                      type="number"
                      value={simConfig.initialSan}
                      onChange={(e) => setSimConfig({ ...simConfig, initialSan: Number(e.target.value) })}
                      className="w-full px-3 py-1.5 bg-background border border-border rounded-md"
                      min={1}
                      max={999}
                    />
                  </div>
                  <div>
                    <label className="text-muted-foreground block mb-1">平均技能値 (%)</label>
                    <input
                      type="number"
                      value={simConfig.defaultSkillValue}
                      onChange={(e) =>
                        setSimConfig({ ...simConfig, defaultSkillValue: Number(e.target.value) })
                      }
                      className="w-full px-3 py-1.5 bg-background border border-border rounded-md"
                      min={1}
                      max={100}
                    />
                  </div>
                  <div>
                    <label className="text-muted-foreground block mb-1">ダイス・ストック数 (枠)</label>
                    <input
                      type="number"
                      value={simConfig.diceStockCount}
                      onChange={(e) =>
                        setSimConfig({ ...simConfig, diceStockCount: Number(e.target.value) })
                      }
                      className="w-full px-3 py-1.5 bg-background border border-border rounded-md"
                      min={0}
                      max={10}
                    />
                  </div>
                  <div>
                    <label className="text-muted-foreground block mb-1">目標セッション時間 (分)</label>
                    <input
                      type="number"
                      value={simConfig.targetSessionMinutes}
                      onChange={(e) =>
                        setSimConfig({ ...simConfig, targetSessionMinutes: Number(e.target.value) })
                      }
                      className="w-full px-3 py-1.5 bg-background border border-border rounded-md"
                      min={30}
                      max={600}
                    />
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleRunSimulation}
                    disabled={isSimulating}
                    className="flex items-center gap-2 px-5 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 transition-all shadow-md"
                  >
                    {isSimulating ? (
                      <>
                        <RotateCcw size={14} className="animate-spin" />
                        シミュレーション計算中...
                      </>
                    ) : (
                      <>
                        <Play size={14} />
                        シミュレーションを実行 ({simConfig.runs}回)
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Simulation Results */}
              {simResult && (
                <div className="space-y-6">
                  {/* Heatmap Overlay Action Banner */}
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                    <div className="flex items-center gap-2.5 text-xs text-emerald-950 dark:text-emerald-200">
                      <Flame size={20} className="text-amber-500 shrink-0" />
                      <div>
                        <div className="font-bold text-sm">キャンバス・ヒートマップ重畳表示</div>
                        <div className="text-[11px] opacity-85">エッジ通過率・ボトルネック・ロスト集中度をフローチャート上にカラー表示します。</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSimulationOverlay({ active: true, result: simResult });
                        onClose();
                      }}
                      className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
                    >
                      <span>キャンバスで確認</span>
                      <ExternalLink size={13} />
                    </button>
                  </div>

                  {/* Metric Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 rounded-xl bg-card border border-border">
                      <div className="text-xs text-muted-foreground">全滅率 (Party Lost)</div>
                      <div className="text-2xl font-bold mt-1 text-destructive">
                        {(simResult.lostRate * 100).toFixed(1)}%
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        全滅: {simResult.lostRuns}回 / 完走: {simResult.completedRuns}回
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-card border border-border">
                      <div className="text-xs text-muted-foreground">平均想定プレイ時間</div>
                      <div className="text-2xl font-bold mt-1 text-primary">
                        {simResult.averagePlayTimeMinutes} 分
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        中央値: {simResult.playTimePercentiles.p50}分 (90%: {simResult.playTimePercentiles.p90}分)
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-card border border-border">
                      <div className="text-xs text-muted-foreground">{systemConfig.crisisLabel} 発生頻度</div>
                      <div className="text-2xl font-bold mt-1 text-amber-500">
                        {simResult.insanityOccurrences} 回
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        試行あたりの平均: {(simResult.insanityOccurrences / simResult.totalRuns).toFixed(2)}回
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-card border border-border">
                      <div className="text-xs text-muted-foreground">目標時間内完了率</div>
                      <div className="text-2xl font-bold mt-1 text-emerald-500">
                        {simResult.timeDistribution.percentUnderTarget}%
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {simResult.timeDistribution.targetMinutes}分以内に終了
                      </div>
                    </div>
                  </div>

                  {/* SAN / Resource by Chapter */}
                  {Object.keys(simResult.averageSanByChapter).length > 0 && (
                    <div className="p-4 rounded-lg bg-card border border-border">
                      <h4 className="text-xs font-semibold text-muted-foreground mb-3">章ごとの平均残存{systemConfig.resourceName}推移</h4>
                      <div className="flex items-end gap-4 h-28 pt-4">
                        {Object.entries(simResult.averageSanByChapter).map(([ch, san]) => (
                          <div key={ch} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                            <span className="text-[10px] font-semibold text-foreground">{san}</span>
                            <div
                              className="w-full max-w-[40px] bg-primary/80 rounded-t transition-all"
                              style={{ height: `${Math.max(8, (san / (simConfig.initialSan || 50)) * 100)}%` }}
                            />
                            <span className="text-[10px] text-muted-foreground">第{ch}章</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Dangerous Nodes (Lost Counts) */}
                  {Object.keys(simResult.nodeLostCounts).length > 0 && (
                    <div className="p-4 rounded-lg bg-card border border-border">
                      <h4 className="text-xs font-semibold text-muted-foreground mb-2">全滅・脱落発生ノード</h4>
                      <div className="space-y-1.5 text-xs">
                        {Object.entries(simResult.nodeLostCounts).map(([nodeId, count]) => {
                          const n = targetNodes.find((x) => x.id === nodeId);
                          return (
                            <div key={nodeId} className="flex items-center justify-between p-2 rounded bg-muted/30">
                              <span>{n?.data.label || nodeId}</span>
                              <span className="font-semibold text-destructive">{count} 回全滅</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'export' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold">完全統一フォーマット (scenario_body.md)</h3>
                  <p className="text-xs text-muted-foreground">
                    意味論的括弧体系（【アイテム】、［場所］、《探索点》、〈技能〉、〔マスタリング指示〕、&gt; 描写）に準拠したMarkdownを出力します。
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyMarkdown}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border bg-background hover:bg-accent text-foreground transition-colors"
                  >
                    {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                    {copied ? 'コピー済み' : 'コピー'}
                  </button>
                  <button
                    onClick={handleDownloadMarkdown}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
                  >
                    <Download size={14} />
                    ダウンロード (.md)
                  </button>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-muted/40 p-4 max-h-[50vh] overflow-y-auto font-mono text-xs whitespace-pre-wrap selection:bg-primary/20">
                {exportedMarkdown}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
