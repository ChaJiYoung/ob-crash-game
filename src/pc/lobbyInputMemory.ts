import type { SlotInput } from './coopSlots';

/** 1P가 마지막에 고른 입력 방식을 기억하는 저장소 키. */
export const LOBBY_INPUT_STORAGE_KEY = 'beer_crusher_lobby_input_1p';

function resolveStorage<T extends Partial<Storage>>(storage?: T): T | undefined {
  if (storage) return storage;
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage as unknown as T;
  } catch {
    // 저장소 접근이 막힌 환경(사생활 보호 모드 등)
  }
  return undefined;
}

/** 1P가 마지막에 고른 입력. 없거나 이상하면 'mobile'. 저장소 접근이 막혀도 예외를 던지지 않는다. */
export function loadLastInput(storage?: Pick<Storage, 'getItem'>): SlotInput {
  const target = resolveStorage(storage);
  if (!target) return 'mobile';
  try {
    const value = target.getItem?.(LOBBY_INPUT_STORAGE_KEY);
    return value === 'mouse' || value === 'mobile' ? value : 'mobile';
  } catch {
    return 'mobile';
  }
}

/** 저장 실패(사생활 보호 모드 등)는 무시한다. */
export function saveLastInput(input: SlotInput, storage?: Pick<Storage, 'setItem'>): void {
  const target = resolveStorage(storage);
  if (!target) return;
  try {
    target.setItem?.(LOBBY_INPUT_STORAGE_KEY, input);
  } catch {
    // 무시
  }
}
