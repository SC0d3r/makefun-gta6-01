// Twelve traffic cars on lane routes that slow for red lights, one another and the player, plus
// sixteen pedestrians walking the sidewalk rings. Pedestrians sidestep the player and run when a
// shot is fired or a car clips them.

import { CAR, GRID, WORLD, TRAFFIC } from './config.js';
import { createCar, placeCar } from './vehicle.js';
import { createHuman } from './player.js';
import { createRng } from './rng.js';

const COLORS = [0xd94b3f, 0x2f7f92, 0xe4c45a, 0x6b7d8c, 0xc9c2b3, 0x9b4f78, 0x3d5f8a, 0xe07b3f];
const PED_COLORS = [
  { shirt: 0xe8765f, pants: 0x27303a }, { shirt: 0x3b8d9b, pants: 0x22262c },
  { shirt: 0xe7d8bd, pants: 0x37455a }, { shirt: 0xd8a53c, pants: 0x2b2e33 },
  { shirt: 0xa05a7f, pants: 0x242a30 }, { shirt: 0x5d8f62, pants: 0x30302a },
];

function lerp(a, b, t) { return a + (b - a) * t; }

function ringPath(cx, cz, inset) {
  const h = GRID.block / 2 - inset;
  return [
    { x: cx - h, z: cz - h }, { x: cx + h, z: cz - h },
    { x: cx + h, z: cz + h }, { x: cx - h, z: cz + h },
  ];
}

export function createTraffic(scene, city, player, seed) {
  const rng = createRng(seed ^ 0x51a7);
  const cars = [];
  const routes = city.routes;

  for (let i = 0; i < TRAFFIC.cars; i += 1) {
    const kind = i % 7 === 0 ? 'van' : i % 3 === 0 ? 'coupe' : 'sedan';
    const car = createCar(scene, kind, COLORS[i % COLORS.length]);
    const route = routes[i % routes.length];
    const seg = rng.int(0, route.length - 1);
    const t = rng.range(0.05, 0.95);
    const a = route[seg];
    const b = route[(seg + 1) % route.length];
    placeCar(car, lerp(a.x, b.x, t), lerp(a.z, b.z, t), Math.atan2(b.x - a.x, b.z - a.z));
    car.route = route;
    car.routeIndex = (seg + 1) % route.length;
    car.baseSpeed = rng.range(7.2, 10.5);
    car.cruise = car.baseSpeed;
    car.wait = 0;
    cars.push(car);
  }

  const peds = [];
  for (let i = 0; i < TRAFFIC.peds; i += 1) {
    const colors = PED_COLORS[i % PED_COLORS.length];
    const model = createHuman({ ...colors, skin: rng.pick([0xc98e68, 0x9b6644, 0x70452c, 0xe0b38c]), hair: 0x1d1712 });
    const blockX = GRID.centers[rng.int(0, 4)];
    const blockZ = GRID.centers[rng.int(0, 4)];
    const path = ringPath(blockX, blockZ, rng.range(3.7, 5.2));
    const ped = {
      x: path[0].x, z: path[0].z, yaw: 0, path, target: 1, speed: rng.range(1.0, 1.45),
      phase: rng.range(0, 6), flee: 0, group: model.group, model, alive: true, hit: false,
    };
    const idx = rng.int(0, 3);
    ped.x = path[idx].x;
    ped.z = path[idx].z;
    ped.target = (idx + 1) % 4;
    ped.yaw = Math.atan2(path[ped.target].x - ped.x, path[ped.target].z - ped.z);
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.5, 12), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.26, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.03;
    model.group.add(shadow);
    ped.group.position.set(ped.x, 0, ped.z);
    scene.add(ped.group);
    peds.push(ped);
  }

  function frighten(x, z, radius = 42) {
    for (const ped of peds) {
      if (Math.hypot(ped.x - x, ped.z - z) < radius) ped.flee = Math.max(ped.flee, 6.5);
    }
  }

  function clipPed(ped, car) {
    ped.flee = 9;
    ped.hit = true;
    const dx = ped.x - car.x;
    const dz = ped.z - car.z;
    const len = Math.hypot(dx, dz) || 1;
    ped.x += (dx / len) * 1.6;
    ped.z += (dz / len) * 1.6;
  }

  function updateTrafficCar(car, dt, time, allCars) {
    const route = car.route;
    let target = route[car.routeIndex];
    let dx = target.x - car.x;
    let dz = target.z - car.z;
    let dist = Math.hypot(dx, dz);
    if (dist < 3.2) {
      car.routeIndex = (car.routeIndex + 1) % route.length;
      target = route[car.routeIndex];
      dx = target.x - car.x;
      dz = target.z - car.z;
      dist = Math.hypot(dx, dz);
    }
    const desiredYaw = Math.atan2(dx, dz);
    let diff = desiredYaw - car.yaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.yaw += diff * Math.min(1, dt * 2.4);

    let wanted = car.baseSpeed;
    let blocked = false;
    const fx = Math.sin(car.yaw);
    const fz = Math.cos(car.yaw);
    const rx = -Math.cos(car.yaw);
    const rz = Math.sin(car.yaw);
    for (const other of allCars) {
      if (other === car) continue;
      const ox = other.x - car.x;
      const oz = other.z - car.z;
      const ahead = ox * fx + oz * fz;
      const side = Math.abs(ox * rx + oz * rz);
      if (ahead > 0 && ahead < 8.5 && side < 2.6) {
        wanted = Math.max(0, (ahead - 5) * 2.2);
        blocked = true;
        break;
      }
    }
    if (!blocked) {
      const axis = Math.abs(fx) > Math.abs(fz) ? 'x' : 'z';
      for (const inter of city.intersections) {
        const ox = inter.x - car.x;
        const oz = inter.z - car.z;
        const ahead = ox * fx + oz * fz;
        const side = Math.abs(ox * rx + oz * rz);
        if (ahead > 7 && ahead < 15 && side < 8 && city.signalState(axis, time) !== 1) {
          wanted = Math.max(0, (ahead - 7) * 0.9);
          blocked = true;
          break;
        }
      }
    }
    const speed = car.speed;
    if (speed < wanted) car.speed = Math.min(wanted, speed + dt * 4.5);
    else car.speed = Math.max(wanted, speed - dt * 12);
    if (Math.abs(car.speed) < 0.02) car.speed = 0;
    car.x += Math.sin(car.yaw) * car.speed * dt;
    car.z += Math.cos(car.yaw) * car.speed * dt;

    // Keep traffic out of buildings on the rare corner where a route grazes a sidewalk.
    for (const b of city.colliders) {
      if (car.x > b.x - b.w / 2 - 0.8 && car.x < b.x + b.w / 2 + 0.8 && car.z > b.z - b.d / 2 - 0.8 && car.z < b.z + b.d / 2 + 0.8) {
        car.x += Math.sin(car.yaw + Math.PI / 2) * dt * 8;
        car.z += Math.cos(car.yaw + Math.PI / 2) * dt * 8;
        car.speed *= 0.6;
      }
    }
    car.group.position.set(car.x, 0, car.z);
    car.group.rotation.y = car.yaw;
    car.wheelPhase += car.speed * dt;
  }

  function updatePed(ped, dt) {
    if (!ped.alive) return;
    if (ped.flee > 0) {
      ped.flee -= dt;
      const dx = ped.x - player.x;
      const dz = ped.z - player.z;
      const len = Math.hypot(dx, dz) || 1;
      const speed = 4.2;
      ped.x += (dx / len) * speed * dt;
      ped.z += (dz / len) * speed * dt;
      ped.yaw = Math.atan2(dx, dz);
      ped.speed = speed;
      if (ped.flee <= 0) {
        let best = 0;
        let bd = Infinity;
        for (let i = 0; i < ped.path.length; i += 1) {
          const d = Math.hypot(ped.path[i].x - ped.x, ped.path[i].z - ped.z);
          if (d < bd) { bd = d; best = i; }
        }
        ped.target = best;
      }
    } else {
      const t = ped.path[ped.target];
      const dx = t.x - ped.x;
      const dz = t.z - ped.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 1.1) ped.target = (ped.target + 1) % 4;
      const desired = Math.atan2(dx, dz);
      let diff = desired - ped.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      ped.yaw += diff * Math.min(1, dt * 4);
      let speed = ped.speed;
      const pd = Math.hypot(player.x - ped.x, player.z - ped.z);
      if (pd < 1.35 && !player.inCar) {
        ped.x += (ped.x - player.x) * dt * 1.7;
        ped.z += (ped.z - player.z) * dt * 1.7;
        speed *= 0.6;
      }
      ped.x += Math.sin(ped.yaw) * speed * dt;
      ped.z += Math.cos(ped.yaw) * speed * dt;
    }
    ped.x = Math.max(-152, Math.min(152, ped.x));
    ped.z = Math.max(-152, Math.min(200, ped.z));
    ped.phase += dt * (2.5 + ped.speed * 1.4);
    const swing = Math.sin(ped.phase) * (ped.flee > 0 ? 0.85 : 0.5);
    ped.model.leftLeg.rotation.x = swing;
    ped.model.rightLeg.rotation.x = -swing;
    ped.model.leftArm.rotation.x = -swing;
    ped.model.rightArm.rotation.x = swing;
    ped.group.position.set(ped.x, Math.abs(Math.sin(ped.phase)) * 0.025, ped.z);
    ped.group.rotation.y = ped.yaw;
  }

  function update(dt, time) {
    for (const car of cars) {
      if (car.occupied) continue;
      updateTrafficCar(car, dt, time, cars);
    }
    for (const ped of peds) updatePed(ped, dt);
    if (player.inCar) {
      const car = player.inCar.car;
      for (const ped of peds) {
        if (!ped.alive || ped.flee > 5.2) continue;
        if (Math.hypot(car.x - ped.x, car.z - ped.z) < 2.3 && Math.abs(car.speed) > 4) {
          clipPed(ped, car);
          if (player.onPedHit) player.onPedHit(ped);
        }
      }
    }
  }

  return { cars, peds, update, frighten, clipPed };
}
