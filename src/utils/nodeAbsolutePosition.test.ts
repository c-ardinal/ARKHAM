import { describe, it, expect } from 'vitest';
import { getJumpTargetCenter } from './nodeAbsolutePosition';
import type { ScenarioNode } from '../types';

// Minimal node factory
function makeNode(
  id: string,
  position: { x: number; y: number },
  options: {
    positionAbsolute?: { x: number; y: number };
    width?: number;
    height?: number;
  } = {},
): ScenarioNode {
  return {
    id,
    position,
    positionAbsolute: options.positionAbsolute,
    width: options.width,
    height: options.height,
    data: { label: id },
  } as ScenarioNode;
}

describe('getJumpTargetCenter', () => {
  it('positionAbsolute がある場合、その座標と width/height から中心を計算する', () => {
    const node = makeNode('n1', { x: 10, y: 20 }, {
      positionAbsolute: { x: 100, y: 200 },
      width: 200,
      height: 100,
    });
    const result = getJumpTargetCenter(node);
    expect(result.cx).toBe(100 + 200 / 2);
    expect(result.cy).toBe(200 + 100 / 2);
  });

  it('positionAbsolute が undefined のとき position ベースで中心を計算する', () => {
    const node = makeNode('n1', { x: 50, y: 80 }, {
      width: 100,
      height: 60,
    });
    const result = getJumpTargetCenter(node);
    expect(result.cx).toBe(50 + 100 / 2);
    expect(result.cy).toBe(80 + 60 / 2);
  });

  it('width が undefined のとき デフォルト 150 を使う', () => {
    const node = makeNode('n1', { x: 0, y: 0 }, {
      height: 50,
    });
    const result = getJumpTargetCenter(node);
    expect(result.cx).toBe(0 + 150 / 2);
  });

  it('height が undefined のとき デフォルト 50 を使う', () => {
    const node = makeNode('n1', { x: 0, y: 0 }, {
      width: 200,
    });
    const result = getJumpTargetCenter(node);
    expect(result.cy).toBe(0 + 50 / 2);
  });

  it('width=0, height=0 でも計算できる (中心はそのまま position 点)', () => {
    const node = makeNode('n1', { x: 30, y: 40 }, {
      width: 0,
      height: 0,
    });
    const result = getJumpTargetCenter(node);
    expect(result.cx).toBe(30);
    expect(result.cy).toBe(40);
  });

  it('positionAbsolute がある場合、position は無視される', () => {
    const node = makeNode('n1', { x: 999, y: 999 }, {
      positionAbsolute: { x: 10, y: 20 },
      width: 100,
      height: 50,
    });
    const result = getJumpTargetCenter(node);
    expect(result.cx).toBe(10 + 100 / 2);
    expect(result.cy).toBe(20 + 50 / 2);
  });

  it('positionAbsolute と width/height が全て 0 の場合でも計算できる', () => {
    const node = makeNode('n1', { x: 5, y: 5 }, {
      positionAbsolute: { x: 0, y: 0 },
      width: 0,
      height: 0,
    });
    const result = getJumpTargetCenter(node);
    expect(result.cx).toBe(0);
    expect(result.cy).toBe(0);
  });
});
