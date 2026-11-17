// Every tuning number, layout measurement and colour in one place. The city grid is a 5 by 5 set
// of 46 m blocks with 14 m roads and 3 m sidewalks; all distances are metres and the sea lies south.
// Tuning numbers gather here so the whole world can be retimed in one sweep.

export const STEP = 1 / 60;
export const MAX_FRAME = 0.25;

export const GRID = {
  n: 5,
  block: 46,
  road: 14,
  sidewalk: 3,
  pitch: 60,
  centers: [-120, -60, 0, 60, 120],
  roads: [-150, -90, -30, 30, 90, 150],
  edge: 157,
};

export const WORLD = {
  xMin: -156,
  xMax: 156,
  zMin: -156,
  zMax: 240,
  beachStart: 157,
  beachEnd: 200,
  seaStart: 200,
  marinaX: 100,
  marinaZ: 222,
  hospital: { x: -92, z: -92, yaw: 0.2 },
  spawn: { x: 5, z: 21.2, yaw: Math.PI },
};

export const PLAYER = {
  walk: 4,
  sprint: 7,
  jump: 5.1,
  gravity: 18,
  radius: 0.44,
  eye: 1.65,
  arm: 4.5,
  shoulder: 1.7,
  fov: 60,
  lag: 0.12,
  pitchMin: -0.44,
  pitchMax: 1.05,
  maxHealth: 100,
  maxArmour: 60,
};

export const CAR = {
  maxSpeed: 32,
  reverse: 10,
  engine: 13,
  brake: 18,
  drag: 0.55,
  grip: 7.5,
  handbrakeGrip: 1.1,
  steer: 1.55,
  radius: 1.1,
  arm: 7,
  fov: 68,
  lookAhead: 8,
};

export const PLAYER_CAR = {
  maxSpeed: 32,
  reverse: 10,
  engine: 15,
  brake: 20,
  drag: 0.6,
  grip: 8,
  handbrakeGrip: 1.2,
  steer: 1.65,
  radius: 1.15,
};

export const WANTED = {
  max: 5,
  decayAfter: 30,
  decayStep: 5,
  sightRange: 70,
  starCooldown: 4,
};

export const MISSION = {
  title: 'COURIER RUN',
  reward: 5000,
  stopReward: 750,
  time: 240,
  stopTime: 90,
  radius: 5,
  interact: 6,
};

export const TRAFFIC = { cars: 12, peds: 16 };

export const RENDER = {
  fov: 60,
  near: 0.1,
  far: 1500,
  fog: 0.0019,
  fogColor: 0xe8b08e,
  sunColor: 0xffc98e,
  sunIntensity: 2.05,
  hemiSky: 0x9ccfe0,
  hemiGround: 0x6b5040,
  hemiIntensity: 0.56,
  exposure: 0.7,
  shadowSize: 120,
};

export const COLORS = {
  skyHigh: 0x2f7fa3,
  skyMid: 0x7fb7c4,
  horizon: 0xffb98a,
  sea: 0x1a7f9c,
  sand: 0xdfbd7f,
  asphalt: 0x363d47,
  sidewalk: 0xc7bca5,
  curb: 0xab9d82,
  cream: 0xe2cda7,
  coral: 0xd4775f,
  white: 0xe9dfc9,
  sandBuilding: 0xceb07f,
  tealGlass: 0x2e8fa0,
  darkGlass: 0x1d5664,
  palm: 0x346b31,
  palmDark: 0x244f24,
  trunk: 0x6e4f34,
  hill: 0x5b6d45,
  neonPink: 0xff4fa3,
  neonCyan: 0x39d6e0,
  gold: 0xffc94a,
  lame: 0x2a2d33,
};

export const CSS = {
  gold: '#ffc94a',
  coral: '#ff6b5e',
  cyan: '#39d6e0',
  cream: '#f4e8d0',
};

export const SAVE_KEY = 'vela-city.save.v1';

export const SHOTS = ['chase', 'street', 'drive', 'mission'];
