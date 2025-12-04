import type { Variable } from '../types';

export const substituteVariables = (text: string, variables: Record<string, Variable>): string => {
  if (!text) return '';
  
  let result = text;
  let depth = 0;
  const maxDepth = 10; // Prevent infinite loops
  const maxLength = 100000; // Prevent memory exhaustion DoS

  // Recursively substitute
  while (result.includes('${') && depth < maxDepth) {
      const prevResult = result;
      // Match innermost variable: ${var} with no { or } inside
      result = result.replace(/\$\{([^{}]+)\}/g, (match, varName) => {
        // Case insensitive lookup
        const variableKey = Object.keys(variables).find(k => k.toLowerCase() === varName.toLowerCase());
        if (variableKey) {
          return String(variables[variableKey].value);
        }
        return match; // Return original if variable not found
      });
      
      if (result.length > maxLength) {
          return '#ERROR: Text too long#';
      }

      if (prevResult === result) break; // No more changes
      depth++;
  }
  
  return result;
};

export const evaluateFormula = (formula: string, variables: Record<string, Variable>): number | string => {
  if (typeof formula !== 'string') return formula;
  
  // 1. Substitute variables
  const substituted = substituteVariables(formula, variables);
  
  // Check length again (though substituteVariables handles it, the formula itself might be long)
  if (substituted.length > 10000) {
      return substituted; // Too long to evaluate safely
  }
  
  // 2. Check if it looks like a math expression (digits, operators, parens, spaces, decimals)
  // We allow: 0-9, ., +, -, *, /, (, ), and whitespace
  if (!/^[\d\.\+\-\*\/\(\)\s]+$/.test(substituted)) {
      return substituted; // Not a clean formula, return as string
  }

  try {
      // 3. Evaluate safely-ish
      // eslint-disable-next-line no-new-func
      const result = new Function(`return ${substituted}`)();
      return typeof result === 'number' && !isNaN(result) ? result : substituted;
  } catch (e) {
      return substituted;
  }
};
