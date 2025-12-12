import { useDebugStore } from '../store/debugStore';

let isCapturing = false;

// コンソールログをキャプチャしてDebugStoreに送信
export const setupLogCapture = () => {
  if (isCapturing) return;
  isCapturing = true;

  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;
  const originalInfo = console.info;

  console.log = (...args) => {
    originalLog(...args);
    useDebugStore.getState().addLog('log', args);
  };

  console.warn = (...args) => {
    originalWarn(...args);
    useDebugStore.getState().addLog('warn', args);
  };

  console.error = (...args) => {
    originalError(...args);
    useDebugStore.getState().addLog('error', args);
  };

  console.info = (...args) => {
    originalInfo(...args);
    useDebugStore.getState().addLog('info', args);
  };
};
