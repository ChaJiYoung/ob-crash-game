import { describe, it, expect } from 'vitest';
import { clampToViewport } from '../src/pc/overlayClamp';

describe('clampToViewport (P03-T04)', () => {
  it('keeps a centered element unchanged', () => {
    expect(clampToViewport(512, 100, 1024)).toBe(462);
  });
  it('pushes an element at the left edge inside by the margin', () => {
    expect(clampToViewport(-24, 60, 1024)).toBe(8);
    expect(clampToViewport(10, 60, 1024, 12)).toBe(12);
  });
  it('pushes an element at the right edge inside by the margin', () => {
    expect(clampToViewport(1048, 60, 1024)).toBe(1024 - 60 - 8);
  });
  it('falls back to the left margin when wider than the viewport', () => {
    expect(clampToViewport(100, 2000, 1024)).toBe(8);
  });
});
