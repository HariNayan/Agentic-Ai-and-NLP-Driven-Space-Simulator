export interface PlanetConfig {
  name: string;
  textureKey: string;
  fallbackColor: number;
  emissive: number;
  size: number;
  orbitRadius: number;
  speed: number;
  eccentricity: number;
  perihelionLon: number;
  axialTilt: number;
  nasaId: string;
  shininess?: number;
  atmosphere?: number;
  hasSaturnRings?: boolean;
  cloudsKey?: string;
  banded?: boolean;
}

export const PLANET_DATA: PlanetConfig[] = [
  { name: 'Mercury', textureKey: 'mercury', fallbackColor: 0xa09088, emissive: 0x100a00, size: 0.35, orbitRadius: 5.0,  speed: 0.0172, eccentricity: 0.2056, perihelionLon: 0.508,  axialTilt: 0.001,  nasaId: '199', shininess: 15 },
  { name: 'Venus',   textureKey: 'venus',   fallbackColor: 0xe8d070, emissive: 0x604000, size: 0.75, orbitRadius: 7.8,  speed: 0.0125, eccentricity: 0.0068, perihelionLon: 0.958,  axialTilt: 3.096,  nasaId: '299', shininess: 50, atmosphere: 0xffa040 },
  { name: 'Earth',   textureKey: 'earth',   fallbackColor: 0x3a8fd0, emissive: 0x001840, size: 0.85, orbitRadius: 11.0, speed: 0.0100, eccentricity: 0.0167, perihelionLon: 1.993,  axialTilt: 0.409,  nasaId: '399', shininess: 80, atmosphere: 0x4488ff, cloudsKey: 'earth_clouds' },
  { name: 'Mars',    textureKey: 'mars',    fallbackColor: 0xc84020, emissive: 0x500800, size: 0.55, orbitRadius: 15.0, speed: 0.0081, eccentricity: 0.0934, perihelionLon: 5.000,  axialTilt: 0.440,  nasaId: '499', shininess: 20, atmosphere: 0xff4400 },
  { name: 'Jupiter', textureKey: 'jupiter', fallbackColor: 0xc89050, emissive: 0x301800, size: 2.20, orbitRadius: 21.0, speed: 0.0044, eccentricity: 0.0484, perihelionLon: 4.780,  axialTilt: 0.055,  nasaId: '599', shininess: 30 },
  { name: 'Saturn',  textureKey: 'saturn',  fallbackColor: 0xe0d080, emissive: 0x302000, size: 1.90, orbitRadius: 27.0, speed: 0.0034, eccentricity: 0.0542, perihelionLon: 5.924,  axialTilt: 0.467,  nasaId: '699', shininess: 40, hasSaturnRings: true },
  { name: 'Uranus',  textureKey: 'uranus',  fallbackColor: 0x70dce0, emissive: 0x003030, size: 1.40, orbitRadius: 32.5, speed: 0.0020, eccentricity: 0.0472, perihelionLon: 1.710,  axialTilt: 1.706,  nasaId: '799', shininess: 60, atmosphere: 0x00eeff },
  { name: 'Neptune', textureKey: 'neptune', fallbackColor: 0x4060e8, emissive: 0x001040, size: 1.30, orbitRadius: 37.0, speed: 0.0010, eccentricity: 0.0086, perihelionLon: 4.768,  axialTilt: 0.494,  nasaId: '899', shininess: 70, atmosphere: 0x2255ff },
];

export interface MoonConfig {
  name: string;
  parent: string;
  size: number;
  orbitRadius: number;
  speed: number;
  color: number;
}

export const MOON_DATA: MoonConfig[] = [
  { name: 'Moon',     parent: 'Earth',   size: 0.18, orbitRadius: 1.6, speed: 0.055, color: 0xcccccc },
  { name: 'Phobos',   parent: 'Mars',    size: 0.06, orbitRadius: 0.8, speed: 0.12,  color: 0xaa8866 },
  { name: 'Deimos',   parent: 'Mars',    size: 0.04, orbitRadius: 1.3, speed: 0.05,  color: 0x887766 },
  { name: 'Io',       parent: 'Jupiter', size: 0.18, orbitRadius: 2.8, speed: 0.10,  color: 0xddcc55 },
  { name: 'Europa',   parent: 'Jupiter', size: 0.15, orbitRadius: 3.4, speed: 0.07,  color: 0xccddcc },
  { name: 'Ganymede', parent: 'Jupiter', size: 0.22, orbitRadius: 4.2, speed: 0.04,  color: 0xbbbbaa },
  { name: 'Callisto', parent: 'Jupiter', size: 0.20, orbitRadius: 5.5, speed: 0.02,  color: 0x888877 },
  { name: 'Titan',    parent: 'Saturn',  size: 0.20, orbitRadius: 3.2, speed: 0.035, color: 0xddbb66 },
  { name: 'Enceladus',parent: 'Saturn',  size: 0.08, orbitRadius: 2.2, speed: 0.08,  color: 0xeeeeff },
  { name: 'Mimas',    parent: 'Saturn',  size: 0.07, orbitRadius: 2.6, speed: 0.12,  color: 0x999988 },
  { name: 'Titania',  parent: 'Uranus',  size: 0.14, orbitRadius: 2.2, speed: 0.04,  color: 0xbbccdd },
  { name: 'Oberon',   parent: 'Uranus',  size: 0.13, orbitRadius: 3.0, speed: 0.03,  color: 0xaabbcc },
  { name: 'Umbriel',  parent: 'Uranus',  size: 0.10, orbitRadius: 3.8, speed: 0.025, color: 0x888899 },
  { name: 'Ariel',    parent: 'Uranus',  size: 0.10, orbitRadius: 1.8, speed: 0.05,  color: 0xccddee },
  { name: 'Miranda',  parent: 'Uranus',  size: 0.07, orbitRadius: 1.6, speed: 0.08,  color: 0x9999aa },
  { name: 'Triton',   parent: 'Neptune', size: 0.16, orbitRadius: 2.6, speed: 0.025, color: 0xccbbaa },
];

export const ORBITAL_ELEMENTS: Record<string, { l0: number; dailyMotion: number }> = {
  Mercury: { l0: 252.25, dailyMotion: 4.092 },
  Venus:   { l0: 181.98, dailyMotion: 1.602 },
  Earth:   { l0: 100.46, dailyMotion: 0.986 },
  Mars:    { l0: 355.45, dailyMotion: 0.524 },
  Jupiter: { l0: 34.35,  dailyMotion: 0.083 },
  Saturn:  { l0: 50.08,  dailyMotion: 0.033 },
  Uranus:  { l0: 314.06, dailyMotion: 0.012 },
  Neptune: { l0: 304.35, dailyMotion: 0.006 },
};

export function getCurrentAngle(name: string): number {
  const el = ORBITAL_ELEMENTS[name];
  if (!el) return Math.random() * Math.PI * 2;
  const j2000 = Date.UTC(2000, 0, 1, 12, 0, 0);
  const daysSinceJ2000 = (Date.now() - j2000) / 86400000;
  const angle = ((el.l0 + el.dailyMotion * daysSinceJ2000) % 360 + 360) % 360;
  return (angle * Math.PI) / 180;
}

export function solveKepler(M: number, e: number, tol = 1e-8): number {
  let E = M;
  for (let i = 0; i < 64; i++) {
    const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < tol) break;
  }
  return E;
}

export function ellipticalPosition(meanAnomaly: number, a: number, e: number, perihelionLon: number): { x: number; z: number } {
  const E = solveKepler(meanAnomaly, e);
  const cosE = Math.cos(E);
  const sinE = Math.sin(E);
  const cosNu = (cosE - e) / (1 - e * cosE);
  const sinNu = (Math.sqrt(1 - e * e) * sinE) / (1 - e * cosE);
  const nu = Math.atan2(sinNu, cosNu);
  const r = a * (1 - e * e) / (1 + e * cosNu);
  const theta = nu + perihelionLon;
  return { x: r * Math.cos(theta), z: r * Math.sin(theta) };
}
