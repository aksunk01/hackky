import type { CompareMode } from "@/lib/types";

/**
 * A stable string key for any JSON value, used to compare arrays as multisets.
 * Object keys are sorted so that key order never affects equality.
 */
function key(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) return `[${value.map(key).join(",")}]`;
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${key(v)}`);
    return `{${entries.join(",")}}`;
  }
  if (typeof value === "number") {
    // -0 and 0 must compare equal; integral floats print without a decimal.
    return Object.is(value, -0) ? "0" : String(value);
  }
  return JSON.stringify(value);
}

function deepEqual(a: unknown, b: unknown): boolean {
  return key(a) === key(b);
}

/** Compares two arrays ignoring order, using element keys as a multiset. */
function multisetEqual(a: unknown[], b: unknown[]): boolean {
  if (a.length !== b.length) return false;
  const counts = new Map<string, number>();
  for (const item of a) {
    const k = key(item);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  for (const item of b) {
    const k = key(item);
    const n = counts.get(k);
    if (!n) return false;
    if (n === 1) counts.delete(k);
    else counts.set(k, n - 1);
  }
  return counts.size === 0;
}

/** Sorts the inner arrays so two groupings match regardless of internal order. */
function normaliseInner(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  return value.map((row) =>
    Array.isArray(row) ? [...row].sort((x, y) => (key(x) < key(y) ? -1 : 1)) : row,
  );
}

export function compareResult(
  actual: unknown,
  expected: unknown,
  mode: CompareMode,
): boolean {
  switch (mode) {
    case "exact":
      return deepEqual(actual, expected);

    case "sortedArray":
      if (!Array.isArray(actual) || !Array.isArray(expected)) return false;
      return multisetEqual(actual, expected);

    case "setOfSets": {
      if (!Array.isArray(actual) || !Array.isArray(expected)) return false;
      if (actual.some((row) => !Array.isArray(row))) return false;
      return multisetEqual(
        normaliseInner(actual) as unknown[],
        normaliseInner(expected) as unknown[],
      );
    }

    case "outerUnordered": {
      if (!Array.isArray(actual) || !Array.isArray(expected)) return false;
      return multisetEqual(actual, expected);
    }
  }
}

/** Compact, readable rendering of a value for the results table. */
export function formatValue(value: unknown, maxLen = 220): string {
  let text: string;
  try {
    text = JSON.stringify(value ?? null);
  } catch {
    text = String(value);
  }
  if (text === undefined) text = "undefined";
  return text.length > maxLen ? `${text.slice(0, maxLen)}… (${text.length} chars)` : text;
}

/** Renders a call's arguments the way the candidate would read them. */
export function formatArgs(names: string[], args: unknown[], maxLen = 220): string {
  return names
    .map((name, i) => `${name} = ${formatValue(args[i], Math.floor(maxLen / names.length))}`)
    .join(", ");
}
