import React, { useCallback, useRef, useState, useEffect } from 'react';
import ReactFlow, { 
  Background, 
  Controls, 
  ReactFlowProvider,
  useReactFlow,
  type Node,
  type Edge,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useScenarioStore } from '../store/scenarioStore';
import EventNode from '../nodes/EventNode';
import ElementNode from '../nodes/ElementNode';
import BranchNode from '../nodes/BranchNode';
import GroupNode from '../nodes/GroupNode';
import MemoNode from '../nodes/MemoNode';
import VariableNode from '../nodes/VariableNode';
import type { NodeType, ScenarioNode, ScenarioNodeData } from '../types';
import { useTranslation } from '../hooks/useTranslation';
import { substituteVariables } from '../utils/textUtils';

const nodeTypes = {
  event: EventNode,
  information: ElementNode, // For backward compatibility
  element: ElementNode,
  branch: BranchNode,
  group: GroupNode,
  memo: MemoNode,
  variable: VariableNode,
};

interface ContextMenuState {
  id: string;
  type: 'node' | 'edge' | 'pane';
  top: number;
  left: number;
  data?: ScenarioNodeData;
  nodeType?: string;
}

const ContextMenu = ({ 
  menu, 
  onClose, 
  onDelete, 
  onDuplicate, 
  onReduplicate,
  onCopyText,
  onToggleState,
  onUngroup
}: { 
  menu: ContextMenuState & { nodeType?: string }; 
  onClose: () => void;
  onDelete: () => void;
  onDuplicate?: () => void;
  onReduplicate?: () => void;
  onCopyText?: (type: 'all' | 'label' | 'description' | 'value' | 'condition' | 'cases') => void;
  onToggleState?: () => void;
  onGroup?: () => void;
  onUngroup?: () => void;
  isRevealed?: boolean;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as globalThis.Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const { mode } = useScenarioStore();

  return (
    <div 
      ref={ref}
      style={{ top: menu.top, left: menu.left }} 
      className="fixed z-50 bg-popover border border-border shadow-lg rounded-md py-1 min-w-[160px] flex flex-col text-sm text-popover-foreground"
    >
      {mode === 'edit' && menu.type === 'node' && (
        <>
          <button 
            onClick={onDuplicate}
            className="px-4 py-2 text-left hover:bg-accent hover:text-accent-foreground w-full"
          >
            {t.contextMenu.duplicate}
          </button>
          
          <div className="relative group">
              <button 
                className="px-4 py-2 text-left hover:bg-accent hover:text-accent-foreground w-full flex justify-between items-center"
              >
                {t.contextMenu.copyText} <span>▶</span>
              </button>
              <div className="absolute left-full top-0 bg-popover border border-border shadow-lg rounded-md py-1 min-w-[140px] hidden group-hover:flex flex-col">
                  <button onClick={() => onCopyText?.('all')} className="px-4 py-2 text-left hover:bg-accent hover:text-accent-foreground">{t.contextMenu.all}</button>
                  <button onClick={() => onCopyText?.('label')} className="px-4 py-2 text-left hover:bg-accent hover:text-accent-foreground">{t.contextMenu.label}</button>
                  <button onClick={() => onCopyText?.('description')} className="px-4 py-2 text-left hover:bg-accent hover:text-accent-foreground">{t.contextMenu.description}</button>
                  {['element', 'variable'].includes(menu.nodeType || '') && (
                      <button onClick={() => onCopyText?.('value')} className="px-4 py-2 text-left hover:bg-accent hover:text-accent-foreground">{t.contextMenu.value}</button>
                  )}
                  {menu.nodeType === 'branch' && (
                      <>
                          <button onClick={() => onCopyText?.('condition')} className="px-4 py-2 text-left hover:bg-accent hover:text-accent-foreground">{t.contextMenu.condition}</button>
                          <button onClick={() => onCopyText?.('cases')} className="px-4 py-2 text-left hover:bg-accent hover:text-accent-foreground">{t.contextMenu.cases}</button>
                      </>
                  )}
              </div>
          </div>

          <button 
            onClick={onToggleState}
            className="px-4 py-2 text-left hover:bg-accent hover:text-accent-foreground w-full"
          >
            {menu.data?.revealed ? t.contextMenu.markUnrevealed : t.contextMenu.markRevealed}
          </button>
          <div className="h-px bg-border my-1" />
          
          {menu.nodeType === 'group' && (
              <button 
                onClick={onUngroup}
                className="px-4 py-2 text-left hover:bg-accent hover:text-accent-foreground w-full"
              >
                {t.contextMenu.ungroup}
              </button>
          )}
          
          <div className="h-px bg-border my-1" />
        </>
      )}

      {mode === 'edit' && menu.type === 'pane' && (
          <button 
            onClick={onReduplicate}
            className="px-4 py-2 text-left hover:bg-accent hover:text-accent-foreground w-full"
          >
            {t.contextMenu.reduplicate}
          </button>
      )}
      
      {mode === 'play' && menu.type === 'node' && (
          <button 
            onClick={onToggleState}
            className="px-4 py-2 text-left hover:bg-accent hover:text-accent-foreground w-full"
          >
            {menu.data?.revealed ? t.contextMenu.markUnrevealed : t.contextMenu.markRevealed}
          </button>
      )}

      {mode === 'edit' && (menu.type === 'node' || menu.type === 'edge') && (
          <button 
            onClick={onDelete}
            className="px-4 py-2 text-left hover:bg-destructive/20 text-red-600 dark:text-red-400 w-full"
          >
            {t.contextMenu.delete}
          </button>
      )}
    </div>
  );
};

const CanvasContent = ({ onCanvasClick }: { onCanvasClick?: () => void }) => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { 
    nodes, 
    edges, 
    onNodesChange, 
    onEdgesChange, 
    onConnect, 
    onReconnect,
    addNode,
    duplicateNodes,
    deleteNodes,
    setSelectedNode,
    mode,
    toggleNodeState,
    groupNodes,
    ungroupNodes,
    pushHistory,
    edgeType,
    gameState,
    selectedNodeId,
  } = useScenarioStore();
  const { project, setEdges, getNodes } = useReactFlow();
  const { t } = useTranslation();
  
  const [menu, setMenu] = useState<ContextMenuState | null>(null);
  const lastDuplicatedIds = useRef<string[]>([]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      
      if (mode === 'play') return;

      const type = event.dataTransfer.getData('application/reactflow') as NodeType;
      if (typeof type === 'undefined' || !type) {
        return;
      }

      const position = project({
        x: event.clientX - (reactFlowWrapper.current?.getBoundingClientRect().left ?? 0),
        y: event.clientY - (reactFlowWrapper.current?.getBoundingClientRect().top ?? 0),
      });

      const newNode: ScenarioNode = {
        id: `${type}-${Date.now()}`,
        type,
        position,
        data: { 
            label: `${t.nodes.new} ${type}`,
            // Set defaults
            infoType: (type === 'element') ? 'knowledge' : undefined,
            branchType: type === 'branch' ? 'if_else' : undefined,
            expanded: type === 'group' ? true : undefined, // GroupNode initial expand
            targetVariable: (type === 'variable' && Object.keys(gameState.variables).length > 0) ? Object.keys(gameState.variables)[0] : undefined,
        },
        style: type === 'group' ? { width: 300, height: 300, zIndex: -1 } : undefined,
      };

      addNode(newNode);
    },
    [project, addNode, mode, t, gameState]
  );

  const onNodeDragStop = useCallback((_event: React.MouseEvent, node: Node) => {
      pushHistory(); // Push history on drag stop

      const groups = getNodes().filter(n => n.type === 'group' && n.id !== node.id);
      
      const nodeRect = {
          x: node.positionAbsolute?.x ?? node.position.x,
          y: node.positionAbsolute?.y ?? node.position.y,
          width: node.width || 200,
          height: node.height || 100
      };
      
      const intersectingGroup = groups.find(g => {
          const gRect = {
              x: g.positionAbsolute?.x ?? g.position.x,
              y: g.positionAbsolute?.y ?? g.position.y,
              width: g.width || 300,
              height: g.height || 300
          };
          
          return (
              nodeRect.x >= gRect.x &&
              nodeRect.x + nodeRect.width <= gRect.x + gRect.width &&
              nodeRect.y >= gRect.y &&
              nodeRect.y + nodeRect.height <= gRect.y + gRect.height
          );
      });

      if (intersectingGroup) {
          if (node.parentNode !== intersectingGroup.id) {
              // Reparent to this group
              const relX = nodeRect.x - (intersectingGroup.positionAbsolute?.x ?? intersectingGroup.position.x);
              const relY = nodeRect.y - (intersectingGroup.positionAbsolute?.y ?? intersectingGroup.position.y);
              
              useScenarioStore.getState().setNodeParent(node.id, intersectingGroup.id, { x: relX, y: relY });
          }
      } else {
          if (node.parentNode) {
              // Ungroup
              useScenarioStore.getState().setNodeParent(node.id, undefined, { x: nodeRect.x, y: nodeRect.y });
          }
      }
  }, [getNodes, pushHistory]);

  const onSelectionChange = useCallback(({ nodes }: { nodes: Node[] }) => {
    if (nodes.length > 0) {
      setSelectedNode(nodes[0].id);
    } else {
      setSelectedNode(null);
    }
  }, [setSelectedNode]);

  const onNodeClick = useCallback(() => {
    if (mode === 'play') {
      setSelectedNode(null); // Ensure no node is selected in play mode
    }
  }, [mode, setSelectedNode]);

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      setMenu({
        id: node.id,
        type: 'node',
        top: event.clientY,
        left: event.clientX,
        data: node.data,
        nodeType: node.type // Pass node type
      });
    },
    []
  );

  const onEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      event.preventDefault();
      if (mode === 'play') return;

      setMenu({
        id: edge.id,
        type: 'edge',
        top: event.clientY,
        left: event.clientX,
      });
    },
    [mode]
  );

  const onPaneContextMenu = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      if (mode === 'play') return;
      setMenu({
        id: 'pane',
        type: 'pane',
        top: event.clientY,
        left: event.clientX,
      });
    },
    [mode]
  );

  const onPaneClick = useCallback(() => {
    setMenu(null);
    onCanvasClick?.();
  }, [onCanvasClick]);

  const handleDelete = useCallback(() => {
    const selectedNodes = getNodes().filter(n => n.selected);
    const nodesToDelete = selectedNodes.length > 0 ? selectedNodes : (menu?.type === 'node' ? getNodes().filter(n => n.id === menu.id) : []);
    
    if (nodesToDelete.length > 0) {
        deleteNodes(nodesToDelete.map(n => n.id));
    } else {
        // Check for selected edges
        const selectedEdges = edges.filter(e => e.selected);
        const edgesToDelete = selectedEdges.length > 0 ? selectedEdges : (menu?.type === 'edge' ? edges.filter(e => e.id === menu.id) : []);
        
        if (edgesToDelete.length > 0) {
            setEdges((currentEdges) => currentEdges.filter((e) => !edgesToDelete.some(del => del.id === e.id)));
        }
    }
    setMenu(null);
  }, [menu, deleteNodes, setEdges, getNodes, edges]);

  const handleDuplicate = useCallback(() => {
    const selectedNodes = getNodes().filter(n => n.selected);
    const nodesToDuplicate = selectedNodes.length > 0 ? selectedNodes : (menu?.type === 'node' ? getNodes().filter(n => n.id === menu.id) : []);
    
    if (nodesToDuplicate.length === 0) return;

    const newIds = duplicateNodes(nodesToDuplicate as ScenarioNode[]);
    lastDuplicatedIds.current = newIds;
    setMenu(null);
  }, [menu, getNodes, duplicateNodes]);

  const handleReduplicate = useCallback(() => {
      if (lastDuplicatedIds.current.length === 0) return;
      
      const nodesToDuplicate = getNodes().filter(n => lastDuplicatedIds.current.includes(n.id));
      if (nodesToDuplicate.length === 0) return;

      const newIds = duplicateNodes(nodesToDuplicate as ScenarioNode[]);
      lastDuplicatedIds.current = newIds;
      setMenu(null);
  }, [getNodes, duplicateNodes]);

  const handleToggleState = useCallback(() => {
    const selectedNodes = getNodes().filter(n => n.selected);
    const targetNodes = selectedNodes.length > 0 ? selectedNodes : (menu?.type === 'node' ? getNodes().filter(n => n.id === menu.id) : []);
    
    if (targetNodes.length === 0) return;

    // Determine target state based on the first node (or menu node)
    // If menu is open, use menu node. If not (shortcut), use selectedNodeId or first selected.
    let primaryNode = targetNodes[0];
    if (menu?.type === 'node') {
        primaryNode = targetNodes.find(n => n.id === menu.id) || targetNodes[0];
    } else if (selectedNodeId) {
        primaryNode = targetNodes.find(n => n.id === selectedNodeId) || targetNodes[0];
    }

    const isRevealed = primaryNode.data.revealed;
    const newState = !isRevealed;

    targetNodes.forEach(node => {
        if (node.data.revealed !== newState) {
            toggleNodeState(node.id);
        }
    });
    setMenu(null);
  }, [menu, getNodes, toggleNodeState, selectedNodeId]);

  const handleGroup = useCallback(() => {
      const selectedNodes = getNodes().filter(n => n.selected);
      if (selectedNodes.length === 0 && menu?.type === 'node') {
          groupNodes([menu.id]);
      } else {
          groupNodes(selectedNodes.map(n => n.id));
      }
      setMenu(null);
  }, [menu, getNodes, groupNodes]);

  const handleUngroup = useCallback(() => {
      if (!menu) return;
      ungroupNodes(menu.id);
      setMenu(null);
  }, [menu, ungroupNodes]);

  const handleCopyText = useCallback((type: 'all' | 'label' | 'description' | 'value' | 'condition' | 'cases') => {
    if (!menu || !menu.data) return;
    let text = '';
    const data = menu.data;
    const variables = gameState.variables;
    
    const process = (t: string) => substituteVariables(t, variables);

    switch (type) {
        case 'all':
            text = `[${menu.nodeType?.toUpperCase()}] ${process(data.label)}`;
            if (data.description) text += `\n${process(data.description)}`;
            
            if (menu.nodeType === 'element') {
                text += `\nType: ${data.infoType || 'knowledge'}`;
                text += `\nValue: ${process(data.infoValue || '')}`;
                text += `\nQuantity: ${data.quantity || 1}`;
                text += `\nAction: ${data.actionType || 'obtain'}`;
            } else if (menu.nodeType === 'variable') {
                text += `\nTarget: ${data.targetVariable || ''}`;
                text += `\nValue: ${process(data.variableValue || '')}`;
            } else if (menu.nodeType === 'branch') {
                text += `\nType: ${data.branchType || 'if_else'}`;
                text += `\nCondition: ${data.conditionVariable || ''} ${process(data.conditionValue || '')}`;
                if (data.branches) {
                    text += `\nCases:\n${data.branches.map((b) => `- ${process(b.label)}`).join('\n')}`;
                }
            }
            break;
        case 'label':
            text = process(data.label);
            break;
        case 'description':
            text = process(data.description || '');
            break;
        case 'value':
            if (menu.nodeType === 'element') text = process(data.infoValue || '');
            else if (menu.nodeType === 'variable') text = process(data.variableValue || '');
            else text = process(data.infoValue || '');
            break;
        case 'condition':
            text = `${data.conditionVariable || ''} ${process(data.conditionValue || '')}`;
            break;
        case 'cases':
            if (data.branches) {
                text = data.branches.map((b) => process(b.label)).join('\n');
            }
            break;
    }
    navigator.clipboard.writeText(text);
    setMenu(null);
  }, [menu, gameState.variables]);

  // Keyboard Shortcuts
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if (mode === 'play') return;
          
          // Ignore if input/textarea is focused
          if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) return;

          if (e.key === 'Delete') {
              handleDelete();
          } else if (e.ctrlKey && e.key === 'c') {
              e.preventDefault(); // Prevent copy to clipboard? Or allow? User said "Duplicate".
              handleDuplicate();
          } else if (e.ctrlKey && e.key === 'v') {
              e.preventDefault();
              handleReduplicate();
          } else if (e.ctrlKey && e.key === 'r') {
              e.preventDefault();
              handleToggleState();
          }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, handleDelete, handleDuplicate, handleReduplicate, handleToggleState]);

  // Sort nodes so groups are rendered first (bottom)
  const sortedNodes = [...nodes].sort((a, b) => {
      if (a.type === 'group' && b.type !== 'group') return -1;
      if (a.type !== 'group' && b.type === 'group') return 1;
      return 0;
  });

  return (
    <div className="flex-1 h-full relative bg-background" ref={reactFlowWrapper}>
      {mode === 'play' && (
          <style>{`
            .react-flow__handle {
                display: none !important;
            }
          `}</style>
      )}
      <ReactFlow
        nodes={sortedNodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onReconnect={onReconnect}
        nodeTypes={nodeTypes}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onNodeDragStop={onNodeDragStop}
        onSelectionChange={onSelectionChange}
        onNodeClick={onNodeClick}
        onNodeContextMenu={onNodeContextMenu}
        onEdgeContextMenu={onEdgeContextMenu}
        onPaneContextMenu={onPaneContextMenu}
        onPaneClick={onPaneClick}
        nodesDraggable={mode === 'edit'}
        nodesConnectable={mode === 'edit'}
        elementsSelectable={mode === 'edit'}
        fitView
        selectionKeyCode="Control"
        deleteKeyCode={null} // Disable default delete to handle it manually
        defaultEdgeOptions={{
            type: edgeType || 'default',
            style: { strokeWidth: 2 },
            markerEnd: {
                type: MarkerType.ArrowClosed,
                width: 20,
                height: 20,
                color: 'hsl(var(--muted-foreground))',
            },
        }}
      >
        <Background color="hsl(var(--muted-foreground) / 0.2)" gap={16} />
        <Controls className="bg-card border-border fill-foreground" /> 
        <style>{`
            .react-flow__edge.selected .react-flow__edge-path {
                stroke: hsl(var(--primary));
                stroke-width: 6;
            }
            .react-flow__edge-path {
                stroke: hsl(var(--muted-foreground));
            }
        `}</style>
      </ReactFlow>
      
      {menu && (
        <ContextMenu 
          menu={menu} 
          onClose={() => setMenu(null)}
          onDelete={handleDelete}
          onDuplicate={handleDuplicate}
          onReduplicate={handleReduplicate}
          onCopyText={handleCopyText}
          onToggleState={handleToggleState}
          onGroup={handleGroup}
          onUngroup={handleUngroup}
        />
      )}
    </div>
  );
};

export const Canvas = ({ onCanvasClick }: { onCanvasClick?: () => void }) => {
  return (
    <ReactFlowProvider>
      <CanvasContent onCanvasClick={onCanvasClick} />
    </ReactFlowProvider>
  );
};
