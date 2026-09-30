import { useScenarioStore } from '../store/scenarioStore';
import React, { useState, useEffect, type ChangeEvent } from 'react';
import type { ScenarioNode } from '../types';
import { useTranslation } from '../hooks/useTranslation';
import { VariableSuggestInput } from './VariableSuggestInput';
import { INPUT_CLASS, LABEL_CLASS, ERROR_MSG_CLASS as ERROR_CLASS } from '../styles/common';
import { X, AlertCircle, Dices, Sparkles } from 'lucide-react';
import { useRenderMetricsIfDebug } from '../hooks/useRenderMetrics';
import { JumpTargetCombobox } from './JumpTargetCombobox';
import { SearchableSelect } from './SearchableSelect';
import { FORBIDDEN_READ_ALOUD_TERMS } from '../core/linter';
import { VisualConditionBuilder } from './VisualConditionBuilder';
import { EntityVariablesPropertySection } from './common/EntityVariablesPropertySection';

const MobileBackdrop = ({ children, isMobile }: { children: React.ReactNode, isMobile: boolean }) => {
    if (!isMobile) return <>{children}</>;
    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            {children}
        </div>
    );
};

interface PropertyPanelProps {
  width?: number;
  isMobile?: boolean; // Added isMobile prop
  onClose?: () => void; // Added onClose prop
}

export const PropertyPanel = React.memo(React.forwardRef<HTMLElement, PropertyPanelProps>(({ width, isMobile = false, onClose }, ref) => {
  const {
      tabs, activeTabId, selectedNodeId, updateNodeData, gameState,
      characters, resources, stages, updateCharacter, updateResource, updateStage, systemConfig,
      addStage
  } = useScenarioStore();
  const activeTab = tabs.find(t => t.id === activeTabId);
  const nodes = activeTab?.nodes ?? [];
  const { t } = useTranslation();
  
  // --- PropertyPanel Width Resizing (Desktop) ---
  const [panelWidth, setPanelWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('arkham_property_panel_width');
      if (saved) {
        const val = parseInt(saved, 10);
        if (!isNaN(val) && val >= 250 && val <= 750) return val;
      }
    } catch (_) {}
    return width ?? 320;
  });
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(250, Math.min(750, window.innerWidth - e.clientX));
      setPanelWidth(newWidth);
    };

    const handleMouseUp = (e: MouseEvent) => {
      setIsResizing(false);
      const finalWidth = Math.max(250, Math.min(750, window.innerWidth - e.clientX));
      setPanelWidth(finalWidth);
      try {
        localStorage.setItem('arkham_property_panel_width', String(finalWidth));
      } catch (_) {}
      window.dispatchEvent(new Event('resize'));
      document.body.style.cursor = 'default';
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  // レンダリング計測(デバッグモード時のみ)
  useRenderMetricsIfDebug('PropertyPanel');
  
  // Resolve selected item
  let selectedNode = nodes.find((n: ScenarioNode) => n.id === selectedNodeId);
  const selectedCharacter = !selectedNode 
      ? characters.find(c => c.id === selectedNodeId)
      : (selectedNode.type === 'character' ? characters.find(c => c.id === selectedNode.data.referenceId) : null);
  const selectedResource = !selectedNode
      ? resources.find(r => r.id === selectedNodeId)
      : (selectedNode.type === 'resource' ? resources.find(r => r.id === selectedNode.data.referenceId) : null);
  const selectedStage = !selectedNode
      ? stages.find(s => s.id === selectedNodeId)
      : (selectedNode.type === 'stage' ? stages.find(s => s.id === selectedNode.data.referenceId) : null);



  const inputClass = INPUT_CLASS;
  const labelClass = LABEL_CLASS;

  // Auto-select resource if available and not set (User Requirement)
  useEffect(() => {
      if ((selectedNode?.type === 'element' || selectedNode?.type === 'information') && 
          !selectedNode.data.referenceId && 
          resources.length > 0) {
          updateNodeData(selectedNode.id, { 
             referenceId: resources[0].id,
             infoValue: resources[0].name 
         });
      }

      if (selectedNode?.type === 'variable' && 
          !selectedNode.data.targetVariable && 
          Object.keys(gameState.variables).length > 0) {
          updateNodeData(selectedNode.id, { 
             targetVariable: Object.keys(gameState.variables)[0]
         });
      }
  }, [selectedNode?.id, resources.length, selectedNode?.data.referenceId, selectedNode?.data.targetVariable, gameState.variables]);

  const panelClass = isMobile
      ? `bg-card border border-border rounded-lg shadow-xl w-full max-w-[400px] max-h-[85vh] flex flex-col overflow-hidden` 
      : `border-l flex flex-col bg-card border-border shrink-0 relative ${isResizing ? '' : 'transition-[width] duration-200'}`;

  const renderResizeHandle = () => {
    if (isMobile) return null;
    return (
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={t('common.resizePanel' as any) || 'パネル幅を変更'}
        tabIndex={0}
        title="ドラッグで幅を変更 / ダブルクリックでリセット"
        className="group absolute top-0 -left-1.5 w-3 h-full cursor-col-resize z-30 flex items-center justify-center hover:bg-primary/15 select-none"
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsResizing(true);
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          setPanelWidth(320);
          try { localStorage.setItem('arkham_property_panel_width', '320'); } catch (_) {}
          window.dispatchEvent(new Event('resize'));
        }}
      >
        <div className={`w-0.5 h-full transition-colors ${isResizing ? 'bg-primary' : 'bg-transparent group-hover:bg-primary/60'}`} />
      </div>
    );
  };


  // Header helper to include Close button on mobile
  const renderHeader = (title: string, subTitle?: string) => (
      <div className="p-4 border-b border-border flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-card-foreground">{title}</h2>
            {subTitle && <div className="text-xs mt-1 text-muted-foreground">{subTitle}</div>}
            {selectedNode && !selectedCharacter && !selectedResource && !selectedStage && (
                <div className="text-xs text-muted-foreground">Type: {selectedNode.type}</div>
            )}
          </div>
          {isMobile && onClose && (
              <button
                  onClick={onClose}
                  className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] -mr-2 -mt-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-colors"
                  aria-label={t('accessibility.closePanel' as any) || t('common.close')}
              >
                  <X size={20} aria-hidden="true" />
              </button>
          )}
      </div>
  );

  // --- Character Editing ---
  if (selectedCharacter) {
       const handleChange = (name: string, value: string) => {
           updateCharacter(selectedCharacter.id, { [name]: value });
       };

        return (
            <MobileBackdrop isMobile={isMobile}>
                 <aside ref={ref} className={panelClass} style={{ width: isMobile ? '100%' : `${panelWidth}px` }}>
                     {renderResizeHandle()}
                     {renderHeader(t('characters.title'), `ID: ${selectedCharacter.id}`)}
                     <div className="p-4 flex-1 overflow-y-auto space-y-4">
                         <div>
                             <label className={labelClass}>{t('characters.name')}</label>
                             <input
                                 value={selectedCharacter.name}
                                 onChange={(e) => handleChange('name', e.target.value)}
                                 className={inputClass}
                             />
                         </div>
                         <div>
                             <label className={labelClass}>{t('characters.reading')}</label>
                             <input
                                 value={selectedCharacter.reading || ''}
                                 onChange={(e) => handleChange('reading', e.target.value)}
                                 className={inputClass}
                             />
                         </div>
                         <div>
                             <label className={labelClass}>{t('characters.type')}</label>
                              <select
                                 value={selectedCharacter.type}
                                 onChange={(e) => handleChange('type', e.target.value)}
                                 className={inputClass}
                             >
                                 {Object.entries((t('characters.types') as any) || {}).map(([key, label]) => (
                                     <option key={key} value={key}>{label as string}</option>
                                 ))}
                             </select>
                         </div>
                         <div>
                             <label className={labelClass}>{t('characters.description')}</label>
                              <VariableSuggestInput
                                 multiline
                                 value={selectedCharacter.description || ''}
                                 onChange={(val) => handleChange('description', val)}
                                 className={`${inputClass} min-h-[80px]`}
                             />
                         </div>
                          <div>
                             <label className={labelClass}>{t('characters.abilities')}</label>
                             <textarea
                                 value={selectedCharacter.abilities || ''}
                                 onChange={(e) => handleChange('abilities', e.target.value)}
                                 className={`${inputClass} min-h-[60px]`}
                             />
                         </div>
                          <div>
                             <label className={labelClass}>{t('characters.skills')}</label>
                             <textarea
                                 value={selectedCharacter.skills || ''}
                                 onChange={(e) => handleChange('skills', e.target.value)}
                                 className={`${inputClass} min-h-[60px]`}
                             />
                         </div>
                          <div>
                             <label className={labelClass}>{t('characters.note')}</label>
                             <textarea
                                 value={selectedCharacter.note || ''}
                                 onChange={(e) => handleChange('note', e.target.value)}
                                 className={`${inputClass} min-h-[60px]`}
                             />
                         </div>
                          <EntityVariablesPropertySection variables={selectedCharacter.variables} entityType="character" entityId={selectedCharacter.id} />
                     </div>
                 </aside>
            </MobileBackdrop>
        );
  }

  // --- Resource Editing ---
  if (selectedResource) {
       const handleChange = (name: string, value: string) => {
           updateResource(selectedResource.id, { [name]: value });
       };

        return (
            <MobileBackdrop isMobile={isMobile}>
                 <aside ref={ref} className={panelClass} style={{ width: isMobile ? '100%' : `${panelWidth}px` }}>
                     {renderResizeHandle()}
                     {renderHeader(t('resources.title'), `ID: ${selectedResource.id}`)}
                     <div className="p-4 flex-1 overflow-y-auto space-y-4">
                         <div>
                             <label className={labelClass}>{t('resources.name')}</label>
                             <input
                                 value={selectedResource.name}
                                 onChange={(e) => handleChange('name', e.target.value)}
                                 className={inputClass}
                             />
                         </div>
                          <div>
                             <label className={labelClass}>{t('resources.reading')}</label>
                             <input
                                 value={selectedResource.reading || ''}
                                 onChange={(e) => handleChange('reading', e.target.value)}
                                 className={inputClass}
                             />
                         </div>
                         <div>
                             <label className={labelClass}>{t('resources.type')}</label>
                              <select
                                 value={selectedResource.type}
                                 onChange={(e) => handleChange('type', e.target.value)}
                                 className={inputClass}
                             >
                                 {Object.entries((t('resources.types') as any) || {}).map(([key, label]) => (
                                     <option key={key} value={key}>{label as string}</option>
                                 ))}
                             </select>
                         </div>
                         <div>
                             <label className={labelClass}>{t('resources.description')}</label>
                              <VariableSuggestInput
                                 multiline
                                 value={selectedResource.description || ''}
                                 onChange={(val) => handleChange('description', val)}
                                 className={`${inputClass} min-h-[80px]`}
                             />
                         </div>
                          <div>
                             <label className={labelClass}>{t('resources.cost')}</label>
                             <input
                                 value={selectedResource.cost || ''}
                                 onChange={(e) => handleChange('cost', e.target.value)}
                                 className={inputClass}
                             />
                         </div>
                          <div>
                             <label className={labelClass}>{t('resources.effect')}</label>
                             <VariableSuggestInput
                                 multiline
                                 value={selectedResource.effect || ''}
                                 onChange={(val) => handleChange('effect', val)}
                                 className={`${inputClass} min-h-[60px]`}
                             />
                         </div>
                          <div>
                             <label className={labelClass}>{t('resources.note')}</label>
                             <textarea
                                 value={selectedResource.note || ''}
                                 onChange={(e) => handleChange('note', e.target.value)}
                                 className={`${inputClass} min-h-[60px]`}
                             />
                         </div>
                          <EntityVariablesPropertySection variables={selectedResource.variables} entityType="resource" entityId={selectedResource.id} />
                     </div>
                 </aside>
            </MobileBackdrop>
        );
  }

  // --- Stage Editing ---
  if (selectedStage) {
       const handleChange = (name: string, value: string) => {
           updateStage(selectedStage.id, { [name]: value });
       };

        return (
            <MobileBackdrop isMobile={isMobile}>
                 <aside ref={ref} className={panelClass} style={{ width: isMobile ? '100%' : `${panelWidth}px` }}>
                     {renderResizeHandle()}
                     {renderHeader(t('stages.title'), `ID: ${selectedStage.id}`)}
                     <div className="p-4 flex-1 overflow-y-auto space-y-4">
                         <div>
                             <label className={labelClass}>{t('stages.name')}</label>
                             <input
                                 value={selectedStage.name}
                                 onChange={(e) => handleChange('name', e.target.value)}
                                 className={inputClass}
                             />
                         </div>
                          <div>
                             <label className={labelClass}>{t('stages.reading')}</label>
                             <input
                                 value={selectedStage.reading || ''}
                                 onChange={(e) => handleChange('reading', e.target.value)}
                                 className={inputClass}
                             />
                         </div>
                         <div>
                             <label className={labelClass}>{t('stages.type')}</label>
                              <select
                                 value={selectedStage.type}
                                 onChange={(e) => handleChange('type', e.target.value)}
                                 className={inputClass}
                             >
                                 {Object.entries((t('stages.types') as any) || {}).map(([key, label]) => (
                                     <option key={key} value={key}>{label as string}</option>
                                 ))}
                             </select>
                         </div>
                         <div>
                             <label className={labelClass}>{t('stages.description')}</label>
                              <VariableSuggestInput
                                 multiline
                                 value={selectedStage.description || ''}
                                 onChange={(val) => handleChange('description', val)}
                                 className={`${inputClass} min-h-[80px]`}
                             />
                         </div>
                          <div>
                             <label className={labelClass}>{t('stages.details')}</label>
                             <VariableSuggestInput
                                 multiline
                                 value={selectedStage.details || ''}
                                 onChange={(val) => handleChange('details', val)}
                                 className={`${inputClass} min-h-[60px]`}
                             />
                         </div>
                          <div>
                             <label className={labelClass}>{t('stages.note')}</label>
                             <textarea
                                 value={selectedStage.note || ''}
                                 onChange={(e) => handleChange('note', e.target.value)}
                                 className={`${inputClass} min-h-[60px]`}
                             />
                         </div>
                          <EntityVariablesPropertySection variables={selectedStage.variables} entityType="stage" entityId={selectedStage.id} />
                     </div>
                 </aside>
            </MobileBackdrop>
        );
  }

  // --- Standard Node Editing ---
  if (!selectedNode) {
    if (isMobile) return null; // If nothing selected on mobile, default hidden (though parent likely handles this)

    return (
      <MobileBackdrop isMobile={isMobile}>
          <aside ref={ref} className={panelClass} style={{ width: isMobile ? '100%' : `${panelWidth}px` }}>
            {renderResizeHandle()}
            {renderHeader(t('common.properties'))}
            <div className="p-4 flex-1 overflow-y-auto text-muted-foreground">
              <p>{t('properties.selectNode')}</p>
            </div>
          </aside>
      </MobileBackdrop>
    );
  }

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    updateNodeData(selectedNode.id, { [name]: value });
  };

  /* Existing handleFieldChange */
  const handleFieldChange = (name: string, value: string) => {
    updateNodeData(selectedNode.id, { [name]: value });
  };



  return (
    <MobileBackdrop isMobile={isMobile}>
        <aside ref={ref} className={panelClass} style={{ width: isMobile ? '100%' : `${panelWidth}px` }}>
          {renderResizeHandle()}
          {renderHeader(t('common.properties'), `ID: ${selectedNode.id}`)}
    
          <div className="p-4 flex-1 overflow-y-auto">
            <div className="space-y-4">
              <div>
                <label className={labelClass}>{t('properties.label')}</label>
                <VariableSuggestInput
                  value={selectedNode.data.label}
                  onChange={(val) => handleFieldChange('label', val)}
                  className={inputClass}
                />
              </div>
    
              {/* Event Node */}
              {selectedNode.type === 'event' && (
                <div className="space-y-4">
                  {/* Scene Progression Flags (Start & Ending) */}
                  <div className="flex items-center gap-4 pt-1">
                    <label className="flex items-center gap-1.5 text-xs text-foreground cursor-pointer select-none">
                      <input 
                        type="checkbox"
                        name="isStart"
                        checked={!!selectedNode.data.isStart}
                        onChange={(e) => updateNodeData(selectedNode.id, { isStart: e.target.checked })}
                        className="w-4 h-4 rounded"
                      />
                      <span>{t('properties.isStartNode')}</span>
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-foreground cursor-pointer select-none">
                      <input 
                        type="checkbox"
                        name="isEnding"
                        checked={!!selectedNode.data.isEnding}
                        onChange={(e) => updateNodeData(selectedNode.id, { isEnding: e.target.checked })}
                        className="w-4 h-4 rounded"
                      />
                      <span>{t('properties.isEndingNode')}</span>
                    </label>
                  </div>

                  {/* Chapter & Time Cost */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={labelClass}>{t('properties.chapter')}</label>
                      <input
                        type="number"
                        min={0}
                        max={20}
                        value={selectedNode.data.chapter ?? 1}
                        onChange={(e) =>
                          updateNodeData(selectedNode.id, { chapter: Number(e.target.value) })
                        }
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>{t('properties.timeCostMinutes')}</label>
                      <input
                        type="number"
                        min={1}
                        max={600}
                        step={5}
                        value={selectedNode.data.timeCostMinutes ?? 10}
                        onChange={(e) =>
                          updateNodeData(selectedNode.id, { timeCostMinutes: Number(e.target.value) })
                        }
                        className={inputClass}
                      />
                    </div>
                  </div>

                  {/* Location Selection */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className={labelClass}>{t('properties.location')}</label>
                      <button
                        type="button"
                        onClick={() => {
                          const name = window.prompt('新しい場所名を入力してください:');
                          if (name && name.trim()) {
                            const newLocId = `loc_${Date.now()}`;
                            addStage({
                              id: newLocId,
                              type: 'Location',
                              name: name.trim(),
                              description: '',
                              details: '',
                              reading: '',
                              note: ''
                            });
                            updateNodeData(selectedNode.id, { locationId: newLocId });
                          }
                        }}
                        className="text-xs text-primary hover:underline"
                        title="新しい場所を作成して設定"
                      >
                        {t('properties.addLocation')}
                      </button>
                    </div>
                    {stages.filter((s) => s.type === 'Location').length > 0 ? (
                      <div className="space-y-1">
                        <SearchableSelect
                          items={stages
                            .filter((s) => s.type === 'Location')
                            .map((s) => ({ id: s.id, label: s.name }))}
                          value={selectedNode.data.locationId ?? null}
                          onChange={(id) => updateNodeData(selectedNode.id, { locationId: id ?? '' })}
                        />
                        <p className="text-[11px] text-muted-foreground">
                          ※場所の一覧編集・詳細・削除は、左サイドバーの「舞台」タブから行えます。
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <input
                          type="text"
                          placeholder="例: エントランスロビー"
                          value={selectedNode.data.locationId || ''}
                          onChange={(e) => updateNodeData(selectedNode.id, { locationId: e.target.value })}
                          className={inputClass}
                        />
                        <p className="text-[11px] text-muted-foreground">
                          ※上の「+ 場所を追加」または左サイドバーの「舞台」タブ（種別: 場所）で登録・管理できます。
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Scene Purpose */}
                  <div>
                    <label className={labelClass}>{t('properties.purpose')}</label>
                    <input
                      type="text"
                      placeholder={t('properties.purposePlaceholder')}
                      value={selectedNode.data.purpose || ''}
                      onChange={(e) => updateNodeData(selectedNode.id, { purpose: e.target.value })}
                      className={inputClass}
                    />
                  </div>

                  {/* Read Aloud Text with Forbidden Terms Warning */}
                  <div className="border-t border-border/60 pt-3">
                    <label className={labelClass}>{t('properties.readAloudText')}</label>
                    <textarea
                      rows={3}
                      placeholder={t('properties.readAloudPlaceholder')}
                      value={selectedNode.data.readAloudText || ''}
                      onChange={(e) => updateNodeData(selectedNode.id, { readAloudText: e.target.value })}
                      className={`${inputClass} min-h-[70px] text-xs`}
                    />
                    {(() => {
                      const forbidden = FORBIDDEN_READ_ALOUD_TERMS.filter((term) =>
                        (selectedNode.data.readAloudText || '').includes(term)
                      );
                      if (forbidden.length > 0) {
                        return (
                          <div className="flex items-start gap-1.5 mt-1 text-[11px] text-destructive bg-destructive/10 p-2 rounded border border-destructive/20">
                            <AlertCircle size={14} className="shrink-0 mt-0.5" />
                            <div>
                              禁則メタ用語「{forbidden.join(', ')}」が含まれています。恐怖描写に置き換えてください。
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>

                  {/* KP Master Notes / Description */}
                  <div>
                    <label className={labelClass}>{t('properties.kpNotes')}</label>
                    <VariableSuggestInput
                      multiline
                      value={selectedNode.data.description || ''}
                      onChange={(val) => handleFieldChange('description', val)}
                      className={`${inputClass} min-h-[80px]`}
                      placeholder={t('properties.kpNotesPlaceholder')}
                    />
                  </div>

                  {/* Resource Check Subform (SAN check / Resource check) */}
                  {(() => {
                    const activeCheck = selectedNode.data.resourceCheck || selectedNode.data.sanCheck;
                    return (
                      <div className="p-2.5 rounded border border-border bg-muted/20 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                            <Dices size={14} className="text-purple-500 shrink-0" />
                            <span>{systemConfig.checkLabel}</span>
                          </div>
                          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                            <input
                              type="checkbox"
                              checked={Boolean(activeCheck)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  const defaultCheck = {
                                    trigger: '',
                                    successLoss: '0',
                                    failLoss: '1D3',
                                    resourceName: systemConfig.resourceName,
                                  };
                                  updateNodeData(selectedNode.id, {
                                    resourceCheck: defaultCheck,
                                    sanCheck: defaultCheck,
                                  });
                                } else {
                                  updateNodeData(selectedNode.id, {
                                    resourceCheck: undefined,
                                    sanCheck: undefined,
                                  });
                                }
                              }}
                              className="w-3.5 h-3.5 rounded"
                            />
                            <span>判定を設定</span>
                          </label>
                        </div>

                        {activeCheck && (
                          <div className="space-y-2 pt-1 border-t border-border/60">
                            <div>
                              <label className="text-[10px] text-muted-foreground block mb-0.5">
                                判定の契機・トリガー (Trigger)
                              </label>
                              <input
                                type="text"
                                placeholder="例: 怪異の目撃、罠の発動、精神的重圧"
                                value={activeCheck.trigger || ''}
                                onChange={(e) => {
                                  const updated = {
                                    ...activeCheck,
                                    trigger: e.target.value,
                                  };
                                  updateNodeData(selectedNode.id, {
                                    resourceCheck: updated,
                                    sanCheck: updated,
                                  });
                                }}
                                className={inputClass}
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[10px] text-muted-foreground block mb-0.5">
                                  {systemConfig.successLossLabel} (例: 0, 1)
                                </label>
                                <input
                                  type="text"
                                  placeholder="0"
                                  value={activeCheck.successLoss || ''}
                                  onChange={(e) => {
                                    const updated = {
                                      ...activeCheck,
                                      successLoss: e.target.value,
                                    };
                                    updateNodeData(selectedNode.id, {
                                      resourceCheck: updated,
                                      sanCheck: updated,
                                    });
                                  }}
                                  className={inputClass}
                                />
                              </div>
                              <div>
                                <label className="text-[10px] text-muted-foreground block mb-0.5">
                                  {systemConfig.failLossLabel} (例: 1D3, 1D6)
                                </label>
                                <input
                                  type="text"
                                  placeholder="1D3"
                                  value={activeCheck.failLoss || ''}
                                  onChange={(e) => {
                                    const updated = {
                                      ...activeCheck,
                                      failLoss: e.target.value,
                                    };
                                    updateNodeData(selectedNode.id, {
                                      resourceCheck: updated,
                                      sanCheck: updated,
                                    });
                                  }}
                                  className={inputClass}
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Encapsulated Item Operations (Required & Acquired) */}
                  <div className="border-t border-border/60 pt-3 space-y-3">
                    {/* Required Items */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className={labelClass}>必要アイテム (Required)</label>
                        <span className="text-[10px] text-muted-foreground">入場・達成に必要</span>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap gap-1">
                          {(selectedNode.data.requiredItems || []).map((itemId: string) => {
                            const res = resources.find((r) => r.id === itemId);
                            return (
                              <span key={itemId} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-xs">
                                <span>{res?.name || itemId}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next = (selectedNode.data.requiredItems || []).filter((id: string) => id !== itemId);
                                    updateNodeData(selectedNode.id, { requiredItems: next });
                                  }}
                                  className="hover:text-destructive text-[11px]"
                                >
                                  ×
                                </button>
                              </span>
                            );
                          })}
                        </div>
                        {resources.filter((r) => r.type === 'Item' || r.type === 'Equipment' || r.type === 'Knowledge').length > 0 && (
                          <SearchableSelect
                            placeholder="+ 必要アイテムを選択して追加..."
                            items={resources
                              .filter((r) => r.type === 'Item' || r.type === 'Equipment' || r.type === 'Knowledge')
                              .filter((r) => !(selectedNode.data.requiredItems || []).includes(r.id))
                              .map((r) => ({
                                id: r.id,
                                label: `${r.name} (${r.type})`,
                                searchableText: `${r.name} ${r.type}`,
                              }))}
                            value={null}
                            onChange={(id) => {
                              if (id) {
                                const next = [...(selectedNode.data.requiredItems || []), id];
                                updateNodeData(selectedNode.id, { requiredItems: next });
                              }
                            }}
                          />
                        )}
                      </div>
                    </div>

                    {/* Acquired Items */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className={labelClass}>獲得アイテム (Acquired)</label>
                        <span className="text-[10px] text-muted-foreground">ノード通過時に入手</span>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap gap-1">
                          {(selectedNode.data.acquiredItems || []).map((itemId: string) => {
                            const res = resources.find((r) => r.id === itemId);
                            return (
                              <span key={itemId} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-xs">
                                <span>{res?.name || itemId}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next = (selectedNode.data.acquiredItems || []).filter((id: string) => id !== itemId);
                                    updateNodeData(selectedNode.id, { acquiredItems: next });
                                  }}
                                  className="hover:text-destructive text-[11px]"
                                >
                                  ×
                                </button>
                              </span>
                            );
                          })}
                        </div>
                        {resources.filter((r) => r.type === 'Item' || r.type === 'Equipment' || r.type === 'Knowledge').length > 0 && (
                          <SearchableSelect
                            placeholder="+ 獲得アイテムを選択して追加..."
                            items={resources
                              .filter((r) => r.type === 'Item' || r.type === 'Equipment' || r.type === 'Knowledge')
                              .filter((r) => !(selectedNode.data.acquiredItems || []).includes(r.id))
                              .map((r) => ({
                                id: r.id,
                                label: `${r.name} (${r.type})`,
                                searchableText: `${r.name} ${r.type}`,
                              }))}
                            value={null}
                            onChange={(id) => {
                              if (id) {
                                const next = [...(selectedNode.data.acquiredItems || []), id];
                                updateNodeData(selectedNode.id, { acquiredItems: next });
                              }
                            }}
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Encapsulated Variable Operations */}
                  <div className="border-t border-border/60 pt-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className={labelClass}>変数操作 (Variable Operations)</label>
                      <span className="text-[10px] text-muted-foreground">通過時に変数を更新</span>
                    </div>

                    {Object.keys(gameState.variables).length === 0 ? (
                      <p className="text-[11px] text-muted-foreground">※「変数」タブで変数を定義すると、ここで加算・代入が設定できます。</p>
                    ) : (
                      <div className="space-y-2">
                        {(selectedNode.data.variableOperations || []).map((op: any, index: number) => (
                          <div key={index} className="p-2 rounded border border-border bg-background flex items-center gap-1.5 text-xs">
                            <select
                              value={op.variableName}
                              onChange={(e) => {
                                const next = [...(selectedNode.data.variableOperations || [])];
                                next[index] = { ...op, variableName: e.target.value };
                                updateNodeData(selectedNode.id, { variableOperations: next });
                              }}
                              className={`${inputClass} flex-1 text-xs`}
                            >
                              {Object.keys(gameState.variables).map((vName) => (
                                <option key={vName} value={vName}>{vName}</option>
                              ))}
                            </select>

                            <select
                              value={op.operator || 'set'}
                              onChange={(e) => {
                                const next = [...(selectedNode.data.variableOperations || [])];
                                next[index] = { ...op, operator: e.target.value };
                                updateNodeData(selectedNode.id, { variableOperations: next });
                              }}
                              className={`${inputClass} w-20 text-xs`}
                            >
                              <option value="set">＝ 代入</option>
                              <option value="add">＋ 加算</option>
                              <option value="subtract">－ 減算</option>
                            </select>

                            <input
                              type="text"
                              value={op.value ?? ''}
                              onChange={(e) => {
                                const next = [...(selectedNode.data.variableOperations || [])];
                                const raw = e.target.value;
                                next[index] = { ...op, value: !isNaN(Number(raw)) && raw !== '' ? Number(raw) : raw };
                                updateNodeData(selectedNode.id, { variableOperations: next });
                              }}
                              className={`${inputClass} w-16 text-xs`}
                              placeholder="値"
                            />

                            <button
                              type="button"
                              onClick={() => {
                                const next = (selectedNode.data.variableOperations || []).filter((_: any, i: number) => i !== index);
                                updateNodeData(selectedNode.id, { variableOperations: next });
                              }}
                              className="text-muted-foreground hover:text-destructive px-1"
                              title="削除"
                            >
                              ×
                            </button>
                          </div>
                        ))}

                        <button
                          type="button"
                          onClick={() => {
                            const defaultVar = Object.keys(gameState.variables)[0] || '';
                            const next = [
                              ...(selectedNode.data.variableOperations || []),
                              { variableName: defaultVar, operator: 'set', value: 1 },
                            ];
                            updateNodeData(selectedNode.id, { variableOperations: next });
                          }}
                          className="w-full py-1 text-[11px] rounded border border-dashed border-border hover:border-primary text-muted-foreground hover:text-primary transition-colors flex items-center justify-center gap-1"
                        >
                          <span>+ 変数操作を追加</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Element / Information Node */}
              {(selectedNode.type === 'information' || selectedNode.type === 'element') && (
                <div className="space-y-4">
                  {/* Chapter */}
                  <div>
                    <label className={labelClass}>{t('properties.chapter')}</label>
                    <input
                      type="number"
                      min={0}
                      max={20}
                      value={selectedNode.data.chapter ?? 1}
                      onChange={(e) =>
                        updateNodeData(selectedNode.id, { chapter: Number(e.target.value) })
                      }
                      className={inputClass}
                    />
                  </div>

                  {/* Operation Type & Quantity */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={labelClass}>{t('properties.actionType')}</label>
                      <select
                        name="actionType"
                        value={selectedNode.data.actionType || 'obtain'}
                        onChange={handleChange}
                        className={inputClass}
                      >
                        <option value="obtain">{t('properties.actionTypeObtain')}</option>
                        <option value="consume">{t('properties.actionTypeConsume')}</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>{t('properties.operationQuantity')}</label>
                      <input
                        type="number"
                        name="quantity"
                        min={1}
                        value={selectedNode.data.quantity || 1}
                        onChange={handleChange}
                        className={inputClass}
                      />
                    </div>
                  </div>

                  {/* Operation Target */}
                  <div>
                    <label className={labelClass}>{t('properties.operationTarget')}</label>
                    {resources.length === 0 ? (
                       <div className={ERROR_CLASS}>
                           {t('resources.noResources') || "Elements not defined"}
                       </div>
                    ) : (
                        <SearchableSelect
                            items={resources.map((r) => {
                                const typeLabel = t(`resources.types.${r.type}` as any) || r.type;
                                return {
                                    id: r.id,
                                    label: `${r.name} (${typeLabel})`,
                                    searchableText: `${r.name} ${typeLabel} ${r.type}`,
                                };
                            })}
                            value={selectedNode.data.referenceId ?? null}
                            onChange={(id) => {
                                if (!id) {
                                    updateNodeData(selectedNode.id, { referenceId: undefined, infoValue: '' });
                                    return;
                                }
                                const resource = resources.find((r) => r.id === id);
                                updateNodeData(selectedNode.id, {
                                    referenceId: id,
                                    infoValue: resource?.name || '',
                                });
                            }}
                        />
                    )}
                  </div>

                  {/* Description / Notes */}
                  <div>
                    <label className={labelClass}>{t('properties.description')}</label>
                    <VariableSuggestInput
                      multiline
                      value={selectedNode.data.description || ''}
                      onChange={(val) => handleFieldChange('description', val)}
                      className={`${inputClass} min-h-[80px]`}
                      placeholder="入手時の演出やメモなど"
                    />
                  </div>

                  <EntityVariablesPropertySection
                    variables={selectedNode.data.variables}
                    entityType="node"
                    entityId={selectedNode.id}
                  />
                </div>
              )}

              {/* Branch Node */}
              {selectedNode.type === 'branch' && (
                <div className="space-y-4">
                  {/* Chapter */}
                  <div>
                    <label className={labelClass}>{t('properties.chapter')}</label>
                    <input
                      type="number"
                      min={0}
                      max={20}
                      value={selectedNode.data.chapter ?? 1}
                      onChange={(e) =>
                        updateNodeData(selectedNode.id, { chapter: Number(e.target.value) })
                      }
                      className={inputClass}
                    />
                  </div>

                  {/* Unified Progressive Branch Routes Manager */}
                  <div className="space-y-4 pt-1">
                    <div className="flex items-center justify-between pb-1 border-b border-border">
                      <div>
                        <label className={`${labelClass} mb-0`}>
                          {((selectedNode.data.branches?.length ?? (selectedNode.data.conditionValue ? 1 : 0)) >= 2)
                            ? `多分岐ルート一覧 (${selectedNode.data.branches?.length} ルート)`
                            : '条件判定 (True / False)'}
                        </label>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {((selectedNode.data.branches?.length ?? (selectedNode.data.conditionValue ? 1 : 0)) >= 2)
                            ? '上から順に判定し、最初に合致したルートへ進みます'
                            : '「+ 分岐ルートを追加」で多分岐（複数ルート）に拡張できます'}
                        </p>
                      </div>
                    </div>

                    {/* Quick Presets for TRPG Check / Selection */}
                    <div className="p-2 rounded-md bg-muted/40 border border-border/60 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                        <Sparkles size={12} className="text-amber-500 shrink-0" />
                        <span>汎用判定・選択プリセット</span>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            const newBranches = [
                              { id: `case_${Date.now()}_succ`, label: '成功 (Success)', conditionType: 'check', conditionValue: '' },
                              { id: `case_${Date.now()}_fail`, label: '失敗 (Failure)', conditionType: 'check', conditionValue: '' },
                            ];
                            updateNodeData(selectedNode.id, { branches: newBranches, branchType: 'switch' });
                          }}
                          className="px-1.5 py-1 bg-background hover:bg-accent text-foreground rounded text-[10px] font-medium border border-border shadow-xs transition-colors cursor-pointer text-center"
                          title="二値判定（成功 / 失敗）の2分岐を自動生成"
                        >
                          成否 (2分岐)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const newBranches = [
                              { id: `case_${Date.now()}_crit`, label: '大成功 (Critical)', conditionType: 'check', conditionValue: '' },
                              { id: `case_${Date.now()}_succ`, label: '通常成功 (Success)', conditionType: 'check', conditionValue: '' },
                              { id: `case_${Date.now()}_fail`, label: '失敗 (Failure)', conditionType: 'check', conditionValue: '' },
                              { id: `case_${Date.now()}_fumb`, label: '大失敗 (Fumble)', conditionType: 'check', conditionValue: '' },
                            ];
                            updateNodeData(selectedNode.id, { branches: newBranches, branchType: 'switch' });
                          }}
                          className="px-1.5 py-1 bg-background hover:bg-accent text-foreground rounded text-[10px] font-medium border border-border shadow-xs transition-colors cursor-pointer text-center"
                          title="4段階成果（大成功 / 成功 / 失敗 / 大失敗）の4分岐を自動生成"
                        >
                          4段階成果
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const newBranches = [
                              { id: `case_${Date.now()}_opt1`, label: '調査対象 A', conditionType: 'variable', conditionValue: '' },
                              { id: `case_${Date.now()}_opt2`, label: '調査対象 B', conditionType: 'variable', conditionValue: '' },
                              { id: `case_${Date.now()}_opt3`, label: '別エリアへ移動', conditionType: 'variable', conditionValue: '' },
                            ];
                            updateNodeData(selectedNode.id, { branches: newBranches, branchType: 'switch' });
                          }}
                          className="px-1.5 py-1 bg-background hover:bg-accent text-foreground rounded text-[10px] font-medium border border-border shadow-xs transition-colors cursor-pointer text-center"
                          title="探索・行動選択（3択）を自動生成"
                        >
                          調査選択 (3択)
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {(() => {
                        const rawBranches = selectedNode.data.branches;
                        const hasLegacy = Boolean(selectedNode.data.conditionValue);
                        const branches: any[] = (rawBranches && rawBranches.length > 0)
                          ? rawBranches
                          : (hasLegacy ? [{
                              id: 'case-1',
                              label: 'True (条件成立)',
                              conditionType: selectedNode.data.conditionType || 'variable',
                              conditionValue: selectedNode.data.conditionValue,
                            }] : [{
                              id: 'case-1',
                              label: 'True (条件成立)',
                              conditionType: 'variable',
                              conditionValue: '',
                            }]);

                        const isMulti = branches.length >= 2;

                        return (
                          <>
                            {branches.map((branch: any, index: number) => {
                              const condType = branch.conditionType || 'variable';

                              return (
                                <div
                                  key={branch.id || index}
                                  className="p-3 rounded-md border border-purple-200/90 dark:border-purple-800/80 bg-purple-50/40 dark:bg-purple-950/20 space-y-2.5 relative"
                                >
                                  {/* Route Header */}
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-purple-900 dark:text-purple-200">
                                      {isMulti ? `ルート ${index + 1}` : '【True】成立時の進出条件'}
                                    </span>
                                    {isMulti && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const newBranches = branches.filter((_: any, i: number) => i !== index);
                                          // If transitioning back to 2-way T/F (length <= 1), clear leftover route label so it defaults cleanly to True
                                          if (newBranches.length <= 1 && newBranches[0]) {
                                            newBranches[0] = {
                                              ...newBranches[0],
                                              label: '',
                                            };
                                          }
                                          updateNodeData(selectedNode.id, {
                                            branches: newBranches,
                                            ...(newBranches.length <= 1 && newBranches[0] ? {
                                              conditionType: newBranches[0].conditionType,
                                              conditionValue: newBranches[0].conditionValue,
                                            } : {})
                                          });
                                        }}
                                        className="text-muted-foreground hover:text-destructive text-xs px-1.5 py-0.5 rounded hover:bg-destructive/10 transition-colors"
                                        title="このルートを削除"
                                      >
                                        ×
                                      </button>
                                    )}
                                  </div>

                                  {/* Route Label */}
                                  <div>
                                    <label className="text-[10px] text-muted-foreground block mb-1">
                                      {isMulti ? 'ルート名 (ピン表示ラベル)' : 'True ピン表示ラベル (任意)'}
                                    </label>
                                    <input
                                      type="text"
                                      value={branch.label || ''}
                                      onChange={(e) => {
                                        const newBranches = [...branches];
                                        newBranches[index] = { ...branch, label: e.target.value };
                                        updateNodeData(selectedNode.id, { branches: newBranches });
                                      }}
                                      className={inputClass}
                                      placeholder={isMulti ? `例: ルート ${index + 1} または 潜入成功` : '未入力時は「True (一致)」'}
                                    />
                                  </div>

                                  {/* Condition Category Picker */}
                                  <div>
                                    <label className="text-[10px] text-muted-foreground block mb-1">
                                      判定対象 (カテゴリ)
                                    </label>
                                    <select
                                      value={condType}
                                      onChange={(e) => {
                                        const newType = e.target.value;
                                        const newBranches = [...branches];
                                        newBranches[index] = {
                                          ...branch,
                                          conditionType: newType,
                                          conditionValue: '',
                                        };
                                        updateNodeData(selectedNode.id, {
                                          branches: newBranches,
                                          conditionType: newType,
                                          conditionValue: '',
                                        });
                                      }}
                                      className={inputClass}
                                    >
                                      <option value="variable">変数・ステータス計算式 (SAN, HP, フラグ等)</option>
                                      <option value="item_held">アイテム所持判定</option>
                                      <option value="stage_visited">舞台・場所の通過/到達</option>
                                      <option value="character_met">登場人物との会話/遭遇</option>
                                      <option value="clue_found">手がかり・情報の入手</option>
                                      <option value="check">技能・ダイス判定</option>
                                    </select>
                                  </div>

                                  {/* Category-Specific Value Selectors */}
                                  {condType === 'item_held' && (
                                    <div>
                                      <label className="text-[10px] text-muted-foreground block mb-1">
                                        対象アイテム
                                      </label>
                                      {resources.filter((r) => r.type === 'Item' || r.type === 'Equipment').length === 0 ? (
                                        <div className={ERROR_CLASS}>アイテムが未登録です</div>
                                      ) : (
                                        <SearchableSelect
                                          items={resources
                                            .filter((r) => r.type === 'Item' || r.type === 'Equipment')
                                            .map((r) => ({
                                              id: r.id,
                                              label: `${r.name} (${r.type})`,
                                              searchableText: `${r.name} ${r.type}`,
                                            }))}
                                          value={branch.conditionValue ?? null}
                                          onChange={(id) => {
                                            const newBranches = [...branches];
                                            newBranches[index] = { ...branch, conditionValue: id ?? '' };
                                            updateNodeData(selectedNode.id, {
                                              branches: newBranches,
                                              conditionValue: id ?? '',
                                            });
                                          }}
                                        />
                                      )}
                                    </div>
                                  )}

                                  {condType === 'stage_visited' && (
                                    <div>
                                      <label className="text-[10px] text-muted-foreground block mb-1">
                                        対象の舞台・場所
                                      </label>
                                      {stages.length === 0 ? (
                                        <div className={ERROR_CLASS}>舞台・場所が未登録です</div>
                                      ) : (
                                        <SearchableSelect
                                          items={stages.map((s) => ({
                                            id: s.id,
                                            label: s.name,
                                            searchableText: `${s.name} ${s.reading || ''}`,
                                          }))}
                                          value={branch.conditionValue ?? null}
                                          onChange={(id) => {
                                            const newBranches = [...branches];
                                            newBranches[index] = { ...branch, conditionValue: id ?? '' };
                                            updateNodeData(selectedNode.id, {
                                              branches: newBranches,
                                              conditionValue: id ?? '',
                                            });
                                          }}
                                        />
                                      )}
                                    </div>
                                  )}

                                  {condType === 'character_met' && (
                                    <div>
                                      <label className="text-[10px] text-muted-foreground block mb-1">
                                        対象の登場人物
                                      </label>
                                      {characters.length === 0 ? (
                                        <div className={ERROR_CLASS}>登場人物が未登録です</div>
                                      ) : (
                                        <SearchableSelect
                                          items={characters.map((c) => ({
                                            id: c.id,
                                            label: `${c.name} (${c.type})`,
                                            searchableText: `${c.name} ${c.reading || ''}`,
                                          }))}
                                          value={branch.conditionValue ?? null}
                                          onChange={(id) => {
                                            const newBranches = [...branches];
                                            newBranches[index] = { ...branch, conditionValue: id ?? '' };
                                            updateNodeData(selectedNode.id, {
                                              branches: newBranches,
                                              conditionValue: id ?? '',
                                            });
                                          }}
                                        />
                                      )}
                                    </div>
                                  )}

                                  {condType === 'clue_found' && (
                                    <div>
                                      <label className="text-[10px] text-muted-foreground block mb-1">
                                        対象の手がかり・情報
                                      </label>
                                      {resources.filter((r) => r.type === 'Knowledge' || r.type === 'Item').length === 0 ? (
                                        <div className={ERROR_CLASS}>手がかり・情報が未登録です</div>
                                      ) : (
                                        <SearchableSelect
                                          items={resources
                                            .filter((r) => r.type === 'Knowledge' || r.type === 'Item')
                                            .map((r) => ({
                                              id: r.id,
                                              label: `${r.name} (${r.type})`,
                                              searchableText: `${r.name} ${r.type}`,
                                            }))}
                                          value={branch.conditionValue ?? null}
                                          onChange={(id) => {
                                            const newBranches = [...branches];
                                            newBranches[index] = { ...branch, conditionValue: id ?? '' };
                                            updateNodeData(selectedNode.id, {
                                              branches: newBranches,
                                              conditionValue: id ?? '',
                                            });
                                          }}
                                        />
                                      )}
                                    </div>
                                  )}

                                  {condType === 'check' && (
                                    <div className="space-y-2">
                                      <div>
                                        <label className="text-[10px] text-muted-foreground block mb-1">
                                          判定技能名 / 判定対象
                                        </label>
                                        <VariableSuggestInput
                                          value={branch.conditionValue || ''}
                                          onChange={(val) => {
                                            const newBranches = [...branches];
                                            newBranches[index] = { ...branch, conditionValue: val };
                                            updateNodeData(selectedNode.id, {
                                              branches: newBranches,
                                              conditionValue: val,
                                            });
                                          }}
                                          className={inputClass}
                                          placeholder="例: 目星 または アイデア"
                                        />
                                      </div>
                                    </div>
                                  )}

                                  {condType === 'variable' && (
                                    <VisualConditionBuilder
                                      value={branch.conditionValue || ''}
                                      onChange={(val) => {
                                        const newBranches = [...branches];
                                        newBranches[index] = { ...branch, conditionValue: val };
                                        updateNodeData(selectedNode.id, {
                                          branches: newBranches,
                                          conditionValue: val,
                                        });
                                      }}
                                      variables={gameState.variables}
                                      label="進出条件式"
                                    />
                                  )}
                                </div>
                              );
                            })}

                            <button
                              type="button"
                              onClick={() => {
                                const baseBranches = branches.map((b: any, i: number) => {
                                  if (i === 0 && (!b.label || b.label === 'True (条件成立)' || b.label === 'True')) {
                                    return { ...b, label: 'ルート 1' };
                                  }
                                  return b;
                                });
                                const newBranches = [
                                  ...baseBranches,
                                  {
                                    id: `case_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                                    label: `ルート ${baseBranches.length + 1}`,
                                    conditionType: 'variable',
                                    conditionValue: '',
                                  },
                                ];
                                updateNodeData(selectedNode.id, { branches: newBranches });
                              }}
                              className="w-full py-1.5 bg-primary/15 hover:bg-primary/25 text-primary rounded font-medium text-xs flex items-center justify-center gap-1 transition-colors cursor-pointer"
                            >
                              <span>+ 新しい分岐ルートを追加</span>
                            </button>

                            <p className="text-[11px] text-muted-foreground p-2 rounded bg-muted/40 border border-border/50">
                              {isMulti
                                ? '※どのルートの条件も満たさなかった場合は「その他 (Else)」ピンへ自動的に進みます。'
                                : '※条件を満たさない場合は「False (その他)」ピンへ自動的に進みます。'}
                            </p>
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Description / Notes */}
                  <div>
                    <label className={labelClass}>{t('properties.description')}</label>
                    <VariableSuggestInput
                      multiline
                      value={selectedNode.data.description || ''}
                      onChange={(val) => handleFieldChange('description', val)}
                      className={`${inputClass} min-h-[80px]`}
                      placeholder="判定や分岐に関するメモ・補足"
                    />
                  </div>
                </div>
              )}

              {/* Variable Node */}
              {selectedNode.type === 'variable' && (
                <div className="space-y-4">
                  <div>
                    <label className={labelClass}>{t('properties.targetVariable')}</label>
                    {Object.keys(gameState.variables).length === 0 ? (
                       <div className={ERROR_CLASS}>
                           {t('variables.noVariables') || "No variables defined"}
                       </div>
                    ) : (
                        <SearchableSelect
                            items={Object.keys(gameState.variables).map((name) => ({
                                id: name,
                                label: name,
                            }))}
                            value={selectedNode.data.targetVariable ?? null}
                            onChange={(id) => handleFieldChange('targetVariable', id ?? '')}
                        />
                    )}
                  </div>
                  {/* Operation Type (Set / Add / Subtract) */}
                  <div>
                    <label className={labelClass}>{t('properties.variableOperator' as any) || '操作タイプ'}</label>
                    <select
                      value={selectedNode.data.variableOperator || 'set'}
                      onChange={(e) => handleFieldChange('variableOperator', e.target.value)}
                      className={inputClass}
                    >
                      <option value="set">{t('properties.variableOpSet' as any) || '代入 (＝)'}</option>
                      {(!selectedNode.data.targetVariable || gameState.variables[selectedNode.data.targetVariable]?.type === 'number') && (
                        <>
                          <option value="add">{t('properties.variableOpAdd' as any) || '加算 (＋)'}</option>
                          <option value="subtract">{t('properties.variableOpSubtract' as any) || '減算 (－)'}</option>
                        </>
                      )}
                    </select>
                  </div>

                  <div>
                    <label className={labelClass}>
                      {selectedNode.data.variableOperator === 'add'
                        ? (t('properties.variableOpAdd' as any) || '加算値 (＋)')
                        : selectedNode.data.variableOperator === 'subtract'
                        ? (t('properties.variableOpSubtract' as any) || '減算値 (－)')
                        : t('properties.assignmentValue')}
                    </label>
                    {(() => {
                        const targetVarName = selectedNode.data.targetVariable;
                        const variables = useScenarioStore.getState().gameState.variables;
                        
                        const targetVar = targetVarName ? variables[targetVarName] : (Object.keys(variables).length > 0 ? variables[Object.keys(variables)[0]] : null);

                        if (targetVar && targetVar.type === 'boolean') {
                            return (
                                <select
                                    value={selectedNode.data.variableValue || 'true'}
                                    onChange={(e) => handleFieldChange('variableValue', e.target.value)}
                                    className={inputClass}
                                >
                                    <option value="true">True</option>
                                    <option value="false">False</option>
                                </select>
                            );
                        }
                        
                        return (
                            <>
                                <VariableSuggestInput
                                    value={selectedNode.data.variableValue || ''}
                                    onChange={(val) => handleFieldChange('variableValue', val)}
                                    className={inputClass}
                                    placeholder={targetVar?.type === 'number' ? "Number or ${Var}" : "Value or ${Var}"}
                                />
                                {targetVar && targetVar.type === 'number' && 
                                 selectedNode.data.variableValue && 
                                 isNaN(Number(selectedNode.data.variableValue)) && 
                                 !selectedNode.data.variableValue.startsWith('${') && (
                                    <div className="text-xs text-amber-500 mt-1">
                                        Warning: Value should be a number or variable reference.
                                    </div>
                                )}
                            </>
                        );
                    })()}
                  </div>
                  <div>
                    <label className={labelClass}>{t('properties.description')}</label>
                    <VariableSuggestInput
                      multiline
                      value={selectedNode.data.description || ''}
                      onChange={(val) => handleFieldChange('description', val)}
                      className={`${inputClass} min-h-[80px]`}
                      placeholder="変数操作に関するメモ"
                    />
                  </div>
                </div>
              )}

              {/* Jump Node */}
              {selectedNode.type === 'jump' && (
                <div className="space-y-4">
                  <div>
                    <label className={labelClass}>{t('properties.jumpTarget')}</label>
                    <JumpTargetCombobox
                        value={
                            typeof selectedNode.data.jumpTarget === 'string'
                                ? null
                                : (selectedNode.data.jumpTarget ?? null)
                        }
                        onChange={(target) => updateNodeData(selectedNode.id, { jumpTarget: target })}
                        excludeNodeId={selectedNode.id}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>{t('properties.description')}</label>
                    <VariableSuggestInput
                      multiline
                      value={selectedNode.data.description || ''}
                      onChange={(val) => handleFieldChange('description', val)}
                      className={`${inputClass} min-h-[80px]`}
                      placeholder="ジャンプ理由やフローメモ"
                    />
                  </div>
                </div>
              )}

              {/* General Fallback Nodes: memo, sticky, group */}
              {selectedNode.type !== 'event' && 
               selectedNode.type !== 'information' && 
               selectedNode.type !== 'element' && 
               selectedNode.type !== 'branch' && 
               selectedNode.type !== 'variable' && 
               selectedNode.type !== 'jump' && (
                <div>
                  <label className={labelClass}>{t('properties.description')}</label>
                  <VariableSuggestInput
                    multiline
                    value={selectedNode.data.description || ''}
                    onChange={(val) => handleFieldChange('description', val)}
                    className={`${inputClass} ${selectedNode.type === 'sticky' ? 'min-h-[400px]' : 'min-h-[80px]'}`}
                  />
                </div>
              )}
            </div>
          </div>
        </aside>
    </MobileBackdrop>
  );
}));
