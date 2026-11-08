type PermissionRequester = { requestPermission?: () => Promise<'granted' | 'denied'> };

/**
 * iOS 13+는 DeviceOrientation/Motion 권한을 사용자 터치와 같은 호출 흐름 안에서 요청해야 한다.
 * 다른 브라우저는 요청 함수가 없어 바로 허용으로 본다. 예외(데스크톱 등)도 허용으로 본다.
 */
export async function requestSensorPermission(): Promise<'granted' | 'denied'> {
  try {
    const orientation = (globalThis as { DeviceOrientationEvent?: unknown }).DeviceOrientationEvent as
      | PermissionRequester
      | undefined;
    if (orientation && typeof orientation.requestPermission === 'function') {
      const response = await orientation.requestPermission();
      if (response !== 'granted') return 'denied';
    }
    const motion = (globalThis as { DeviceMotionEvent?: unknown }).DeviceMotionEvent as PermissionRequester | undefined;
    if (motion && typeof motion.requestPermission === 'function') {
      await motion.requestPermission().catch(() => {});
    }
    return 'granted';
  } catch (err) {
    console.warn('Sensor permission error or desktop browser:', err);
    return 'granted';
  }
}
