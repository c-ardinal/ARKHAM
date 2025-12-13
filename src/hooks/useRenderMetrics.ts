import { useEffect, useRef } from 'react';
import { useDebugStore } from '../store/debugStore';

/**
 * コンポーネントのレンダリングパフォーマンスを計測するフック
 * @param componentName 計測対象のコンポーネント名
 */
export const useRenderMetrics = (componentName: string) => {
  const updatePerformanceMetrics = useDebugStore((state) => state.updatePerformanceMetrics);
  const renderCountRef = useRef(0);
  const metricsRef = useRef({
    count: 0,
    avgTime: 0,
    minTime: Infinity,
    maxTime: 0,
    lastRenderTime: 0,
  });

  useEffect(() => {
    const startTime = performance.now();
    renderCountRef.current += 1;

    return () => {
      const renderTime = performance.now() - startTime;
      const metrics = metricsRef.current;

      // メトリクスを更新
      const newCount = metrics.count + 1;
      const newAvgTime = (metrics.avgTime * metrics.count + renderTime) / newCount;
      const newMinTime = Math.min(metrics.minTime, renderTime);
      const newMaxTime = Math.max(metrics.maxTime, renderTime);

      metricsRef.current = {
        count: newCount,
        avgTime: newAvgTime,
        minTime: newMinTime,
        maxTime: newMaxTime,
        lastRenderTime: renderTime,
      };

      // デバッグストアを更新(頻度を抑えるため、10回に1回のみ)
      if (newCount % 10 === 0) {
        updatePerformanceMetrics({
          componentRenders: {
            [componentName]: { ...metricsRef.current },
          },
        });
      }
    };
  });
};

/**
 * デバッグモードが有効な場合のみレンダリング計測を行うフック
 * @param componentName 計測対象のコンポーネント名
 */
export const useRenderMetricsIfDebug = (componentName: string) => {
  const isDebugMode = typeof window !== 'undefined' && 
    (import.meta.env.DEV || localStorage.getItem('debugModeEnabled') === 'true');

  if (isDebugMode) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useRenderMetrics(componentName);
  }
};
