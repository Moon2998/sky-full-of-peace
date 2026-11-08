import { describe, expect, it } from 'vitest';
import { ParticleKind, ParticlePool, type ParticleInit } from './particles';

const spark = (x: number): ParticleInit => ({
  x,
  y: 0,
  vx: 0,
  vy: 0,
  life: 1,
  size: 1,
  color: 0,
  kind: ParticleKind.Spark,
  drag: 0,
  gravity: 0,
  alpha: 1,
  twinkle: 0,
});

describe('ParticlePool', () => {
  it('never holds more than its capacity and counts refused spawns', () => {
    const pool = new ParticlePool(3);
    expect(pool.spawn(spark(1))).toBe(0);
    expect(pool.spawn(spark(2))).toBe(1);
    expect(pool.spawn(spark(3))).toBe(2);
    expect(pool.isFull).toBe(true);
    expect(pool.spawn(spark(4))).toBe(-1);
    expect(pool.count).toBe(3);
    expect(pool.dropped).toBe(1);
  });

  it('removes by moving the last particle into the gap', () => {
    const pool = new ParticlePool(4);
    pool.spawn(spark(10));
    pool.spawn(spark(20));
    pool.spawn(spark(30));
    pool.remove(0);
    expect(pool.count).toBe(2);
    expect([pool.x[0], pool.x[1]]).toEqual([30, 20]);
    pool.remove(1);
    expect(pool.count).toBe(1);
    expect(pool.x[0]).toBe(30);
  });

  it('reuses its fixed memory after clearing', () => {
    const pool = new ParticlePool(2);
    const buffer = pool.x;
    pool.spawn(spark(1));
    pool.clear();
    expect(pool.count).toBe(0);
    pool.spawn(spark(5));
    expect(pool.x).toBe(buffer);
    expect(pool.x[0]).toBe(5);
  });

  it('rejects invalid capacities', () => {
    expect(() => new ParticlePool(0)).toThrow();
    expect(() => new ParticlePool(2.5)).toThrow();
  });
});
