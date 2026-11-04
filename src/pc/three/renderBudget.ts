export const MAX_RENDER_PIXELS = 3_000_000;

/**
 * 렌더 버퍼 비율을 devicePixelRatio가 아니라 총 픽셀 수로 제한한다.
 * 울트라와이드(3440x1440)는 DPR 1이라 DPR 상한만으로는 비용이 줄지 않는다.
 */
export function computeRenderPixelRatio(
  cssWidth: number,
  cssHeight: number,
  devicePixelRatio: number,
  maxPixels: number = MAX_RENDER_PIXELS
): number {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  if (cssWidth <= 0 || cssHeight <= 0) return dpr;
  return Math.min(dpr, Math.sqrt(maxPixels / (cssWidth * cssHeight)));
}
