import React from 'react';
import { useDebugStore } from '../../store/debugStore';
import { FloatingWindow } from '../common/FloatingWindow';
import { LogTab } from './LogTab';
import { PerformanceTab } from './PerformanceTab';
import { SnapshotTab } from './SnapshotTab';
import { AssertionTab } from './AssertionTab';

export const DebugPanel: React.FC = () => {
  const { isDebugPanelOpen, activeTab, setDebugPanelOpen, setActiveTab } = useDebugStore();

  const tabs = [
    { id: 'logs' as const, label: 'ログ' },
    { id: 'performance' as const, label: 'パフォーマンス' },
    { id: 'snapshots' as const, label: 'スナップショット' },
    { id: 'assertions' as const, label: 'アサーション' },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'logs':
        return <LogTab />;
      case 'performance':
        return <PerformanceTab />;
      case 'snapshots':
        return <SnapshotTab />;
      case 'assertions':
        return <AssertionTab />;
      default:
        return null;
    }
  };

  return (
    <>
      {/* デスクトップ版: フローティングウィンドウ */}
      <div className="hidden md:block">
        <FloatingWindow
          title="デバッグパネル"
          isOpen={isDebugPanelOpen}
          onClose={() => setDebugPanelOpen(false)}
          zIndex={200}
        >
          <div className="flex flex-col h-full">
            {/* タブバー */}
            <div className="flex border-b border-border bg-muted/30">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-background border-b-2 border-primary text-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* タブコンテンツ */}
            <div className="flex-1 overflow-hidden">
              {renderTabContent()}
            </div>
          </div>
        </FloatingWindow>
      </div>

      {/* モバイル版: フルスクリーンモーダル */}
      {isDebugPanelOpen && (
        <div className="md:hidden fixed inset-0 bg-black/50 z-[10000] flex items-center justify-center">
          <div className="bg-card w-full h-full flex flex-col">
            {/* ヘッダー */}
            <div className="flex items-center justify-between p-4 border-b border-border bg-muted/50">
              <h2 className="text-lg font-bold">デバッグパネル</h2>
              <button
                onClick={() => setDebugPanelOpen(false)}
                className="px-4 py-2 bg-muted hover:bg-muted/80 rounded text-sm"
              >
                閉じる
              </button>
            </div>

            {/* タブバー */}
            <div className="flex border-b border-border bg-muted/30 overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-shrink-0 px-4 py-3 text-sm font-medium transition-colors min-w-[100px] ${
                    activeTab === tab.id
                      ? 'bg-background border-b-2 border-primary text-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* タブコンテンツ */}
            <div className="flex-1 overflow-hidden">
              {renderTabContent()}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
