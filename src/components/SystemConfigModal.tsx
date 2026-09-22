import React, { useState, useEffect } from 'react';
import { X, Settings2, Check, RefreshCw } from 'lucide-react';
import type { SystemConfig } from '../types';
import { DEFAULT_SYSTEM_PRESETS } from '../types';
import { useScenarioStore } from '../store/scenarioStore';
import { toast } from './common/toast';

interface SystemConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SystemConfigModal: React.FC<SystemConfigModalProps> = ({ isOpen, onClose }) => {
  const currentSystemConfig = useScenarioStore((s) => s.systemConfig);
  const scenarioTitle = useScenarioStore((s) => s.scenarioTitle);
  const setSystemConfig = useScenarioStore((s) => s.setSystemConfig);
  const setScenarioTitle = useScenarioStore((s) => s.setScenarioTitle);

  const [title, setTitle] = useState(scenarioTitle);
  const [config, setConfig] = useState<SystemConfig>(currentSystemConfig);

  useEffect(() => {
    if (isOpen) {
      setTitle(scenarioTitle);
      setConfig(currentSystemConfig);
    }
  }, [isOpen, currentSystemConfig, scenarioTitle]);

  if (!isOpen) return null;

  const presets = Object.values(DEFAULT_SYSTEM_PRESETS);

  const handleApplyPreset = (preset: SystemConfig) => {
    setConfig({ ...preset });
  };

  const handleSave = () => {
    setScenarioTitle(title.trim() || '無題のシナリオ');
    setSystemConfig(config);
    toast.success(`システム設定を更新しました (${config.name})`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-xl bg-card border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Settings2 size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">TRPGシステム・シナリオ設定</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                執筆中シナリオのシステム用語や判定ラベルを設定・変更します
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              シナリオタイトル (Scenario Title)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          {/* Quick Preset Selector */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-2">
              システムプリセットから選択
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {presets.map((preset) => {
                const isActive = config.id === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleApplyPreset(preset)}
                    className={`px-3 py-2 rounded-lg border text-left text-xs transition-all flex items-center justify-between ${
                      isActive
                        ? 'border-primary bg-primary/10 text-primary font-semibold ring-1 ring-primary'
                        : 'border-border bg-background hover:bg-muted/60 text-foreground'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <span>{preset.icon}</span>
                      <span className="truncate">{preset.name.split(' ')[0]}</span>
                    </div>
                    {isActive && <Check size={14} className="shrink-0 text-primary" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Detailed Terminology Configuration */}
          <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-3.5">
            <div className="text-xs font-bold text-foreground flex items-center justify-between">
              <span>用語・判定ラベルの詳細設定</span>
              <button
                type="button"
                onClick={() => handleApplyPreset(DEFAULT_SYSTEM_PRESETS[config.id] || DEFAULT_SYSTEM_PRESETS.generic)}
                className="text-[11px] text-muted-foreground hover:text-primary flex items-center gap-1"
              >
                <RefreshCw size={11} />
                <span>プリセットの初期値に戻す</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-muted-foreground block mb-1">システム表示名</label>
                <input
                  type="text"
                  value={config.name}
                  onChange={(e) => setConfig({ ...config, name: e.target.value, id: 'custom' })}
                  className="w-full px-3 py-1.5 bg-background border border-border rounded-md"
                />
              </div>

              <div>
                <label className="text-muted-foreground block mb-1">判定名 (Check Label)</label>
                <input
                  type="text"
                  value={config.checkLabel}
                  onChange={(e) => setConfig({ ...config, checkLabel: e.target.value, id: 'custom' })}
                  className="w-full px-3 py-1.5 bg-background border border-border rounded-md"
                  placeholder="例: 正気度(SAN)チェック、共鳴判定"
                />
              </div>

              <div>
                <label className="text-muted-foreground block mb-1">対象リソース名 (Resource)</label>
                <input
                  type="text"
                  value={config.resourceName}
                  onChange={(e) => setConfig({ ...config, resourceName: e.target.value, id: 'custom' })}
                  className="w-full px-3 py-1.5 bg-background border border-border rounded-md"
                  placeholder="例: 正気度 (SAN)、精神力 (MP)"
                />
              </div>

              <div>
                <label className="text-muted-foreground block mb-1">危機・重篤状態名 (Crisis State)</label>
                <input
                  type="text"
                  value={config.crisisLabel}
                  onChange={(e) => setConfig({ ...config, crisisLabel: e.target.value, id: 'custom' })}
                  className="w-full px-3 py-1.5 bg-background border border-border rounded-md"
                  placeholder="例: 一時的狂気、共鳴崩壊、行動不能"
                />
              </div>

              <div>
                <label className="text-muted-foreground block mb-1">成功時ラベル</label>
                <input
                  type="text"
                  value={config.successLossLabel}
                  onChange={(e) => setConfig({ ...config, successLossLabel: e.target.value, id: 'custom' })}
                  className="w-full px-3 py-1.5 bg-background border border-border rounded-md"
                />
              </div>

              <div>
                <label className="text-muted-foreground block mb-1">失敗時ラベル</label>
                <input
                  type="text"
                  value={config.failLossLabel}
                  onChange={(e) => setConfig({ ...config, failLossLabel: e.target.value, id: 'custom' })}
                  className="w-full px-3 py-1.5 bg-background border border-border rounded-md"
                />
              </div>
            </div>
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
            onClick={handleSave}
            className="px-5 py-2 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg shadow transition-all flex items-center gap-1.5"
          >
            <Check size={14} />
            <span>設定を保存</span>
          </button>
        </div>
      </div>
    </div>
  );
};
