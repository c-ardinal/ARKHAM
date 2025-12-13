import React, { useEffect } from 'react';
import { Activity, Cpu, HardDrive, Zap, Database, Trash2 } from 'lucide-react';
import { useDebugStore } from '../../store/debugStore';

export const PerformanceTab: React.FC = () => {
  const { performanceMetrics, updatePerformanceMetrics, clearPerformanceMetrics } = useDebugStore();

  // FPS計測
  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();
    let animationFrameId: number;

    const measureFPS = () => {
      frameCount++;
      const currentTime = performance.now();
      const elapsed = currentTime - lastTime;

      if (elapsed >= 1000) {
        const fps = Math.round((frameCount * 1000) / elapsed);
        updatePerformanceMetrics({ fps });
        frameCount = 0;
        lastTime = currentTime;
      }

      animationFrameId = requestAnimationFrame(measureFPS);
    };

    animationFrameId = requestAnimationFrame(measureFPS);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [updatePerformanceMetrics]);

  // メモリ使用量計測
  useEffect(() => {
    const measureMemory = () => {
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        updatePerformanceMetrics({
          memory: {
            usedJSHeapSize: memory.usedJSHeapSize,
            totalJSHeapSize: memory.totalJSHeapSize,
            jsHeapSizeLimit: memory.jsHeapSizeLimit,
          },
        });
      }
    };

    measureMemory();
    const interval = setInterval(measureMemory, 1000);

    return () => clearInterval(interval);
  }, [updatePerformanceMetrics]);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const getMemoryUsagePercent = () => {
    if (!performanceMetrics.memory) return 0;
    return (performanceMetrics.memory.usedJSHeapSize / performanceMetrics.memory.jsHeapSizeLimit) * 100;
  };

  const memoryUsagePercent = getMemoryUsagePercent();
  const fpsWarning = performanceMetrics.fps < 30 && performanceMetrics.fps > 0;
  const memoryWarning = memoryUsagePercent > 80;
  const localStorageWarning = performanceMetrics.localStorage && performanceMetrics.localStorage.percentage > 80;

  return (
    <div className="flex flex-col h-full overflow-auto p-4 space-y-6">
      {/* クリアボタン */}
      <div className="flex justify-end">
        <button
          onClick={clearPerformanceMetrics}
          className="px-3 py-1.5 text-xs bg-destructive/10 hover:bg-destructive/20 text-destructive rounded flex items-center gap-1.5 transition-colors"
        >
          <Trash2 size={14} />
          計測データをクリア
        </button>
      </div>

      {/* FPS */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Zap size={18} className="text-primary" />
          <h3 className="font-bold text-sm">フレームレート (FPS)</h3>
        </div>
        <div className="flex items-baseline gap-2">
          <span className={`text-3xl font-bold ${fpsWarning ? 'text-yellow-500' : 'text-foreground'}`}>
            {performanceMetrics.fps}
          </span>
          <span className="text-sm text-muted-foreground">fps</span>
        </div>
        {fpsWarning && (
          <div className="mt-2 text-xs text-yellow-500">
            ⚠️ フレームレートが低下しています
          </div>
        )}
      </div>

      {/* メモリ使用量 */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <HardDrive size={18} className="text-primary" />
          <h3 className="font-bold text-sm">メモリ使用量</h3>
        </div>
        {performanceMetrics.memory ? (
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>使用中</span>
                <span className={memoryWarning ? 'text-yellow-500 font-bold' : ''}>
                  {formatBytes(performanceMetrics.memory.usedJSHeapSize)}
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    memoryWarning ? 'bg-yellow-500' : 'bg-primary'
                  }`}
                  style={{ width: `${Math.min(memoryUsagePercent, 100)}%` }}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <div className="text-muted-foreground">合計</div>
                <div className="font-mono">{formatBytes(performanceMetrics.memory.totalJSHeapSize)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">上限</div>
                <div className="font-mono">{formatBytes(performanceMetrics.memory.jsHeapSizeLimit)}</div>
              </div>
            </div>
            {memoryWarning && (
              <div className="text-xs text-yellow-500">
                ⚠️ メモリ使用率が高くなっています ({memoryUsagePercent.toFixed(1)}%)
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">
            このブラウザではメモリ情報を取得できません
          </div>
        )}
      </div>

      {/* LocalStorage使用率 */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Database size={18} className="text-primary" />
          <h3 className="font-bold text-sm">LocalStorage使用率</h3>
        </div>
        {performanceMetrics.localStorage ? (
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>使用中</span>
                <span className={localStorageWarning ? 'text-yellow-500 font-bold' : ''}>
                  {formatBytes(performanceMetrics.localStorage.used)} / {formatBytes(performanceMetrics.localStorage.quota)}
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    localStorageWarning ? 'bg-yellow-500' : 'bg-primary'
                  }`}
                  style={{ width: `${Math.min(performanceMetrics.localStorage.percentage, 100)}%` }}
                />
              </div>
            </div>
            <div className="text-xs">
              <span className="text-muted-foreground">使用率: </span>
              <span className={`font-mono font-bold ${localStorageWarning ? 'text-yellow-500' : ''}`}>
                {performanceMetrics.localStorage.percentage}%
              </span>
            </div>
            {localStorageWarning && (
              <div className="text-xs text-yellow-500">
                ⚠️ LocalStorage使用率が高くなっています
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">
            LocalStorage情報を取得できません
          </div>
        )}
      </div>

      {/* コンポーネントレンダリング */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Cpu size={18} className="text-primary" />
          <h3 className="font-bold text-sm">コンポーネントレンダリング</h3>
        </div>
        {Object.keys(performanceMetrics.componentRenders).length === 0 ? (
          <div className="text-sm text-muted-foreground">
            データがありません
          </div>
        ) : (
          <div className="space-y-2">
            {Object.entries(performanceMetrics.componentRenders).map(([name, metrics]) => (
              <div key={name} className="border-b border-border pb-2 last:border-0">
                <div className="font-mono text-xs font-bold mb-1">{name}</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">回数:</span>{' '}
                    <span className="font-mono">{metrics.count}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">平均:</span>{' '}
                    <span className="font-mono">{metrics.avgTime.toFixed(2)}ms</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">最小:</span>{' '}
                    <span className="font-mono">{metrics.minTime.toFixed(2)}ms</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">最大:</span>{' '}
                    <span className="font-mono">{metrics.maxTime.toFixed(2)}ms</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 注意事項 */}
      <div className="bg-muted/30 border border-border rounded-lg p-3">
        <div className="flex items-start gap-2">
          <Activity size={14} className="text-muted-foreground mt-0.5" />
          <div className="text-xs text-muted-foreground">
            <p className="mb-1">パフォーマンスモニター自体が若干のオーバーヘッドを発生させます。</p>
            <p>本番環境ではデバッグモードを無効化してください。</p>
          </div>
        </div>
      </div>
    </div>
  );
};
