import { useEffect, useState, useRef } from 'react';
import { X, Copy } from 'lucide-react';

interface DebugModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface LogEntry {
  timestamp: string;
  level: 'log' | 'warn' | 'error' | 'info';
  message: string;
  args: any[];
}

// グローバルにログを保存
const globalLogs: LogEntry[] = [];
let isCapturing = false;

// コンソールログをキャプチャする関数
const setupLogCapture = () => {
  if (isCapturing) return;
  isCapturing = true;
  
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;
  const originalInfo = console.info;
  
  const addLog = (level: LogEntry['level'], args: any[]) => {
    const timestamp = new Date().toLocaleTimeString('ja-JP', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      fractionalSecondDigits: 3
    });
    
    const message = args.map(arg => {
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg, null, 2);
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    }).join(' ');
    
    globalLogs.push({ timestamp, level, message, args });
    // 最大1000件まで保持
    if (globalLogs.length > 1000) {
      globalLogs.shift();
    }
  };
  
  console.log = (...args) => {
    originalLog(...args);
    addLog('log', args);
  };
  
  console.warn = (...args) => {
    originalWarn(...args);
    addLog('warn', args);
  };
  
  console.error = (...args) => {
    originalError(...args);
    addLog('error', args);
  };
  
  console.info = (...args) => {
    originalInfo(...args);
  };
};

// アプリ起動時にログキャプチャを開始
setupLogCapture();

export const DebugModal = ({ isOpen, onClose }: DebugModalProps) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [copySuccess, setCopySuccess] = useState(false);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  
  // モーダルが開いたときにグローバルログをコピー
  useEffect(() => {
    if (isOpen) {
      setLogs([...globalLogs]);
      
      // 定期的にログを更新
      const interval = setInterval(() => {
        setLogs([...globalLogs]);
      }, 500);
      
      return () => clearInterval(interval);
    }
  }, [isOpen]);
  
  if (!isOpen) return null;
  
  const getLevelColor = (level: LogEntry['level']) => {
    switch (level) {
      case 'error': return 'text-red-500';
      case 'warn': return 'text-yellow-500';
      case 'info': return 'text-blue-500';
      default: return 'text-foreground';
    }
  };
  
  const handleClear = () => {
    globalLogs.length = 0;
    setLogs([]);
  };
  
  const handleCopy = () => {
    const logText = logs.map(log => 
      `${log.timestamp} [${log.level.toUpperCase()}] ${log.message}`
    ).join('\n');
    
    if (textAreaRef.current) {
      textAreaRef.current.value = logText;
      textAreaRef.current.select();
      textAreaRef.current.setSelectionRange(0, 99999); // モバイル対応
      
      try {
        document.execCommand('copy');
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      } catch (err) {
        console.error('Failed to copy logs:', err);
        alert('ログのコピーに失敗しました');
      }
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000]">
      <div className="bg-card border border-border rounded-lg shadow-lg w-[90vw] h-[80vh] flex flex-col">
        {/* 非表示のテキストエリア（コピー用） */}
        <textarea
          ref={textAreaRef}
          style={{ position: 'absolute', left: '-9999px' }}
          readOnly
        />
        
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-bold">デバッグコンソール</h2>
          <div className="flex gap-2">
            <button
              onClick={handleCopy}
              className={`px-3 py-1 text-sm rounded flex items-center gap-1 ${
                copySuccess 
                  ? 'bg-green-500 text-white' 
                  : 'bg-primary text-primary-foreground hover:bg-primary/90'
              }`}
            >
              <Copy size={14} />
              {copySuccess ? 'コピー完了！' : 'ログをコピー'}
            </button>
            <button
              onClick={handleClear}
              className="px-3 py-1 text-sm bg-muted hover:bg-muted/80 rounded"
            >
              クリア
            </button>
            <button
              onClick={onClose}
              className="p-1 hover:bg-muted rounded"
            >
              <X size={20} />
            </button>
          </div>
        </div>
        
        {/* ログ表示エリア */}
        <div className="flex-1 overflow-auto p-4 font-mono text-xs bg-background">
          {logs.length === 0 ? (
            <div className="text-muted-foreground text-center py-8">
              ログはありません
            </div>
          ) : (
            logs.map((log, index) => (
              <div key={index} className="mb-2 flex gap-2">
                <span className="text-muted-foreground shrink-0">{log.timestamp}</span>
                <span className={`shrink-0 font-bold ${getLevelColor(log.level)}`}>
                  [{log.level.toUpperCase()}]
                </span>
                <pre className="whitespace-pre-wrap break-all flex-1">{log.message}</pre>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
