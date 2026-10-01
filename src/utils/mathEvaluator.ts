import type { Variable } from '../types';

const FORBIDDEN_KEYS = new Set([
  '__proto__',
  'constructor',
  'prototype',
  'tostring',
  'valueof',
]);

type TokenType = 'NUMBER' | 'OPERATOR' | 'LPAREN' | 'RPAREN' | 'IDENTIFIER' | 'EOF';

interface Token {
  type: TokenType;
  value: string | number;
}

/**
 * Tokenize a math expression.
 * Only allows numbers, basic arithmetic operators (+, -, *, /, %), parentheses,
 * and valid variable identifiers (including Japanese, Latin, underscores, and dots).
 * Immediately rejects any illegal characters (quotes, semicolons, brackets, etc.) to prevent injection attacks.
 */
function tokenizeMath(input: string): Token[] | null {
  const tokens: Token[] = [];
  let i = 0;
  const len = input.length;

  while (i < len) {
    const ch = input[i];

    // Skip whitespace
    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    // Number literal: e.g. 100, 3.14, .5
    if (/\d/.test(ch) || (ch === '.' && i + 1 < len && /\d/.test(input[i + 1]))) {
      let numStr = '';
      while (i < len && /[\d.]/.test(input[i])) {
        numStr += input[i];
        i++;
      }
      const numVal = parseFloat(numStr);
      if (isNaN(numVal) || !Number.isFinite(numVal)) {
        return null;
      }
      tokens.push({ type: 'NUMBER', value: numVal });
      continue;
    }

    // Variable template notation within formula: ${var_name}
    if (ch === '$' && i + 1 < len && input[i + 1] === '{') {
      i += 2;
      let varName = '';
      while (i < len && input[i] !== '}') {
        varName += input[i];
        i++;
      }
      if (i >= len || input[i] !== '}') {
        return null;
      }
      i++; // skip '}'
      const trimmedName = varName.trim();
      if (FORBIDDEN_KEYS.has(trimmedName.toLowerCase())) {
        return null;
      }
      tokens.push({ type: 'IDENTIFIER', value: trimmedName });
      continue;
    }

    // Operators: +, -, *, /, %
    if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '%') {
      tokens.push({ type: 'OPERATOR', value: ch });
      i++;
      continue;
    }

    // Parentheses: (, )
    if (ch === '(') {
      tokens.push({ type: 'LPAREN', value: '(' });
      i++;
      continue;
    }
    if (ch === ')') {
      tokens.push({ type: 'RPAREN', value: ')' });
      i++;
      continue;
    }

    // Identifiers: Latin, numbers, Japanese characters, underscore, dot (e.g., chara.hp, Dr.サトウ.HP)
    if (/[a-zA-Z_\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf]/.test(ch)) {
      let idStr = '';
      while (
        i < len &&
        /[a-zA-Z0-9_\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf.]/.test(input[i])
      ) {
        idStr += input[i];
        i++;
      }
      // Trim trailing dot if any
      if (idStr.endsWith('.')) {
        idStr = idStr.slice(0, -1);
        i--;
      }
      if (FORBIDDEN_KEYS.has(idStr.toLowerCase())) {
        return null;
      }
      tokens.push({ type: 'IDENTIFIER', value: idStr });
      continue;
    }

    // Any unrecognized character (e.g. ;, =, <, >, ", ', `, \, {, }) is rejected
    return null;
  }

  tokens.push({ type: 'EOF', value: '' });
  return tokens;
}

class MathParser {
  private tokens: Token[];
  private current = 0;
  private depth = 0;
  private maxDepth = 30;
  private variables: Record<string, Variable | { value: any }>;
  private lowerKeyMap: Map<string, string>;
  public hasOperation = false;

  constructor(tokens: Token[], variables: Record<string, Variable | { value: any }>) {
    this.tokens = tokens;
    this.variables = variables;
    this.lowerKeyMap = new Map();
    for (const k of Object.keys(variables)) {
      if (!FORBIDDEN_KEYS.has(k.toLowerCase())) {
        this.lowerKeyMap.set(k.toLowerCase(), k);
      }
    }
  }

  private peek(): Token {
    return this.tokens[this.current] || { type: 'EOF', value: '' };
  }

  private consume(): Token {
    const token = this.peek();
    this.current++;
    return token;
  }

  public parse(): number | null {
    this.depth = 0;
    const result = this.parseAdditive();
    if (result === null || !Number.isFinite(result)) {
      return null;
    }
    // Must consume all tokens to be a valid expression
    if (this.peek().type !== 'EOF') {
      return null;
    }
    // Round to avoid IEEE 754 precision artifacts (e.g. 0.1 + 0.2 = 0.30000000000000004)
    return Math.round(result * 1e10) / 1e10;
  }

  private parseAdditive(): number | null {
    let left = this.parseMultiplicative();
    if (left === null) return null;

    while (this.peek().type === 'OPERATOR' && (this.peek().value === '+' || this.peek().value === '-')) {
      this.hasOperation = true;
      const op = this.consume().value;
      const right = this.parseMultiplicative();
      if (right === null) return null;

      if (op === '+') {
        left = left + right;
      } else {
        left = left - right;
      }
      if (!Number.isFinite(left)) return null;
    }

    return left;
  }

  private parseMultiplicative(): number | null {
    let left = this.parseUnary();
    if (left === null) return null;

    while (
      this.peek().type === 'OPERATOR' &&
      (this.peek().value === '*' || this.peek().value === '/' || this.peek().value === '%')
    ) {
      this.hasOperation = true;
      const op = this.consume().value;
      const right = this.parseUnary();
      if (right === null) return null;

      if (op === '*') {
        left = left * right;
      } else if (op === '/') {
        // Safe division by zero returns 0
        left = right === 0 ? 0 : left / right;
      } else if (op === '%') {
        left = right === 0 ? 0 : left % right;
      }
      if (!Number.isFinite(left)) return null;
    }

    return left;
  }

  private parseUnary(): number | null {
    this.depth++;
    if (this.depth > this.maxDepth) return null;

    try {
      if (this.peek().type === 'OPERATOR' && (this.peek().value === '+' || this.peek().value === '-')) {
        this.hasOperation = true;
        const op = this.consume().value;
        const operand = this.parseUnary();
        if (operand === null) return null;
        return op === '-' ? -operand : operand;
      }

      return this.parsePrimary();
    } finally {
      this.depth--;
    }
  }

  private parsePrimary(): number | null {
    const token = this.peek();

    if (token.type === 'NUMBER') {
      this.consume();
      return typeof token.value === 'number' ? token.value : parseFloat(String(token.value));
    }

    if (token.type === 'IDENTIFIER') {
      this.consume();
      const id = String(token.value).trim();
      const realKey = this.lowerKeyMap.get(id.toLowerCase());
      if (!realKey) {
        return null; // Unknown variable, cannot evaluate math
      }
      const rawObj = this.variables[realKey];
      const rawVal =
        rawObj !== null && typeof rawObj === 'object' && 'value' in rawObj
          ? (rawObj as { value: any }).value
          : rawObj;

      const num = Number(rawVal);
      if (isNaN(num) || !Number.isFinite(num)) {
        return null; // Variable value is not numeric
      }
      return num;
    }

    if (token.type === 'LPAREN') {
      this.hasOperation = true;
      this.consume(); // '('
      const val = this.parseAdditive();
      if (val === null) return null;
      if (this.peek().type !== 'RPAREN') {
        return null; // Missing matching ')'
      }
      this.consume(); // ')'
      return val;
    }

    return null;
  }
}

/**
 * Safely evaluates a math expression without eval() or new Function().
 *
 * @param expr The expression string (e.g. "100 + 200", "${chara.money} + 50", "Dr.サトウ.HP * 2")
 * @param variables Available variables to resolve identifiers
 * @param options.requireOperator If true, expression must contain at least one operation or parenthesis
 * @returns The evaluated number, or null if invalid / not a formula
 */
export function safeEvaluateMath(
  expr: string,
  variables: Record<string, Variable | { value: any }> = {},
  options: { requireOperator?: boolean } = {}
): number | null {
  if (!expr || typeof expr !== 'string') return null;
  const trimmed = expr.trim();
  if (trimmed.length > 500) return null; // Prevent DoS on excessively long formulas

  const tokens = tokenizeMath(trimmed);
  if (!tokens || tokens.length === 0) return null;

  const parser = new MathParser(tokens, variables);
  const result = parser.parse();

  if (result === null) return null;
  if (options.requireOperator && !parser.hasOperation) {
    return null;
  }

  return result;
}
