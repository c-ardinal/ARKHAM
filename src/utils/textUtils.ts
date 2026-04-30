import type { Variable } from '../types';
import React from 'react';

// LRU cache for substituteVariables results. Each entry is keyed by the
// input text plus the *referenced* variables' current values, so the same
// (text, vars) pair short-circuits the regex pipeline. Variables that are
// not referenced in the text don't affect the key, so unrelated variable
// changes don't invalidate the cache.
const SUBST_CACHE = new Map<string, string>();
const SUBST_CACHE_LIMIT = 500;

const buildCacheKey = (text: string, variables: Record<string, Variable>): string | null => {
    const refs = new Set<string>();
    const re = /\$\{([^{}]+)\}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
        refs.add(m[1].toLowerCase());
    }
    if (refs.size === 0) return null;
    // Build a lowered-name -> real-name lookup once per call so we don't
    // walk Object.keys(variables) inside the loop.
    const lowerKeyMap = new Map<string, string>();
    for (const k of Object.keys(variables)) lowerKeyMap.set(k.toLowerCase(), k);
    const parts: string[] = [];
    for (const r of refs) {
        const realKey = lowerKeyMap.get(r);
        const v = realKey ? variables[realKey].value : '';
        parts.push(`${r}=${String(v)}`);
    }
    parts.sort();
    return `${text}\x00${parts.join('|')}`;
};

const cacheGet = (key: string): string | undefined => {
    const v = SUBST_CACHE.get(key);
    if (v !== undefined) {
        // Refresh recency by re-inserting (Map preserves insertion order).
        SUBST_CACHE.delete(key);
        SUBST_CACHE.set(key, v);
    }
    return v;
};

const cacheSet = (key: string, value: string) => {
    if (SUBST_CACHE.size >= SUBST_CACHE_LIMIT) {
        const first = SUBST_CACHE.keys().next().value;
        if (first !== undefined) SUBST_CACHE.delete(first);
    }
    SUBST_CACHE.set(key, value);
};

export const substituteVariables = (text: string, variables: Record<string, Variable>): string => {
  if (!text) return '';
  // Fast-path: nothing to substitute.
  if (!text.includes('${')) return text;

  const cacheKey = buildCacheKey(text, variables);
  if (cacheKey !== null) {
      const hit = cacheGet(cacheKey);
      if (hit !== undefined) return hit;
  }

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

  if (cacheKey !== null) cacheSet(cacheKey, result);
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

/**
 * Converts newlines in text to <br> tags.
 */
export const nl2br = (text: string): React.ReactNode => {
    if (!text) return '';
    return text.split('\n').map((str, index, array) => {
        return React.createElement(React.Fragment, { key: index }, 
            str,
            index < array.length - 1 ? React.createElement('br') : null
        );
    });
};
