import React, { useCallback, useRef, useState, useEffect, useMemo, useImperativeHandle, forwardRef } from 'react';
import { Plus, Minus, Maximize } from 'lucide-react';
import ReactFlow, { 
  Background, 
  Controls, 
  ControlButton,
  type Edge,
  type Node,
  MarkerType,
  useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useScenarioStore } from '../store/scenarioStore';
import EventNode from '../nodes/EventNode';
import ElementNode from '../nodes/ElementNode';
import BranchNode from '../nodes/BranchNode';
import GroupNode from '../nodes/GroupNode';
import MemoNode from '../nodes/MemoNode';
import VariableNode from '../nodes/VariableNode';
import JumpNode from '../nodes/JumpNode';
import StickyNode from '../nodes/StickyNode';
import CharacterNode from '../nodes/CharacterNode';
import ResourceNode from '../nodes/ResourceNode';
import type { NodeType, ScenarioNode } from '../types';
import { useTranslation } from '../hooks/useTranslation';
import { substituteVariables } from '../utils/textUtils';
import { NodeInfoModal } from './NodeInfoModal';
import { ContextMenu, type ContextMenuState } from './ContextMenu';
import { useRenderMetricsIfDebug } from '../hooks/useRenderMetrics';

const nodeTypes = {
  event: EventNode,
  information: ElementNode, // For backward compatibility
  element: ElementNode,
  branch: BranchNode,
  group: GroupNode,
  memo: MemoNode,
  variable: VariableNode,
  jump: JumpNode,
  sticky: StickyNode,
  character: CharacterNode,
  resource: ResourceNode,
};

import StickyEdge from '../edges/StickyEdge';

const edgeTypes = {
  sticky: StickyEdge,
};


const CanvasContent = React.memo(forwardRef<{ zoomIn: () => void; zoomOut: () => void; fitView: () => void; getZoom: () => number; setZoom: (zoom: number) => void; getViewport: () => { x: number; y: number; zoom: number }; setViewport: (viewport: { x: number; y: number; zoom: number }, options?: { isRestoring?: boolean }) => void }, { 
    onCanvasClick?: () => void;
    isMobile?: boolean; // Added isMobile prop
    onOpenPropertyPanel?: () => void;
}>(({ onCanvasClick, isMobile, onOpenPropertyPanel }, ref) => {
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
    bringNodeToFront,
    addSticky,
    toggleStickies,
    deleteStickies,
    hideSticky,
  } = useScenarioStore();
  const { 
      setEdges, 
      getNodes,
      setNodes,
      screenToFlowPosition, 
      setCenter, 
      getZoom,
      fitView,
      setViewport,
      getViewport
  } = useReactFlow();
  const { t } = useTranslation();
  
  // レンダリング計測(デバッグモード時のみ)
  useRenderMetricsIfDebug('Canvas');
  
  // Expose zoom functions to parent
  useImperativeHandle(ref, () => ({
    zoomIn: () => {
      const currentZoom = getZoom();
      setViewport({ x: getViewport().x, y: getViewport().y, zoom: Math.min(2, currentZoom * 1.2) }, { duration: 200 });
    },
    zoomOut: () => {
      const currentZoom = getZoom();
      setViewport({ x: getViewport().x, y: getViewport().y, zoom: Math.max(0.1, currentZoom / 1.2) }, { duration: 200 });
    },
    fitView: () => {
      fitView({ padding: 0.2, duration: 300 });
    },
    // fitView実行後、ビューポート変化を監視して完了後に保存
    fitViewWithSave: () => {
      return new Promise<void>((resolve) => {
        let prevViewport = getViewport();
        let stableFrames = 0;
        const requiredStableFrames = 3; // 3フレーム安定したら完了と判断
        
        fitView({ padding: 0.2, duration: 300 });
        
        const checkStability = () => {
          const currentViewport = getViewport();
          const isStable = 
            Math.abs(currentViewport.x - prevViewport.x) < 0.1 &&
            Math.abs(currentViewport.y - prevViewport.y) < 0.1 &&
            Math.abs(currentViewport.zoom - prevViewport.zoom) < 0.001;
          
          if (isStable) {
            stableFrames++;
            if (stableFrames >= requiredStableFrames) {
              // 完了：ビューポートを保存
              localStorage.setItem('canvas-viewport', JSON.stringify(currentViewport));
              resolve();
              return;
            }
          } else {
            stableFrames = 0;
          }
          
          prevViewport = currentViewport;
          requestAnimationFrame(checkStability);
        };
        
        requestAnimationFrame(checkStability);
      });
    },
    getZoom: () => getZoom(),
    setZoom: (zoom: number) => {
      const clampedZoom = Math.max(0.01, Math.min(2, zoom));
      setViewport({ x: getViewport().x, y: getViewport().y, zoom: clampedZoom }, { duration: 200 });
    },
    getViewport: () => getViewport(),
    setViewport: (viewport: { x: number; y: number; zoom: number }, options?: { isRestoring?: boolean }) => {
      // ビューポート復元時の処理
      if (options?.isRestoring) {
        // 保留してuseEffectで処理
        setPendingViewport(viewport);
        setHasAppliedViewport(false); // リセットして再適用を許可
      } else {
        // 通常のビューポート変更
        setViewport(viewport);
      }
    },
    // setViewport実行後、ビューポート変化を監視して完了後に保存
    setViewportWithSave: (viewport: { x: number; y: number; zoom: number }, duration: number = 200) => {
      return new Promise<void>((resolve) => {
        let prevViewport = getViewport();
        let stableFrames = 0;
        const requiredStableFrames = 3;
        
        setViewport(viewport, { duration });
        
        const checkStability = () => {
          const currentViewport = getViewport();
          const isStable = 
            Math.abs(currentViewport.x - prevViewport.x) < 0.1 &&
            Math.abs(currentViewport.y - prevViewport.y) < 0.1 &&
            Math.abs(currentViewport.zoom - prevViewport.zoom) < 0.001;
          
          if (isStable) {
            stableFrames++;
            if (stableFrames >= requiredStableFrames) {
              // 完了：ビューポートを保存
              localStorage.setItem('canvas-viewport', JSON.stringify(currentViewport));
              resolve();
              return;
            }
          } else {
            stableFrames = 0;
          }
          
          prevViewport = currentViewport;
          requestAnimationFrame(checkStability);
        };
        
        requestAnimationFrame(checkStability);
      });
    }
  }), [getZoom, setViewport, getViewport, fitView]);
  
  const [menu, setMenu] = useState<ContextMenuState | null>(null);
  const [zoom, setZoomState] = useState(1);
  const [infoModalData, setInfoModalData] = useState<string | null>(null);
  // Removed local isUpdatingSticky
  const lastDuplicatedIds = useRef<string[]>([]);
  
  // ビューポート復元管理（stateで変更を検知）
  const [pendingViewport, setPendingViewport] = useState<{ x: number; y: number; zoom: number } | null>(null);
  const [hasAppliedViewport, setHasAppliedViewport] = useState(false);
  const previousNodesLength = useRef(0);
  const nodesDimensionsInitialized = useRef(false);

  // Sync zoom state
  useEffect(() => {
      const interval = setInterval(() => {
          setZoomState(getZoom());
      }, 100);
      return () => clearInterval(interval);
  }, [getZoom]);

  // ノード変更時のビューポート処理
  useEffect(() => {

    
    // リセット時（ノード数が0になった）にフラグをリセット
    if (nodes.length === 0 && previousNodesLength.current > 0) {

      setHasAppliedViewport(false);
      setPendingViewport(null);
      nodesDimensionsInitialized.current = false;
    }
    
    // ノード数が0の場合は何もしない
    if (nodes.length === 0) {

      previousNodesLength.current = nodes.length;
      return;
    }
    
    // ノードが読み込まれた直後
    const nodesJustLoaded = previousNodesLength.current === 0 && nodes.length > 0;
    const nodesChanged = Math.abs(nodes.length - previousNodesLength.current) > 5;
    
    // ノードのサイズがすべて確定しているかチェック
    const allNodesHaveDimensions = nodes.every(n => n.width && n.height);
    const nodesWithoutDimensions = nodes.filter(n => !n.width || !n.height);
    
    console.log('[Viewport] Node analysis:', {
      nodesJustLoaded,
      nodesChanged,
      allNodesHaveDimensions,
      nodesWithoutDimensionsCount: nodesWithoutDimensions.length
    });

    // 寸法が確定していない場合は処理を保留（previousNodesLengthも更新しない）
    // これにより、寸法確定後の再レンダリングで正しく処理される
    if (nodes.length > 0 && !allNodesHaveDimensions) {
      console.log('[Viewport] Waiting for node dimensions...');
      return;
    }
    
    if (nodesJustLoaded || nodesChanged) {
      console.log('[Viewport] Conditions met for viewport action');
      
      if (pendingViewport && !hasAppliedViewport) {
        // ノードのサイズが確定してからビューポートを復元
        const viewport = pendingViewport;
        setHasAppliedViewport(true);
        nodesDimensionsInitialized.current = true;
        
        // モバイルデバイスではレンダリングに時間がかかるため、より長い遅延を設定
        const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const delay = isMobileDevice ? 5000 : 300;
        
        console.log('[Viewport] Scheduling viewport restoration:', { viewport, delay, isMobileDevice });
        
        // 少し遅延させてReactFlowのレイアウト計算を待つ
        setTimeout(() => {
          console.log('[Viewport] Executing setViewport now');
          window.requestAnimationFrame(() => {
            setViewport(viewport);
            console.log('[Viewport] setViewport executed');
            // 適用後にpendingViewportをクリア
            setTimeout(() => {
              console.log('[Viewport] Clearing pendingViewport');
              setPendingViewport(null);
            }, 100);
          });
        }, delay);
      } else if (!hasAppliedViewport && !pendingViewport && nodes.length > 0) {
        // ビューポートがない場合はfitView
        setHasAppliedViewport(true);
        console.log('[Viewport] No pending viewport, scheduling fitView');
        setTimeout(() => {
          window.requestAnimationFrame(async () => {
            console.log('[Viewport] Executing fitView');
            fitView({ padding: 0.2 });
            
            // fitView完了を待ってビューポートを保存
            let prevViewport = getViewport();
            let stableFrames = 0;
            const checkStability = () => {
              const currentViewport = getViewport();
              const isStable = 
                Math.abs(currentViewport.x - prevViewport.x) < 0.1 &&
                Math.abs(currentViewport.y - prevViewport.y) < 0.1 &&
                Math.abs(currentViewport.zoom - prevViewport.zoom) < 0.001;
              
              if (isStable) {
                stableFrames++;
                if (stableFrames >= 3) { // 3フレーム安定したら完了
                  localStorage.setItem('canvas-viewport', JSON.stringify(currentViewport));
                  console.log('[Viewport] Saved after fitView');
                  return;
                }
              } else {
                stableFrames = 0;
              }
              
              prevViewport = currentViewport;
              requestAnimationFrame(checkStability);
            };
            requestAnimationFrame(checkStability);
          });
        }, 300);
      } else {
        console.log('[Viewport] Skipping action:', { 
          hasApplied: hasAppliedViewport, 
          hasPending: !!pendingViewport 
        });
      }
    } else {
      console.log('[Viewport] Conditions not met for viewport action');
    }
    
    previousNodesLength.current = nodes.length;
  }, [nodes, pendingViewport, fitView, setViewport]);
  



  const setZoom = (newZoom: number) => {
      const { x, y } = getViewport();
      setViewport({ x, y, zoom: newZoom });
      setZoomState(newZoom);
  };

  // Merged into handlePaneClick below
  // const onPaneClick = useCallback(...)

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      
      if (mode === 'play') return;

      const type = event.dataTransfer.getData('application/reactflow') as NodeType;
      const referenceId = event.dataTransfer.getData('application/reactflow/referenceId');

      if (typeof type === 'undefined' || !type) {
        return;
      }

      const rawPosition = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      // Center the node (approx 150x50)
      const position = { x: rawPosition.x - 75, y: rawPosition.y - 25 };

      const newNode: ScenarioNode = {
        id: `${type}-${Date.now()}`,
        type,
        position,
        data: { 
            label: `${type === 'character' || type === 'resource' ? '' : t('nodes.new') + ' ' + type}`,
            referenceId: referenceId || undefined,
            // Set defaults
            infoType: (type === 'element') ? 'knowledge' : undefined,
            branchType: type === 'branch' ? 'if_else' : undefined,
            expanded: type === 'group' ? true : undefined, // GroupNode initial expand
            targetVariable: (type === 'variable' && Object.keys(gameState.variables).length > 0) ? Object.keys(gameState.variables)[0] : undefined,
            quantity: type === 'element' ? 1 : undefined,
        },
        style: type === 'group' ? { width: 300, height: 300, zIndex: -1 } : undefined,
      };

      addNode(newNode);
    },
    [screenToFlowPosition, addNode, mode, t, gameState]
  );

  const onNodeDragStart = useCallback((_event: React.MouseEvent, node: Node) => {
      // In Play Mode, only Sticky nodes can be dragged.
      // Other nodes have draggable=true to prevent zoom issues, but we block the drag here (or via store).
      // Note: ReactFlow doesn't fully support preventing drag via event in callback easily without controlled position?
      
      if (mode === 'play' && node.type !== 'sticky') {
          // Ideally we would stop drag here. But ReactFlow might continue visual drag.
          // We rely on Store onNodesChange to block the actual position update.
      }

      if (node.type === 'group') {
          bringNodeToFront(node.id);
      }
  }, [bringNodeToFront, mode]);

  const onNodeDragStop = useCallback((event: React.MouseEvent | React.TouchEvent | any, node: Node) => {
      if (!node) return;
      pushHistory(); // Push history on drag stop

      const allNodes = getNodes();
      // Groups logic - prevent stickies from interacting with groups
      // Groups logic - prevent stickies and reference nodes from interacting with groups
      if (node.type === 'sticky' || node.type === 'character' || node.type === 'resource') return;

      const groups = allNodes.filter(n => n.type === 'group' && n.id !== node.id);
      
      // Get pointer position (mouse or touch)
      let clientX, clientY;
      if (event.changedTouches && event.changedTouches.length > 0) {
          clientX = event.changedTouches[0].clientX;
          clientY = event.changedTouches[0].clientY;
      } else if (event.clientX !== undefined) {
          clientX = event.clientX;
          clientY = event.clientY;
      } else {
        // Fallback or exit if no coordinates found
        return;
      }

      // Calculate drop position in canvas coordinates using screenToFlowPosition
      const dropPosition = screenToFlowPosition({
          x: clientX,
          y: clientY,
      });
      
      const nodeRect = {
          x: node.positionAbsolute?.x ?? node.position.x,
          y: node.positionAbsolute?.y ?? node.position.y,
          width: node.width || 200,
          height: node.height || 100
      };

      // Helper to get absolute position even if positionAbsolute is missing
      const getAbsolutePosition = (n: Node) => {
          if (n.positionAbsolute) return n.positionAbsolute;
          let x = n.position.x;
          let y = n.position.y;
          let parentId = n.parentNode;
          while (parentId) {
              const parent = allNodes.find(p => p.id === parentId);
              if (parent) {
                  x += parent.position.x;
                  y += parent.position.y;
                  parentId = parent.parentNode;
              } else {
                  break;
              }
          }
          return { x, y };
      };
      
      const intersectingGroups = groups.filter(g => {
          const pos = getAbsolutePosition(g);
          const gRect = {
              x: pos.x,
              y: pos.y,
              width: g.width || 300,
              height: g.height || 300
          };
          
          // Check if mouse cursor (drop position) is inside group
          return (
              dropPosition.x >= gRect.x &&
              dropPosition.x <= gRect.x + gRect.width &&
              dropPosition.y >= gRect.y &&
              dropPosition.y <= gRect.y + gRect.height
          );
      });

      // Sort by area (ascending) to find the innermost group
      intersectingGroups.sort((a, b) => {
          const aArea = (a.width || 300) * (a.height || 300);
          const bArea = (b.width || 300) * (b.height || 300);
          return aArea - bArea;
      });

      const intersectingGroup = intersectingGroups[0];

      if (intersectingGroup) {
          // Check for circular reference: ensure intersectingGroup is not a descendant of node
          let isDescendant = false;
          let current: Node | undefined = intersectingGroup;
          
          while (current && current.parentNode) {
              if (current.parentNode === node.id) {
                  isDescendant = true;
                  break;
              }
              current = allNodes.find(n => n.id === current?.parentNode);
          }
          
          if (isDescendant) {
              return; // Prevent circular reference
          }

          if (node.parentNode !== intersectingGroup.id) {
              const groupPos = getAbsolutePosition(intersectingGroup);
              // Reparent to this group
              // Calculate relative position based on absolute positions
              const relX = nodeRect.x - groupPos.x;
              const relY = nodeRect.y - groupPos.y;
              
              useScenarioStore.getState().setNodeParent(node.id, intersectingGroup.id, { x: relX, y: relY });
              
              // Update group size to fit the new node
              setTimeout(() => {
                  useScenarioStore.getState().updateGroupSize(intersectingGroup.id);
                  // Resolve overlaps for the moved node within the new group
                  if (node.type === 'group') {
                      useScenarioStore.getState().resolveGroupOverlaps(node.id);
                  }
              }, 10);
          } else {
              // Same parent (already in this group), just moving
              if (node.type === 'group') {
                  setTimeout(() => {
                      useScenarioStore.getState().resolveGroupOverlaps(node.id);
                  }, 10);
              }
          }
      } else {
          if (node.parentNode) {
              // Ungroup
              useScenarioStore.getState().setNodeParent(node.id, undefined, { x: nodeRect.x, y: nodeRect.y });
          }
          
          // Resolve overlaps for root or ungrouped node
          if (node.type === 'group') {
              setTimeout(() => {
                  useScenarioStore.getState().resolveGroupOverlaps(node.id);
              }, 10);
          }
      }
  }, [getNodes, pushHistory, screenToFlowPosition]);

  const onSelectionChange = useCallback(({ nodes }: { nodes: Node[] }) => {
      const ids = nodes.map(n => n.id);
      if (ids.length === 0) {
          setSelectedNode(null);
      } else if (ids.length === 1) {
          setSelectedNode(ids[0]);
      } else {
          // Support multi-selection if store allows it
          try {
              setSelectedNode(ids); 
          } catch (e) {
              setSelectedNode(ids[0]);
          }
      }
  }, [setSelectedNode]);

  const lastClickTime = useRef<number>(0);
  const lastClickNodeId = useRef<string | null>(null);

  // Stop propagation to prevent canvas click (deselection) and zoom
  // Stop propagation to prevent canvas click (deselection) and zoom
  // Stop propagation to prevent canvas click (deselection) and zoom
  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    event.stopPropagation();

    const currentTime = Date.now();
    const timeDiff = currentTime - lastClickTime.current;

    // Prevent ghost clicks / chattering: ignore if too fast (< 50ms)
    // This helps prevent single taps from being registered as double taps due to event duplication
    if (timeDiff < 50) return;

    const isDoubleClick = node.id === lastClickNodeId.current && timeDiff < 500;
    
    lastClickTime.current = currentTime;
    lastClickNodeId.current = node.id;

    const handleJump = (targetId: string) => {
        // Use setTimeout to ensure state updates and rendering settle before moving view
        setTimeout(() => {
            const targetNode = getNodes().find(n => n.id === targetId);
            
            if (targetNode) {
                const { x, y } = targetNode.position;
                const width = targetNode.width || 150;
                const height = targetNode.height || 50;
                
                const currentZoom = getZoom();
                setCenter(x + width / 2, y + height / 2, { zoom: currentZoom, duration: 800 });
                
                setSelectedNode(targetId);
            }
        }, 50);
    };

    if (mode === 'play') {
          // Play Mode Logic
          if (isDoubleClick) {
              if (node.type === 'sticky') {
                  // Sticky: Open Property Panel on Double Click
                  onOpenPropertyPanel?.();
              } else if (node.type === 'jump' && node.data.jumpTarget) {
                  // Jump Node: Jump on Double Click
                  handleJump(node.data.jumpTarget);
              }
              // Other nodes: Do nothing
          }
          return;
    }
    
    // Edit Mode Logic

    // Mobile double tap logic (Property Panel)
    if (isMobile && onOpenPropertyPanel && isDoubleClick) {
        onOpenPropertyPanel();
    }

    if (isDoubleClick && node.type === 'jump' && node.data.jumpTarget) {
        // Jump Node Logic
        // In Edit Mode: Only jump if NOT mobile. 
        if (!isMobile) {
            handleJump(node.data.jumpTarget);
        }
    }

    if (node.type === 'group') {
        bringNodeToFront(node.id);
    }
  }, [bringNodeToFront, getNodes, getZoom, setCenter, setSelectedNode, mode, isMobile, onOpenPropertyPanel]);

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      
      // Mimic left-click behavior: 
      // - Normal right-click: select only this node (unless already selected)
      // - Ctrl/Cmd + right-click: toggle selection (add/remove from multi-selection)
      const isMultiSelect = event.ctrlKey || event.metaKey;
      
      if (isMultiSelect) {
        // Toggle selection (like Ctrl+Click)
        const updatedNodes = getNodes().map((n) => ({
          ...n,
          selected: n.id === node.id ? !n.selected : n.selected,
        }));
        setNodes(updatedNodes);
        
        // Update selected node if this node is now selected
        if (!node.selected) {
          setSelectedNode(node.id);
        }
      } else {
        // Single selection (like normal Click)
        // Only change selection if the node is not already selected
        if (!node.selected) {
          const updatedNodes = getNodes().map((n) => ({
            ...n,
            selected: n.id === node.id,
          }));
          setNodes(updatedNodes);
          setSelectedNode(node.id);
        }
      }
      
      // Use setTimeout to ensure selection state is updated before showing menu
      setTimeout(() => {
        const stickies = getNodes().filter(n => n.type === 'sticky' && n.data.targetNodeId === node.id);
        const hasSticky = stickies.length > 0;
        const stickiesHidden = stickies.every(n => n.hidden);

        setMenu({
          id: node.id,
          type: 'node',
          top: event.clientY,
          left: event.clientX,
          data: node.data,
          nodeType: node.type, // Pass node type
          parentNode: node.parentNode,
          hasSticky,
          stickiesHidden
        });
      }, 0);
    },
    [getNodes, setNodes, setSelectedNode]
  );



  const onSelectionContextMenu = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      
      // Get selected nodes
      const selectedNodes = getNodes().filter(n => n.selected);
      if (selectedNodes.length === 0) return;
      
      // Use the first selected node as the menu target
      const firstNode = selectedNodes[0];
      
      setTimeout(() => {
        const stickies = getNodes().filter(n => n.type === 'sticky' && n.data.targetNodeId === firstNode.id);
        const hasSticky = stickies.length > 0;
        const stickiesHidden = stickies.every(n => n.hidden);

        setMenu({
          id: firstNode.id,
          type: 'node',
          top: event.clientY,
          left: event.clientX,
          data: firstNode.data,
          nodeType: firstNode.type,
          parentNode: firstNode.parentNode,
          hasSticky,
          stickiesHidden
        });
      }, 0);
    },
    [getNodes]
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
      // Allow pane context menu in play mode for adding sticky notes
      setMenu({
        id: 'pane',
        type: 'pane',
        top: event.clientY,
        left: event.clientX,
      });
    },
    [mode]
  );

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    
    if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
    }

    const touch = e.touches[0];
    const clientX = touch.clientX;
    const clientY = touch.clientY;
    
    // Save start pos for move detection
    touchStartPos.current = { x: clientX, y: clientY };
    isLongPressTriggered.current = false;
    
    // We don't need e.persist() anymore if we just capture primitives and use state/refs
    
    longPressTimer.current = setTimeout(() => {
        isLongPressTriggered.current = true;
        
        // Robust Hit Testing: Use Flow coordinates and node bounds
        const flowPos = screenToFlowPosition({ x: clientX, y: clientY });
        
        // Find top-most node at this position
        // We iterate in reverse to find the one "on top" (assuming last rendered is on top, check z-index if needed)
        // Note: Simple reverse iteration of 'nodes' array is usually sufficient for standard ReactFlow
        // If z-indexes vary wildly, we might need real sort.
        const nodes = getNodes();
        let targetNode: Node | null = null;
        
        // Sort by z-index (if present) then by array order? 
        // For now, let's just search reverse.
        for (let i = nodes.length - 1; i >= 0; i--) {
            const n = nodes[i];
            const nX = n.positionAbsolute?.x ?? n.position.x;
            const nY = n.positionAbsolute?.y ?? n.position.y;
            const nW = n.width || 150; // Default fallback if not measured yet
            const nH = n.height || 40; 
            
            if (
                flowPos.x >= nX && flowPos.x <= nX + nW &&
                flowPos.y >= nY && flowPos.y <= nY + nH
            ) {
                // If it's a group, we should only pick it if we didn't hit a child inside it?
                // Actually, if we iterate reverse, we might hit a child first if it's rendered later (on top).
                // But groups are often rendered "behind".
                // ReactFlow rendering order depends on array order + z-index.
                
                // Let's refine: If we found a candidate, is there a better one?
                // With reverse loop, we find the "last" one.
                // However, children are often after parents in the array? Or before?
                // It's safer to check if the node is "visible" / clickable.
                if (!n.hidden) {
                    targetNode = n;
                    break;
                }
            }
        }
        
        // Special case: If we hit a GroupNode, but there might be a child...
        // The loop above finds the "last" node in the list that intersects.
        // If children are added *after* parents, this works.
        // If we hit a group, we might want to check if there is a child *inside* it at that position.
        // But if children are in the list after parents, we hit child first (break).
        // Let's assume standard ReactFlow order.
        
        const fakeEvent = {
            preventDefault: () => {},
            ctrlKey: false,
            metaKey: false,
            clientX: clientX,
            clientY: clientY,
        } as any;

        if (targetNode) {
             if (!targetNode.selected) setSelectedNode(targetNode.id);
             onNodeContextMenu(fakeEvent, targetNode);
        } else {
             onPaneContextMenu(fakeEvent);
        }
        
    }, 500);
  }, [getNodes, onNodeContextMenu, onPaneContextMenu, setSelectedNode, screenToFlowPosition]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    const dx = touch.clientX - touchStartPos.current.x;
    const dy = touch.clientY - touchStartPos.current.y;
    
    // Tolerance 10px (100px^2)
    if (dx*dx + dy*dy > 100) {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
    }
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
    }
    
    if (isLongPressTriggered.current) {
        if (e.cancelable) e.preventDefault();
        return;
    }
  }, []);



  const handleDetachFromGroup = useCallback(() => {
      if (!menu?.id) return;
      
      // Get selected nodes
      const selectedNodes = getNodes().filter(n => n.selected && n.parentNode);
      const nodesToDetach = selectedNodes.length > 0 ? selectedNodes : getNodes().filter(n => n.id === menu.id && n.parentNode);
      
      nodesToDetach.forEach(node => {
          if (node.parentNode) {
              // Find the top-level parent group
              let topParent = getNodes().find(n => n.id === node.parentNode);
              let currentParentId = topParent?.parentNode;
              
              while (currentParentId) {
                  const parent = getNodes().find(n => n.id === currentParentId);
                  if (parent) {
                      topParent = parent;
                      currentParentId = parent.parentNode;
                  } else {
                      break;
                  }
              }

              if (topParent) {
                  // Calculate node's current absolute Y
                  let absY = node.position.y;
                  let pId: string | undefined = node.parentNode;
                  while(pId) {
                      const p = getNodes().find(n => n.id === pId);
                      if (p) {
                          absY += p.position.y;
                          pId = p.parentNode;
                      } else {
                          break;
                      }
                  }

                  // Top parent is at root, so its position is absolute
                  const topParentX = topParent.position.x;
                  const topParentWidth = topParent.width || 150;

                  // New Position: Right of the top parent with some margin
                  const newX = topParentX + topParentWidth + 50;
                  const newY = absY;

                  useScenarioStore.getState().setNodeParent(node.id, undefined, { x: newX, y: newY });
              }
          }
      });
      setMenu(null);
  }, [menu, getNodes]);

  const handleAddSticky = useCallback((targetId?: string) => {
      // Get selected nodes
      const selectedNodes = getNodes().filter(n => n.selected && n.type !== 'sticky');
      const nodesToAddSticky = selectedNodes.length > 0 ? selectedNodes : (targetId ? getNodes().filter(n => n.id === targetId) : []);
      
      if (nodesToAddSticky.length > 0) {
          for (const node of nodesToAddSticky) {
              // Calculate absolute position manually to handle nested groups
              let absX = node.position.x;
              let absY = node.position.y;
              let parentId = node.parentNode;
              
              while(parentId) {
                  const parent = getNodes().find(n => n.id === parentId);
                  if (parent) {
                      absX += parent.position.x;
                      absY += parent.position.y;
                      parentId = parent.parentNode;
                  } else {
                      break;
                  }
              }

              // Position relative to target: Top-Right
              const pos = { 
                  x: absX + (node.width || 150) + 20, 
                  y: absY - 20 
              };
              
              addSticky(node.id, pos);
          }
      } else {
          // Add Free Sticky at Menu Position (if clicked on pane)
          if (menu) {
              const pos = screenToFlowPosition({ x: menu.left, y: menu.top });
              addSticky(undefined, pos);
          }
      }
      setMenu(null);
  }, [menu, getNodes, addSticky, screenToFlowPosition]);

  const handleToggleStickies = useCallback((targetId: string) => {
      // Get selected nodes
      const selectedNodes = getNodes().filter(n => n.selected && n.type !== 'sticky');
      const nodesToToggle = selectedNodes.length > 0 ? selectedNodes : getNodes().filter(n => n.id === targetId);
      
      nodesToToggle.forEach(node => {
          toggleStickies(node.id);
      });
      setMenu(null);
  }, [getNodes, toggleStickies]);

  const handleDeleteStickies = useCallback((targetId: string) => {
      // Get selected nodes
      const selectedNodes = getNodes().filter(n => n.selected && n.type !== 'sticky');
      const nodesToDelete = selectedNodes.length > 0 ? selectedNodes : getNodes().filter(n => n.id === targetId);
      
      nodesToDelete.forEach(node => {
          deleteStickies(node.id);
      });
      setMenu(null);
  }, [getNodes, deleteStickies]);

  const handleHideSticky = useCallback((stickyId: string) => {
      hideSticky(stickyId);
      setMenu(null);
  }, [hideSticky]);

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
      const selectedNodes = getNodes().filter(n => n.selected && n.type !== 'character' && n.type !== 'resource' && n.type !== 'sticky');
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

  const handleCopyText = useCallback(async (type: 'all' | 'label' | 'description' | 'value' | 'condition' | 'cases') => {
    if (!menu || !menu.data) {
        console.warn('[Canvas] Copy aborted: Menu state invalid');
        return;
    }
    
    // Get selected nodes or target node
    const selectedNodes = getNodes().filter(n => n.selected);
    const nodesToCopy = selectedNodes.length > 0 ? selectedNodes : getNodes().filter(n => n.id === menu.id);
    
    if (nodesToCopy.length === 0) {
        console.warn('[Canvas] Copy aborted: No nodes found');
        return;
    }

    const variables = gameState.variables;
    const process = (t: string) => substituteVariables(t, variables);
    
    const texts = nodesToCopy.map(node => {
      let text = '';
      const data = node.data;
      const nodeType = node.type;
      
      switch (type) {
          case 'all':
              text = `[${nodeType?.toUpperCase()}] ${process(data.label)}`;
              if (data.description) text += `\n${process(data.description)}`;
              
              if (nodeType === 'element') {
                  text += `\nType: ${data.infoType || 'knowledge'}`;
                  text += `\nValue: ${process(data.infoValue || '')}`;
                  text += `\nQuantity: ${data.quantity || 1}`;
                  text += `\nAction: ${data.actionType || 'obtain'}`;
              } else if (nodeType === 'variable') {
                  text += `\nTarget: ${data.targetVariable || ''}`;
                  text += `\nValue: ${process(data.variableValue || '')}`;
              } else if (nodeType === 'branch') {
                  text += `\nType: ${data.branchType || 'if_else'}`;
                  text += `\nCondition: ${data.conditionVariable || ''} ${process(data.conditionValue || '')}`;
                  if (data.branches) {
                      text += `\nCases:\n${data.branches.map((b: any) => `- ${process(b.label)}`).join('\n')}`;
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
              if (nodeType === 'element') text = process(data.infoValue || '');
              else if (nodeType === 'variable') text = process(data.variableValue || '');
              else text = process(data.infoValue || '');
              break;
          case 'condition':
              text = `${data.conditionVariable || ''} ${process(data.conditionValue || '')}`;
              break;
          case 'cases':
              if (data.branches) {
                  text = data.branches.map((b: any) => process(b.label)).join('\n');
              }
              break;
      }
      return text;
    });
    
    const finalString = texts.join('\n\n');
    if (!finalString) {
         console.warn('[Canvas] Copy aborted: Generated text is empty');
         setMenu(null);
         return;
    }

    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(finalString);
            console.log('[Canvas] Text copied to clipboard (API):', finalString.substring(0, 50) + '...');
        } else {
            throw new Error('Clipboard API unavailable or non-secure context');
        }
    } catch (err) {
        console.warn('[Canvas] Clipboard API failed, trying fallback:', err);
        try {
            const textArea = document.createElement("textarea");
            textArea.value = finalString;
            
            // Ensure element is part of document but hidden visually
            textArea.style.position = "fixed";
            textArea.style.left = "-9999px";
            textArea.style.top = "0";
            textArea.setAttribute('readonly', ''); // Prevent keyboard popup on mobile
            
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            
            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);
            
            if (successful) {
                console.log('[Canvas] Text copied to clipboard (Fallback)');
            } else {
                throw new Error('execCommand returned false');
            }
        } catch (fallbackErr) {
            console.error('[Canvas] Failed to copy text (Fallback):', fallbackErr);
            // Optional: Alert user if critical
            // alert('Failed to copy text. Please check browser permissions.');
        }
    }
    setMenu(null);
  }, [menu, gameState.variables, getNodes]);

  // Keyboard Shortcuts
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          // Prevent page reload on Ctrl+R
          if (e.ctrlKey && e.key === 'r') {
              e.preventDefault();
          }

          if (mode === 'play') {
              // Only allow Ctrl+R in play mode
              if (e.ctrlKey && e.key === 'r') {
                  handleToggleState();
              }
              return;
          }
          
          // Ignore if input/textarea is focused
          if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) return;
          
          // Ignore if inside a modal or dialog
          const target = e.target as HTMLElement;
          if (target.closest('[role="dialog"]') || target.closest('.modal')) return;
          
          // Ignore if text is selected (allow native copy)
          const selection = window.getSelection();
          if (selection && selection.toString().length > 0) return;

          if (e.key === 'Delete') {
              handleDelete();
          } else if (e.ctrlKey && e.key === 'c') {
              e.preventDefault(); // Prevent copy to clipboard? Or allow? User said "Duplicate".
              handleDuplicate();
          } else if (e.ctrlKey && e.key === 'v') {
              e.preventDefault();
              handleReduplicate();
          } else if (e.ctrlKey && e.key === 'r') {
              // Handled above, but just in case logic flows here
              handleToggleState();
          }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, handleDelete, handleDuplicate, handleReduplicate, handleToggleState]);

  // Sort nodes so groups are rendered first (bottom)
  // Ensure correct z-index and render order
  // Sticky Node (2000) > Sticky Edge (1000) > Target Node (0) > Group Node (-1)
  // Sort nodes so groups are rendered first (bottom)
  const sortedNodes = useMemo(() => {
      // Sort in place copy
      return [...nodes].sort((a, b) => {
        const getScore = (type: string) => {
            if (type === 'group') return -1;
            if (type === 'sticky') return 1;
            return 0;
        };
        return getScore(a.type || '') - getScore(b.type || '');
      });
  }, [nodes]);
  
  // Use sortedNodes directly. Removed processedNodes to avoid object reference changes.
  const processedNodes = sortedNodes;

  // Manual Pane Double Click - Behaves like Shift+Click (neutral, no zoom)
  const lastPaneClickTime = useRef(0);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartPos = useRef({ x: 0, y: 0 });
  const isLongPressTriggered = useRef(false);

  const handlePaneClick = useCallback((event: React.MouseEvent) => {
       const target = event.target as HTMLElement;
       
       // Double safety: ensure we are clicking the pane specifically
       if (target.closest('.react-flow__node')) return;
       // Triple safety: if we recently clicked a node (detected via onNodeClick), ignore pane click
       if (Date.now() - lastClickTime.current < 500) return;

       // STRICT CHECK: Only allow zoom if we clicked strictly on the pane or viewport background
       const isPane = target.classList.contains('react-flow__pane') || 
                      target.classList.contains('react-flow__renderer') ||
                      target.classList.contains('react-flow__viewport'); // Sometimes events bubble to viewport
       
       // Also allow if it's the wrapper div ref (though ReactFlow catches that inside)
       
       if (!isPane) {
           // If we are not sure it's the pane, do not zoom.
           // However, we still want to deselect if it's "not a node".
           // But for Zoom, be strict.
       } else {
           const now = Date.now();
           if (now - lastPaneClickTime.current < 300) {
               // Double click detected on Pane
               // Do nothing special - behaves neutrally (no zoom)
               // User can use Shift+Drag for box selection or View menu for zoom
           }
           lastPaneClickTime.current = now;
       }

       
       if (onCanvasClick) onCanvasClick();
       
       // Close menu/deselect
       setMenu(null);
       // Select null is handled by onSelectionChange if we click pane (deselection)
       // But clicking pane doesn't always trigger onSelectionChange (if nothing was selected)?
       // It does standard deselection.
       // However, manually calling setSelectedNode(null) ensures consistency.
       setSelectedNode(null);
  }, [onCanvasClick, setSelectedNode, setMenu]);




  return (
    <div 
        className="flex-1 h-full w-full relative" 
        ref={reactFlowWrapper}
        onTouchStartCapture={handleTouchStart}
        onTouchMoveCapture={handleTouchMove}
        onTouchEndCapture={handleTouchEnd}
    >

      {mode === 'play' && (
          <style>{`
            .react-flow__handle {
                opacity: 0 !important;
                pointer-events: none !important;
            }
          `}</style>
      )}
      {/* Mobile styles moved to index.css */}
      <ReactFlow
        nodes={processedNodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onReconnect={onReconnect}
        onInit={() => {
          // 初期ロード時の安全策：保存されたビューポートがない場合、遅延させてfitViewを実行
          // useEffect側のロジックでカバーできないケース（タイミング問題など）を救済
          const savedViewport = localStorage.getItem('canvas-viewport');
          if (!savedViewport && nodes.length > 0) {
            console.log('[Viewport] onInit: Scheduling fallback fitView');
            setTimeout(() => {
               window.requestAnimationFrame(() => {
                 fitView({ padding: 0.2, duration: 800 });
               });
            }, 600);
          }
        }}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultViewport={(() => {
          const savedViewport = localStorage.getItem('canvas-viewport');
          if (savedViewport) {
            try {
              return JSON.parse(savedViewport);
            } catch (e) {
              return { x: 0, y: 0, zoom: 1 };
            }
          }
          return { x: 0, y: 0, zoom: 1 };
        })()}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onNodeDragStart={onNodeDragStart}
        onNodeDragStop={onNodeDragStop}
        onSelectionChange={onSelectionChange}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
        }}
        onNodeContextMenu={onNodeContextMenu}
        onSelectionContextMenu={onSelectionContextMenu}
        onEdgeContextMenu={onEdgeContextMenu}
        onMoveEnd={(_event, viewport) => {
          // Save viewport to localStorage when user moves or zooms
          localStorage.setItem('canvas-viewport', JSON.stringify(viewport));
        }}
        onPaneContextMenu={onPaneContextMenu}
        onPaneClick={handlePaneClick}
        nodesDraggable={true}
        nodesConnectable={mode === 'edit'}
        elementsSelectable={true}
        zoomOnDoubleClick={false} // Disable native double click zoom (handled manually for pane)
        selectionKeyCode="Shift" // Default behavior
        deleteKeyCode={null} // Disable default delete to handle it manually
        minZoom={0.01}
        className="select-none touch-none bg-background"
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

        {!isMobile && (
            <Controls 
                className="bg-card border-border fill-foreground flex flex-col items-center gap-0.5 p-1 w-auto shadow-sm !overflow-visible rounded-full group" 
                showZoom={false} 
                showFitView={false} 
                showInteractive={false}
            >
                <ControlButton onClick={() => setZoom(Math.min(2, zoom + 0.05))} title="Zoom In (+5%)" className="!bg-transparent !border-none hover:!bg-accent hover:text-accent-foreground !text-foreground flex items-center justify-center rounded-full w-8 h-8">
                    <Plus size={14} />
                </ControlButton>
                
                <div className="relative flex items-center justify-center h-44 w-full my-0">
                    <input 
                        type="range" 
                        min="0.01" 
                        max="2" 
                        step="0.01" 
                        value={zoom} 
                        onChange={(e) => setZoom(parseFloat(e.target.value))}
                        onWheel={(e) => {
                            const delta = e.deltaY > 0 ? -0.01 : 0.01;
                            const newZoom = Math.min(2, Math.max(0.01, zoom + delta));
                            setZoom(newZoom);
                        }}
                        className="w-44 h-1.5 bg-secondary dark:bg-white/20 rounded-lg appearance-none cursor-pointer accent-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-90"
                    />
                    
                    <div 
                        className="absolute left-full ml-4 px-2 py-1 bg-popover text-popover-foreground text-xs font-mono rounded shadow-md border border-border whitespace-nowrap pointer-events-none z-50 hidden group-hover:flex items-center"
                        style={{ 
                            bottom: `calc(50% - 80px + ${((zoom - 0.01) / 1.99) * 160}px)`,
                            transform: 'translateY(50%)'
                        }}
                    >
                        <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-popover border-l-0"></div>
                        {Math.round(zoom * 100)}%
                    </div>
                </div>

                <ControlButton onClick={() => setZoom(Math.max(0.01, zoom - 0.05))} title="Zoom Out (-5%)" className="!bg-transparent !border-none hover:!bg-accent hover:text-accent-foreground !text-foreground flex items-center justify-center rounded-full w-8 h-8">
                    <Minus size={14} />
                </ControlButton>
                
                <ControlButton onClick={() => {
                  fitView();
                  // fitView完了を待ってビューポートを保存
                  let prevViewport = getViewport();
                  let stableFrames = 0;
                  const checkStability = () => {
                    const currentViewport = getViewport();
                    const isStable = 
                      Math.abs(currentViewport.x - prevViewport.x) < 0.1 &&
                      Math.abs(currentViewport.y - prevViewport.y) < 0.1 &&
                      Math.abs(currentViewport.zoom - prevViewport.zoom) < 0.001;
                    
                    if (isStable) {
                      stableFrames++;
                      if (stableFrames >= 3) {
                        localStorage.setItem('canvas-viewport', JSON.stringify(currentViewport));
                        return;
                      }
                    } else {
                      stableFrames = 0;
                    }
                    
                    prevViewport = currentViewport;
                    requestAnimationFrame(checkStability);
                  };
                  requestAnimationFrame(checkStability);
                }} title="Fit View" className="!bg-transparent !border-none hover:!bg-accent hover:text-accent-foreground !text-foreground flex items-center justify-center rounded-full w-8 h-8">
                    <Maximize size={14} />
                </ControlButton>
            </Controls> 
        )}
        <NodeInfoModal 
            referenceId={infoModalData} 
            onClose={() => setInfoModalData(null)} 
        />
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
          onDetachFromGroup={handleDetachFromGroup}
          onAddSticky={handleAddSticky}
          onToggleStickies={handleToggleStickies}
          onDeleteStickies={handleDeleteStickies}
          onHideSticky={handleHideSticky}
        />
      )}
    </div>
  );
}));

export const Canvas = React.memo(forwardRef<{ zoomIn: () => void; zoomOut: () => void; fitView: () => void; getZoom: () => number; setZoom: (zoom: number) => void; getViewport: () => { x: number; y: number; zoom: number }; setViewport: (viewport: { x: number; y: number; zoom: number }, options?: { isRestoring?: boolean }) => void }, { 
    onCanvasClick?: () => void;
    isMobile?: boolean; // Added prop
    onOpenPropertyPanel?: () => void;
}>((props, ref) => {
  return (
      <CanvasContent 
        ref={ref}
        {...props}
      />
  );
}));
