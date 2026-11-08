/** 서버·폰 컨트롤러가 함께 쓰는 연결 수명주기 시간 상수(ms). */
export const CONTROLLER_LIFECYCLE = {
  /** 센서 프레임이 이 시간 넘게 없으면 컨트롤러가 사라진 것으로 본다. */
  FRAME_TIMEOUT_MS: 3000,
  /** 서버가 프레임 끊김을 확인하는 주기. */
  WATCH_INTERVAL_MS: 1000,
  /** 폰이 화면이 꺼졌다고 알린 뒤, 서버가 PC에 알리기 전에 기다리는 시간. 이보다 짧은 꺼짐은 무시한다. */
  BACKGROUND_NOTIFY_DELAY_MS: 1000,
} as const;
