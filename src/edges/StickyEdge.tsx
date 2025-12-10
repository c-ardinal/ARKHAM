import { BaseEdge, type EdgeProps, getStraightPath } from 'reactflow';
import React from 'react';

const StickyEdge = ({
  sourceX,
  sourceY,
  targetX,
  targetY,
  style = {},
  markerEnd,
}: EdgeProps) => {
  const [edgePath] = getStraightPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
  });

  // Calculate direction vector to offset start point
  // We want to start 15px away from source (icon radius + buffer)
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const len = Math.sqrt(dx * dx + dy * dy);
  
  // Offset start by 15px to clear the icon
  const offset = 15;
  let finalPath = edgePath;
  
  if (len > offset) {
      const offsetX = (dx / len) * offset;
      const offsetY = (dy / len) * offset;
      const startX = sourceX + offsetX;
      const startY = sourceY + offsetY;
      
      // Re-calculate straight path from new start
      const [newPath] = getStraightPath({
          sourceX: startX,
          sourceY: startY,
          targetX,
          targetY,
      });
      finalPath = newPath;
  }

  return (
    <>
      <BaseEdge path={finalPath} markerEnd={markerEnd} style={style} />
    </>
  );
};

export default StickyEdge;
