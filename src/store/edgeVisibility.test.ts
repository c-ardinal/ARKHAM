import { describe, it, expect } from 'vitest';
import { recomputeEdgeVisibility } from './edgeVisibility';
import type { ScenarioNode, ScenarioEdge } from '../types';

// Minimal node factory
function makeNode(
  id: string,
  hidden?: boolean,
): Pick<ScenarioNode, 'id' | 'hidden' | 'position' | 'data'> {
  return {
    id,
    hidden,
    position: { x: 0, y: 0 },
    data: { label: id },
  };
}

// Minimal edge factory
function makeEdge(
  id: string,
  source: string,
  target: string,
  hidden?: boolean,
  data?: Record<string, unknown>,
): ScenarioEdge {
  return { id, source, target, hidden, data } as ScenarioEdge;
}

describe('recomputeEdgeVisibility', () => {
  it('両端が visible のとき edge.hidden は false になる', () => {
    const nodes = [makeNode('a'), makeNode('b')] as ScenarioNode[];
    const edges = [makeEdge('e1', 'a', 'b')] as ScenarioEdge[];
    const result = recomputeEdgeVisibility(nodes, edges);
    expect(result[0].hidden).toBe(false);
  });

  it('source が hidden のとき edge.hidden は true になる', () => {
    const nodes = [makeNode('a', true), makeNode('b')] as ScenarioNode[];
    const edges = [makeEdge('e1', 'a', 'b')] as ScenarioEdge[];
    const result = recomputeEdgeVisibility(nodes, edges);
    expect(result[0].hidden).toBe(true);
  });

  it('target が hidden のとき edge.hidden は true になる', () => {
    const nodes = [makeNode('a'), makeNode('b', true)] as ScenarioNode[];
    const edges = [makeEdge('e1', 'a', 'b')] as ScenarioEdge[];
    const result = recomputeEdgeVisibility(nodes, edges);
    expect(result[0].hidden).toBe(true);
  });

  it('両端が hidden のとき edge.hidden は true になる', () => {
    const nodes = [makeNode('a', true), makeNode('b', true)] as ScenarioNode[];
    const edges = [makeEdge('e1', 'a', 'b')] as ScenarioEdge[];
    const result = recomputeEdgeVisibility(nodes, edges);
    expect(result[0].hidden).toBe(true);
  });

  it('source が存在しないノードを指すとき edge.hidden は true になる', () => {
    const nodes = [makeNode('b')] as ScenarioNode[];
    const edges = [makeEdge('e1', 'nonexistent', 'b')] as ScenarioEdge[];
    const result = recomputeEdgeVisibility(nodes, edges);
    expect(result[0].hidden).toBe(true);
  });

  it('target が存在しないノードを指すとき edge.hidden は true になる', () => {
    const nodes = [makeNode('a')] as ScenarioNode[];
    const edges = [makeEdge('e1', 'a', 'nonexistent')] as ScenarioEdge[];
    const result = recomputeEdgeVisibility(nodes, edges);
    expect(result[0].hidden).toBe(true);
  });

  it('既に hidden=true で変化がない場合、同じ edge オブジェクト参照を返す', () => {
    const nodes = [makeNode('a', true), makeNode('b')] as ScenarioNode[];
    const edge = makeEdge('e1', 'a', 'b', true) as ScenarioEdge;
    const edges = [edge];
    const result = recomputeEdgeVisibility(nodes, edges);
    expect(Object.is(result[0], edge)).toBe(true);
  });

  it('既に hidden=false で変化がない場合、同じ edge オブジェクト参照を返す', () => {
    const nodes = [makeNode('a'), makeNode('b')] as ScenarioNode[];
    const edge = makeEdge('e1', 'a', 'b', false) as ScenarioEdge;
    const edges = [edge];
    const result = recomputeEdgeVisibility(nodes, edges);
    expect(Object.is(result[0], edge)).toBe(true);
  });

  it('virtual edge (data.isVirtual: true) は通常の edge と同じ visibility ルールが適用される (両端visible)', () => {
    const nodes = [makeNode('a'), makeNode('b')] as ScenarioNode[];
    const edge = makeEdge('e1', 'a', 'b', undefined, { isVirtual: true }) as ScenarioEdge;
    const edges = [edge];
    const result = recomputeEdgeVisibility(nodes, edges);
    expect(result[0].hidden).toBe(false);
  });

  it('virtual edge で片方が hidden のとき edge.hidden は true になる', () => {
    const nodes = [makeNode('a', true), makeNode('b')] as ScenarioNode[];
    const edge = makeEdge('e1', 'a', 'b', false, { isVirtual: true }) as ScenarioEdge;
    const edges = [edge];
    const result = recomputeEdgeVisibility(nodes, edges);
    expect(result[0].hidden).toBe(true);
  });

  it('edges 配列が空の場合、空配列を返す', () => {
    const nodes = [makeNode('a')] as ScenarioNode[];
    const result = recomputeEdgeVisibility(nodes, []);
    expect(result).toEqual([]);
  });

  it('複数 edge に対して正しく処理される', () => {
    const nodes = [makeNode('a'), makeNode('b'), makeNode('c', true)] as ScenarioNode[];
    const edges = [
      makeEdge('e1', 'a', 'b'),      // visible -> hidden=false
      makeEdge('e2', 'a', 'c'),      // c is hidden -> hidden=true
      makeEdge('e3', 'b', 'c'),      // c is hidden -> hidden=true
    ] as ScenarioEdge[];
    const result = recomputeEdgeVisibility(nodes, edges);
    expect(result[0].hidden).toBe(false);
    expect(result[1].hidden).toBe(true);
    expect(result[2].hidden).toBe(true);
  });
});
