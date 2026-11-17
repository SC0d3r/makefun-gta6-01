// The four deterministic screenshot scenes. Each stages a real playable state, runs the fixed-step
// simulation for a short burst so traffic, pedestrians and lights are alive, then plants a cinematic
// camera and freezes so the capture is identical every time for the same seed.
// Each preset name maps to a staged moment that outside tools can photograph.

import { STEP } from './config.js';
import { placeCar } from './vehicle.js';

function reset(game) {
  const { player, traffic, police, missions } = game;
  if (player.inCar) {
    player.inCar.car.occupied = false;
    player.inCar = null;
  }
  for (const car of traffic.cars) {
    car.occupied = false;
    car.health = 100;
    car.group.rotation.z = 0;
  }
  for (const ped of traffic.peds) ped.alive = true;
  police.clearWanted();
  for (const unit of police.units) unit.car.group.rotation.z = 0;
  missions.state.status = 'idle';
  missions.state.stage = 0;
  missions.state.override = null;
  missions.state.timeLeft = 0;
  missions.state.objective = 'Reach the yellow marker';
  missions.setPoint(missions.points[0].x, missions.points[0].z, true);
  player.group.visible = true;
  player.shadow.visible = true;
  game.health = 100;
  game.armour = 60;
  game.cash = 1240;
  game.ammo = 12;
  game.showBanner = true;
  game.frozen = false;
  game.hud.clearToast();
  game.clearShotCamera?.();
}

function stageChase(game) {
  const { traffic, police, player, missions } = game;
  const hero = traffic.cars[0];
  const park = (car, x, z, yaw, speed = 0) => {
    placeCar(car, x, z, yaw);
    car.speed = speed;
    car.vx = Math.sin(yaw) * speed;
    car.vz = Math.cos(yaw) * speed;
  };
  park(hero, 7, 149, -Math.PI / 2, 22);
  game.enterCar(hero, true);
  park(traffic.cars[1], -28, 149, -Math.PI / 2, 12);
  park(traffic.cars[2], -62, 152.5, Math.PI / 2, 10);
  park(traffic.cars[3], 94, 152.5, Math.PI / 2, 9);
  park(traffic.cars[4], 118, 149, -Math.PI / 2, 14);

  police.stageChase(3, 3);
  police.state.lastCrime = game.time;
  for (let i = 0; i < 3; i += 1) {
    const unit = police.units[i];
    unit.active = true;
    unit.spawned = true;
    unit.car.group.visible = true;
    unit.mode = 'chase';
    park(unit.car, 15 + i * 6, 149 + (i === 1 ? 1.2 : -1.2), -Math.PI / 2);
  }
  missions.state.title = 'COURIER RUN';
  missions.state.status = 'idle';
  missions.state.override = 'Lose the police';
  missions.state.timeLeft = 0;
  missions.setPoint(missions.points[0].x, missions.points[0].z, false);
  player.snap({ x: hero.x, z: hero.z, yaw: hero.yaw });
  game.health = 84;
  game.armour = 38;
  game.cash = 1240;
  game.cameraYaw = hero.yaw;
  game.pitch = 0.08;
  for (let i = 0; i < 8; i += 1) game.step(STEP);
  // Put the staged cast back where the frame wants it after its short run-up.
  park(hero, 7, 149, -Math.PI / 2, 22);
  for (let i = 0; i < 3; i += 1) {
    const unit = police.units[i];
    park(unit.car, 15 + i * 6, 149 + (i === 1 ? 1.2 : -1.2), -Math.PI / 2);
    unit.car.lights.red.color.setHex(0xff2a20);
    unit.car.lights.blue.color.setHex(0x2a8cff);
  }
  police.setWanted(3);
  police.state.lastCrime = game.time;
  player.x = hero.x;
  player.z = hero.z;
  game.health = 84;
  game.armour = 38;
  game.hud.clearToast();
  game.setShotCamera([-2, 2.8, 156], [8, 1.3, 149.5], 46);
}

function stageStreet(game) {
  const { player, traffic, police, missions } = game;
  player.snap({ x: 24.7, z: 10, yaw: Math.PI });
  police.clearWanted();
  missions.state.status = 'idle';
  missions.state.override = null;
  missions.state.objective = 'Reach the yellow marker';
  missions.setPoint(missions.points[0].x, missions.points[0].z, true);
  game.health = 92;
  game.armour = 45;
  game.cash = 1240;
  placeCar(traffic.cars[0], 26.5, 0, Math.PI);
  traffic.cars[0].speed = 7;
  placeCar(traffic.cars[1], 33.5, 8, 0);
  traffic.cars[1].speed = 8;
  placeCar(traffic.cars[2], 26.5, -30, Math.PI);
  traffic.cars[2].speed = 10;
  const walkers = [[35.2, 14], [24.7, -7], [35.2, -4], [30.2, -16]];
  for (let i = 0; i < walkers.length; i += 1) {
    const ped = traffic.peds[i];
    ped.x = walkers[i][0];
    ped.z = walkers[i][1];
    ped.flee = 0;
    ped.group.position.set(ped.x, 0, ped.z);
  }
  game.cameraYaw = Math.PI;
  game.pitch = 0.12;
  for (let i = 0; i < 10; i += 1) game.step(STEP);
  placeCar(traffic.cars[0], 26.5, 0, Math.PI);
  traffic.cars[0].speed = 7;
  placeCar(traffic.cars[1], 33.5, 8, 0);
  traffic.cars[1].speed = 8;
  placeCar(traffic.cars[2], 26.5, -30, Math.PI);
  traffic.cars[2].speed = 10;
  for (let i = 0; i < walkers.length; i += 1) {
    const ped = traffic.peds[i];
    ped.x = walkers[i][0];
    ped.z = walkers[i][1];
    ped.group.position.set(ped.x, 0, ped.z);
  }
  player.snap({ x: 24.7, z: 10, yaw: Math.PI });
  game.setShotCamera([28.5, 4.1, 24], [22.5, 2.0, 3], 58);
}

function stageDrive(game) {
  const { traffic, police, player, missions } = game;
  const hero = traffic.cars[2];
  placeCar(hero, 112, 146.5, -Math.PI / 2);
  hero.speed = 22;
  hero.vx = Math.sin(hero.yaw) * hero.speed;
  hero.vz = Math.cos(hero.yaw) * hero.speed;
  game.enterCar(hero, true);
  police.clearWanted();
  missions.state.status = 'active';
  missions.state.override = null;
  missions.state.timeLeft = 168;
  missions.state.stage = 0;
  missions.state.objective = 'Drop the package at the north warehouse';
  missions.setPoint(missions.points[1].x, missions.points[1].z, true);
  placeCar(traffic.cars[0], 66, 146.5, -Math.PI / 2);
  traffic.cars[0].speed = 13;
  placeCar(traffic.cars[1], 88, 153.5, Math.PI / 2);
  traffic.cars[1].speed = 9;
  game.health = 96;
  game.armour = 30;
  game.cash = 1990;
  player.x = hero.x;
  player.z = hero.z;
  game.cameraYaw = hero.yaw;
  game.pitch = 0.06;
  for (let i = 0; i < 8; i += 1) game.step(STEP);
  placeCar(hero, 112, 146.5, -Math.PI / 2);
  hero.speed = 22;
  hero.vx = Math.sin(hero.yaw) * hero.speed;
  hero.vz = Math.cos(hero.yaw) * hero.speed;
  player.x = hero.x;
  player.z = hero.z;
  game.cameraYaw = hero.yaw;
  game.setShotCamera([122, 4.4, 146.5], [100, 1.2, 146.5], 62);
}

function stageMission(game) {
  const { player, police, missions, traffic } = game;
  player.snap({ x: 88, z: 221, yaw: 0 });
  missions.stageFinal();
  missions.state.timeLeft = 42;
  game.missions.state.title = 'COURIER RUN';
  game.health = 78;
  game.armour = 24;
  game.cash = 8650;
  police.setWanted(2);
  police.state.lastCrime = game.time;
  const units = police.units;
  for (let i = 0; i < 4; i += 1) {
    const unit = units[i];
    unit.active = i < 2;
    unit.spawned = i < 2;
    unit.car.group.visible = i < 2;
    if (i < 2) placeCar(unit.car, i === 0 ? 72 : 106, 190, i === 0 ? 0.5 : -0.5);
  }
  game.cameraYaw = 0;
  game.pitch = 0.12;
  for (let i = 0; i < 8; i += 1) game.step(STEP);
  player.snap({ x: 88, z: 221, yaw: 0 });
  for (let i = 0; i < 2; i += 1) {
    const unit = units[i];
    placeCar(unit.car, i === 0 ? 72 : 106, 190, i === 0 ? 0.5 : -0.5);
    unit.car.lights.red.color.setHex(0xff2a20);
    unit.car.lights.blue.color.setHex(0x2a8cff);
  }
  police.addCop(80, 197);
  police.addCop(98, 197);
  traffic.peds[0].x = 96;
  traffic.peds[0].z = 194;
  traffic.peds[0].group.position.set(96, 0, 194);
  police.setWanted(2);
  police.state.lastCrime = game.time;
  missions.stageFinal();
  missions.state.timeLeft = 42;
  game.health = 78;
  game.armour = 24;
  game.cash = 8650;
  game.hud.clearToast();
  game.setShotCamera([107, 6.4, 234], [87, 1.4, 219], 58);
}

export function stageShot(game, name) {
  reset(game);
  if (name === 'street') stageStreet(game);
  else if (name === 'drive') stageDrive(game);
  else if (name === 'mission') stageMission(game);
  else stageChase(game);
  game.frozen = true;
  game.shotName = name;
  window.__shotName = name;
}
