import { describe, it, expect } from 'vitest';
import { startGrace, tickGrace } from '../src/pc/coopDisconnect';
import { BeerCrusherEngine } from '../src/pc/engine/BeerCrusherEngine';

describe('Coop Disconnect Grace (P04-T06)', () => {
  describe('startGrace and tickGrace pure logic', () => {
    it('calculates remaining seconds and expiration accurately', () => {
      const g = startGrace(2, 1, 1000, 30000);
      expect(g.slot).toBe(2);
      expect(g.playerIndex).toBe(1);
      expect(g.deadlineMs).toBe(31000);

      // At start (nowMs = 1000)
      const t1 = tickGrace(g, 1000);
      expect(t1.remainingSec).toBe(30);
      expect(t1.expired).toBe(false);

      // Just before expiration (nowMs = 30999)
      const t2 = tickGrace(g, 30999);
      expect(t2.remainingSec).toBe(1);
      expect(t2.expired).toBe(false);

      // At exact deadline (nowMs = 31000)
      const t3 = tickGrace(g, 31000);
      expect(t3.remainingSec).toBe(0);
      expect(t3.expired).toBe(true);

      // Past deadline (nowMs = 35000)
      const t4 = tickGrace(g, 35000);
      expect(t4.remainingSec).toBe(0);
      expect(t4.expired).toBe(true);
    });
  });

  describe('Engine disconnect grace and player away integration', () => {
    it('sets disconnectGraceMs to null for solo and 30000 for coop', () => {
      const engine = new BeerCrusherEngine();
      engine.startGame({ playerCount: 1 });
      expect(engine.rules.disconnectGraceMs).toBeNull();

      engine.startGame({ playerCount: 2 });
      expect(engine.rules.disconnectGraceMs).toBe(30000);
    });

    it('manages away player lifecycle and active players in a coop run', () => {
      const engine = new BeerCrusherEngine();
      engine.startGame({ playerCount: 2 });

      expect(engine.getActivePlayers()).toHaveLength(2);
      expect(engine.getPlayer(1).isAway).toBe(false);

      // Mark player 1 as away
      engine.setPlayerAway(1, true, 5000);
      expect(engine.getPlayer(1).isAway).toBe(true);
      expect(engine.getActivePlayers()).toHaveLength(1);
      expect(engine.getActivePlayers()[0].index).toBe(0);

      // Reconnect player 1
      engine.setPlayerAway(1, false, 15000);
      expect(engine.getPlayer(1).isAway).toBe(false);
      expect(engine.getActivePlayers()).toHaveLength(2);
    });
  });
});
