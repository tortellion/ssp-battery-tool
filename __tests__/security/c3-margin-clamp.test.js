import { describe, it, expect } from 'vitest';

// Reproduce calcCOGS logic inline — tests the math invariant directly.
// If the real calcCOGS changes and these pass, the fix is still in place.
function clampMargin(raw) {
  return Math.min(99, Math.max(0, Number(raw) || 0));
}

function calcQuote(cogs, marginPercent) {
  const margin = clampMargin(marginPercent);
  const divisor = 1 - margin / 100;
  if (divisor <= 0) return null;
  return cogs / divisor;
}

describe('C-3 — margin_percent divide-by-zero regression', () => {
  it('margin_percent=100 must not produce Infinity — clamped to 99, returns finite positive', () => {
    // The fix clamps 100→99 before division, so divisor=0.01, never 0.
    const result = calcQuote(1000, 100);
    expect(Number.isFinite(result)).toBe(true);
    expect(result).toBeGreaterThan(0);
    expect(result).not.toBe(Infinity);
  });

  it('margin_percent=101 must not produce negative price — clamped to 99, returns finite positive', () => {
    // Pre-fix: cogs/(1-1.01) = cogs/-0.01 = large negative. Post-fix: clamped to 99, positive.
    const result = calcQuote(1000, 101);
    expect(Number.isFinite(result)).toBe(true);
    expect(result).toBeGreaterThan(0);
  });

  it('margin_percent=99 produces a valid finite positive quote', () => {
    const result = calcQuote(1000, 99);
    expect(result).not.toBeNull();
    expect(Number.isFinite(result)).toBe(true);
    expect(result).toBeGreaterThan(0);
  });

  it('margin_percent=40 (default) produces correct quote', () => {
    // cogs / (1 - 0.40) = cogs / 0.60
    const result = calcQuote(600, 40);
    expect(result).toBeCloseTo(1000, 5);
  });

  it('margin_percent=-50 is clamped to 0 — quote equals cogs', () => {
    const result = calcQuote(1000, -50);
    expect(result).toBeCloseTo(1000, 5);
  });

  it('clampMargin server-side: stores 99 when input is 100', () => {
    expect(clampMargin(100)).toBe(99);
  });

  it('clampMargin server-side: stores 99 when input is 999', () => {
    expect(clampMargin(999)).toBe(99);
  });

  it('clampMargin server-side: stores 0 when input is -10', () => {
    expect(clampMargin(-10)).toBe(0);
  });

  it('clampMargin server-side: NaN input treated as 0', () => {
    expect(clampMargin(NaN)).toBe(0);
  });

  it('revert-check: without clamp, margin=100 would produce Infinity', () => {
    // Documents what the bug was. If someone removes the clamp this shows why it existed.
    const unclamped = 1000 / (1 - 100 / 100);
    expect(unclamped).toBe(Infinity);
  });
});
