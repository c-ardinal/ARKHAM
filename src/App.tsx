import { useEffect, useRef } from 'react';
import { Layout } from './components/Layout';
import { useScenarioStore } from './store/scenarioStore';
import { setupLogCapture } from './utils/logCapture';
import { usePerformanceMonitor } from './hooks/usePerformanceMonitor';

// アプリ起動時にログキャプチャを開始
setupLogCapture();

function App() {
  const saveToLocalStorage = useScenarioStore((state) => state.saveToLocalStorage);
  const store = useScenarioStore();
  const saveTimeoutRef = useRef<number | null>(null);

  // パフォーマンスモニター起動(デバッグモード時のみ)
  usePerformanceMonitor();

  // 状態が変更されたら自動保存（デバウンス付き）
  useEffect(() => {
    // 既存のタイムアウトをクリア
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // 500ms後に保存
    saveTimeoutRef.current = setTimeout(() => {
      saveToLocalStorage();
      saveTimeoutRef.current = null;
    }, 500);

    // クリーンアップ
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [
    store.nodes,
    store.edges,
    store.gameState,
    store.mode,
    store.characters,
    store.resources,
    store.language,
    store.theme,
    store.edgeType,
    saveToLocalStorage,
  ]);

  return (
    <>
      <Layout />
    </>
  );
}

export default App;
