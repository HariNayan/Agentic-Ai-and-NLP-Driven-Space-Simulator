import { describe, it, expect } from 'vitest';
import {
  solveKepler, ellipticalPosition, getCurrentAngle,
  PLANET_DATA, MOON_DATA, ORBITAL_ELEMENTS,
} from './orbitalMath';

describe('solveKepler', () => {
  it('returns M for circular orbit (e=0)', () => {
    const E = solveKepler(1.0, 0);
    expect(E).toBeCloseTo(1.0, 10);
  });

  it('converges for moderate eccentricity', () => {
    const E = solveKepler(0.5, 0.2);
    expect(E).toBeGreaterThan(0);
    expect(E).toBeLessThan(Math.PI);
  });

  it('converges for high eccentricity (e=0.9)', () => {
    const E = solveKepler(1.0, 0.9);
    expect(isNaN(E)).toBe(false);
    expect(E).toBeGreaterThan(0);
  });

  it('handles M=0 and any e', () => {
    const E = solveKepler(0, 0.5);
    expect(E).toBeCloseTo(0, 8);
  });

  it('matches first-order approx M + e*sin(M) for small e', () => {
    const M = 2.0, e = 0.0167;
    const E = solveKepler(M, e);
    expect(E).toBeCloseTo(M + e * Math.sin(M), 3);
  });

  it('converges within 64 iterations', () => {
    const E = solveKepler(3.0, 0.8);
    expect(isNaN(E)).toBe(false);
    expect(E).toBeGreaterThan(0);
  });
});

describe('ellipticalPosition', () => {
  it('returns circular position for e=0', () => {
    const pos = ellipticalPosition(0, 1, 0, 0);
    expect(pos.x).toBeCloseTo(1, 5);
    expect(pos.z).toBeCloseTo(0, 5);
  });

  it('returns (-a, 0) at M=π', () => {
    const pos = ellipticalPosition(Math.PI, 2, 0.1, 0);
    expect(pos.x).toBeLessThan(0);
    expect(Math.abs(pos.z)).toBeLessThan(0.1);
  });

  it('planets orbit the sun (position within reasonable bounds)', () => {
    for (const p of PLANET_DATA) {
      const pos = ellipticalPosition(0, p.orbitRadius, p.eccentricity, p.perihelionLon);
      expect(Math.abs(pos.x)).toBeLessThan(p.orbitRadius * 1.5);
      expect(Math.abs(pos.z)).toBeLessThan(p.orbitRadius * 1.5);
    }
  });

  it('perihelion offset rotates the orbit', () => {
    const pos0 = ellipticalPosition(0, 1, 0.1, 0);
    const pos90 = ellipticalPosition(0, 1, 0.1, Math.PI / 2);
    expect(pos0.x).not.toBeCloseTo(pos90.x, 2);
  });
});

describe('getCurrentAngle', () => {
  it('returns a value in [0, 2π) for known planets', () => {
    for (const name of Object.keys(ORBITAL_ELEMENTS)) {
      const angle = getCurrentAngle(name);
      expect(angle).toBeGreaterThanOrEqual(0);
      expect(angle).toBeLessThan(2 * Math.PI);
    }
  });

  it('returns a random angle for unknown bodies', () => {
    const angle = getCurrentAngle('Pluto');
    expect(angle).toBeGreaterThanOrEqual(0);
    expect(angle).toBeLessThan(2 * Math.PI);
  });

  it('is deterministic within same millisecond', () => {
    const a1 = getCurrentAngle('Earth');
    const a2 = getCurrentAngle('Earth');
    expect(a1).toEqual(a2);
  });
});

describe('PLANET_DATA integrity', () => {
  it('has 8 planets', () => {
    expect(PLANET_DATA).toHaveLength(8);
  });

  it('all planets have unique names', () => {
    const names = PLANET_DATA.map(p => p.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('moon orbit radii exceed parent planet size', () => {
    const planetSizes = new Map(PLANET_DATA.map(p => [p.name, p.size]));
    for (const moon of MOON_DATA) {
      const parentSize = planetSizes.get(moon.parent);
      if (parentSize !== undefined) {
        expect(moon.orbitRadius).toBeGreaterThan(parentSize);
      }
    }
  });

  it('all ORBITAL_ELEMENTS reference valid planets', () => {
    const names = new Set(PLANET_DATA.map(p => p.name));
    for (const key of Object.keys(ORBITAL_ELEMENTS)) {
      expect(names.has(key)).toBe(true);
    }
  });
});
