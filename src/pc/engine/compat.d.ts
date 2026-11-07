import type { BeerCrusherEngine } from './BeerCrusherEngine';

declare module './BeerCrusherEngine' {
  interface BeerCrusherEngine {
    isCardSelectPending: boolean;
  }
}
