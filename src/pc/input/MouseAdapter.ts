import type { InputSink } from './inputSignals';
import { WEAPON_CONSTANTS } from '../../shared/constants';
import { detectDoubleClick } from '../mouseFever';

export class MouseAdapter {
  private lastClickMs = 0;

  constructor(
    private readonly sink: () => InputSink | null,
    private readonly windowMs = WEAPON_CONSTANTS.FEVER_DOUBLE_TAP_MS,
    private readonly now: () => number = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())
  ) {}

  public onMove(aimX: number, aimY: number): void {
    const s = this.sink();
    if (!s) return;
    s.send({ type: 'aim', aimX, aimY });
  }

  /**
   * 캔버스 위 왼쪽 누름 → fireDown(+ detectDoubleClick이면 fever).
   * 버튼·모달 클릭은 캔버스에 오지 않아 여기 도달하지 않는다(D26).
   */
  public onLeftDown(): void {
    const s = this.sink();
    if (!s) return;

    const currentTime = this.now();
    const dbl = detectDoubleClick(this.lastClickMs, currentTime, this.windowMs);
    this.lastClickMs = dbl.nextLastClickMs;

    if (dbl.triggered) {
      s.send({ type: 'fever' });
    }
    s.send({ type: 'fireDown' });
  }

  public onLeftUp(): void {
    const s = this.sink();
    if (!s) return;
    s.send({ type: 'fireUp' });
  }

  public onRightClick(): void {
    const s = this.sink();
    if (!s) return;
    s.send({ type: 'skill' });
  }
}
