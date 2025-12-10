import React from 'react';
import { useTranslation } from '../hooks/useTranslation';
import { X, Clock } from 'lucide-react';

interface UpdateHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
}

// @ts-ignore
import changeLogRaw from '../../ChangeLog.md?raw';

interface ChangeLog {
    version: string;
    date: string;
    features: string[];
    changes: string[];
    fixes: string[];
    others: string[];
}

const parseChangeLog = (md: string): ChangeLog[] => {
    const logs: ChangeLog[] = [];
    const sections = md.split(/^## /m).filter(s => s.trim());
    
    sections.forEach(section => {
        const lines = section.split('\n');
        const header = lines[0]; // e.g. "v1.1.0 (2025-12-10)"
        const match = header.match(/(v\d+\.\d+\.\d+) \(([^)]+)\)/);
        if (!match) return;
        
        const version = match[1];
        const date = match[2];
        const log: ChangeLog = { version, date, features: [], changes: [], fixes: [], others: [] };
        
        let currentType: 'features' | 'changes' | 'fixes' | 'others' | null = null;
        
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.startsWith('### ')) {
                if (line.includes('機能追加')) currentType = 'features';
                else if (line.includes('変更・改善')) currentType = 'changes';
                else if (line.includes('バグ修正')) currentType = 'fixes';
                else if (line.includes('その他')) currentType = 'others';
                else currentType = null;
            } else if (line.startsWith('- ') && currentType) {
                log[currentType].push(line.substring(2));
            }
        }
        logs.push(log);
    });
    return logs;
};

const updateHistory = parseChangeLog(changeLogRaw || '');

export const UpdateHistoryModal = ({ isOpen, onClose }: UpdateHistoryModalProps) => {
    const { t } = useTranslation();

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-[150] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div 
                className="bg-card text-card-foreground w-full max-w-2xl max-h-[80vh] rounded-lg shadow-xl flex flex-col border border-border"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Clock size={24} />
                        {t('menu.updateHistory')}
                    </h2>
                    <button 
                        onClick={onClose}
                        className="p-1 rounded-full hover:bg-muted transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                    {updateHistory.length === 0 && (
                        <div className="text-center text-muted-foreground">Unable to load history.</div>
                    )}
                    {updateHistory.map((log, index) => (
                        <div key={index} className="relative">
                            <div className="flex items-baseline gap-3 mb-3 border-b border-border pb-2">
                                <h3 className="text-lg font-bold text-primary">{log.version}</h3>
                                <span className="text-sm text-muted-foreground font-mono">{log.date}</span>
                            </div>
                            
                            <div className="space-y-4 pl-2">
                                {log.features.length > 0 && (
                                    <div>
                                        <div className="text-xs font-bold text-green-600 dark:text-green-400 mb-1 flex items-center gap-1">
                                            <span className="w-2 h-2 rounded-full bg-green-500"></span> 機能追加 (New Features)
                                        </div>
                                        <ul className="list-disc list-inside text-sm space-y-1 text-muted-foreground pl-2">
                                            {log.features.map((item, i) => <li key={i}>{item}</li>)}
                                        </ul>
                                    </div>
                                )}
                                
                                {log.changes.length > 0 && (
                                    <div>
                                        <div className="text-xs font-bold text-blue-600 dark:text-blue-400 mb-1 flex items-center gap-1">
                                            <span className="w-2 h-2 rounded-full bg-blue-500"></span> 変更・改善 (Changes)
                                        </div>
                                        <ul className="list-disc list-inside text-sm space-y-1 text-muted-foreground pl-2">
                                            {log.changes.map((item, i) => <li key={i}>{item}</li>)}
                                        </ul>
                                    </div>
                                )}

                                {log.fixes.length > 0 && (
                                    <div>
                                        <div className="text-xs font-bold text-orange-600 dark:text-orange-400 mb-1 flex items-center gap-1">
                                            <span className="w-2 h-2 rounded-full bg-orange-500"></span> バグ修正 (Bug Fixes)
                                        </div>
                                        <ul className="list-disc list-inside text-sm space-y-1 text-muted-foreground pl-2">
                                            {log.fixes.map((item, i) => <li key={i}>{item}</li>)}
                                        </ul>
                                    </div>
                                )}

                                {log.others.length > 0 && (
                                    <div>
                                        <div className="text-xs font-bold text-gray-600 dark:text-gray-400 mb-1 flex items-center gap-1">
                                            <span className="w-2 h-2 rounded-full bg-gray-500"></span> その他 (Others)
                                        </div>
                                        <ul className="list-disc list-inside text-sm space-y-1 text-muted-foreground pl-2">
                                            {log.others.map((item, i) => <li key={i}>{item}</li>)}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-border flex justify-end">
                    <button 
                        onClick={onClose}
                        className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
                    >
                        {t('common.close')}
                    </button>
                </div>
            </div>
        </div>
    );
};
