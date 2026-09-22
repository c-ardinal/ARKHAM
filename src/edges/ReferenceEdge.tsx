import React from 'react';
import { BaseEdge, type EdgeProps, getBezierPath } from 'reactflow';

/**
 * Reference Edge component for linking supplementary nodes (characters, stages, elements, memos)
 * to narrative event nodes.
 * Rendered as a distinct dashed auxiliary line without chronological directional flow.
 */
export const ReferenceEdge: React.FC<EdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  selected,
}) => {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const mergedStyle: React.CSSProperties = {
    ...style,
    stroke: selected ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground) / 0.7)',
    strokeWidth: selected ? 2.5 : 1.75,
    strokeDasharray: '5 5',
  };

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      markerEnd={markerEnd}
      style={mergedStyle}
    />
  );
};

export default ReferenceEdge;
