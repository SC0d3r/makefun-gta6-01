// Wanted level, pursuit driving, foot officers and gun combat. Crimes raise the heat, four police
// cars answer (two patrol units already parked in the city and two responders staged off-screen),
// officers deploy above two stars, and the level cools after thirty seconds out of sight.

import { CAR, WANTED } from './config.js';
import { createCar, driveCar, placeCar } from './vehicle.js';
import { createHuman } from './player.js';
import { createRng } from './rng.js';

const boxGeo = new THREE.BoxGeometry(1, 1, 1);

function rayBox(ox, oy, oz, dx, dy, dz, b, maxDist) {
  let tmin = 0;
  let tmax = maxDist;
  const lo = [b.x - b.w / 2, 0, b.z - b.d / 2];
  const hi = [b.x + b.w / 2, b.height ?? b.h ?? 6, b.z + b.d / 2];
  const o = [ox, oy, oz];
  const d = [dx, dy, dz];
  for (let a = 0; a < 3; a += 1) {
    if (Math.abs(d[a]) < 1e-7) {
      if (o[a] < lo[a] || o[a] > hi[a]) return Infinity;
    } else {
      let t1 = (lo[a] - o[a]) / d[a];
      let t2 = (hi[a] - o[a]) / d[a];
      if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
      if (t1 > tmin) tmin = t1;
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return Infinity;
    }
  }
  return tmin;
}

function raySphere(ox, oy, oz, dx, dy, dz, x, y, z, radius) {
  const lx = x - ox;
  const ly = y - oy;
  const lz = z - oz;
  const tca = lx * dx + ly * dy + lz * dz;
  if (tca < 0) return Infinity;
  const d2 = lx * lx + ly * ly + lz * lz - tca * tca;
  if (d2 > radius * radius) return Infinity;
  return tca - Math.sqrt(radius * radius - d2);
}

function distToCar(player, car) {
  return Math.hypot(player.x - car.x, player.z - car.z);
}

export function createPolice(scene, city, player, traffic, hooks = {}) {
  const rng = createRng(0x9e3779b9);
  const state = {
    wanted: 0, time: 0, lastCrime: -999, decayTimer: WANTED.decayStep,
    units: [], cops: [], tracers: [], flashes: [], lastFireCrime: -999, ramCooldown: 0,
    respondTimer: 0,
  };
  const uniforms = { shirt: new THREE.MeshStandardMaterial({ color: 0x1b2d4a, roughness: 0.82 }) };

  function makeUnit(index) {
    const car = createCar(scene, 'police', 0xe9ece7);
    car.isUnit = true;
    const spawn = index === 0 ? { x: -88, z: -60, yaw: 0.1 } : index === 1 ? { x: 58, z: 88, yaw: -1.4 } : null;
    if (spawn) placeCar(car, spawn.x, spawn.z, spawn.yaw);
    else placeCar(car, 300 + index * 8, 300, 0);
    const unit = { car, index, patrol: index < 2, active: index < 2, spawned: index < 2, mode: 'parked', reverse: 0, stuck: 0 };
    car.group.visible = index < 2;
    state.units.push(unit);
    return unit;
  }
  for (let i = 0; i < 4; i += 1) makeUnit(i);

  function spawnPoint() {
    for (let tries = 0; tries < 40; tries += 1) {
      const inter = city.intersections[rng.int(0, city.intersections.length - 1)];
      const x = inter.x + (rng.chance(0.5) ? -3.5 : 3.5);
      const z = inter.z + (rng.chance(0.5) ? -3.5 : 3.5);
      const d = Math.hypot(x - player.x, z - player.z);
      if (d < 65 || d > 145) continue;
      let inside = false;
      for (const b of city.colliders) {
        if (x > b.x - b.w / 2 - 2 && x < b.x + b.w / 2 + 2 && z > b.z - b.d / 2 - 2 && z < b.z + b.d / 2 + 2) { inside = true; break; }
      }
      if (!inside) return { x, z, yaw: Math.atan2(player.x - x, player.z - z) };
    }
    return { x: player.x + 90, z: player.z - 90, yaw: Math.atan2(player.x - (player.x + 90), player.z - (player.z - 90)) };
  }

  function addWanted(amount, reason) {
    const before = state.wanted;
    state.wanted = Math.max(1, Math.min(WANTED.max, state.wanted + amount));
    state.lastCrime = state.time;
    state.decayTimer = WANTED.decayStep;
    if (state.wanted > before && hooks.toast) hooks.toast(reason || 'WANTED LEVEL UP');
    if (state.wanted > 0) activateUnits();
  }

  function activateUnits() {
    for (const unit of state.units) {
      if (!unit.spawned) {
        const spot = spawnPoint(85);
        placeCar(unit.car, spot.x, spot.z, spot.yaw);
        unit.car.group.visible = true;
        unit.spawned = true;
      }
      unit.active = true;
      unit.mode = 'chase';
    }
  }

  function clearWanted() {
    state.wanted = 0;
    state.lastCrime = -999;
    for (const cop of state.cops) removeCop(cop);
    state.cops.length = 0;
    for (const unit of state.units) {
      unit.active = unit.patrol;
      unit.mode = 'parked';
      if (!unit.patrol) { unit.car.group.visible = false; unit.spawned = false; }
    }
  }

  function setWanted(level) {
    state.wanted = Math.max(0, Math.min(WANTED.max, level));
    state.lastCrime = state.time;
    state.decayTimer = WANTED.decayStep;
    if (state.wanted > 0) activateUnits();
  }

  function removeCop(cop) {
    cop.alive = false;
    scene.remove(cop.group);
  }

  function addCop(x, z) {
    if (state.cops.filter((c) => c.alive).length >= 4) return null;
    const model = createHuman({ shirt: 0x1b2d4a, pants: 0x18202b, skin: 0xc08a63, hair: 0x17120f });
    const cop = {
      x, z, yaw: 0, health: 70, alive: true, timer: rng.range(0.4, 1.2), phase: 0,
      group: model.group, model, speed: 3.1,
    };
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.5, 12), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.03;
    model.group.add(shadow);
    model.group.position.set(x, 0, z);
    scene.add(model.group);
    state.cops.push(cop);
    return cop;
  }

  function lineClear(x1, y1, z1, x2, y2, z2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dz = z2 - z1;
    const len = Math.hypot(dx, dy, dz) || 1;
    for (const b of city.colliders) {
      const t = rayBox(x1, y1, z1, dx / len, dy / len, dz / len, b, len);
      if (t < len) return false;
    }
    return true;
  }

  function tracer(from, to, color = 0xffe6a8) {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(from[0], from[1], from[2]),
      new THREE.Vector3(to[0], to[1], to[2]),
    ]);
    const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.95, toneMapped: false }));
    scene.add(line);
    state.tracers.push({ line, life: 0.075 });
  }

  function flash(position) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffe2a0, toneMapped: false }));
    mesh.position.set(position[0], position[1], position[2]);
    scene.add(mesh);
    const light = new THREE.PointLight(0xffc060, 6, 7, 2);
    light.position.copy(mesh.position);
    scene.add(light);
    state.flashes.push({ mesh, light, life: 0.06 });
  }

  /**
   * Fire from the player's muzzle along the camera's aim. Hits the nearest cop, pedestrian, car or
   * wall; returns a small description for the HUD and game rules.
   */
  function playerShoot(origin, direction, muzzle, peds) {
    const dx = direction.x;
    const dy = direction.y;
    const dz = direction.z;
    let best = { kind: 'none', dist: 140, point: [origin.x + dx * 140, origin.y + dy * 140, origin.z + dz * 140] };
    for (const b of city.colliders) {
      const t = rayBox(origin.x, origin.y, origin.z, dx, dy, dz, b, 140);
      if (t < best.dist) best = { kind: 'wall', dist: t, point: [origin.x + dx * t, origin.y + dy * t, origin.z + dz * t] };
    }
    for (const cop of state.cops) {
      if (!cop.alive) continue;
      const t = raySphere(origin.x, origin.y, origin.z, dx, dy, dz, cop.x, 1.1, cop.z, 0.62);
      if (t < best.dist) best = { kind: 'cop', dist: t, target: cop, point: [origin.x + dx * t, origin.y + dy * t, origin.z + dz * t] };
    }
    for (const ped of peds) {
      if (!ped.alive) continue;
      const t = raySphere(origin.x, origin.y, origin.z, dx, dy, dz, ped.x, 1.05, ped.z, 0.6);
      if (t < best.dist) best = { kind: 'ped', dist: t, target: ped, point: [origin.x + dx * t, origin.y + dy * t, origin.z + dz * t] };
    }
    const cars = [...traffic.cars, ...state.units.map((u) => u.car)];
    if (player.inCar) cars.push(player.inCar.car);
    for (const car of cars) {
      if (car === (player.inCar && player.inCar.car)) continue;
      const t = rayBox(origin.x, origin.y, origin.z, dx, dy, dz, { x: car.x, z: car.z, w: 2.2, d: 4.6, h: 1.7 }, 140);
      if (t < best.dist) best = { kind: car.isPolice ? 'policeCar' : 'car', dist: t, target: car, point: [origin.x + dx * t, origin.y + dy * t, origin.z + dz * t] };
    }
    flash(muzzle);
    tracer(muzzle, best.point);
    if (state.time - state.lastFireCrime > 3.5) {
      state.lastFireCrime = state.time;
      addWanted(1, 'FIRING A WEAPON');
    }
    if (best.kind === 'cop') {
      best.target.health -= 70;
      if (best.target.health <= 0) {
        removeCop(best.target);
        addWanted(1, 'OFFICER DOWN');
      }
    } else if (best.kind === 'ped') {
      best.target.flee = 10;
      best.target.hit = true;
      addWanted(2, 'CIVILIAN HIT');
      traffic.frighten(best.point[0], best.point[2]);
    } else if (best.kind === 'policeCar') {
      best.target.health -= 26;
      if (best.target.health <= 0) {
        best.target.group.rotation.z = 0.12;
        addWanted(1, 'POLICE CAR DISABLED');
      }
    }
    return best;
  }

  function drivePursuit(unit, dt) {
    const car = unit.car;
    const target = player.inCar ? player.inCar.car : player;
    const d = Math.hypot(target.x - car.x, target.z - car.z);
    const desired = Math.atan2(target.x - car.x, target.z - car.z);
    let diff = desired - car.yaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;

    // Look a short way ahead for a wall and steer around it.
    const fx = Math.sin(car.yaw);
    const fz = Math.cos(car.yaw);
    const probeX = car.x + fx * 9;
    const probeZ = car.z + fz * 9;
    let wall = false;
    for (const b of city.colliders) {
      if (probeX > b.x - b.w / 2 - 1.4 && probeX < b.x + b.w / 2 + 1.4 && probeZ > b.z - b.d / 2 - 1.4 && probeZ < b.z + b.d / 2 + 1.4) { wall = true; break; }
    }
    let steer = Math.max(-1, Math.min(1, diff * 1.9));
    if (wall) steer = diff > 0 ? -1 : 1;
    if (unit.reverse > 0) {
      unit.reverse -= dt;
      driveCar(car, { throttle: -1, steer: -steer * 0.7, brake: false, handbrake: false }, dt, city.colliders);
      car.lights.red.color.setHex(0xff2a20);
      return;
    }
    const hit = driveCar(car, {
      throttle: d > 8 ? 1 : d > 4 ? 0.35 : -0.6,
      steer,
      brake: d < 5,
      handbrake: d < 4.5 && Math.abs(car.speed) > 12,
    }, dt, city.colliders);
    if (hit && Math.abs(car.speed) < 1.6) {
      unit.stuck += dt;
      if (unit.stuck > 0.75) { unit.reverse = 0.65; unit.stuck = 0; }
    } else unit.stuck = Math.max(0, unit.stuck - dt * 0.4);
  }

  function updateCop(cop, dt) {
    const d = Math.hypot(player.x - cop.x, player.z - cop.z);
    if (d > 34 && state.wanted > 0) {
      cop.x += (player.x - cop.x) / (d || 1) * cop.speed * dt;
      cop.z += (player.z - cop.z) / (d || 1) * cop.speed * dt;
    } else if (d > 11) {
      cop.x += (player.x - cop.x) / (d || 1) * cop.speed * dt;
      cop.z += (player.z - cop.z) / (d || 1) * cop.speed * dt;
    }
    cop.yaw = Math.atan2(player.x - cop.x, player.z - cop.z);
    cop.timer -= dt;
    if (cop.timer <= 0 && d < 30 && lineClear(cop.x, 1.4, cop.z, player.x, 1.4, player.z)) {
      cop.timer = rng.range(1.15, 1.9);
      flash([cop.x, 1.45, cop.z]);
      tracer([cop.x, 1.45, cop.z], [player.x, 1.2, player.z], 0xffb080);
      const chance = Math.max(0.22, 0.62 - d * 0.015);
      if (rng() < chance && hooks.damage) hooks.damage(rng.range(5, 10), 'police');
    }
    for (const b of city.colliders) {
      const cx = Math.max(b.x - b.w / 2, Math.min(cop.x, b.x + b.w / 2));
      const cz = Math.max(b.z - b.d / 2, Math.min(cop.z, b.z + b.d / 2));
      const dx = cop.x - cx;
      const dz = cop.z - cz;
      if (dx * dx + dz * dz < 0.22) {
        const len = Math.hypot(dx, dz) || 1;
        cop.x = cx + (dx / len) * 0.48;
        cop.z = cz + (dz / len) * 0.48;
      }
    }
    cop.phase += dt * 5;
    cop.model.leftLeg.rotation.x = Math.sin(cop.phase) * 0.6;
    cop.model.rightLeg.rotation.x = -Math.sin(cop.phase) * 0.6;
    cop.model.leftArm.rotation.x = 0.5;
    cop.model.rightArm.rotation.x = -0.2;
    cop.group.position.set(cop.x, 0, cop.z);
    cop.group.rotation.y = cop.yaw;
  }

  function update(dt, time) {
    state.time = time;
    const playerCar = player.inCar ? player.inCar.car : null;
    for (const unit of state.units) {
      if (!unit.active || !unit.spawned || unit.car.occupied) continue;
      if (state.wanted > 0) drivePursuit(unit, dt);
      else if (unit.mode === 'parked' && unit.patrol) {
        // Parked units idle with their lights off.
        unit.car.group.position.set(unit.car.x, 0, unit.car.z);
      }
      if (state.wanted >= 2) {
        const d = distToCar(player, unit.car);
        if (d < 26 && rng() < dt * 0.28) {
          const side = rng.chance(0.5) ? 1 : -1;
          addCop(unit.car.x + Math.cos(unit.car.yaw) * side * 1.6, unit.car.z - Math.sin(unit.car.yaw) * side * 1.6);
        }
      }
      if (playerCar && state.wanted > 0) {
        const d = Math.hypot(playerCar.x - unit.car.x, playerCar.z - unit.car.z);
        if (d < 3.4) {
          const dx = playerCar.x - unit.car.x;
          const dz = playerCar.z - unit.car.z;
          const len = Math.hypot(dx, dz) || 1;
          playerCar.x += (dx / len) * 1.2;
          playerCar.z += (dz / len) * 1.2;
          unit.car.x -= (dx / len) * 1.2;
          unit.car.z -= (dz / len) * 1.2;
          if (Math.abs(playerCar.speed) > 5 && state.ramCooldown <= 0) {
            addWanted(1, 'POLICE CAR RAMMED');
            state.ramCooldown = 3;
          }
        }
      }
    }
    state.ramCooldown = Math.max(0, state.ramCooldown - dt);
    for (const cop of state.cops) if (cop.alive) updateCop(cop, dt);
    for (let i = state.tracers.length - 1; i >= 0; i -= 1) {
      const t = state.tracers[i];
      t.life -= dt;
      t.line.material.opacity = Math.max(0, t.life / 0.075);
      if (t.life <= 0) {
        scene.remove(t.line);
        t.line.geometry.dispose();
        t.line.material.dispose();
        state.tracers.splice(i, 1);
      }
    }
    for (let i = state.flashes.length - 1; i >= 0; i -= 1) {
      const f = state.flashes[i];
      f.life -= dt;
      f.light.intensity = Math.max(0, f.life / 0.06) * 6;
      if (f.life <= 0) {
        scene.remove(f.mesh);
        scene.remove(f.light);
        state.flashes.splice(i, 1);
      }
    }
    if (state.wanted > 0 && time - state.lastCrime > WANTED.decayAfter) {
      let nearest = Infinity;
      for (const unit of state.units) if (unit.spawned) nearest = Math.min(nearest, distToCar(player, unit.car));
      for (const cop of state.cops) if (cop.alive) nearest = Math.min(nearest, Math.hypot(player.x - cop.x, player.z - cop.z));
      if (nearest > 48) {
        state.decayTimer -= dt;
        if (state.decayTimer <= 0) {
          state.wanted -= 1;
          state.decayTimer = WANTED.decayStep;
          if (state.wanted <= 0) clearWanted();
          else if (hooks.toast) hooks.toast(state.wanted === 0 ? 'YOU LOST THE POLICE' : 'HEAT COOLING');
        }
      } else state.decayTimer = WANTED.decayStep;
    }
  }

  function stageChase(count = 3, level = 3) {
    setWanted(level);
    for (let i = 0; i < count; i += 1) {
      const unit = state.units[i];
      unit.active = true;
      unit.spawned = true;
      unit.car.group.visible = true;
      unit.mode = 'chase';
      placeCar(unit.car, player.x + 12 + i * 9, player.z + (i % 2 ? 4 : -2), player.yaw + Math.PI);
    }
    for (const unit of state.units) {
      if (unit.car.group.visible) unit.car.lightPhase = 0;
    }
  }

  function onSteal(car) {
    let seen = false;
    for (const unit of state.units) if (unit.spawned && Math.hypot(unit.car.x - car.x, unit.car.z - car.z) < 75) seen = true;
    if (seen) addWanted(1, 'GRAND THEFT AUTO');
  }

  return { state, units: state.units, cops: state.cops, addWanted, clearWanted, setWanted, playerShoot, onSteal, update, stageChase, addCop, lineClear, tracer };
}
