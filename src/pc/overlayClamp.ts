/** 가운데 정렬 요소의 왼쪽 x를 [margin, viewportWidth - width - margin]로 제한한다. */
export function clampToViewport(
  centerX: number,
  width: number,
  viewportWidth: number,
  margin = 8
): number {
  const left = centerX - width / 2;
  const max = viewportWidth - width - margin;
  if (max < margin) return margin; // 요소가 화면보다 넓으면 왼쪽 여백에 붙인다
  return Math.min(max, Math.max(margin, left));
}
