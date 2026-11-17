// Cars: a shared box-and-cylinder model in four flavours, arcade driving with engine force,
// steering, lateral grip and handbrake, building collision, and the visual bits the traffic and
// police systems need (wheels, brake lights, flashing roof bars).
// Handling stays loose and forgiving rather than physically correct.

import { CAR } from './config.js';

const box = new THREE.BoxGeometry(1, 1, 1);
const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.26, 10);
const shadowGeo = new THREE.CircleGeometry(1, 18);
const materialCache = new Map();

function carMat(color, metalness = 0.35, roughness = 0.38) {
  const key = `${color}:${metalness}:${roughness}`;
  if (!materialCache.has(key)) materialCache.set(key, new THREE.MeshStandardMaterial({ color, metalness, roughness }));
  return materialCache.get(key);
}
const glassMat = new THREE.MeshStandardMaterial({ color: 0x18313a, metalness: 0.5, roughness: 0.18 });
const tireMat = new THREE.MeshStandardMaterial({ color: 0x14171b, roughness: 0.9 });
const rimMat = new THREE.MeshStandardMaterial({ color: 0x9aa1a5, metalness: 0.8, roughness: 0.3 });
const headMat = new THREE.MeshBasicMaterial({ color: 0xfff1c4, toneMapped: false });
const tailMat = new THREE.MeshBasicMaterial({ color: 0xa82019, toneMapped: false });
const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false });

function addMesh(group, material, x, y, z, sx, sy, sz) {
  const mesh = new THREE.Mesh(box, material);
  mesh.position.set(x, y, z);
  mesh.scale.set(sx, sy, sz);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

const KINDS = {
  sedan: { w: 1.92, l: 4.35, body: 0.58, cabin: 0.58, cabinL: 2.1, cabZ: -0.15, speed: 1 },
  coupe: { w: 1.98, l: 4.1, body: 0.5, cabin: 0.5, cabinL: 1.7, cabZ: -0.35, speed: 1.12 },
  van: { w: 2.12, l: 5.1, body: 0.8, cabin: 0.9, cabinL: 3.4, cabZ: 0.1, speed: 0.82 },
  police: { w: 1.95, l: 4.5, body: 0.58, cabin: 0.6, cabinL: 2.0, cabZ: -0.12, speed: 1.06 },
};

export function createCar(scene, kind = 'sedan', color = 0xd34f3f) {
  const spec = KINDS[kind] || KINDS.sedan;
  const group = new THREE.Group();
  const body = carMat(color);
  addMesh(group, body, 0, 0.58, 0, spec.w, spec.body, spec.l);
  addMesh(group, body, 0, 0.88, spec.l / 2 - 0.42, spec.w * 0.94, 0.22, 0.9);
  addMesh(group, body, 0, 0.86, -spec.l / 2 + 0.38, spec.w * 0.94, 0.2, 0.82);
  const cabin = addMesh(group, glassMat, 0, 0.58 + spec.body / 2 + spec.cabin / 2 - 0.02, spec.cabZ, spec.w * 0.82, spec.cabin, spec.cabinL);
  addMesh(group, body, 0, 0.58 + spec.body / 2 + spec.cabin + 0.02, spec.cabZ, spec.w * 0.8, 0.09, spec.cabinL * 0.92);
  if (kind === 'police') {
    addMesh(group, carMat(0x10161d, 0.2, 0.5), 0, 0.61, 0, spec.w + 0.025, 0.2, spec.l * 0.96);
    addMesh(group, carMat(0xeff0ec, 0.1, 0.6), 0, 0.75, 0.2, spec.w + 0.03, 0.24, 1.3);
  }
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const wheel = new THREE.Mesh(wheelGeo, tireMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(sx * (spec.w / 2 - 0.02), 0.36, sz * (spec.l * 0.31));
      wheel.castShadow = true;
      group.add(wheel);
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.28, 8), rimMat);
      rim.rotation.z = Math.PI / 2;
      rim.position.copy(wheel.position);
      group.add(rim);
    }
    addMesh(group, headMat, sx * 0.56, 0.63, spec.l / 2 + 0.02, 0.34, 0.18, 0.08);
    addMesh(group, tailMat, sx * 0.56, 0.66, -spec.l / 2 - 0.02, 0.34, 0.16, 0.08);
  }
  addMesh(group, headMat, 0, 0.42, spec.l / 2 + 0.02, 0.7, 0.06, 0.06);
  const contact = new THREE.Mesh(shadowGeo, shadowMat);
  contact.rotation.x = -Math.PI / 2;
  contact.position.y = 0.035;
  contact.scale.set(spec.w * 0.62, spec.l * 0.55, 1);
  group.add(contact);

  const lights = { red: null, blue: null };
  if (kind === 'police') {
    lights.red = new THREE.MeshBasicMaterial({ color: 0xff2a20, toneMapped: false });
    lights.blue = new THREE.MeshBasicMaterial({ color: 0x2a8cff, toneMapped: false });
    const barY = 0.58 + spec.body / 2 + spec.cabin + 0.16;
    addMesh(group, lights.red, -0.42, barY, spec.cabZ, 0.7, 0.18, 0.32);
    addMesh(group, lights.blue, 0.42, barY, spec.cabZ, 0.7, 0.18, 0.32);
    addMesh(group, carMat(0x1b2026, 0.4, 0.4), 0, barY + 0.02, spec.cabZ, 0.24, 0.22, 0.38);
  }
  group.position.set(0, 0, 0);
  scene.add(group);

  return {
    x: 0, z: 0, yaw: 0, vx: 0, vz: 0, speed: 0, group, kind, spec, lights,
    color, health: 100, occupied: false, isPolice: kind === 'police', wheelPhase: 0, reverse: false,
    lightPhase: 0,
  };
}

export function placeCar(car, x, z, yaw) {
  car.x = x;
  car.z = z;
  car.yaw = yaw;
  car.vx = 0;
  car.vz = 0;
  car.speed = 0;
  car.group.position.set(x, 0, z);
  car.group.rotation.y = yaw;
}

function collideCar(car, colliders, radius) {
  let hit = false;
  for (const b of colliders) {
    const minX = b.x - b.w / 2;
    const maxX = b.x + b.w / 2;
    const minZ = b.z - b.d / 2;
    const maxZ = b.z + b.d / 2;
    if (car.x + radius < minX || car.x - radius > maxX || car.z + radius < minZ || car.z - radius > maxZ) continue;
    const cx = Math.max(minX, Math.min(car.x, maxX));
    const cz = Math.max(minZ, Math.min(car.z, maxZ));
    let dx = car.x - cx;
    let dz = car.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= radius * radius) continue;
    hit = true;
    if (d2 > 1e-8) {
      const d = Math.sqrt(d2);
      car.x = cx + (dx / d) * radius;
      car.z = cz + (dz / d) * radius;
    } else {
      const left = car.x - minX;
      const right = maxX - car.x;
      const up = car.z - minZ;
      const down = maxZ - car.z;
      const m = Math.min(left, right, up, down);
      if (m === left) car.x = minX - radius;
      else if (m === right) car.x = maxX + radius;
      else if (m === up) car.z = minZ - radius;
      else car.z = maxZ + radius;
    }
    car.vx *= 0.35;
    car.vz *= 0.35;
  }
  return hit;
}

/**
 * One arcade physics step. controls: {throttle -1..1, steer -1..1, brake, handbrake}.
 * Returns true when the car scraped a building this step.
 */
export function driveCar(car, controls, dt, colliders, limits = null) {
  const spec = car.spec;
  const fx = Math.sin(car.yaw);
  const fz = Math.cos(car.yaw);
  const rx = -Math.cos(car.yaw);
  const rz = Math.sin(car.yaw);
  let vf = car.vx * fx + car.vz * fz;
  let vl = car.vx * rx + car.vz * rz;
  const maxSpeed = CAR.maxSpeed * spec.speed;
  const reverseMax = CAR.reverse * 0.8;
  const throttle = controls.throttle || 0;
  if (throttle > 0) vf += CAR.engine * spec.speed * throttle * dt;
  else if (throttle < 0) {
    if (vf > 0.4) vf -= CAR.brake * dt;
    else vf += CAR.engine * spec.speed * 0.6 * throttle * dt;
  }
  if (controls.brake) vf -= Math.sign(vf) * CAR.brake * dt * (Math.abs(vf) > 0.3 ? 1 : 0);
  if (controls.handbrake) vf *= Math.exp(-1.4 * dt);
  vf -= vf * CAR.drag * dt;
  vf = Math.max(-reverseMax, Math.min(maxSpeed, vf));

  const authority = Math.min(1, Math.abs(vf) / 5) * (1 - 0.3 * Math.min(1, Math.abs(vf) / maxSpeed));
  car.yaw += (controls.steer || 0) * CAR.steer * spec.speed * dt * authority * Math.sign(vf || 1);
  const grip = controls.handbrake ? CAR.handbrakeGrip : CAR.grip;
  vl *= Math.exp(-grip * dt);
  const nfx = Math.sin(car.yaw);
  const nfz = Math.cos(car.yaw);
  const nrx = -Math.cos(car.yaw);
  const nrz = Math.sin(car.yaw);
  car.vx = nfx * vf + nrx * vl;
  car.vz = nfz * vf + nrz * vl;
  car.x += car.vx * dt;
  car.z += car.vz * dt;
  car.speed = vf;
  car.reverse = vf < -0.2;

  let hit = collideCar(car, colliders, CAR.radius);
  const zLimit = limits ? limits.zMax : 198;
  if (car.z > zLimit) { car.z = zLimit; car.vz = Math.min(0, car.vz); car.speed *= 0.5; hit = true; }
  if (car.z < -154) { car.z = -154; car.vz = Math.max(0, car.vz); car.speed *= 0.5; hit = true; }
  if (car.x > 154) { car.x = 154; car.vx = Math.min(0, car.vx); car.speed *= 0.5; hit = true; }
  if (car.x < -154) { car.x = -154; car.vx = Math.max(0, car.vx); car.speed *= 0.5; hit = true; }
  if (hit) car.speed *= 0.72;
  car.group.position.set(car.x, 0, car.z);
  car.group.rotation.y = car.yaw;
  car.wheelPhase += Math.abs(vf) * dt;
  if (car.lights.red) {
    car.lightPhase += dt;
    const on = Math.floor(car.lightPhase * 8) % 2 === 0;
    car.lights.red.color.setHex(on ? 0xff2a20 : 0x3a0805);
    car.lights.blue.color.setHex(on ? 0x1a2450 : 0x2a8cff);
  }
  return hit;
}

export function nearestCar(cars, x, z, maxDistance) {
  let best = null;
  let bestD = maxDistance;
  for (const car of cars) {
    if (car.occupied || car.health <= 0) continue;
    const d = Math.hypot(car.x - x, car.z - z);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}
