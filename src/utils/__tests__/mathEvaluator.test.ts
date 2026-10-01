import { describe, it, expect } from 'vitest';
import { safeEvaluateMath } from '../mathEvaluator';
import { substituteVariables, evaluateFormula } from '../textUtils';
import type { Variable } from '../../types';

describe('safeEvaluateMath', () => {
  it('correctly evaluates basic arithmetic', () => {
    expect(safeEvaluateMath('1 + 2')).toBe(3);
    expect(safeEvaluateMath('10 - 4')).toBe(6);
    expect(safeEvaluateMath('3 * 4')).toBe(12);
    expect(safeEvaluateMath('10 / 2')).toBe(5);
    expect(safeEvaluateMath('10 % 3')).toBe(1);
    expect(safeEvaluateMath('2 + 3 * 4')).toBe(14);
    expect(safeEvaluateMath('(2 + 3) * 4')).toBe(20);
    expect(safeEvaluateMath('-5 + 15')).toBe(10);
    expect(safeEvaluateMath('-(5 + 5)')).toBe(-10);
  });

  it('safely handles division by zero', () => {
    expect(safeEvaluateMath('10 / 0')).toBe(0);
    expect(safeEvaluateMath('10 % 0')).toBe(0);
  });

  it('resolves variables including dot-notation', () => {
    const vars: Record<string, Variable> = {
      'charaa.money': { name: 'charaa.money', type: 'number', value: 100 },
      'charab.money': { name: 'charab.money', type: 'number', value: 200 },
      'Dr.サトウ.HP': { name: 'Dr.サトウ.HP', type: 'number', value: 15 },
    };

    expect(safeEvaluateMath('charaa.money + charab.money', vars)).toBe(300);
    expect(safeEvaluateMath('${charaa.money} + ${charab.money}', vars)).toBe(300);
    expect(safeEvaluateMath('Dr.サトウ.HP * 2', vars)).toBe(30);
    expect(safeEvaluateMath('(charaa.money + charab.money) / 3', vars)).toBe(100);
  });

  it('rejects injection attacks, forbidden keys, and malicious input', () => {
    // Arbitrary JS execution attempts
    expect(safeEvaluateMath('new Function("alert(1)")()')).toBeNull();
    expect(safeEvaluateMath('eval("1+1")')).toBeNull();
    expect(safeEvaluateMath('window.location="http://evil.com"')).toBeNull();
    expect(safeEvaluateMath('<script>alert(1)</script>')).toBeNull();
    expect(safeEvaluateMath('1; alert(1)')).toBeNull();
    expect(safeEvaluateMath('__proto__ + 1')).toBeNull();
    expect(safeEvaluateMath('constructor + 1')).toBeNull();
    expect(safeEvaluateMath('prototype + 1')).toBeNull();
    expect(safeEvaluateMath('toString()')).toBeNull();
  });

  it('enforces requireOperator option', () => {
    expect(safeEvaluateMath('100', {}, { requireOperator: true })).toBeNull();
    expect(safeEvaluateMath('100 + 0', {}, { requireOperator: true })).toBe(100);
  });
});

describe('substituteVariables with arithmetic expansion', () => {
  const sampleVars: Record<string, Variable> = {
    'charaa.money': { name: 'charaa.money', type: 'number', value: 150 },
    'charab.money': { name: 'charab.money', type: 'number', value: 350 },
    'charaa.name': { name: 'charaa.name', type: 'string', value: 'アリス' },
    'Dr.サトウ.HP': { name: 'Dr.サトウ.HP', type: 'number', value: 12 },
  };

  it('evaluates nested variable summation: ${${charaa.money}+${charab.money}}', () => {
    const text = '合計所持金は ${${charaa.money}+${charab.money}} 円です。';
    const result = substituteVariables(text, sampleVars);
    expect(result).toBe('合計所持金は 500 円です。');
  });

  it('evaluates nested variable math with spaces: ${ ${charaa.money} + ${charab.money} }', () => {
    const text = '合計所持金: ${ ${charaa.money} + ${charab.money} }G';
    const result = substituteVariables(text, sampleVars);
    expect(result).toBe('合計所持金: 500G');
  });

  it('evaluates direct variable formula in single bracket: ${charaa.money + charab.money}', () => {
    const text = '合計所持金は ${charaa.money + charab.money} 円です。';
    const result = substituteVariables(text, sampleVars);
    expect(result).toBe('合計所持金は 500 円です。');
  });

  it('evaluates formula with multiplier: ${(charaa.money * 2) + charab.money}', () => {
    const text = '計算結果: ${(charaa.money * 2) + charab.money}';
    const result = substituteVariables(text, sampleVars);
    expect(result).toBe('計算結果: 650');
  });

  it('supports entity with dots: ${Dr.サトウ.HP * 2}', () => {
    const text = 'サトウ先生のブースト後HPは ${Dr.サトウ.HP * 2} です。';
    const result = substituteVariables(text, sampleVars);
    expect(result).toBe('サトウ先生のブースト後HPは 24 です。');
  });

  it('preserves non-math string variables and normal templates untouched', () => {
    const text = '名前は ${charaa.name} です。';
    const result = substituteVariables(text, sampleVars);
    expect(result).toBe('名前は アリス です。');
  });

  it('leaves unknown variables untouched without crashing', () => {
    const text = '不明な変数: ${unknown_value}';
    const result = substituteVariables(text, sampleVars);
    expect(result).toBe('不明な変数: ${unknown_value}');
  });

  it('blocks injection attempts in string templates', () => {
    const text1 = '攻撃試行: ${constructor.prototype}';
    expect(substituteVariables(text1, sampleVars)).toBe(text1);

    const text2 = '攻撃試行: ${<script>alert(1)</script>}';
    expect(substituteVariables(text2, sampleVars)).toBe(text2);

    const text3 = '攻撃試行: ${window.location="http://evil.com"}';
    expect(substituteVariables(text3, sampleVars)).toBe(text3);
  });
});

describe('evaluateFormula', () => {
  const vars: Record<string, Variable> = {
    'charaa.money': { name: 'charaa.money', type: 'number', value: 100 },
    'charab.money': { name: 'charab.money', type: 'number', value: 200 },
  };

  it('evaluates arithmetic formulas safely without new Function', () => {
    expect(evaluateFormula('10 + 20', vars)).toBe(30);
    expect(evaluateFormula('${charaa.money} + ${charab.money}', vars)).toBe(300);
    expect(evaluateFormula('charaa.money + charab.money', vars)).toBe(300);
    expect(evaluateFormula('(charaa.money * 3) - 50', vars)).toBe(250);
  });

  it('falls back to string substitution for non-math text', () => {
    const stringVars: Record<string, Variable> = {
      itemName: { name: 'itemName', type: 'string', value: '回復薬' },
    };
    expect(evaluateFormula('アイテム: ${itemName}', stringVars)).toBe('アイテム: 回復薬');
  });
});
