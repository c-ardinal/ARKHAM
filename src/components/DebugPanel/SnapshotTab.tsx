import React, { useState } from 'react';
import { Camera, Trash2, Download, AlertTriangle, GitCompare } from 'lucide-react';
import { useDebugStore } from '../../store/debugStore';
import { useScenarioStore } from '../../store/scenarioStore';
import type { ExportConfig, StateSnapshot } from '../../types/debug';

// 差分計算関数
const calculateDiff = (snapshot1: StateSnapshot, snapshot2: StateSnapshot) => {
  const diff = {
    nodes: {
      added: snapshot2.nodes.filter(n2 => !snapshot1.nodes.find(n1 => n1.id === n2.id)),
      removed: snapshot1.nodes.filter(n1 => !snapshot2.nodes.find(n2 => n2.id === n1.id)),
      modified: snapshot2.nodes.filter(n2 => {
        const n1 = snapshot1.nodes.find(n => n.id === n2.id);
        return n1 && JSON.stringify(n1) !== JSON.stringify(n2);
      }),
    },
    edges: {
      added: snapshot2.edges.filter(e2 => !snapshot1.edges.find(e1 => e1.id === e2.id)),
      removed: snapshot1.edges.filter(e1 => !snapshot2.edges.find(e2 => e2.id === e1.id)),
    },
    characters: {
      added: snapshot2.characters.filter(c2 => !snapshot1.characters.find(c1 => c1.id === c2.id)),
      removed: snapshot1.characters.filter(c1 => !snapshot2.characters.find(c2 => c2.id === c1.id)),
      modified: snapshot2.characters.filter(c2 => {
        const c1 = snapshot1.characters.find(c => c.id === c2.id);
        return c1 && JSON.stringify(c1) !== JSON.stringify(c2);
      }),
    },
    resources: {
      added: snapshot2.resources.filter(r2 => !snapshot1.resources.find(r1 => r1.id === r2.id)),
      removed: snapshot1.resources.filter(r1 => !snapshot2.resources.find(r2 => r2.id === r1.id)),
      modified: snapshot2.resources.filter(r2 => {
        const r1 = snapshot1.resources.find(r => r.id === r2.id);
        return r1 && JSON.stringify(r1) !== JSON.stringify(r2);
      }),
    },
    mode: snapshot1.mode !== snapshot2.mode ? { from: snapshot1.mode, to: snapshot2.mode } : null,
  };
  return diff;
};

export const SnapshotTab: React.FC = () => {
  const { 
    snapshots, 
    createSnapshot, 
    deleteSnapshot, 
    exportSnapshot,
    snapshotCompareMode,
    snapshotSelectedIds,
    snapshotDetailView,
    setSnapshotCompareMode,
    toggleSnapshotSelection,
    setSnapshotDetailView,
    clearSnapshotSelection,
    resetSnapshotSelection
  } = useDebugStore();
  const scenarioState = useScenarioStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [exportConfig, setExportConfig] = useState<ExportConfig>({
    includeNodes: true,
    includeGameState: true,
    includeCharacters: true,
    includeResources: true,
    includeViewport: true,
    includeLocalStorage: false,
  });

  const handleCreateSnapshot = () => {
    createSnapshot({
      nodes: scenarioState.nodes,
      edges: scenarioState.edges,
      gameState: scenarioState.gameState,
      characters: scenarioState.characters,
      resources: scenarioState.resources,
      viewport: null, // TODO: 実際のビューポート情報を取得
      mode: scenarioState.mode,
    });
  };

  const handleExport = (snapshotId: string) => {
    setExportingId(snapshotId);
  };

  const confirmExport = () => {
    if (!exportingId) return;
    exportSnapshot(exportingId, exportConfig);
    setExportingId(null);
  };

  const toggleCompareMode = () => {
    if (snapshotCompareMode) {
      resetSnapshotSelection();
    } else {
      setSnapshotCompareMode(true);
      clearSnapshotSelection();
    }
  };

  const formatTimestamp = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  // 詳細表示を開く
  const openDetailView = (
    type: 'node' | 'edge' | 'character' | 'resource',
    item1: any,
    item2: any | null,
    action: 'added' | 'removed' | 'modified'
  ) => {
    setSnapshotDetailView({ type, item1, item2, action });
  };

  // JSON差分をハイライト表示
  const renderJsonDiff = (json1: any, json2: any) => {
    const lines1 = JSON.stringify(json1, null, 2).split('\n');
    const lines2 = JSON.stringify(json2, null, 2).split('\n');
    const maxLines = Math.max(lines1.length, lines2.length);

    const result1: React.ReactElement[] = [];
    const result2: React.ReactElement[] = [];

    for (let i = 0; i < maxLines; i++) {
      const line1 = lines1[i] || '';
      const line2 = lines2[i] || '';
      const isDifferent = line1 !== line2;

      result1.push(
        <div
          key={i}
          className={`${isDifferent ? 'bg-red-500/20' : ''} px-2`}
        >
          {line1 || '\u00A0'}
        </div>
      );

      result2.push(
        <div
          key={i}
          className={`${isDifferent ? 'bg-green-500/20' : ''} px-2`}
        >
          {line2 || '\u00A0'}
        </div>
      );
    }

    return { left: result1, right: result2 };
  };



  return (
    <div className="flex flex-col h-full">
      {/* 詳細表示モード */}
      {snapshotDetailView ? (
        <div className="flex flex-col h-full">
          {/* ヘッダー */}
          <div className="p-3 border-b border-border bg-background">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className={`font-bold ${
                  snapshotDetailView.action === 'added' ? 'text-green-500' :
                  snapshotDetailView.action === 'removed' ? 'text-red-500' :
                  'text-yellow-500'
                }`}>
                  {snapshotDetailView.action === 'added' ? '+ 追加' :
                   snapshotDetailView.action === 'removed' ? '- 削除' :
                   '~ 変更'}
                </span>
                <span className="text-muted-foreground text-sm">
                  ({snapshotDetailView.type === 'node' ? 'ノード' :
                    snapshotDetailView.type === 'edge' ? 'エッジ' :
                    snapshotDetailView.type === 'character' ? 'キャラクター' :
                    'リソース'})
                </span>
              </div>
              <button
                onClick={() => setSnapshotDetailView(null)}
                className="px-3 py-1 text-sm bg-secondary hover:bg-secondary/80 rounded"
              >
                戻る
              </button>
            </div>
          </div>

          {/* 内容 */}
          <div className="flex-1 overflow-auto p-3">
            {snapshotDetailView.action === 'modified' ? (
              (() => {
                const diff = renderJsonDiff(snapshotDetailView.item1, snapshotDetailView.item2);
                return (
                  <div className="grid grid-cols-2 gap-3 h-full">
                    {/* 変更前 */}
                    <div className="flex flex-col">
                      <div className="font-bold text-xs mb-2 text-muted-foreground">変更前 (古い)</div>
                      <div className="flex-1 text-xs font-mono bg-muted rounded overflow-auto">
                        {diff.left}
                      </div>
                    </div>
                    {/* 変更後 */}
                    <div className="flex flex-col">
                      <div className="font-bold text-xs mb-2 text-muted-foreground">変更後 (新しい)</div>
                      <div className="flex-1 text-xs font-mono bg-muted rounded overflow-auto">
                        {diff.right}
                      </div>
                    </div>
                  </div>
                );
              })()
            ) : (
              <div>
                <div className="font-bold text-xs mb-2 text-muted-foreground">
                  {snapshotDetailView.action === 'added' ? '追加された内容' : '削除された内容'}
                </div>
                <pre className="text-xs font-mono bg-muted p-3 rounded overflow-auto">
                  {JSON.stringify(snapshotDetailView.item1, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      ) : snapshotSelectedIds.length === 2 ? (
        /* 差分表示モード */
        (() => {
          const snap1 = snapshots.find(s => s.id === snapshotSelectedIds[0]);
          const snap2 = snapshots.find(s => s.id === snapshotSelectedIds[1]);
          
          if (!snap1 || !snap2) return null;

          const diff = calculateDiff(snap1, snap2);
          const hasChanges = 
            diff.nodes.added.length > 0 || diff.nodes.removed.length > 0 || diff.nodes.modified.length > 0 ||
            diff.edges.added.length > 0 || diff.edges.removed.length > 0 ||
            diff.characters.added.length > 0 || diff.characters.removed.length > 0 || diff.characters.modified.length > 0 ||
            diff.resources.added.length > 0 || diff.resources.removed.length > 0 || diff.resources.modified.length > 0 ||
            diff.mode !== null;

          return (
            <div className="flex flex-col h-full">
              {/* ヘッダー */}
              <div className="p-3 border-b border-border bg-background">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <GitCompare size={18} className="text-primary" />
                    <h3 className="font-bold text-sm">スナップショット差分</h3>
                  </div>
                  <button
                    onClick={clearSnapshotSelection}
                    className="px-3 py-1 text-sm bg-secondary hover:bg-secondary/80 rounded"
                  >
                    比較終了
                  </button>
                </div>

                {/* 比較元・比較先 */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="font-bold text-muted-foreground mb-1">比較元 (古い)</div>
                    <div className="font-mono">{formatTimestamp(snap1.timestamp)}</div>
                  </div>
                  <div>
                    <div className="font-bold text-muted-foreground mb-1">比較先 (新しい)</div>
                    <div className="font-mono">{formatTimestamp(snap2.timestamp)}</div>
                  </div>
                </div>
              </div>

              {/* 差分内容 */}
              <div className="flex-1 overflow-auto p-3 space-y-3">
                {!hasChanges ? (
                  <div className="text-center text-muted-foreground py-8 text-sm">
                    変更はありません
                  </div>
                ) : (
                  <>
                    {/* ノード */}
                    {(diff.nodes.added.length > 0 || diff.nodes.removed.length > 0 || diff.nodes.modified.length > 0) && (
                      <div className="bg-card border border-border rounded-lg p-3">
                        <h4 className="font-bold text-sm mb-2">ノード</h4>
                        <div className="space-y-2 text-xs">
                          {diff.nodes.added.length > 0 && (
                            <div>
                              <div className="text-green-500 font-bold mb-1">+ 追加 ({diff.nodes.added.length}件)</div>
                              <div className="space-y-1 ml-4">
                                {diff.nodes.added.map((n, idx) => (
                                  <button
                                    key={idx}
                                    onClick={() => openDetailView('node', n, null, 'added')}
                                    className="block w-full text-left px-2 py-1 hover:bg-green-500/10 rounded transition-colors"
                                  >
                                    {n.id}{n.data?.label ? ` / ${n.data.label}` : ''}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                          {diff.nodes.removed.length > 0 && (
                            <div>
                              <div className="text-red-500 font-bold mb-1">- 削除 ({diff.nodes.removed.length}件)</div>
                              <div className="space-y-1 ml-4">
                                {diff.nodes.removed.map((n, idx) => (
                                  <button
                                    key={idx}
                                    onClick={() => openDetailView('node', n, null, 'removed')}
                                    className="block w-full text-left px-2 py-1 hover:bg-red-500/10 rounded transition-colors"
                                  >
                                    {n.id}{n.data?.label ? ` / ${n.data.label}` : ''}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                          {diff.nodes.modified.length > 0 && (
                            <div>
                              <div className="text-yellow-500 font-bold mb-1">~ 変更 ({diff.nodes.modified.length}件)</div>
                              <div className="space-y-1 ml-4">
                                {diff.nodes.modified.map((n, idx) => {
                                  const oldNode = snap1.nodes.find(n1 => n1.id === n.id);
                                  return (
                                    <button
                                      key={idx}
                                      onClick={() => openDetailView('node', oldNode, n, 'modified')}
                                      className="block w-full text-left px-2 py-1 hover:bg-yellow-500/10 rounded transition-colors"
                                    >
                                      {n.id}{n.data?.label ? ` / ${n.data.label}` : ''}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* エッジ */}
                    {(diff.edges.added.length > 0 || diff.edges.removed.length > 0) && (
                      <div className="bg-card border border-border rounded-lg p-3">
                        <h4 className="font-bold text-sm mb-2">エッジ</h4>
                        <div className="space-y-2 text-xs">
                          {diff.edges.added.length > 0 && (
                            <div className="flex items-start gap-2">
                              <span className="text-green-500 font-bold shrink-0">+ 追加:</span>
                              <span>{diff.edges.added.length}件</span>
                            </div>
                          )}
                          {diff.edges.removed.length > 0 && (
                            <div className="flex items-start gap-2">
                              <span className="text-red-500 font-bold shrink-0">- 削除:</span>
                              <span>{diff.edges.removed.length}件</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* キャラクター */}
                    {(diff.characters.added.length > 0 || diff.characters.removed.length > 0 || diff.characters.modified.length > 0) && (
                      <div className="bg-card border border-border rounded-lg p-3">
                        <h4 className="font-bold text-sm mb-2">キャラクター</h4>
                        <div className="space-y-2 text-xs">
                          {diff.characters.added.length > 0 && (
                            <div className="flex items-start gap-2">
                              <span className="text-green-500 font-bold shrink-0">+ 追加:</span>
                              <span>{diff.characters.added.length}件 ({diff.characters.added.map(c => `${c.id} / ${c.name}`).join(', ')})</span>
                            </div>
                          )}
                          {diff.characters.removed.length > 0 && (
                            <div className="flex items-start gap-2">
                              <span className="text-red-500 font-bold shrink-0">- 削除:</span>
                              <span>{diff.characters.removed.length}件 ({diff.characters.removed.map(c => `${c.id} / ${c.name}`).join(', ')})</span>
                            </div>
                          )}
                          {diff.characters.modified.length > 0 && (
                            <div className="flex items-start gap-2">
                              <span className="text-yellow-500 font-bold shrink-0">~ 変更:</span>
                              <span>{diff.characters.modified.length}件 ({diff.characters.modified.map(c => `${c.id} / ${c.name}`).join(', ')})</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* リソース */}
                    {(diff.resources.added.length > 0 || diff.resources.removed.length > 0 || diff.resources.modified.length > 0) && (
                      <div className="bg-card border border-border rounded-lg p-3">
                        <h4 className="font-bold text-sm mb-2">リソース</h4>
                        <div className="space-y-2 text-xs">
                          {diff.resources.added.length > 0 && (
                            <div className="flex items-start gap-2">
                              <span className="text-green-500 font-bold shrink-0">+ 追加:</span>
                              <span>{diff.resources.added.length}件 ({diff.resources.added.map(r => `${r.id} / ${r.name}`).join(', ')})</span>
                            </div>
                          )}
                          {diff.resources.removed.length > 0 && (
                            <div className="flex items-start gap-2">
                              <span className="text-red-500 font-bold shrink-0">- 削除:</span>
                              <span>{diff.resources.removed.length}件 ({diff.resources.removed.map(r => `${r.id} / ${r.name}`).join(', ')})</span>
                            </div>
                          )}
                          {diff.resources.modified.length > 0 && (
                            <div className="flex items-start gap-2">
                              <span className="text-yellow-500 font-bold shrink-0">~ 変更:</span>
                              <span>{diff.resources.modified.length}件 ({diff.resources.modified.map(r => `${r.id} / ${r.name}`).join(', ')})</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* モード */}
                    {diff.mode && (
                      <div className="bg-card border border-border rounded-lg p-3">
                        <h4 className="font-bold text-sm mb-2">モード</h4>
                        <div className="text-xs">
                          <span className="text-yellow-500 font-bold">~ 変更:</span>{' '}
                          {diff.mode.from === 'edit' ? '編集' : 'プレイ'} → {diff.mode.to === 'edit' ? '編集' : 'プレイ'}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })()
      ) : (
        /* スナップショット一覧モード */
        <>
          {/* アクションバー */}
          <div className="p-3 border-b border-border bg-background space-y-2">
        <button
          onClick={handleCreateSnapshot}
          className="w-full px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded flex items-center justify-center gap-2 transition-colors"
        >
          <Camera size={16} />
          スナップショット作成
        </button>
        <button
          onClick={toggleCompareMode}
          className={`w-full px-4 py-2 rounded flex items-center justify-center gap-2 transition-colors ${
            snapshotCompareMode
              ? 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              : 'bg-muted hover:bg-muted/80'
          }`}
        >
          <GitCompare size={16} />
          {snapshotCompareMode ? '比較モード終了' : '差分比較'}
        </button>
        <div className="text-xs text-muted-foreground text-center">
          最大{snapshots.length}/10件保存
          {snapshotCompareMode && snapshotSelectedIds.length > 0 && (
            <span className="ml-2">({snapshotSelectedIds.length}/2件選択中)</span>
          )}
        </div>
      </div>

      {/* スナップショット一覧 */}
      <div className="flex-1 overflow-auto p-3 space-y-2">
        {snapshots.length === 0 ? (
          <div className="text-center text-muted-foreground py-8 text-sm">
            スナップショットがありません
          </div>
        ) : (
          snapshots.map((snapshot) => (
            <div 
              key={snapshot.id} 
              className={`bg-card border rounded-lg overflow-hidden transition-colors ${
                snapshotCompareMode && snapshotSelectedIds.includes(snapshot.id)
                  ? 'border-primary bg-primary/10'
                  : 'border-border'
              }`}
            >
              {/* ヘッダー */}
              <div className="p-3 bg-muted/30">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    {snapshotCompareMode && (
                      <label className="flex items-center gap-2 mb-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={snapshotSelectedIds.includes(snapshot.id)}
                          onChange={() => toggleSnapshotSelection(snapshot.id)}
                          disabled={!snapshotSelectedIds.includes(snapshot.id) && snapshotSelectedIds.length >= 2}
                          className="rounded"
                        />
                        <span className="text-xs font-bold">比較対象に選択</span>
                      </label>
                    )}
                    <div className="font-mono text-xs text-muted-foreground">
                      {formatTimestamp(snapshot.timestamp)}
                    </div>
                    <div className="text-sm mt-1 space-y-0.5">
                      <div>ノード: {snapshot.nodes.length}件</div>
                      <div>エッジ: {snapshot.edges.length}件</div>
                      <div>モード: {snapshot.mode === 'edit' ? '編集' : 'プレイ'}</div>
                    </div>
                  </div>
                  {!snapshotCompareMode && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => setExpandedId(expandedId === snapshot.id ? null : snapshot.id)}
                        className="px-2 py-1 text-xs bg-secondary hover:bg-secondary/80 rounded"
                      >
                        {expandedId === snapshot.id ? '閉じる' : '詳細'}
                      </button>
                      <button
                        onClick={() => handleExport(snapshot.id)}
                        className="p-1 hover:bg-accent rounded transition-colors"
                        title="エクスポート"
                      >
                        <Download size={14} />
                      </button>
                      <button
                        onClick={() => deleteSnapshot(snapshot.id)}
                        className="p-1 hover:bg-destructive/20 hover:text-destructive rounded transition-colors"
                        title="削除"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* 詳細表示 */}
              {expandedId === snapshot.id && !snapshotCompareMode && (
                <div className="p-3 border-t border-border">
                  <pre className="text-xs font-mono bg-background p-2 rounded overflow-auto max-h-64">
                    {JSON.stringify(snapshot, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ))
        )}
      </div>



      {/* エクスポート確認ダイアログ */}
      {exportingId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[300]">
          <div className="bg-card border border-border rounded-lg shadow-2xl w-[90vw] max-w-md">
            <div className="p-4 border-b border-border">
              <div className="flex items-center gap-2 text-yellow-500 mb-2">
                <AlertTriangle size={20} />
                <h3 className="font-bold">警告</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                エクスポートされるデータには、シナリオの内容や設定情報が含まれます。
                このファイルを第三者と共有する際は、機密情報が含まれていないか確認してください。
              </p>
            </div>

            <div className="p-4 space-y-3">
              <div className="text-sm font-bold mb-2">エクスポートする内容を選択:</div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={exportConfig.includeNodes}
                  onChange={(e) => setExportConfig({ ...exportConfig, includeNodes: e.target.checked })}
                  className="rounded"
                />
                ノード・エッジ
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={exportConfig.includeGameState}
                  onChange={(e) => setExportConfig({ ...exportConfig, includeGameState: e.target.checked })}
                  className="rounded"
                />
                ゲーム状態
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={exportConfig.includeCharacters}
                  onChange={(e) => setExportConfig({ ...exportConfig, includeCharacters: e.target.checked })}
                  className="rounded"
                />
                キャラクター
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={exportConfig.includeResources}
                  onChange={(e) => setExportConfig({ ...exportConfig, includeResources: e.target.checked })}
                  className="rounded"
                />
                リソース
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={exportConfig.includeViewport}
                  onChange={(e) => setExportConfig({ ...exportConfig, includeViewport: e.target.checked })}
                  className="rounded"
                />
                ビューポート
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={exportConfig.includeLocalStorage}
                  onChange={(e) => setExportConfig({ ...exportConfig, includeLocalStorage: e.target.checked })}
                  className="rounded"
                />
                LocalStorage (キー名のみ)
              </label>
            </div>

            <div className="p-4 border-t border-border flex gap-2 justify-end">
              <button
                onClick={() => setExportingId(null)}
                className="px-4 py-2 bg-muted hover:bg-muted/80 rounded text-sm"
              >
                キャンセル
              </button>
              <button
                onClick={confirmExport}
                className="px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded text-sm"
              >
                エクスポート実行
              </button>
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
};
