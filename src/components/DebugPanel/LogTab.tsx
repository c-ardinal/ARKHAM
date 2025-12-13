import React, { useMemo } from 'react';
import { Copy, Trash2, Search, Filter } from 'lucide-react';
import { useDebugStore } from '../../store/debugStore';
import type { LogEntry } from '../../types/debug';

export const LogTab: React.FC = () => {
  const { logs, logFilter, setLogFilter, clearLogs, exportLogs, addLog } = useDebugStore();
  const [copySuccess, setCopySuccess] = React.useState(false);

  // フィルタリングされたログ
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // レベルフィルタ
      if (!logFilter.levels.has(log.level)) return false;

      // キーワードフィルタ
      if (logFilter.keyword) {
        if (logFilter.isRegex) {
          try {
            const regex = new RegExp(logFilter.keyword, 'i');
            if (!regex.test(log.message)) return false;
          } catch {
            if (!log.message.toLowerCase().includes(logFilter.keyword.toLowerCase())) return false;
          }
        } else {
          if (!log.message.toLowerCase().includes(logFilter.keyword.toLowerCase())) return false;
        }
      }

      // タグフィルタ
      if (logFilter.tags.size > 0) {
        const hasMatchingTag = log.tags.some(tag => logFilter.tags.has(tag));
        if (!hasMatchingTag) return false;
      }

      return true;
    });
  }, [logs, logFilter]);

  // 全タグを抽出
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    logs.forEach(log => {
      log.tags.forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [logs]);


  const getLevelColor = (level: LogEntry['level']) => {
    switch (level) {
      case 'error': return 'text-red-500';
      case 'warn': return 'text-yellow-500';
      case 'info': return 'text-blue-500';
      default: return 'text-foreground';
    }
  };

  const handleCopy = () => {
    const logText = filteredLogs.map(log =>
      `${log.timestamp} [${log.level.toUpperCase()}] ${log.message}`
    ).join('\n');

    navigator.clipboard.writeText(logText).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }).catch(() => {
      addLog('error', ['ログのコピーに失敗しました']);
    });
  };

  const toggleLevel = (level: LogEntry['level']) => {
    const newLevels = new Set(logFilter.levels);
    if (newLevels.has(level)) {
      newLevels.delete(level);
    } else {
      newLevels.add(level);
    }
    setLogFilter({ levels: newLevels });
  };

  const toggleTag = (tag: string) => {
    const newTags = new Set(logFilter.tags);
    if (newTags.has(tag)) {
      newTags.delete(tag);
    } else {
      newTags.add(tag);
    }
    setLogFilter({ tags: newTags });
  };


  return (
    <div className="flex flex-col h-full">
      {/* フィルタバー */}
      <div className="p-3 border-b border-border bg-muted/30 space-y-2">
        {/* レベルフィルタ */}
        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={14} className="text-muted-foreground" />
          <label className="flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              checked={logFilter.levels.has('log')}
              onChange={() => toggleLevel('log')}
              className="rounded"
            />
            Log
          </label>
          <label className="flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              checked={logFilter.levels.has('info')}
              onChange={() => toggleLevel('info')}
              className="rounded"
            />
            Info
          </label>
          <label className="flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              checked={logFilter.levels.has('warn')}
              onChange={() => toggleLevel('warn')}
              className="rounded"
            />
            Warn
          </label>
          <label className="flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              checked={logFilter.levels.has('error')}
              onChange={() => toggleLevel('error')}
              className="rounded"
            />
            Error
          </label>
        </div>

        {/* キーワード検索 */}
        <div className="flex items-center gap-2">
          <Search size={14} className="text-muted-foreground" />
          <input
            type="text"
            placeholder="キーワード検索..."
            value={logFilter.keyword}
            onChange={(e) => setLogFilter({ keyword: e.target.value })}
            className="flex-1 px-2 py-1 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <label className="flex items-center gap-1 text-xs whitespace-nowrap">
            <input
              type="checkbox"
              checked={logFilter.isRegex}
              onChange={(e) => setLogFilter({ isRegex: e.target.checked })}
              className="rounded"
            />
            正規表現
          </label>
        </div>

        {/* タグフィルタ */}
        {allTags.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">タグ:</span>
            {allTags.map(tag => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`px-2 py-0.5 text-xs rounded transition-colors ${
                  logFilter.tags.has(tag)
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-muted/80'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}

        {/* 件数表示 */}
        <div className="text-xs text-muted-foreground">
          {logs.length}件中 {filteredLogs.length}件を表示
        </div>
      </div>

      {/* アクションバー */}
      <div className="flex items-center justify-between p-2 border-b border-border bg-background">
        <div className="flex gap-2">
          <button
            onClick={handleCopy}
            className={`px-3 py-1 text-xs rounded flex items-center gap-1 transition-colors ${
              copySuccess
                ? 'bg-green-500 text-white'
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            }`}
          >
            <Copy size={12} />
            {copySuccess ? 'コピー完了!' : 'コピー'}
          </button>
          <button
            onClick={() => exportLogs(true)}
            className="px-3 py-1 text-xs bg-secondary hover:bg-secondary/80 rounded"
          >
            エクスポート
          </button>
        </div>
        <button
          onClick={clearLogs}
          className="px-3 py-1 text-xs bg-destructive/10 hover:bg-destructive/20 text-destructive rounded flex items-center gap-1"
        >
          <Trash2 size={12} />
          クリア
        </button>
      </div>

      {/* ログ表示エリア */}
      <div className="flex-1 overflow-auto p-3 font-mono text-xs bg-background">
        {filteredLogs.length === 0 ? (
          <div className="text-muted-foreground text-center py-8">
            {logs.length === 0 ? 'ログはありません' : 'フィルタに一致するログがありません'}
          </div>
        ) : (
          filteredLogs.map((log, index) => (
            <div key={index} className="mb-2 flex gap-2 hover:bg-muted/30 px-1 py-0.5 rounded">
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
  );
};
