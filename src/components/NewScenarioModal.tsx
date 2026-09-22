import React, { useState } from 'react';
import { X, Sparkles, AlertCircle, HelpCircle } from 'lucide-react';
import type { SystemConfig, SupportedSystemId } from '../types';
import { DEFAULT_SYSTEM_PRESETS } from '../types';
import { useScenarioStore } from '../store/scenarioStore';
import { toast } from './common/toast';

interface NewScenarioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

export const NewScenarioModal: React.FC<NewScenarioModalProps> = ({ isOpen, onClose, onCreated }) => {
  const createNewScenario = useScenarioStore((s) => s.createNewScenario);
  const [title, setTitle] = useState('');
  const [selectedSystemId, setSelectedSystemId] = useState<SupportedSystemId>('coc');
  const [customConfig, setCustomConfig] = useState<SystemConfig>({
    ...DEFAULT_SYSTEM_PRESETS.custom,
    name: 'カスタムシステム',
    resourceName: '特殊リソース',
    checkLabel: '特殊判定',
    successLossLabel: '成功時減少',
    failLossLabel: '失敗時減少',
    crisisLabel: '限界状態',
    defaultInitialResource: 50,
  });

  if (!isOpen) return null;

  const presets = Object.values(DEFAULT_SYSTEM_PRESETS);

  const handleCreate = () => {
    const finalTitle = title.trim() || '新規シナリオ';
    const finalSystem = selectedSystemId === 'custom'
      ? { ...customConfig, id: 'custom' as const }
      : DEFAULT_SYSTEM_PRESETS[selectedSystemId];

    createNewScenario(finalTitle, finalSystem);
    toast.success(`シナリオ「${finalTitle}」(${finalSystem.name}) を新規作成しました`);
    if (onCreated) onCreated();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl bg-card border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Sparkles size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">新規シナリオ作成 (New Scenario)</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                執筆するTRPGシステムとシナリオタイトルを選択してください
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Scenario Title */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              シナリオタイトル (Scenario Title)
            </label>
            <input
              type="text"
              placeholder="例: 不確定性器官の拍動、深淵の呼び声"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all placeholder:text-muted-foreground/60"
              autoFocus
            />
          </div>

          {/* TRPG System Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-foreground">
                TRPGシステム選択 (Game System) <span className="text-destructive">*必須</span>
              </label>
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <HelpCircle size={12} />
                後からいつでも設定変更できます
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {presets.map((preset) => {
                const isSelected = selectedSystemId === preset.id;
                return (
                  <div
                    key={preset.id}
                    onClick={() => setSelectedSystemId(preset.id)}
                    className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'border-primary bg-primary/5 ring-2 ring-primary/20 shadow-sm'
                        : 'border-border bg-card/60 hover:border-primary/40 hover:bg-accent/40'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xl shrink-0">{preset.icon}</span>
                        <div className="font-semibold text-sm text-foreground">{preset.name}</div>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">
                        {preset.description}
                      </p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-border/50 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                      <span>判定: <strong className="text-foreground">{preset.checkLabel}</strong></span>
                      <span>リソース: <strong className="text-foreground">{preset.resourceName}</strong></span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Custom System Fields (if selected) */}
          {selectedSystemId === 'custom' && (
            <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-3 animate-fade-in">
              <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <span>⚙️</span>
                <span>カスタム用語・リソース設定</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-muted-foreground block mb-1">システム表示名</label>
                  <input
                    type="text"
                    value={customConfig.name}
                    onChange={(e) => setCustomConfig({ ...customConfig, name: e.target.value })}
                    className="w-full px-3 py-1.5 bg-background border border-border rounded-md"
                  />
                </div>
                <div>
                  <label className="text-muted-foreground block mb-1">判定名 (Check Label)</label>
                  <input
                    type="text"
                    value={customConfig.checkLabel}
                    onChange={(e) => setCustomConfig({ ...customConfig, checkLabel: e.target.value })}
                    className="w-full px-3 py-1.5 bg-background border border-border rounded-md"
                    placeholder="例: 精神判定、意志セーヴ"
                  />
                </div>
                <div>
                  <label className="text-muted-foreground block mb-1">対象リソース名 (Resource)</label>
                  <input
                    type="text"
                    value={customConfig.resourceName}
                    onChange={(e) => setCustomConfig({ ...customConfig, resourceName: e.target.value })}
                    className="w-full px-3 py-1.5 bg-background border border-border rounded-md"
                    placeholder="例: MP, 精神力, 耐久値"
                  />
                </div>
                <div>
                  <label className="text-muted-foreground block mb-1">危機状態名 (Crisis State)</label>
                  <input
                    type="text"
                    value={customConfig.crisisLabel}
                    onChange={(e) => setCustomConfig({ ...customConfig, crisisLabel: e.target.value })}
                    className="w-full px-3 py-1.5 bg-background border border-border rounded-md"
                    placeholder="例: 行動不能、気絶、暴走"
                  />
                </div>
                <div>
                  <label className="text-muted-foreground block mb-1">成功時減少ラベル</label>
                  <input
                    type="text"
                    value={customConfig.successLossLabel}
                    onChange={(e) => setCustomConfig({ ...customConfig, successLossLabel: e.target.value })}
                    className="w-full px-3 py-1.5 bg-background border border-border rounded-md"
                  />
                </div>
                <div>
                  <label className="text-muted-foreground block mb-1">失敗時減少ラベル</label>
                  <input
                    type="text"
                    value={customConfig.failLossLabel}
                    onChange={(e) => setCustomConfig({ ...customConfig, failLossLabel: e.target.value })}
                    className="w-full px-3 py-1.5 bg-background border border-border rounded-md"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Warning Notice */}
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-600 dark:text-amber-400">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>
              新規作成を実行すると、現在のキャンバス内容はリセットされます。未保存の変更がある場合は、事前に「ファイル → 保存」を行ってください。
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-muted/30">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleCreate}
            className="px-5 py-2 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg shadow transition-all flex items-center gap-1.5"
          >
            <Sparkles size={14} />
            <span>シナリオを作成</span>
          </button>
        </div>
      </div>
    </div>
  );
};
