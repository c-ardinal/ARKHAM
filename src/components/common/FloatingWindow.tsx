import React, { useState } from 'react';
import { Rnd } from 'react-rnd';
import { X, Minus, Maximize2, Minimize2, ChevronUp } from 'lucide-react';

interface FloatingWindowProps {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  defaultPosition?: { x: number; y: number };
  defaultSize?: { width: number; height: number };
  minSize?: { width: number; height: number };
  zIndex?: number;
}

export const FloatingWindow: React.FC<FloatingWindowProps> = ({
  title,
  isOpen,
  onClose,
  children,
  defaultPosition = { x: 20, y: 80 }, // 左上(ヘッダー下)
  defaultSize = { width: 600, height: 400 },
  minSize = { width: 400, height: 300 },
  zIndex = 1000,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [size, setSize] = useState(defaultSize);
  const [position, setPosition] = useState(defaultPosition);
  const [restoreState, setRestoreState] = useState({ size: defaultSize, position: defaultPosition });

  if (!isOpen) return null;

  const handleMaximize = () => {
    if (isMaximized) {
      // 復元
      setSize(restoreState.size);
      setPosition(restoreState.position);
      setIsMaximized(false);
    } else {
      // 最大化前の状態を保存
      setRestoreState({ size, position });
      // 最大化
      setSize({ width: window.innerWidth - 40, height: window.innerHeight - 100 });
      setPosition({ x: 20, y: 80 });
      setIsMaximized(true);
    }
  };

  const currentSize = isMinimized 
    ? { width: size.width, height: 40 } 
    : isMaximized 
      ? { width: window.innerWidth - 40, height: window.innerHeight - 100 }
      : size;

  const currentPosition = isMaximized ? { x: 20, y: 80 } : position;

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex }}>
      <Rnd
        size={currentSize}
        position={currentPosition}
        onDragStop={(_e, d) => {
          if (!isMaximized) {
            setPosition({ x: d.x, y: d.y });
          }
        }}
        onResizeStop={(_e, _direction, ref, _delta, position) => {
          if (!isMaximized) {
            setSize({
              width: parseInt(ref.style.width),
              height: parseInt(ref.style.height),
            });
            setPosition(position);
          }
        }}
        minWidth={minSize.width}
        minHeight={isMinimized ? 40 : minSize.height}
        bounds="parent"
        dragHandleClassName="debug-window-header"
        enableResizing={!isMinimized && !isMaximized}
        disableDragging={isMaximized}
        style={{ pointerEvents: 'auto' }}
      >
        <div className="bg-card border border-border rounded-lg shadow-2xl flex flex-col h-full">
          {/* ヘッダー */}
          <div className="debug-window-header flex items-center justify-between px-4 py-2 border-b border-border cursor-move bg-muted/50 rounded-t-lg">
            <h3 className="text-sm font-bold select-none">{title}</h3>
            <div className="flex gap-1">
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="p-1 hover:bg-accent rounded transition-colors"
                title={isMinimized ? '展開' : '最小化'}
              >
                {isMinimized ? <ChevronUp size={14} /> : <Minus size={14} />}
              </button>
              <button
                onClick={handleMaximize}
                className="p-1 hover:bg-accent rounded transition-colors"
                title={isMaximized ? '元に戻す' : '最大化'}
              >
                {isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>
              <button
                onClick={onClose}
                className="p-1 hover:bg-destructive/20 hover:text-destructive rounded transition-colors"
                title="閉じる"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* コンテンツ */}
          {!isMinimized && (
            <div className="flex-1 overflow-hidden">
              {children}
            </div>
          )}
        </div>
      </Rnd>
    </div>
  );
};
