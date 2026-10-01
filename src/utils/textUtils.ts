import type { Variable } from '../types';
import React from 'react';
import { safeEvaluateMath } from './mathEvaluator';

// Forbidden keys for prototype pollution defense
const FORBIDDEN_PROPERTIES = new Set(['__proto__', 'constructor', 'prototype', 'tostring', 'valueof']);

// LRU cache for substituteVariables results. Each entry is keyed by the
// input text plus the *referenced* variables' current values, so the same
// (text, vars) pair short-circuits the regex pipeline. Variables that are
// not referenced in the text don't affect the key, so unrelated variable
// changes don't invalidate the cache.
const SUBST_CACHE = new Map<string, string>();
const SUBST_CACHE_LIMIT = 500;

const buildCacheKey = (text: string, variables: Record<string, Variable>): string | null => {
    const refs = new Set<string>();
    const lowerKeyMap = new Map<string, string>();
    for (const k of Object.keys(variables)) {
        if (!FORBIDDEN_PROPERTIES.has(k.toLowerCase())) {
            lowerKeyMap.set(k.toLowerCase(), k);
        }
    }
    if (lowerKeyMap.size === 0) return null;

    // Match all ${...} blocks (nested or flat)
    const re = /\$\{([^{}]+)\}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
        const inner = m[1].toLowerCase().trim();
        // Check direct key
        if (lowerKeyMap.has(inner)) {
            refs.add(inner);
        } else {
            // Also extract potential variable names embedded in expressions
            for (const key of lowerKeyMap.keys()) {
                if (inner.includes(key)) {
                    refs.add(key);
                }
            }
        }
    }
    if (refs.size === 0) return null;

    const parts: string[] = [];
    for (const r of refs) {
        const realKey = lowerKeyMap.get(r);
        const v = realKey && variables[realKey] ? variables[realKey].value : '';
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

  const lowerKeyMap = new Map<string, string>();
  for (const k of Object.keys(variables)) {
    if (!FORBIDDEN_PROPERTIES.has(k.toLowerCase())) {
      lowerKeyMap.set(k.toLowerCase(), k);
    }
  }

  let result = text;
  let depth = 0;
  const maxDepth = 10; // Prevent infinite loops
  const maxLength = 100000; // Prevent memory exhaustion DoS

  // Recursively substitute
  while (result.includes('${') && depth < maxDepth) {
      const prevResult = result;
      // Match innermost variable/expression: ${...} with no { or } inside
      result = result.replace(/\$\{([^{}]+)\}/g, (match, rawInner) => {
        const trimmed = rawInner.trim();

        // 1. Direct variable lookup (case-insensitive)
        const realKey = lowerKeyMap.get(trimmed.toLowerCase());
        if (realKey && variables[realKey] !== undefined) {
          return String(variables[realKey].value);
        }

        // 2. Safe math expression evaluation (e.g. "100+200", "charaa.money + charab.money")
        // requireOperator: true ensures single words/identifiers that are not known variables are preserved as-is
        const mathVal = safeEvaluateMath(trimmed, variables, { requireOperator: true });
        if (mathVal !== null) {
          return String(mathVal);
        }

        return match; // Return original if neither variable nor valid math expression
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
  const trimmed = formula.trim();
  if (!trimmed) return formula;

  // Check length to prevent DoS
  if (trimmed.length > 10000) {
      return trimmed;
  }

  // 1. Direct safe math evaluation without new Function() or eval()
  const directMath = safeEvaluateMath(trimmed, variables, { requireOperator: false });
  if (directMath !== null) {
      return directMath;
  }

  // 2. Substitute variables for templates or nested expressions
  const substituted = substituteVariables(trimmed, variables);

  // 3. Attempt safe math on the substituted result
  const substitutedMath = safeEvaluateMath(substituted, variables, { requireOperator: false });
  if (substitutedMath !== null) {
      return substitutedMath;
  }

  return substituted;
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
