import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { WebGLErrorOverlay } from '../src/pc/components/WebGLErrorOverlay';

describe('WebGLErrorOverlay (webgl-context-loss D03)', () => {
  it('explains a blocked WebGL with fixes and a reload button', () => {
    const html = renderToStaticMarkup(<WebGLErrorOverlay reason="blocked" />);
    expect(html).toContain('그래픽(WebGL)을 켤 수 없습니다');
    expect(html).toContain('차단했습니다');
    expect(html).toContain('chrome://gpu');
    expect(html).toContain('data-testid="webgl-error-reload"');
    expect(html).toContain('role="alert"');
  });

  it('uses the lost copy after a failed restore', () => {
    const html = renderToStaticMarkup(<WebGLErrorOverlay reason="lost" />);
    expect(html).toContain('그래픽이 중단됐습니다');
    expect(html).not.toContain('켤 수 없습니다');
  });
});
