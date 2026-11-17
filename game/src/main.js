// Boot, the one fixed-step loop, the game state and the wiring between city, player, traffic,
// police, missions, HUD, audio and the screenshot presets. ?seed=N makes the whole city and its
// inhabitants deterministic; ?shot=chase|street|drive|mission stages and freezes a real scene.

import { STEP, MAX_FRAME, PLAYER, WORLD, SAVE_KEY, SHOTS } from './config.js';
import { createRng } from './rng.js';
import { createInput, ACTION_PAUSE, ACTION_INTERACT, ACTION_SHOOT, ACTION_JUMP, ACTION_RETRY } from './input.js';
import { createGraphics, createCameraRig } from './render.js';
import { createCity } from './city.js';
import { createPlayer } from './player.js';
import { driveCar, nearestCar } from './vehicle.js';
import { createTraffic } from './traffic.js';
import { createPolice } from './police.js';
import { createMissions } from './missions.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 7;
const shotName = params.get('shot');
const canvas = document.getElementById('game');
const hudRoot = document.getElementById('hud');

let game = null;

function readSave() {
  try {
    const value = JSON.parse(window.localStorage.getItem(SAVE_KEY) || 'null');
    if (value && typeof value.cash === 'number') return value;
  } catch {
    // Private windows or a corrupt save just start clean.
  }
  return null;
}

function boot() {
  if (!window.THREE) throw new Error('three.js was not loaded from vendor/three.min.js');
  const graphics = createGraphics(canvas);
  const city = createCity(graphics.scene, createRng(seed));
  const player = createPlayer(graphics.scene, WORLD.spawn, city.colliders);
  const traffic = createTraffic(graphics.scene, city, player, seed);
  const hud = createHud(hudRoot);
  const audio = createAudio();
  const cameraRig = createCameraRig(graphics, city.colliders);
  const input = createInput(canvas, {
    onLock: (locked) => { if (!locked && game && game.screen === 'play') hud.toast('CLICK TO LOOK AROUND', 1.4); },
  });
  const save = readSave();
  const missions = createMissions(graphics.scene, city, player, {
    toast: (text) => hud.toast(text),
    addCash: (amount) => { game.cash += amount; },
    save: () => { game.save(); },
    complete: () => { game.completed += 1; audio.complete(); game.save(); },
    fail: () => {},
  });
  const police = createPolice(graphics.scene, city, player, traffic, {
    toast: (text) => hud.toast(text),
    damage: (amount) => game.damage(amount, 'police'),
  });

  const sunTarget = new THREE.Vector3();
  const forward = new THREE.Vector3();
  let accumulator = 0;
  let lastTime = performance.now();
  let shotFrames = 0;
  let footTimer = 0;

  game = {
    graphics, city, player, traffic, police, missions, hud, audio, input, cameraRig, save,
    time: 0, cash: save ? save.cash : 1240, health: 100, armour: 60, ammo: 12,
    completed: save ? save.completed || 0 : 0,
    cameraYaw: WORLD.spawn.yaw, pitch: 0.12, facingYaw: WORLD.spawn.yaw,
    screen: 'title', showBanner: true, frozen: false, shotName: null,
    pendingJump: false, fireTimer: 0, reloadTimer: 0, respawnTimer: 0,
    damage(amount, source) { takeDamage(this, amount, source); },
    save() { writeSave(this); },
    step(dt) { stepSimulation(this, dt); },
    enterCar(car, silent) { enterCar(this, car, silent); },
    exitCar() { exitCar(this); },
    snapCamera() { snapCamera(this); },
    setShotCamera(pos, look, fov) { this.cameraRig.setShot(pos, look, fov); },
    clearShotCamera() { this.cameraRig.clearShot(); },
    respawn() { respawn(this); },
    startNew() { startRun(this, false); },
    startContinue() { startRun(this, true); },
    restart() { startRun(this, false); },
  };

  player.onPedHit = (ped) => {
    police.addWanted(2, 'CIVILIAN HIT');
    traffic.frighten(ped.x, ped.z);
  };

  hud.bind({
    click: () => audio.unlock(),
    newGame: () => game.startNew(),
    continue: () => game.startContinue(),
    resume: () => { game.screen = 'play'; hud.setPaused(false); input.requestLock(); },
    restart: () => game.restart(),
  });

  window.addEventListener('pointerdown', () => audio.unlock(), { once: true });
  window.addEventListener('keydown', () => audio.unlock(), { once: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.screen === 'play') {
      game.screen = 'paused';
      hud.setPaused(true);
      input.releaseLock();
    }
  });

  window.__game = game;
  window.__seed = seed;

  if (shotName) {
    hud.hideTitle();
    hud.setPaused(false);
    hud.setPlaying(true);
    game.screen = 'play';
    stageShot(game, SHOTS.includes(shotName) ? shotName : 'chase');
    input.setEnabled(false);
  } else {
    hud.showTitle(!!save);
    hud.setPlaying(false);
    game.screen = 'title';
    cameraRig.setShot([108, 46, 238], [0, 7, -18], 55);
    hud.toast('VELA CITY', 1.8);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.max(0, Math.min((now - lastTime) / 1000, MAX_FRAME));
    lastTime = now;

    if (shotName) {
      updateMouseAndCamera(game, dt);
      hud.update(game, dt);
      graphics.followSun(sunTarget.set(game.player.x, 0, game.player.z));
      graphics.render();
      shotFrames += 1;
      if (params.get('debug')) {
        const cam = graphics.camera.position;
        const car = game.player.inCar ? game.player.inCar.car : null;
        const dir = new THREE.Vector3();
        graphics.camera.getWorldDirection(dir);
        const ndc = car ? car.group.position.clone().setY(0.8).project(graphics.camera) : null;
        document.title = `cam ${cam.x.toFixed(1)},${cam.y.toFixed(1)},${cam.z.toFixed(1)} dir ${dir.x.toFixed(2)},${dir.z.toFixed(2)} yaw ${game.cameraYaw.toFixed(2)} car ${car ? `${car.x.toFixed(1)},${car.z.toFixed(1)},${car.yaw.toFixed(2)},vis=${car.group.visible},gp=${car.group.position.x.toFixed(1)},${car.group.position.y.toFixed(1)},${car.group.position.z.toFixed(1)},ndc=${ndc.x.toFixed(2)},${ndc.y.toFixed(2)},${ndc.z.toFixed(2)},speed=${car.speed.toFixed(1)}` : 'none'} p ${game.player.x.toFixed(1)},${game.player.z.toFixed(1)}`;
      }
      if (shotFrames > 2) window.__shotReady = true;
      return;
    }

    if (game.screen === 'title') {
      game.time += dt;
      city.update(game.time);
      traffic.update(dt, game.time);
      updateMouseAndCamera(game, dt);
      graphics.followSun(sunTarget.set(game.player.x, 0, game.player.z));
      hud.update(game, dt);
      graphics.render();
      return;
    }

    if (game.screen === 'paused') {
      updateMouseAndCamera(game, dt);
      hud.update(game, dt);
      graphics.render();
      return;
    }

    if (game.screen === 'dead') {
      game.respawnTimer -= dt;
      if (game.respawnTimer <= 0) respawn(game);
      hud.update(game, dt);
      graphics.render();
      return;
    }

    handleActions(game);
    updateMouseAndCamera(game, dt);
    accumulator += dt;
    let guard = 0;
    while (accumulator >= STEP && guard < 8) {
      stepSimulation(game, STEP);
      accumulator -= STEP;
      guard += 1;
    }
    if (guard >= 8) accumulator = 0;
    updateAudio(game, dt);
    hud.update(game, dt);
    graphics.render();
  }

  function updateAudio(g, dt) {
    const car = g.player.inCar ? g.player.inCar.car : null;
    g.audio.setEngine(!!car, car ? car.speed : 0);
    g.audio.setSiren(g.police.state.wanted > 0);
    g.audio.update(dt, true);
    if (!car && g.player.speed > 1.4) {
      footTimer -= dt;
      if (footTimer <= 0) { footTimer = 0.34; g.audio.step(); }
    } else footTimer = 0;
  }

  requestAnimationFrame(frame);
}

function takeDamage(g, amount, source) {
  if (g.screen !== 'play') return;
  let left = amount;
  if (g.armour > 0) {
    const absorbed = Math.min(g.armour, left * 0.62);
    g.armour -= absorbed;
    left -= absorbed;
  }
  g.health -= left;
  if (g.health <= 0) die(g);
}

function die(g) {
  if (g.screen === 'dead') return;
  g.screen = 'dead';
  g.respawnTimer = 3.2;
  g.health = 0;
  g.hud.showWasted(true, 'WASTED');
  g.audio.crash();
  g.audio.setEngine(false, 0);
  g.audio.setSiren(false);
  g.police.clearWanted();
  g.missions.fail('Wasted · press R to retry');
  if (g.player.inCar) {
    g.player.inCar.car.occupied = false;
    g.player.inCar = null;
  }
}

function respawn(g) {
  const hospital = WORLD.hospital;
  g.player.snap({ x: hospital.x, z: hospital.z, yaw: 0 });
  g.player.group.visible = true;
  g.player.shadow.visible = true;
  g.health = 100;
  g.armour = 30;
  g.ammo = 12;
  g.screen = 'play';
  g.hud.showWasted(false);
  g.hud.toast('VELA GENERAL HOSPITAL · PATCHED UP');
  g.police.clearWanted();
  g.cameraYaw = 0;
  g.pitch = 0.12;
  g.snapCamera();
}

function writeSave(g) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({ cash: Math.round(g.cash), completed: g.completed }));
  } catch {
    // Saving is optional when storage is unavailable.
  }
}

function resetRun(g) {
  if (g.player.inCar) {
    g.player.inCar.car.occupied = false;
    g.player.inCar = null;
  }
  for (const car of g.traffic.cars) { car.occupied = false; car.health = 100; car.group.rotation.z = 0; }
  g.police.clearWanted();
  g.missions.state.status = 'idle';
  g.missions.state.stage = 0;
  g.missions.state.override = null;
  g.missions.state.timeLeft = 0;
  g.missions.state.objective = 'Reach the yellow marker';
  g.missions.setPoint(g.missions.points[0].x, g.missions.points[0].z, true);
  g.player.snap({ x: WORLD.spawn.x, z: WORLD.spawn.z, yaw: WORLD.spawn.yaw });
  g.player.group.visible = true;
  g.player.shadow.visible = true;
  g.health = 100;
  g.armour = 60;
  g.ammo = 12;
  g.time = 0;
  g.cameraYaw = WORLD.spawn.yaw;
  g.pitch = 0.12;
  g.pendingJump = false;
  g.fireTimer = 0;
  g.reloadTimer = 0;
  g.respawnTimer = 0;
  g.hud.showWasted(false);
  g.hud.resetEndCard();
  g.hud.setPaused(false);
  g.audio.setEngine(false, 0);
  g.audio.setSiren(false);
}

function startRun(g, fromSave) {
  resetRun(g);
  if (fromSave) {
    const saved = readSave();
    if (saved) { g.cash = saved.cash; g.completed = saved.completed || 0; }
  } else {
    g.cash = 1240;
    g.completed = 0;
  }
  g.hud.hideTitle();
  g.hud.setPlaying(true);
  g.hud.setPaused(false);
  g.hud.toast('COURIER RUN · REACH THE YELLOW MARKER', 3);
  g.screen = 'play';
  g.cameraRig.clearShot();
  g.snapCamera();
  g.audio.unlock();
  g.audio.click();
  g.input.setEnabled(true);
  g.input.requestLock();
  g.save();
}

function enterCar(g, car, silent = false) {
  if (g.player.inCar || car.occupied) return;
  car.occupied = true;
  g.player.inCar = { car };
  g.player.x = car.x;
  g.player.z = car.z;
  g.player.y = 0.1;
  g.player.group.visible = false;
  g.player.shadow.visible = false;
  g.cameraYaw = car.yaw;
  g.pitch = 0.05;
  if (!silent) {
    g.police.onSteal(car);
    g.hud.toast('VEHICLE STOLEN');
    g.audio.click();
  }
}

function exitCar(g) {
  if (!g.player.inCar) return;
  const car = g.player.inCar.car;
  car.occupied = false;
  car.speed = 0;
  car.vx = 0;
  car.vz = 0;
  const x = car.x + Math.cos(car.yaw) * 2.1;
  const z = car.z - Math.sin(car.yaw) * 2.1;
  g.player.inCar = null;
  g.player.snap({ x, z, yaw: car.yaw });
  g.player.group.visible = true;
  g.player.shadow.visible = true;
  g.cameraYaw = car.yaw;
  g.pitch = 0.12;
  g.audio.setEngine(false, 0);
}

function attachPoint(g) {
  const cars = [...g.traffic.cars];
  for (const unit of g.police.units) cars.push(unit.car);
  return nearestCar(cars, g.player.x, g.player.z, 3.4);
}

function handleActions(g) {
  const actions = g.input.takeActions();
  if (actions & ACTION_PAUSE) {
    if (g.screen === 'play') {
      g.screen = 'paused';
      g.hud.setPaused(true);
      g.input.releaseLock();
    } else if (g.screen === 'paused') {
      g.screen = 'play';
      g.hud.setPaused(false);
      g.input.requestLock();
    }
    return;
  }
  if (g.screen !== 'play') return;
  if (actions & ACTION_RETRY) {
    if (g.missions.state.status === 'failed') {
      g.missions.retry();
      g.hud.toast('COURIER RUN RETRY');
    } else {
      g.ammo = 12;
      g.hud.toast('RELOADED');
    }
  }
  if (actions & ACTION_INTERACT) {
    if (g.player.inCar) exitCar(g);
    else {
      const car = attachPoint(g);
      if (car) enterCar(g, car);
      else if (!g.missions.interact()) g.hud.toast('NOTHING HERE');
    }
  }
  if ((actions & ACTION_JUMP) && !g.player.inCar) g.pendingJump = true;
  if ((g.input.shooting || (actions & ACTION_SHOOT)) && !g.player.inCar) fire(g);
}

function fire(g) {
  if (g.fireTimer > 0 || g.screen !== 'play') return;
  if (g.ammo <= 0) {
    if (g.reloadTimer <= 0) {
      g.reloadTimer = 1.1;
      g.hud.toast('RELOADING');
    }
    return;
  }
  g.ammo -= 1;
  g.fireTimer = 0.18;
  g.graphics.camera.getWorldDirection(forward);
  const origin = g.graphics.camera.position;
  const muzzle = [g.player.x + forward.x * 0.85, g.player.y + 1.45, g.player.z + forward.z * 0.85];
  const hit = g.police.playerShoot(origin, forward, muzzle, g.traffic.peds);
  g.audio.shot();
  g.traffic.frighten(g.player.x, g.player.z, 55);
  if (hit.kind === 'ped') g.hud.toast('CIVILIAN HIT');
  else if (hit.kind === 'cop') g.hud.toast('OFFICER HIT');
}

function stepSimulation(g, dt) {
  g.time += dt;
  const move = g.input.move();
  if (g.player.inCar) {
    const car = g.player.inCar.car;
    const controls = { throttle: move.forward, steer: move.strafe, brake: false, handbrake: g.input.handbrake };
    driveCar(car, controls, dt, g.city.colliders);
    g.player.x = car.x;
    g.player.z = car.z;
    g.player.y = 0.1;
    g.player.yaw = car.yaw;
    g.player.group.visible = false;
    g.player.shadow.visible = false;
    g.cameraYaw = car.yaw;
  } else {
    g.player.update(dt, g.input, g.cameraYaw, true, g.pendingJump);
    g.pendingJump = false;
  }
  g.facingYaw = g.player.yaw;
  g.traffic.update(dt, g.time);
  g.police.update(dt, g.time);
  g.missions.update(dt);
  g.city.update(g.time);
  if (g.fireTimer > 0) g.fireTimer -= dt;
  if (g.reloadTimer > 0) {
    g.reloadTimer -= dt;
    if (g.reloadTimer <= 0 && g.ammo <= 0) {
      g.ammo = 12;
      g.hud.toast('RELOADED');
    }
  }
}

function updateMouseAndCamera(g, dt) {
  if (g.screen === 'play' && !g.shotName) {
    const mouse = g.input.takeMouse();
    if (g.player.inCar) {
      g.cameraYaw = g.player.inCar.car.yaw;
      g.pitch = Math.max(0.01, Math.min(0.55, g.pitch + mouse.dy * 0.0018));
    } else {
      g.cameraYaw -= mouse.dx * 0.0024;
      g.pitch = Math.max(PLAYER.pitchMin, Math.min(PLAYER.pitchMax, g.pitch + mouse.dy * 0.0022));
    }
  }
  g.facingYaw = g.player.yaw;
  const car = g.player.inCar ? g.player.inCar.car : null;
  g.cameraRig.update(dt, g.player, car ? 'car' : 'foot', g.cameraYaw, g.pitch, car ? Math.abs(car.speed) : g.player.speed);
  g.graphics.followSun(new THREE.Vector3(g.player.x, 0, g.player.z));
}

function snapCamera(g) {
  const car = g.player.inCar ? g.player.inCar.car : null;
  g.cameraRig.snap(g.player, car ? 'car' : 'foot', g.cameraYaw, g.pitch);
}

try {
  boot();
} catch (error) {
  const box = document.getElementById('error');
  if (box) {
    box.style.display = 'block';
    box.textContent = `BOOT ERROR ${error && (error.stack || error.message || error)}`;
  }
  window.__gameError = String(error && (error.stack || error.message || error));
  console.error(error);
}
