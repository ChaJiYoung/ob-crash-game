export type InputSignal =
  | { type: 'aim'; aimX: number; aimY: number }
  | { type: 'fireDown' }
  | { type: 'fireUp' }
  | { type: 'skill' }
  | { type: 'fever' };

/** 어댑터가 신호를 보내는 곳(처리부). */
export interface InputSink {
  send(signal: InputSignal): void;
}
