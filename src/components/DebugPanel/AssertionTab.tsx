import React, { useState } from 'react';
import { Play, CheckCircle, XCircle, AlertCircle, Info, Plus, Trash2 } from 'lucide-react';
import { useDebugStore } from '../../store/debugStore';
import { useScenarioStore } from '../../store/scenarioStore';

export const AssertionTab: React.FC = () => {
  const { 
    assertionRules, 
    assertionResults, 
    runAssertions,
    addAssertionRule,
    deleteAssertionRule,
    toggleAssertionRule
  } = useDebugStore();
  const scenarioState = useScenarioStore();
  const [isAddingMode, setIsAddingMode] = useState(false);
  const [newRule, setNewRule] = useState({
    name: '',
    description: '',
    severity: 'warning' as 'info' | 'warning' | 'error',
    conditionCode: 'return true;'
  });

  const handleAddRule = () => {
    if (!newRule.name || !newRule.conditionCode) return;
    addAssertionRule({
      name: newRule.name,
      description: newRule.description,
      severity: newRule.severity,
      conditionCode: newRule.conditionCode
    });
    setIsAddingMode(false);
    setNewRule({
      name: '',
      description: '',
      severity: 'warning',
      conditionCode: 'return true;'
    });
  };

  const handleRunAssertions = () => {
    runAssertions(scenarioState);
  };

  const getSeverityIcon = (severity: 'info' | 'warning' | 'error') => {
    switch (severity) {
      case 'error':
        return <XCircle size={16} className="text-red-500" />;
      case 'warning':
        return <AlertCircle size={16} className="text-yellow-500" />;
      case 'info':
        return <Info size={16} className="text-blue-500" />;
    }
  };

  const getSeverityColor = (severity: 'info' | 'warning' | 'error') => {
    switch (severity) {
      case 'error':
        return 'border-red-500/50 bg-red-500/10';
      case 'warning':
        return 'border-yellow-500/50 bg-yellow-500/10';
      case 'info':
        return 'border-blue-500/50 bg-blue-500/10';
    }
  };

  const passedCount = assertionResults.filter(r => r.passed).length;
  const failedCount = assertionResults.filter(r => !r.passed).length;

  return (
    <div className="flex flex-col h-full">
      {/* アクションバー */}
      <div className="p-3 border-b border-border bg-background">
        <button
          onClick={handleRunAssertions}
          className="w-full px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded flex items-center justify-center gap-2 transition-colors"
        >
          <Play size={16} />
          アサーション実行
        </button>

        <button
          onClick={() => setIsAddingMode(!isAddingMode)}
          className="w-full mt-2 px-4 py-2 bg-secondary hover:bg-secondary/80 text-sm rounded flex items-center justify-center gap-2"
        >
          <Plus size={16} />
          {isAddingMode ? 'キャンセル' : 'カスタムルールを追加'}
        </button>
        
        {isAddingMode && (
          <div className="mt-2 p-3 bg-muted rounded space-y-3 border border-border">
            <div>
              <label className="text-xs font-bold block mb-1">ルール名</label>
              <input
                type="text"
                value={newRule.name}
                onChange={(e) => setNewRule({...newRule, name: e.target.value})}
                className="w-full px-2 py-1 text-sm rounded border bg-background"
                placeholder="例: ノード数制限チェック"
              />
            </div>
            <div>
              <label className="text-xs font-bold block mb-1">説明</label>
              <input
                type="text"
                value={newRule.description}
                onChange={(e) => setNewRule({...newRule, description: e.target.value})}
                className="w-full px-2 py-1 text-sm rounded border bg-background"
                placeholder="説明文..."
              />
            </div>
            <div>
              <label className="text-xs font-bold block mb-1">重要度</label>
              <select
                value={newRule.severity}
                onChange={(e) => setNewRule({...newRule, severity: e.target.value as any})}
                className="w-full px-2 py-1 text-sm rounded border bg-background"
              >
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="error">Error</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold block mb-1">条件式 (JavaScript)</label>
              <div className="text-xs text-muted-foreground mb-1">
                引数 <code>state</code> を受け取り boolean を返す関数の本体
              </div>
              <textarea
                value={newRule.conditionCode}
                onChange={(e) => setNewRule({...newRule, conditionCode: e.target.value})}
                className="w-full px-2 py-1 text-sm rounded border bg-background font-mono h-24"
                spellCheck={false}
              />
            </div>
            <button
               onClick={handleAddRule}
               disabled={!newRule.name || !newRule.conditionCode}
               className="w-full px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded text-sm disabled:opacity-50"
            >
              ルールを追加
            </button>
          </div>
        )}

        {assertionResults.length > 0 && (
          <div className="mt-2 flex items-center justify-center gap-4 text-xs">
            <div className="flex items-center gap-1 text-green-500">
              <CheckCircle size={14} />
              成功: {passedCount}
            </div>
            <div className="flex items-center gap-1 text-red-500">
              <XCircle size={14} />
              失敗: {failedCount}
            </div>
          </div>
        )}
      </div>

      {/* ルール一覧 */}
      <div className="flex-1 overflow-auto">
        {/* アサーション結果 */}
        {assertionResults.length > 0 && (
          <div className="p-3 border-b border-border bg-muted/30">
            <h3 className="text-sm font-bold mb-2">実行結果</h3>
            <div className="space-y-2">
              {assertionResults.map((result) => (
                <div
                  key={result.ruleId}
                  className={`p-3 border rounded-lg ${
                    result.passed
                      ? 'border-green-500/50 bg-green-500/10'
                      : getSeverityColor(result.severity)
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {result.passed ? (
                      <CheckCircle size={16} className="text-green-500 mt-0.5" />
                    ) : (
                      <div className="mt-0.5">{getSeverityIcon(result.severity)}</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{result.ruleName}</div>
                      <div className="text-xs text-muted-foreground mt-1">{result.message}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ルール定義 */}
        <div className="p-3">
          <h3 className="text-sm font-bold mb-2">アサーションルール</h3>
          <div className="space-y-2">
            {assertionRules.map((rule) => (
              <div
                key={rule.id}
                className="bg-card border border-border rounded-lg p-3"
              >
                <div className="flex items-start gap-2">
                  <div className="mt-0.5">{getSeverityIcon(rule.severity)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium">{rule.name}</span>
                      <button 
                        onClick={() => toggleAssertionRule(rule.id)}
                        className={`px-1.5 py-0.5 text-xs rounded transition-colors ${
                          rule.enabled ? 'bg-green-500/20 text-green-500 hover:bg-green-500/30' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        }`}
                      >
                        {rule.enabled ? '有効' : '無効'}
                      </button>
                    </div>
                    <div className="text-xs text-muted-foreground">{rule.description}</div>
                  </div>
                  <button
                    onClick={() => deleteAssertionRule(rule.id)}
                    className="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
                    title="削除"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 説明 */}
      <div className="p-3 border-t border-border bg-muted/30">
        <div className="text-xs text-muted-foreground">
          <p className="mb-1">アサーションは、シナリオの整合性を自動的にチェックします。</p>
          <p>ストア更新時に自動実行されますが、手動でも実行できます。</p>
        </div>
      </div>
    </div>
  );
};
