/**
 * ARKHAM Core Engine - Expression Module
 * Safe, strict Lexer / Parser / Evaluator for conditions and arithmetic.
 * Does NOT use eval() or new Function().
 */

export type TokenType =
  | 'NUMBER'
  | 'BOOLEAN'
  | 'STRING'
  | 'IDENTIFIER'
  | 'OPERATOR'
  | 'PUNCTUATION'
  | 'EOF';

export interface Token {
  type: TokenType;
  value: string | number | boolean;
  raw: string;
  pos: number;
}

export type ASTNode =
  | { type: 'Literal'; value: number | boolean | string }
  | { type: 'Identifier'; name: string }
  | { type: 'UnaryExpression'; operator: string; argument: ASTNode }
  | { type: 'BinaryExpression'; operator: string; left: ASTNode; right: ASTNode }
  | { type: 'LogicalExpression'; operator: string; left: ASTNode; right: ASTNode };

/**
 * Tokenizes an expression string
 */
export function tokenize(input: string): Token[] {
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

    // Number literal: 123, 12.34
    if (/\d/.test(ch) || (ch === '.' && i + 1 < len && /\d/.test(input[i + 1]))) {
      let numStr = '';
      const start = i;
      while (i < len && (/[\d.]/.test(input[i]))) {
        numStr += input[i];
        i++;
      }
      const val = Number(numStr);
      if (isNaN(val)) {
        throw new Error(`無効な数値形式です: "${numStr}" (位置: ${start})`);
      }
      tokens.push({ type: 'NUMBER', value: val, raw: numStr, pos: start });
      continue;
    }

    // String literal: 'hello' or "hello"
    if (ch === '\'' || ch === '"') {
      const quote = ch;
      const start = i;
      i++; // skip opening quote
      let strVal = '';
      let closed = false;
      while (i < len) {
        if (input[i] === '\\' && i + 1 < len) {
          strVal += input[i + 1];
          i += 2;
        } else if (input[i] === quote) {
          closed = true;
          i++; // skip closing quote
          break;
        } else {
          strVal += input[i];
          i++;
        }
      }
      if (!closed) {
        throw new Error(`文字列リテラルの引用符が閉じられていません (位置: ${start})`);
      }
      tokens.push({ type: 'STRING', value: strVal, raw: input.slice(start, i), pos: start });
      continue;
    }

    // Variable template notation: ${var_name}
    if (ch === '$' && i + 1 < len && input[i + 1] === '{') {
      const start = i;
      i += 2;
      let varName = '';
      while (i < len && input[i] !== '}') {
        varName += input[i];
        i++;
      }
      if (i >= len || input[i] !== '}') {
        throw new Error(`変数参照 \${...} が閉じられていません (位置: ${start})`);
      }
      i++; // skip '}'
      tokens.push({ type: 'IDENTIFIER', value: varName.trim(), raw: input.slice(start, i), pos: start });
      continue;
    }

    // Multi-character operators: ===, !==, ==, !=, <=, >=, &&, ||
    const twoChars = input.slice(i, i + 2);
    const threeChars = input.slice(i, i + 3);

    if (threeChars === '===' || threeChars === '!==') {
      tokens.push({ type: 'OPERATOR', value: threeChars.slice(0, 2), raw: threeChars, pos: i });
      i += 3;
      continue;
    }

    if (['==', '!=', '<=', '>=', '&&', '||'].includes(twoChars)) {
      tokens.push({ type: 'OPERATOR', value: twoChars, raw: twoChars, pos: i });
      i += 2;
      continue;
    }

    // Single character operators & punctuation: <, >, +, -, *, /, %, !, (, )
    if (['<', '>', '+', '-', '*', '/', '%', '!'].includes(ch)) {
      tokens.push({ type: 'OPERATOR', value: ch, raw: ch, pos: i });
      i++;
      continue;
    }

    if (['(', ')'].includes(ch)) {
      tokens.push({ type: 'PUNCTUATION', value: ch, raw: ch, pos: i });
      i++;
      continue;
    }

    // Identifiers & keywords (true, false, and, or, not, or variable names)
    if (/[a-zA-Z_\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf]/.test(ch)) {
      const start = i;
      let idStr = '';
      while (
        i < len &&
        /[a-zA-Z0-9_\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf]/.test(input[i])
      ) {
        idStr += input[i];
        i++;
      }

      const lower = idStr.toLowerCase();
      if (lower === 'true') {
        tokens.push({ type: 'BOOLEAN', value: true, raw: idStr, pos: start });
      } else if (lower === 'false') {
        tokens.push({ type: 'BOOLEAN', value: false, raw: idStr, pos: start });
      } else if (lower === 'and') {
        tokens.push({ type: 'OPERATOR', value: '&&', raw: idStr, pos: start });
      } else if (lower === 'or') {
        tokens.push({ type: 'OPERATOR', value: '||', raw: idStr, pos: start });
      } else if (lower === 'not') {
        tokens.push({ type: 'OPERATOR', value: '!', raw: idStr, pos: start });
      } else {
        tokens.push({ type: 'IDENTIFIER', value: idStr, raw: idStr, pos: start });
      }
      continue;
    }

    throw new Error(`予期しない文字です: "${ch}" (位置: ${i})`);
  }

  tokens.push({ type: 'EOF', value: '', raw: '', pos: len });
  return tokens;
}

/**
 * Parser using Recursive Descent
 */
class ExpressionParser {
  private tokens: Token[];
  private current = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token {
    return this.tokens[this.current];
  }

  private match(...operators: string[]): boolean {
    const token = this.peek();
    if (token.type === 'OPERATOR' && operators.includes(token.value as string)) {
      this.current++;
      return true;
    }
    return false;
  }

  private consume(type: TokenType, expectedValue?: string): Token {
    const token = this.peek();
    if (token.type !== type || (expectedValue !== undefined && token.value !== expectedValue)) {
      const exp = expectedValue ? `"${expectedValue}"` : type;
      const act = token.type === 'EOF' ? '末尾' : `"${token.raw}"`;
      throw new Error(`構文エラー: ${exp} が必要ですが、${act} が見つかりました (位置: ${token.pos})`);
    }
    this.current++;
    return token;
  }

  public parse(): ASTNode {
    if (this.peek().type === 'EOF') {
      throw new Error('式が空です');
    }
    const expr = this.logicalOr();
    if (this.peek().type !== 'EOF') {
      const extra = this.peek();
      throw new Error(`予期しないトークンです: "${extra.raw}" (位置: ${extra.pos})`);
    }
    return expr;
  }

  // logicalOr -> logicalAnd ( '||' logicalAnd )*
  private logicalOr(): ASTNode {
    let expr = this.logicalAnd();
    while (this.match('||')) {
      const right = this.logicalAnd();
      expr = { type: 'LogicalExpression', operator: '||', left: expr, right };
    }
    return expr;
  }

  // logicalAnd -> equality ( '&&' equality )*
  private logicalAnd(): ASTNode {
    let expr = this.equality();
    while (this.match('&&')) {
      const right = this.equality();
      expr = { type: 'LogicalExpression', operator: '&&', left: expr, right };
    }
    return expr;
  }

  // equality -> relational ( ( '==' | '!=' ) relational )*
  private equality(): ASTNode {
    let expr = this.relational();
    while (this.match('==', '!=')) {
      const op = (this.tokens[this.current - 1].value as string);
      const right = this.relational();
      expr = { type: 'BinaryExpression', operator: op, left: expr, right };
    }
    return expr;
  }

  // relational -> additive ( ( '<' | '<=' | '>' | '>=' ) additive )*
  private relational(): ASTNode {
    let expr = this.additive();
    while (this.match('<', '<=', '>', '>=')) {
      const op = (this.tokens[this.current - 1].value as string);
      const right = this.additive();
      expr = { type: 'BinaryExpression', operator: op, left: expr, right };
    }
    return expr;
  }

  // additive -> multiplicative ( ( '+' | '-' ) multiplicative )*
  private additive(): ASTNode {
    let expr = this.multiplicative();
    while (this.match('+', '-')) {
      const op = (this.tokens[this.current - 1].value as string);
      const right = this.multiplicative();
      expr = { type: 'BinaryExpression', operator: op, left: expr, right };
    }
    return expr;
  }

  // multiplicative -> unary ( ( '*' | '/' | '%' ) unary )*
  private multiplicative(): ASTNode {
    let expr = this.unary();
    while (this.match('*', '/', '%')) {
      const op = (this.tokens[this.current - 1].value as string);
      const right = this.unary();
      expr = { type: 'BinaryExpression', operator: op, left: expr, right };
    }
    return expr;
  }

  // unary -> ( '!' | '-' ) unary | primary
  private unary(): ASTNode {
    if (this.match('!', '-')) {
      const op = (this.tokens[this.current - 1].value as string);
      const arg = this.unary();
      return { type: 'UnaryExpression', operator: op, argument: arg };
    }
    return this.primary();
  }

  // primary -> NUMBER | STRING | BOOLEAN | IDENTIFIER | '(' expr ')'
  private primary(): ASTNode {
    const token = this.peek();

    if (token.type === 'NUMBER' || token.type === 'STRING' || token.type === 'BOOLEAN') {
      this.current++;
      return { type: 'Literal', value: token.value as number | boolean | string };
    }

    if (token.type === 'IDENTIFIER') {
      this.current++;
      return { type: 'Identifier', name: token.value as string };
    }

    if (token.type === 'PUNCTUATION' && token.value === '(') {
      this.consume('PUNCTUATION', '(');
      const expr = this.logicalOr();
      this.consume('PUNCTUATION', ')');
      return expr;
    }

    throw new Error(`予期しないトークンです: "${token.raw || 'EOF'}" (位置: ${token.pos})`);
  }
}

/**
 * Parses a string expression into an AST
 */
export function parseExpression(input: string): ASTNode {
  const tokens = tokenize(input);
  const parser = new ExpressionParser(tokens);
  return parser.parse();
}

/**
 * Safely evaluates an ASTNode or expression string against runtime variables
 */
export function evaluateAST(
  node: ASTNode,
  variables: Record<string, any> = {}
): any {
  switch (node.type) {
    case 'Literal':
      return node.value;

    case 'Identifier': {
      const val = variables[node.name];
      if (val === undefined) {
        // Return 0 for numbers, false for booleans or empty if undefined
        return 0;
      }
      // If variable holds an object with a .value property (e.g. Zustand Variable structure)
      if (typeof val === 'object' && val !== null && 'value' in val) {
        return val.value;
      }
      return val;
    }

    case 'UnaryExpression': {
      const arg = evaluateAST(node.argument, variables);
      if (node.operator === '!') return !arg;
      if (node.operator === '-') return -Number(arg);
      throw new Error(`未知の単項演算子です: ${node.operator}`);
    }

    case 'BinaryExpression': {
      const left = evaluateAST(node.left, variables);
      const right = evaluateAST(node.right, variables);

      switch (node.operator) {
        case '==':
          // Loose equality friendly to TRPG string/number comparison
          // eslint-disable-next-line eqeqeq
          return left == right;
        case '!=':
          // eslint-disable-next-line eqeqeq
          return left != right;
        case '<':
          return Number(left) < Number(right);
        case '<=':
          return Number(left) <= Number(right);
        case '>':
          return Number(left) > Number(right);
        case '>=':
          return Number(left) >= Number(right);
        case '+':
          if (typeof left === 'string' || typeof right === 'string') {
            return String(left) + String(right);
          }
          return Number(left) + Number(right);
        case '-':
          return Number(left) - Number(right);
        case '*':
          return Number(left) * Number(right);
        case '/':
          return Number(right) === 0 ? 0 : Number(left) / Number(right);
        case '%':
          return Number(right) === 0 ? 0 : Number(left) % Number(right);
        default:
          throw new Error(`未知の2項演算子です: ${node.operator}`);
      }
    }

    case 'LogicalExpression': {
      const left = evaluateAST(node.left, variables);
      if (node.operator === '&&') {
        return Boolean(left) && Boolean(evaluateAST(node.right, variables));
      }
      if (node.operator === '||') {
        return Boolean(left) || Boolean(evaluateAST(node.right, variables));
      }
      throw new Error(`未知の論理演算子です: ${node.operator}`);
    }
  }
}

/**
 * Convenience function to evaluate an expression string directly
 */
export function evaluateExpression(
  expression: string,
  variables: Record<string, any> = {}
): any {
  if (!expression || !expression.trim()) return true;
  try {
    const ast = parseExpression(expression);
    return evaluateAST(ast, variables);
  } catch (err) {
    return false;
  }
}

/**
 * Collects all variable names referenced in an ASTNode
 */
export function collectVariableNames(node: ASTNode): string[] {
  const vars = new Set<string>();

  function walk(n: ASTNode) {
    if (n.type === 'Identifier') {
      vars.add(n.name);
    } else if (n.type === 'UnaryExpression') {
      walk(n.argument);
    } else if (n.type === 'BinaryExpression' || n.type === 'LogicalExpression') {
      walk(n.left);
      walk(n.right);
    }
  }

  walk(node);
  return Array.from(vars);
}

export interface ExpressionValidationResult {
  isValid: boolean;
  error?: string;
  usedVariables: string[];
  variables: string[];
  undefinedVariables: string[];
  ast?: ASTNode;
}

// Backwards compatibility alias
export type ValidationResult = ExpressionValidationResult;

/**
 * Validates an expression for syntax, undefined variables, and basic type sanity
 */
export function validateExpression(
  expression: string,
  definedVariables?: string[] | Set<string> | Record<string, any>
): ExpressionValidationResult {
  if (!expression || !expression.trim()) {
    return {
      isValid: false,
      error: '条件式を入力してください',
      usedVariables: [],
      variables: [],
      undefinedVariables: [],
    };
  }

  try {
    const ast = parseExpression(expression);
    const usedVariables = collectVariableNames(ast);
    const undefinedVariables: string[] = [];

    // If defined variables are provided, check for undefined variables
    if (definedVariables) {
      let isDefined: (name: string) => boolean;
      if (Array.isArray(definedVariables)) {
        const set = new Set(definedVariables);
        isDefined = (name) => set.has(name);
      } else if (definedVariables instanceof Set) {
        isDefined = (name) => definedVariables.has(name);
      } else {
        isDefined = (name) => name in definedVariables;
      }

      for (const varName of usedVariables) {
        if (!isDefined(varName)) {
          undefinedVariables.push(varName);
        }
      }

      if (undefinedVariables.length > 0) {
        return {
          isValid: false,
          error: `変数「${undefinedVariables.join(', ')}」は未定義です。サイドバーの「変数」タブで定義してください。`,
          usedVariables,
          variables: usedVariables,
          undefinedVariables,
          ast,
        };
      }
    }

    return {
      isValid: true,
      usedVariables,
      variables: usedVariables,
      undefinedVariables: [],
      ast,
    };
  } catch (err: any) {
    return {
      isValid: false,
      error: err.message || '構文エラーです',
      usedVariables: [],
      variables: [],
      undefinedVariables: [],
    };
  }
}
