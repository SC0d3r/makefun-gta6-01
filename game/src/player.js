// The player on foot: a simple box character with swinging limbs, camera-relative walking,
// sprinting and jumping, circle-versus-box building collision, sea and dock limits, and a soft
// contact shadow. The same character builder dresses pedestrians in traffic.js.

import { PLAYER, WORLD } from './config.js';

const box = new THREE.BoxGeometry(1, 1, 1);
const headGeo = new THREE.BoxGeometry(0.34, 0.38, 0.3);
const shadowGeo = new THREE.CircleGeometry(0.55, 16);

function piece(parent, material, x, y, z, sx, sy, sz) {
  const mesh = new THREE.Mesh(box, material);
  mesh.position.set(x, y, z);
  mesh.scale.set(sx, sy, sz);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

export function createHuman(colors = {}) {
  const skin = new THREE.MeshStandardMaterial({ color: colors.skin ?? 0xc98e68, roughness: 0.8 });
  const shirt = new THREE.MeshStandardMaterial({ color: colors.shirt ?? 0xe8765f, roughness: 0.84 });
  const pants = new THREE.MeshStandardMaterial({ color: colors.pants ?? 0x232b34, roughness: 0.9 });
  const shoes = new THREE.MeshStandardMaterial({ color: colors.shoes ?? 0x171b20, roughness: 0.8 });
  const hair = new THREE.MeshStandardMaterial({ color: colors.hair ?? 0x241a14, roughness: 0.9 });
  const group = new THREE.Group();
  const torso = piece(group, shirt, 0, 1.2, 0, 0.58, 0.72, 0.34);
  piece(group, pants, 0, 0.82, 0, 0.48, 0.22, 0.3);
  const head = new THREE.Mesh(headGeo, skin);
  head.position.set(0, 1.76, 0);
  head.castShadow = true;
  group.add(head);
  piece(group, hair, 0, 1.94, -0.02, 0.36, 0.12, 0.32);
  if (colors.hair !== null) piece(group, hair, 0, 1.8, -0.15, 0.36, 0.26, 0.06);

  function limb(x, y, w, h, d, material) {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    const mesh = new THREE.Mesh(box, material);
    mesh.position.y = -h / 2;
    mesh.scale.set(w, h, d);
    mesh.castShadow = true;
    pivot.add(mesh);
    group.add(pivot);
    return pivot;
  }
  const leftArm = limb(-0.4, 1.48, 0.16, 0.6, 0.18, shirt);
  const rightArm = limb(0.4, 1.48, 0.16, 0.6, 0.18, shirt);
  const leftLeg = limb(-0.16, 0.86, 0.2, 0.84, 0.22, pants);
  const rightLeg = limb(0.16, 0.86, 0.2, 0.84, 0.22, pants);
  piece(leftLeg, shoes, 0, -0.86, 0.05, 0.21, 0.12, 0.3);
  piece(rightLeg, shoes, 0, -0.86, 0.05, 0.21, 0.12, 0.3);
  piece(rightArm, skin, 0, -0.63, 0, 0.15, 0.16, 0.17);
  const gun = new THREE.Mesh(box, new THREE.MeshStandardMaterial({ color: 0x2a2e33, roughness: 0.4, metalness: 0.7 }));
  gun.position.set(0, -0.72, 0.18);
  gun.scale.set(0.1, 0.12, 0.34);
  rightArm.add(gun);
  return { group, torso, head, leftArm, rightArm, leftLeg, rightLeg, gun };
}

function resolveCircle(pos, radius, colliders) {
  for (const b of colliders) {
    const minX = b.x - b.w / 2;
    const maxX = b.x + b.w / 2;
    const minZ = b.z - b.d / 2;
    const maxZ = b.z + b.d / 2;
    if (pos.x + radius < minX || pos.x - radius > maxX || pos.z + radius < minZ || pos.z - radius > maxZ) continue;
    const cx = Math.max(minX, Math.min(pos.x, maxX));
    const cz = Math.max(minZ, Math.min(pos.z, maxZ));
    let dx = pos.x - cx;
    let dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= radius * radius) continue;
    if (d2 > 1e-8) {
      const d = Math.sqrt(d2);
      pos.x = cx + (dx / d) * radius;
      pos.z = cz + (dz / d) * radius;
    } else {
      const left = pos.x - minX;
      const right = maxX - pos.x;
      const up = pos.z - minZ;
      const down = maxZ - pos.z;
      const m = Math.min(left, right, up, down);
      if (m === left) pos.x = minX - radius;
      else if (m === right) pos.x = maxX + radius;
      else if (m === up) pos.z = minZ - radius;
      else pos.z = maxZ + radius;
    }
  }
}

function onMarina(x, z) {
  return x > 51 && x < 127 && z > 198 && z < 237;
}

// The player walks on sand and on the promenade slab; a shadow or a pair of feet
// pinned to y 0 sits inside the slab.
function groundAt(x, z) {
  if (onMarina(x, z)) return 0.42;
  const ax = Math.abs(x - Math.round(x / 60) * 60);
  const az = Math.abs(z - Math.round(z / 60) * 60);
  const edge = Math.max(ax, az);
  return edge > 20 && edge < 23 ? 0.22 : 0;
}

export function createPlayer(scene, start, colliders) {
  const model = createHuman({ shirt: 0x8f3b2e, pants: 0x242d38, hair: 0x1d1712, skin: 0xb97f5c });
  scene.add(model.group);
  const shadow = new THREE.Mesh(shadowGeo, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.035;
  scene.add(shadow);
  const player = {
    x: start.x, z: start.z, y: 0, vy: 0, yaw: start.yaw,
    vx: 0, vz: 0, speed: 0, onGround: true, phase: 0, fireTime: 0,
    group: model.group, model, shadow, alive: true, inCar: null,
  };

  function update(dt, input, camYaw, physicsOn = true, jumpPressed = false) {
    if (player.inCar) {
      player.group.visible = false;
      shadow.visible = false;
      player.x = player.inCar.car.x;
      player.z = player.inCar.car.z;
      player.y = 0.1;
      return;
    }
    player.group.visible = true;
    shadow.visible = true;
    const move = physicsOn ? input.move() : { forward: 0, strafe: 0, sprint: false };
    const fx = Math.sin(camYaw);
    const fz = Math.cos(camYaw);
    const rx = -Math.cos(camYaw);
    const rz = Math.sin(camYaw);
    let mx = fx * move.forward + rx * move.strafe;
    let mz = fz * move.forward + rz * move.strafe;
    const len = Math.hypot(mx, mz);
    if (len > 0.001) { mx /= len; mz /= len; }
    const top = move.sprint ? PLAYER.sprint : PLAYER.walk;
    const targetX = mx * top;
    const targetZ = mz * top;
    const k = Math.min(1, dt * (len > 0.01 ? 11 : 8));
    player.vx += (targetX - player.vx) * k;
    player.vz += (targetZ - player.vz) * k;
    player.speed = Math.hypot(player.vx, player.vz);
    player.x += player.vx * dt;
    player.z += player.vz * dt;

    resolveCircle(player, PLAYER.radius, colliders);
    if (player.z > WORLD.seaStart - 0.8 && !onMarina(player.x, player.z)) {
      player.z = WORLD.seaStart - 0.8;
      player.vz = Math.min(0, player.vz);
    }
    player.x = Math.max(WORLD.xMin, Math.min(WORLD.xMax, player.x));
    player.z = Math.max(WORLD.zMin, Math.min(WORLD.zMax, player.z));

    if (physicsOn && input.move().forward === 0 && input.move().strafe === 0) {
      // Idle drift stays, but never creeps.
      if (Math.abs(player.vx) < 0.02) player.vx = 0;
      if (Math.abs(player.vz) < 0.02) player.vz = 0;
    }

    const groundY = groundAt(player.x, player.z);
    if (physicsOn && player.onGround && jumpPressed) {
      player.vy = PLAYER.jump;
      player.onGround = false;
    }
    player.y += player.vy * dt;
    player.vy -= PLAYER.gravity * dt;
    if (player.y <= groundY) {
      player.y = groundY;
      player.vy = 0;
      player.onGround = true;
    }
    if (player.speed > 0.1) {
      const want = Math.atan2(player.vx, player.vz);
      let diff = want - player.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      player.yaw += diff * Math.min(1, dt * 12);
    }
    player.phase += dt * (2.2 + player.speed * 1.75);
    const gait = Math.min(1, player.speed / 3.2);
    const swing = Math.sin(player.phase) * 0.55 * gait;
    model.leftLeg.rotation.x = swing;
    model.rightLeg.rotation.x = -swing;
    model.leftArm.rotation.x = -swing * 0.8;
    model.rightArm.rotation.x = swing * 0.65;
    model.torso.rotation.z = Math.sin(player.phase * 0.5) * 0.04 * gait;
    const bob = player.onGround ? Math.abs(Math.sin(player.phase)) * 0.04 * gait : 0;
    player.group.position.set(player.x, player.y + bob, player.z);
    player.group.rotation.y = player.yaw;
    shadow.position.set(player.x, groundY + 0.035, player.z);
    shadow.scale.setScalar(1 - player.y * 0.18);
    shadow.material.opacity = 0.3 - player.y * 0.1;
  }

  function snap(startPos) {
    player.x = startPos.x;
    player.z = startPos.z;
    player.y = groundAt(player.x, player.z);
    player.vx = 0;
    player.vz = 0;
    player.vy = 0;
    player.yaw = startPos.yaw ?? player.yaw;
    player.group.position.set(player.x, player.y, player.z);
    player.group.rotation.y = player.yaw;
    shadow.position.set(player.x, player.y + 0.035, player.z);
  }

  player.update = update;
  player.snap = snap;
  return player;
}
