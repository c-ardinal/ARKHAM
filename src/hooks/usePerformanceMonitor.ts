import { useEffect } from 'react';
import { useDebugStore } from '../store/debugStore';

/**
 * FPSとメモリ使用量を定期的に計測するフック
 * デバッグモードが有効な場合のみ動作
 */
export const usePerformanceMonitor = () => {
  const updatePerformanceMetrics = useDebugStore((state) => state.updatePerformanceMetrics);
  const isDebugMode = typeof window !== 'undefined' && 
    (import.meta.env.DEV || localStorage.getItem('debugModeEnabled') === 'true');

  useEffect(() => {
    if (!isDebugMode) return;

    let frameCount = 0;
    let lastTime = performance.now();
    let animationFrameId: number;

    const measureFPS = () => {
      frameCount++;
      const currentTime = performance.now();
      const elapsed = currentTime - lastTime;

      // 1秒ごとにFPSを更新
      if (elapsed >= 1000) {
        const fps = Math.round((frameCount * 1000) / elapsed);
        
        // メモリ情報を取得(Chrome/Edgeのみ)
        const memory = (performance as any).memory
          ? {
              usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
              totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
              jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit,
            }
          : null;

        // LocalStorage使用率を計測
        let localStorageInfo = null;
        try {
          let totalSize = 0;
          for (const key in localStorage) {
            if (localStorage.hasOwnProperty(key)) {
              totalSize += key.length + (localStorage.getItem(key)?.length || 0);
            }
          }
          // 文字列サイズをバイト数に変換(UTF-16なので×2)
          const usedBytes = totalSize * 2;
          // 一般的なLocalStorageの割り当ては5MB〜10MB
          // navigator.storage.estimate()が使えればより正確
          const quotaBytes = 5 * 1024 * 1024; // 5MB(デフォルト想定)
          
          localStorageInfo = {
            used: usedBytes,
            quota: quotaBytes,
            percentage: Math.round((usedBytes / quotaBytes) * 100),
          };
        } catch (error) {
          // LocalStorageアクセスエラー時はnull
          localStorageInfo = null;
        }

        updatePerformanceMetrics({
          fps,
          memory,
          localStorage: localStorageInfo,
        });

        frameCount = 0;
        lastTime = currentTime;
      }

      animationFrameId = requestAnimationFrame(measureFPS);
    };

    animationFrameId = requestAnimationFrame(measureFPS);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isDebugMode, updatePerformanceMetrics]);
};
