import { useScenarioStore } from '../store/scenarioStore';
import type { ChangeEvent } from 'react';
import { useTranslation } from '../hooks/useTranslation';
import { VariableSuggestInput } from './VariableSuggestInput';
import { substituteVariables } from '../utils/textUtils';

interface PropertyPanelProps {
  width: number;
}

export const PropertyPanel = ({ width }: PropertyPanelProps) => {
  const { nodes, selectedNodeId, updateNodeData, gameState } = useScenarioStore();
  const { t } = useTranslation();
  
  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  if (!selectedNode) {
    return (
      <aside className="border-l flex flex-col bg-card border-border" style={{ width }}>
        <div className="p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-card-foreground">{t.common.properties}</h2>
        </div>
        <div className="p-4 flex-1 overflow-y-auto text-muted-foreground">
          <p>{t.properties.selectNode}</p>
        </div>
      </aside>
    );
  }

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    updateNodeData(selectedNode.id, { [name]: value });
  };

  const handleFieldChange = (name: string, value: string) => {
    updateNodeData(selectedNode.id, { [name]: value });
  };

  const inputClass = "w-full border rounded px-3 py-2 focus:outline-none focus:border-primary bg-background border-input text-foreground";
  const labelClass = "block text-sm font-medium mb-1 text-foreground";

  return (
    <aside className="border-l flex flex-col bg-card border-border" style={{ width }}>
      <div className="p-4 border-b border-border">
        <h2 className="text-lg font-semibold text-card-foreground">{t.common.properties}</h2>
        <div className="text-xs mt-1 text-muted-foreground">ID: {selectedNode.id}</div>
        <div className="text-xs text-muted-foreground">Type: {selectedNode.type}</div>
      </div>
      <div className="p-4 flex-1 overflow-y-auto">
        <div className="space-y-4">
          <div>
            <label className={labelClass}>{t.properties.label}</label>
            <VariableSuggestInput
              value={selectedNode.data.label}
              onChange={(val) => handleFieldChange('label', val)}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>{t.properties.description}</label>
            <VariableSuggestInput
              multiline
              value={selectedNode.data.description || ''}
              onChange={(val) => handleFieldChange('description', val)}
              className={`${inputClass} ${selectedNode.type === 'sticky' ? 'min-h-[400px]' : 'min-h-[80px]'}`}
            />
          </div>

          {(selectedNode.type === 'information' || selectedNode.type === 'element') && (
            <>
              <div>
                <label className={labelClass}>{t.properties.infoType}</label>
                <select
                  name="infoType"
                  value={selectedNode.data.infoType || 'knowledge'}
                  onChange={handleChange}
                  className={inputClass}
                >
                  <option value="knowledge">{t.gameState.knowledge}</option>
                  <option value="item">{t.gameState.inventory}</option>
                  <option value="skill">{t.gameState.skills}</option>
                  <option value="stat">{t.gameState.stats}</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>{t.properties.actionType}</label>
                <select
                  name="actionType"
                  value={selectedNode.data.actionType || 'obtain'}
                  onChange={handleChange}
                  className={inputClass}
                >
                  <option value="obtain">{t.properties.actionTypeObtain}</option>
                  <option value="consume">{t.properties.actionTypeConsume}</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>{t.properties.operationTarget}</label>
                {selectedNode.data.actionType === 'consume' ? (
                    <select
                        value={selectedNode.data.infoValue || ''}
                        onChange={(e) => handleFieldChange('infoValue', e.target.value)}
                        className={inputClass}
                    >
                        <option value="">{t.properties.selectItem}</option>
                        {Array.from(new Set(
                            nodes
                                .filter(n => 
                                    (n.type === 'element' || n.type === 'information') && 
                                    n.data.infoType === (selectedNode.data.infoType || 'knowledge') &&
                                    n.data.actionType !== 'consume' // Only show items that are obtained elsewhere
                                )
                                .map(n => n.data.infoValue)
                                .filter(Boolean)
                        )).map((val) => (
                            <option key={val} value={val}>{val}</option>
                        ))}
                    </select>
                ) : (
                    <VariableSuggestInput
                        value={selectedNode.data.infoValue || ''}
                        onChange={(val) => handleFieldChange('infoValue', val)}
                        className={inputClass}
                    />
                )}
              </div>
              <div>
                <label className={labelClass}>{t.properties.operationQuantity}</label>
                <input
                  type="number"
                  name="quantity"
                  value={selectedNode.data.quantity || 1}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>
            </>
          )}

          {selectedNode.type === 'variable' && (
              <>
                <div>
                    <label className={labelClass}>{t.properties.targetVariable}</label>
                    <select
                        value={selectedNode.data.targetVariable || ''}
                        onChange={(e) => handleFieldChange('targetVariable', e.target.value)}
                        className={inputClass}
                    >
                        {Object.keys(useScenarioStore.getState().gameState.variables).length === 0 && (
                             <option value="" disabled>{t.variables.noVariables}</option>
                        )}
                        {Object.keys(useScenarioStore.getState().gameState.variables).map((v) => (
                            <option key={v} value={v}>{v}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className={labelClass}>{t.properties.assignmentValue}</label>
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
              </>
          )}

          {selectedNode.type === 'branch' && (
            <>
              <div>
                <label className={labelClass}>{t.properties.branchType}</label>
                <select
                  name="branchType"
                  value={selectedNode.data.branchType || 'if_else'}
                  onChange={handleChange}
                  className={inputClass}
                >
                  <option value="if_else">If / Else</option>
                  <option value="switch">Switch</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>
                    {t.properties.checkTarget}
                </label>
                {selectedNode.data.branchType === 'switch' ? (
                    <VariableSuggestInput
                        value={selectedNode.data.conditionValue || selectedNode.data.conditionVariable || ''}
                        onChange={(val) => handleFieldChange('conditionValue', val)}
                        className={inputClass}
                        placeholder={t.properties.selectVariable}
                    />
                ) : (
                    <VariableSuggestInput
                        value={selectedNode.data.conditionValue || ''}
                        onChange={(val) => handleFieldChange('conditionValue', val)}
                        className={inputClass}
                        placeholder="e.g. hp >= 10"
                    />
                )}
              </div>

              {selectedNode.data.branchType === 'switch' && (
                  <div className="mt-4 border-t pt-4 border-border">
                      <label className={`block text-sm font-medium mb-2 ${labelClass}`}>Cases (Branches)</label>
                      <div className="space-y-2">
                          {(selectedNode.data.branches || []).map((branch, index) => (
                              <div key={branch.id} className="flex gap-2">
                                  <div className="flex-1">
                                    <VariableSuggestInput
                                        value={branch.label}
                                        onChange={(val) => {
                                            const newBranches = [...(selectedNode.data.branches || [])];
                                            newBranches[index] = { ...branch, label: val };
                                            updateNodeData(selectedNode.id, { branches: newBranches });
                                        }}
                                        className={`w-full border rounded px-2 py-1 text-sm bg-background border-input text-foreground`}
                                        placeholder="Case Value"
                                    />
                                  </div>
                                  <button 
                                      onClick={() => {
                                          const newBranches = (selectedNode.data.branches || []).filter((_, i) => i !== index);
                                          updateNodeData(selectedNode.id, { branches: newBranches });
                                      }}
                                      className="px-2 py-1 bg-destructive/20 text-destructive rounded hover:bg-destructive/30"
                                  >
                                      ×
                                  </button>
                              </div>
                          ))}
                          <button 
                               onClick={() => {
                                  const newBranches = [...(selectedNode.data.branches || []), { id: `case-${Date.now()}`, label: 'New Case' }];
                                  updateNodeData(selectedNode.id, { branches: newBranches });
                              }}
                              className="w-full py-1 bg-primary/20 text-primary rounded hover:bg-primary/30 text-sm"
                          >
                              + Add Case
                          </button>
                      </div>
                  </div>
              )}
            </>
          )}
          
          {selectedNode.type === 'event' && (
             <div className="flex items-center gap-2">
                <input 
                    type="checkbox"
                    name="isStart"
                    checked={!!selectedNode.data.isStart}
                    onChange={(e) => updateNodeData(selectedNode.id, { isStart: e.target.checked })}
                    className="w-4 h-4"
                />
                <label className={labelClass}>{t.properties.isStartNode}</label>
             </div>
          )}

          {selectedNode.type === 'jump' && (
              <div>
                  <label className={labelClass}>{t.properties.jumpTarget}</label>
                  <select
                      value={selectedNode.data.jumpTarget || ''}
                      onChange={(e) => updateNodeData(selectedNode.id, { jumpTarget: e.target.value })}
                      className={inputClass}
                  >
                      {nodes.filter(n => n.id !== selectedNode.id && n.type !== 'sticky').length === 0 && (
                           <option value="" disabled>{t.properties.noNodesAvailable}</option>
                      )}
                      {nodes
                          .filter(n => n.id !== selectedNode.id && n.type !== 'sticky')
                          .map(n => (
                              <option key={n.id} value={n.id}>
                                  {substituteVariables(n.data.label, gameState.variables)} ({n.type})
                              </option>
                          ))
                      }
                  </select>
              </div>
          )}
        </div>
      </div>
    </aside>
  );
};
