import { describe, it, expect } from 'vitest';
import {
  tokenize,
  evaluateExpression,
  validateExpression,
} from '../expression';

describe('Expression Module (expression.ts)', () => {
  it('tokenizes simple and complex expressions', () => {
    const tokens = tokenize('alarm_level >= 2 && flag == true');
    expect(tokens.map((t) => t.type)).toEqual([
      'IDENTIFIER',
      'OPERATOR',
      'NUMBER',
      'OPERATOR',
      'IDENTIFIER',
      'OPERATOR',
      'BOOLEAN',
      'EOF',
    ]);
  });

  it('supports template notation ${var}', () => {
    const tokens = tokenize('${hp} <= 0');
    expect(tokens[0]).toEqual({
      type: 'IDENTIFIER',
      value: 'hp',
      raw: '${hp}',
      pos: 0,
    });
  });

  it('supports Japanese variable names', () => {
    const result = evaluateExpression('警報レベル >= 2', { 警報レベル: 3 });
    expect(result).toBe(true);

    const resultFalse = evaluateExpression('警報レベル >= 2', { 警報レベル: 1 });
    expect(resultFalse).toBe(false);
  });

  it('supports friendly and/or/not keywords', () => {
    expect(evaluateExpression('a and b', { a: true, b: true })).toBe(true);
    expect(evaluateExpression('a and b', { a: true, b: false })).toBe(false);
    expect(evaluateExpression('a or b', { a: false, b: true })).toBe(true);
    expect(evaluateExpression('not a', { a: false })).toBe(true);
  });

  it('evaluates comparison operators correctly', () => {
    const vars = { x: 10, y: 20, str: 'hello' };
    expect(evaluateExpression('x < y', vars)).toBe(true);
    expect(evaluateExpression('x <= 10', vars)).toBe(true);
    expect(evaluateExpression('x > y', vars)).toBe(false);
    expect(evaluateExpression('y >= 20', vars)).toBe(true);
    expect(evaluateExpression('x == 10', vars)).toBe(true);
    expect(evaluateExpression('x != 10', vars)).toBe(false);
    expect(evaluateExpression("str == 'hello'", vars)).toBe(true);
    expect(evaluateExpression('str != "world"', vars)).toBe(true);
  });

  it('evaluates arithmetic and operator precedence', () => {
    expect(evaluateExpression('2 + 3 * 4')).toBe(14);
    expect(evaluateExpression('(2 + 3) * 4')).toBe(20);
    expect(evaluateExpression('10 - 4 - 2')).toBe(4);
    expect(evaluateExpression('10 / 2')).toBe(5);
    expect(evaluateExpression('10 % 3')).toBe(1);
  });

  it('evaluates complex boolean logic with parentheses', () => {
    const vars = { level: 2, has_key: false, is_admin: true };
    expect(evaluateExpression('(level >= 2 && has_key) || is_admin', vars)).toBe(true);
    expect(evaluateExpression('level >= 2 && (has_key || is_admin)', vars)).toBe(true);
    expect(evaluateExpression('level >= 3 || (has_key && is_admin)', vars)).toBe(false);
  });

  it('handles Zustand-style variable objects with .value property', () => {
    const zustandVariables = {
      alarm: { name: 'alarm', type: 'number', value: 3 },
      cleared: { name: 'cleared', type: 'boolean', value: true },
    };
    expect(evaluateExpression('alarm >= 2 && cleared', zustandVariables)).toBe(true);
  });

  it('validates syntax and catches errors with friendly messages', () => {
    const invalid1 = validateExpression('alarm >= ');
    expect(invalid1.isValid).toBe(false);
    expect(invalid1.error).toBeDefined();

    const invalid2 = validateExpression('((a + 1)');
    expect(invalid2.isValid).toBe(false);

    const valid = validateExpression('alarm >= 2 && flag == true');
    expect(valid.isValid).toBe(true);
    expect(valid.usedVariables).toEqual(['alarm', 'flag']);
  });

  it('detects undefined variables when variable definitions are supplied', () => {
    const definedVars = {
      alarm: { type: 'number', value: 0 },
    };
    const check1 = validateExpression('alarm >= 1', definedVars);
    expect(check1.isValid).toBe(true);

    const check2 = validateExpression('unknown_var == true', definedVars);
    expect(check2.isValid).toBe(false);
    expect(check2.error).toContain('未定義です');
  });
});
