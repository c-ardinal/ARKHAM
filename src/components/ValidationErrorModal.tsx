import React, { useMemo } from 'react';
import { X } from 'lucide-react';

interface ValidationErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  errors: string[];
  warnings: string[];
  corrections?: string[];
  jsonContent?: string;
}

// Helper function to extract line number from error message
const extractLineInfo = (message: string): { lineNumber: number | null; cleanMessage: string; variableName?: string; isVariable: boolean; isEdgeType?: boolean } => {
  // Try to extract patterns like "ノード 0:", "エッジ 1:", etc.
  const nodeMatch = message.match(/ノード (\d+):/);
  const edgeMatch = message.match(/エッジ (\d+):/);
  const variableMatch = message.match(/変数 "([^"]+)":/);
  const edgeTypeMatch = message.match(/edgeTypeが不正/);
  
  if (nodeMatch) {
    return { lineNumber: parseInt(nodeMatch[1]), cleanMessage: message, isVariable: false };
  }
  if (edgeMatch) {
    return { lineNumber: parseInt(edgeMatch[1]), cleanMessage: message, isVariable: false };
  }
  if (variableMatch) {
    return { lineNumber: 0, cleanMessage: message, variableName: variableMatch[1], isVariable: true };
  }
  if (edgeTypeMatch) {
    return { lineNumber: null, cleanMessage: message, isVariable: false, isEdgeType: true };
  }
  
  return { lineNumber: null, cleanMessage: message, isVariable: false };
};

// Helper function to get code snippet with context
const getCodeSnippetWithContext = (jsonContent: string, targetIndex: number, type: 'node' | 'edge' | 'variable', _errorMessage: string, variableName?: string): { snippet: string; startLine: number; itemStartLine?: number; itemEndLine?: number } | null => {
  try {
    const data = JSON.parse(jsonContent);
    const formatted = JSON.stringify(data, null, 2);
    const lines = formatted.split('\n');
    
    let itemStartLine = 0;
    let itemEndLine = 0;
    
    if (type === 'variable') {
      // Handle variable errors
      if (!variableName) return null;
      
      // Find the variables section
      let inVariables = false;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('"variables":')) {
          inVariables = true;
          continue;
        }
        
        if (inVariables && lines[i].includes(`"${variableName}":`)) {
          itemStartLine = i;
          // Find the end of this variable object
          let braceCount = 0;
          let foundStart = false;
          for (let j = i; j < lines.length; j++) {
            const line = lines[j];
            if (line.includes('{')) {
              foundStart = true;
            }
            if (foundStart) {
              braceCount += (line.match(/{/g) || []).length;
              braceCount -= (line.match(/}/g) || []).length;
              if (braceCount === 0) {
                itemEndLine = j;
                break;
              }
            }
          }
          break;
        }
      }
    } else {
      // Handle node/edge errors
      const items = type === 'node' ? data.nodes : data.edges;
      if (!items || !Array.isArray(items) || targetIndex >= items.length) {
        return null;
      }
      
      // Find the line where this specific item starts
      const searchPattern = type === 'node' ? '"nodes": [' : '"edges": [';
      
      let foundArrayStart = false;
      let currentItemIndex = -1; // Start at -1 so first { increments to 0
      let depth = 0; // Track nesting depth
      
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(searchPattern)) {
          foundArrayStart = true;
          depth = 0;
          continue;
        }
        
        if (foundArrayStart) {
          // Count braces to track depth
          const openBraces = (lines[i].match(/{/g) || []).length;
          const closeBraces = (lines[i].match(/}/g) || []).length;
          
          // Check if this is a top-level object start (depth 0 -> 1)
          if (depth === 0 && lines[i].trim().startsWith('{')) {
            currentItemIndex++;
            if (currentItemIndex === targetIndex) {
              itemStartLine = i;
              // Find the end of this item
              let braceCount = 0;
              for (let j = i; j < lines.length; j++) {
                const line = lines[j];
                braceCount += (line.match(/{/g) || []).length;
                braceCount -= (line.match(/}/g) || []).length;
                if (braceCount === 0) {
                  itemEndLine = j;
                  break;
                }
              }
              break;
            }
          }
          
          depth += openBraces - closeBraces;
          
          // If we've closed the array, stop
          if (depth < 0) break;
        }
      }
    }
    
    if (itemStartLine === 0 && itemEndLine === 0) {
      return null;
    }
    
    // Get context: adjust to show the item and some context
    // For missing fields, show only 1 line before/after to avoid showing previous/next items
    const isMissingField = _errorMessage.includes('が欠落');
    
    let contextBefore = isMissingField ? 1 : 2;
    let contextAfter = isMissingField ? 1 : 2;
    
    // If item is small and not a missing field error, show more context
    const itemLength = itemEndLine - itemStartLine + 1;
    if (!isMissingField && itemLength <= 5) {
      contextBefore = 3;
      contextAfter = 3;
    }
    
    const startLine = Math.max(0, itemStartLine - contextBefore);
    const endLine = Math.min(lines.length - 1, itemEndLine + contextAfter);
    
    const snippet = lines.slice(startLine, endLine + 1).join('\n');
    return { snippet, startLine: startLine + 1, itemStartLine: itemStartLine + 1, itemEndLine: itemEndLine + 1 }; // +1 for 1-indexed line numbers
  } catch {
    return null;
  }
};

// Helper function to get code snippet for edgeType field
const getEdgeTypeSnippet = (jsonContent: string): { snippet: string; startLine: number } | null => {
  try {
    const data = JSON.parse(jsonContent);
    const formatted = JSON.stringify(data, null, 2);
    const lines = formatted.split('\n');
    
    // Find the edgeType field
    let edgeTypeLine = -1;
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*"edgeType"\s*:/.test(lines[i])) {
        edgeTypeLine = i;
        break;
      }
    }
    
    if (edgeTypeLine === -1) {
      return null;
    }
    
    // Get context: 3 lines before and after
    const contextBefore = 3;
    const contextAfter = 3;
    const startLine = Math.max(0, edgeTypeLine - contextBefore);
    const endLine = Math.min(lines.length - 1, edgeTypeLine + contextAfter);
    
    const snippet = lines.slice(startLine, endLine + 1).join('\n');
    return { snippet, startLine: startLine + 1 }; // +1 for 1-indexed line numbers
  } catch {
    return null;
  }
};

// Helper function to get full JSON preview with limited lines
const getJsonPreview = (jsonContent: string, maxLines: number = 20): string => {
  try {
    const data = JSON.parse(jsonContent);
    const formatted = JSON.stringify(data, null, 2);
    const lines = formatted.split('\n');
    
    if (lines.length <= maxLines) {
      return formatted;
    }
    
    return lines.slice(0, maxLines).join('\n') + '\n... (省略)';
  } catch {
    return jsonContent.substring(0, 500) + '...';
  }
};

// Helper function to highlight error in code snippet
const highlightError = (snippet: string, errorMessage: string, startLine: number, itemStartLine?: number, itemEndLine?: number): React.ReactNode => {
  const lines = snippet.split('\n');
  
  // Determine if we should highlight the entire block (for missing fields)
  const highlightEntireBlock = errorMessage.includes('が欠落');
  
  // Extract error keywords from message more precisely
  const errorKeywords: string[] = [];
  
  if (errorMessage.includes('idが不正') || errorMessage.includes('idが欠落')) {
    errorKeywords.push('id');
  }
  if (errorMessage.includes('typeが不正') || errorMessage.includes('typeが欠落')) {
    errorKeywords.push('type');
  }
  if (errorMessage.includes('positionが不正') || errorMessage.includes('positionが欠落')) {
    errorKeywords.push('position');
  }
  if (errorMessage.includes('dataが不正') || errorMessage.includes('dataが欠落')) {
    errorKeywords.push('data');
  }
  if (errorMessage.includes('sourceノードが存在しません') || errorMessage.includes('sourceが欠落')) {
    errorKeywords.push('source');
  }
  if (errorMessage.includes('targetノードが存在しません') || errorMessage.includes('targetが欠落')) {
    errorKeywords.push('target');
  }
  if (errorMessage.includes('値') || errorMessage.includes('不整合')) {
    errorKeywords.push('value');
  }
  if (errorMessage.includes('edgeTypeが不正')) {
    errorKeywords.push('edgeType');
  }
  
  // Extract variable name from error message if it's a variable error
  const variableMatch = errorMessage.match(/変数 "([^"]+)":/);
  const targetVariableName = variableMatch ? variableMatch[1] : null;
  
  let inTargetVariable = false;
  let variableDepth = 0;
  let inTargetItem = false;
  let itemDepth = 0;
  let inFieldBlock = false;
  let fieldBlockDepth = 0;
  
  return lines.map((line, index) => {
    let isError = false;
    const actualLineNumber = startLine + index;
    
    // For variable errors, only highlight within the target variable's block
    if (targetVariableName) {
      if (line.includes(`"${targetVariableName}":`)) {
        inTargetVariable = true;
        variableDepth = 0;
      }
      
      if (inTargetVariable) {
        const openBraces = (line.match(/{/g) || []).length;
        const closeBraces = (line.match(/}/g) || []).length;
        variableDepth += openBraces - closeBraces;
        
        if (variableDepth < 0) {
          inTargetVariable = false;
        }
        
        if (inTargetVariable) {
          for (const keyword of errorKeywords) {
            const fieldPattern = new RegExp(`"${keyword}"\\s*:`);
            if (fieldPattern.test(line)) {
              isError = true;
              break;
            }
          }
        }
      }
    } else if (itemStartLine !== undefined && itemEndLine !== undefined) {
      // For node/edge errors, only highlight within the target item's block
      // Check if we're within the item's range
      if (actualLineNumber >= itemStartLine && actualLineNumber <= itemEndLine) {
        if (!inTargetItem) {
          inTargetItem = true;
          itemDepth = 0;
          console.log(`Entered item range: ${itemStartLine}-${itemEndLine}, errorKeywords:`, errorKeywords);
        }
        
        const openBraces = (line.match(/{/g) || []).length;
        const closeBraces = (line.match(/}/g) || []).length;
        itemDepth += openBraces - closeBraces;
        
        // Check if we're in a field block that should be highlighted
        if (inFieldBlock) {
          isError = true;
          fieldBlockDepth += openBraces - closeBraces;
          if (fieldBlockDepth <= 0) {
            inFieldBlock = false;
          }
        } else if (highlightEntireBlock) {
          // Highlight the entire item block for missing fields
          isError = true;
        } else {
          // Check if this line starts a field that should be highlighted
          for (const keyword of errorKeywords) {
            const fieldPattern = new RegExp(`"${keyword}"\\s*:`);
            if (fieldPattern.test(line)) {
              isError = true;
              
              // For position field with object value, track the entire block
              if (keyword === 'position' && line.includes('{')) {
                inFieldBlock = true;
                fieldBlockDepth = openBraces - closeBraces;
                if (fieldBlockDepth <= 0) {
                  inFieldBlock = false;
                }
              }
              // For data field with object value, track the entire block
              else if (keyword === 'data' && line.includes('{')) {
                inFieldBlock = true;
                fieldBlockDepth = openBraces - closeBraces;
                if (fieldBlockDepth <= 0) {
                  inFieldBlock = false;
                }
              }
              // For data field with string/other value, just highlight this line
              // (isError is already set to true)
              
              break;
            }
          }
        }
      } else if (inTargetItem) {
        // We've exited the item range
        inTargetItem = false;
      }
    } else {
      // For other errors (e.g., edgeType), use simple pattern matching
      for (const keyword of errorKeywords) {
        const fieldPattern = new RegExp(`"${keyword}"\\s*:`);
        if (fieldPattern.test(line)) {
          isError = true;
          break;
        }
      }
    }
    
    return (
      <div key={index} className="flex">
        <span className="text-muted-foreground/50 select-none mr-4 text-right" style={{ minWidth: '3em' }}>
          {actualLineNumber}
        </span>
        <span className={isError ? 'text-red-600 dark:text-red-400 font-semibold' : ''}>
          {line}
        </span>
      </div>
    );
  });
};

export const ValidationErrorModal: React.FC<ValidationErrorModalProps> = ({
  isOpen,
  onClose,
  errors,
  warnings,
  corrections = [],
  jsonContent
}) => {
  if (!isOpen) return null;

  // Helper function to find corrections related to a warning
  const getCorrectionsForWarning = (warningMessage: string): string[] => {
    const relatedCorrections: string[] = [];
    
    // Extract node/edge/variable identifier from warning
    const nodeMatch = warningMessage.match(/ノード (\d+):/);
    const edgeMatch = warningMessage.match(/エッジ (\d+):/);
    const variableMatch = warningMessage.match(/変数 "([^"]+)":/);
    
    if (nodeMatch) {
      const nodeIndex = nodeMatch[1];
      relatedCorrections.push(...corrections.filter(c => c.includes(`ノード ${nodeIndex}:`)));
    } else if (edgeMatch) {
      const edgeIndex = edgeMatch[1];
      relatedCorrections.push(...corrections.filter(c => c.includes(`エッジ ${edgeIndex}:`)));
    } else if (variableMatch) {
      const variableName = variableMatch[1];
      relatedCorrections.push(...corrections.filter(c => c.includes(`変数 "${variableName}":`)));
    } else if (warningMessage.includes('edgeType')) {
      relatedCorrections.push(...corrections.filter(c => c.includes('edgeType')));
    } else if (warningMessage.includes('gameState')) {
      relatedCorrections.push(...corrections.filter(c => c.includes('gameState')));
    } else if (warningMessage.includes('characters')) {
      relatedCorrections.push(...corrections.filter(c => c.includes('characters')));
    } else if (warningMessage.includes('resources')) {
      relatedCorrections.push(...corrections.filter(c => c.includes('resources')));
    }
    
    return relatedCorrections;
  };

  // Process warnings to extract line info and snippets
  const processedWarnings = useMemo(() => {
    return warnings.map(warning => {
      if (!jsonContent) return { message: warning, snippet: null, startLine: 1, isVariable: false };
      
      const { lineNumber, cleanMessage, variableName, isVariable, isEdgeType } = extractLineInfo(warning);
      
      if (isEdgeType) {
        const result = getEdgeTypeSnippet(jsonContent);
        if (result) {
          return { message: cleanMessage, snippet: result.snippet, lineNumber: null, startLine: result.startLine, isVariable: false };
        }
      } else if (isVariable && variableName) {
        const result = getCodeSnippetWithContext(jsonContent, 0, 'variable', warning, variableName);
        if (result) {
          return { message: cleanMessage, snippet: result.snippet, lineNumber: null, startLine: result.startLine, isVariable: true };
        }
      } else if (lineNumber !== null) {
        const isNode = warning.includes('ノード');
        const isEdge = warning.includes('エッジ');
        const type = isEdge ? 'edge' : (isNode ? 'node' : 'node'); // Default to node if neither
        const result = getCodeSnippetWithContext(jsonContent, lineNumber, type, warning);
        if (result) {
          return { message: cleanMessage, snippet: result.snippet, lineNumber, startLine: result.startLine, isVariable: false, itemStartLine: result.itemStartLine, itemEndLine: result.itemEndLine };
        }
      }
      
      // If no line number, show general JSON preview
      return { message: cleanMessage, snippet: getJsonPreview(jsonContent, 15), lineNumber: null, startLine: 1, isVariable: false };
    });
  }, [warnings, jsonContent]);

  // Process errors to extract line info and snippets
  const processedErrors = useMemo(() => {
    return errors.map(error => {
      if (!jsonContent) return { message: error, snippet: null, startLine: 1, isVariable: false };
      
      const { lineNumber, cleanMessage, variableName, isVariable, isEdgeType } = extractLineInfo(error);
      
      if (isEdgeType) {
        const result = getEdgeTypeSnippet(jsonContent);
        if (result) {
          return { message: cleanMessage, snippet: result.snippet, lineNumber: null, startLine: result.startLine, isVariable: false };
        }
      } else if (isVariable && variableName) {
        const result = getCodeSnippetWithContext(jsonContent, 0, 'variable', error, variableName);
        if (result) {
          return { message: cleanMessage, snippet: result.snippet, lineNumber: null, startLine: result.startLine, isVariable: true };
        }
      } else if (lineNumber !== null) {
        const isNode = error.includes('ノード');
        const isEdge = error.includes('エッジ');
        const type = isEdge ? 'edge' : (isNode ? 'node' : 'node'); // Default to node if neither
        const result = getCodeSnippetWithContext(jsonContent, lineNumber, type, error);
        if (result) {
          return { message: cleanMessage, snippet: result.snippet, lineNumber, startLine: result.startLine, isVariable: false, itemStartLine: result.itemStartLine, itemEndLine: result.itemEndLine };
        }
      }
      
      // If no line number, show general JSON preview
      return { message: cleanMessage, snippet: getJsonPreview(jsonContent, 15), lineNumber: null, startLine: 1, isVariable: false };
    });
  }, [errors, jsonContent]);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div role="dialog" aria-modal="true" className="relative bg-card border border-border rounded-lg shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-destructive/10">
          <h2 className="text-xl font-bold text-destructive flex items-center gap-2">
            <span className="text-2xl">⚠️</span>
            JSONバリデーションエラー
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-accent rounded-full transition-colors"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 select-text">
          {/* Errors */}
          {errors.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-destructive mb-3">
                エラー ({errors.length})
              </h3>
              <div className="space-y-4">
                {processedErrors.map((error, index) => (
                  <div
                    key={index}
                    className="bg-destructive/10 border border-destructive/30 rounded-md overflow-hidden"
                  >
                    <div className="p-3">
                      <p className="text-sm text-destructive font-medium mb-2">
                        {error.message}
                      </p>
                      {error.snippet && (
                        <div className="mt-3">
                          <div className="text-xs text-destructive mb-1 font-semibold">
                            {error.lineNumber !== null ? 'コード位置:' : 'JSONプレビュー:'}
                          </div>
                          <div className="bg-muted/50 rounded p-3 overflow-x-auto">
                            <pre className="text-xs font-mono">
                              {highlightError(error.snippet, error.message, error.startLine || 1, error.itemStartLine, error.itemEndLine)}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Warnings */}
          {warnings.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-yellow-600 dark:text-yellow-500 mb-3">
                警告 ({warnings.length})
              </h3>
              <div className="space-y-4">
                {processedWarnings.map((warning, index) => {
                  const relatedCorrections = getCorrectionsForWarning(warning.message);
                  
                  return (
                    <div
                      key={index}
                      className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md overflow-hidden"
                    >
                      <div className="p-3">
                        <p className="text-sm text-yellow-800 dark:text-yellow-300 font-medium mb-2">
                          {warning.message}
                        </p>
                        {warning.snippet && (
                          <div className="mt-3">
                            <div className="text-xs text-yellow-700 dark:text-yellow-400 mb-1 font-semibold">
                              {warning.lineNumber !== null ? 'コード位置:' : 'JSONプレビュー:'}
                            </div>
                            <div className="bg-muted/50 rounded p-3 overflow-x-auto">
                              <pre className="text-xs font-mono">
                                {highlightError(warning.snippet, warning.message, warning.startLine || 1, warning.itemStartLine, warning.itemEndLine)}
                              </pre>
                            </div>
                          </div>
                        )}
                        {relatedCorrections.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-yellow-200 dark:border-yellow-800">
                            <div className="text-xs text-blue-700 dark:text-blue-400 mb-2 font-semibold">
                              自動修正・補完:
                            </div>
                            <div className="space-y-1">
                              {relatedCorrections.map((correction, corrIndex) => (
                                <div
                                  key={corrIndex}
                                  className="text-xs text-blue-800 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 rounded px-2 py-1"
                                >
                                  {correction.replace(/^(ノード|エッジ|変数) (\d+|"[^"]+"):\s*/, '→ ')}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Help Text */}
          <div className="p-4 bg-muted/50 rounded-md border border-border">
            <h4 className="font-semibold mb-2">対処方法</h4>
            <ul className="text-sm space-y-1 text-muted-foreground list-disc list-inside">
              <li>JSONファイルの構造を確認してください</li>
              <li>必須フィールド(nodes, edges, gameState)が存在するか確認してください</li>
              <li>各ノードに正しいid, type, position, dataが含まれているか確認してください</li>
              <li>エッジのsourceとtargetが存在するノードを参照しているか確認してください</li>
              <li>赤文字で表示されている箇所がエラーの原因です</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-4 border-t border-border bg-muted/30">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-medium"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
