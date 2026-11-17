// VELA CITY's layout and geometry: a seeded 5 by 5 block grid, instanced buildings, window strips,
// awnings, lamps, palms, beach, marina and sea. The same call with the same seeded rng always builds
// the same city. Returns pure data (colliders, mission points, traffic routes, signals) for the
// simulation modules as well as the meshes.

import { GRID, WORLD, COLORS } from './config.js';

const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 8);
const coneGeo = new THREE.ConeGeometry(1, 1, 4);
const sphereGeo = new THREE.SphereGeometry(1, 8, 6);

function standard(color, roughness = 0.8, metalness = 0.0, emissive = 0x000000, emissiveIntensity = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, emissive, emissiveIntensity });
}

function instanced(scene, geometry, material, items, castShadow = true, receiveShadow = true) {
  const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, items.length));
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  for (let i = 0; i < items.length; i += 1) {
    const it = items[i];
    dummy.position.set(it.x, it.y, it.z);
    dummy.rotation.set(it.rx || 0, it.ry || 0, it.rz || 0);
    dummy.scale.set(it.sx ?? 1, it.sy ?? 1, it.sz ?? 1);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    if (it.c !== undefined) mesh.setColorAt(i, color.set(it.c));
  }
  mesh.count = items.length;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  scene.add(mesh);
  return mesh;
}

function signalStateAt(axis, time) {
  const t = ((time % 20) + 20) % 20;
  const green = axis === 'x' ? (t >= 0.4 && t < 8.2) : (t >= 10.4 && t < 18.2);
  const amber = axis === 'x' ? (t >= 8.2 && t < 9.6) : (t >= 18.2 && t < 19.6);
  return green ? 1 : amber ? 2 : 0;
}

function seaMesh(scene) {
  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      time: { value: 0 },
      sunDir: { value: new THREE.Vector3(-0.66, 0.22, 0.72).normalize() },
    },
  ]);
  const material = new THREE.ShaderMaterial({
    uniforms,
    fog: true,
    vertexShader: `
      uniform float time;
      varying vec3 vWorld;
      varying float vWave;
      #include <fog_pars_vertex>
      void main() {
        vec3 p = position;
        float a = sin(p.x * 0.15 + time * 1.15);
        float b = sin(p.y * 0.21 - time * 0.85);
        vWave = a * 0.10 + b * 0.07;
        p.z += vWave;
        vec4 world = modelMatrix * vec4(p, 1.0);
        vWorld = world.xyz;
        vec4 mvPosition = viewMatrix * world;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      uniform float time;
      uniform vec3 sunDir;
      varying vec3 vWorld;
      varying float vWave;
      #include <fog_pars_fragment>
      void main() {
        vec3 view = normalize(cameraPosition - vWorld);
        vec3 n = normalize(vec3(
          sin(vWorld.x * 0.24 + time * 0.9) * 0.10,
          1.0,
          cos(vWorld.z * 0.18 - time * 0.7) * 0.10));
        float fres = pow(1.0 - max(dot(n, view), 0.0), 2.0);
        vec3 deep = vec3(0.025, 0.22, 0.31);
        vec3 shallow = vec3(0.10, 0.47, 0.53);
        vec3 col = mix(deep, shallow, clamp(0.42 + vWave * 2.2, 0.0, 1.0));
        col = mix(col, vec3(0.62, 0.79, 0.74), fres * 0.34);
        vec3 h = normalize(normalize(sunDir) + view);
        float spec = pow(max(dot(n, h), 0.0), 110.0);
        col += vec3(1.0, 0.70, 0.36) * spec * 2.4;
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1700, 1200, 90, 60), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(0, -0.22, 780);
  mesh.receiveShadow = false;
  scene.add(mesh);
  return mesh;
}

function ring(minX, maxX, minZ, maxZ, r = 6) {
  return [
    { x: minX + r, z: minZ }, { x: maxX - r, z: minZ }, { x: maxX, z: minZ + r },
    { x: maxX, z: maxZ - r }, { x: maxX - r, z: maxZ }, { x: minX + r, z: maxZ },
    { x: minX, z: maxZ - r }, { x: minX, z: minZ + r },
  ];
}

export function createCity(scene, rng) {
  const colliders = [];
  const buildings = [];
  const windows = [];
  const glassWindows = [];
  const roofItems = [];
  const awningItems = [];
  const neonItems = [];
  const sidewalkItems = [];
  const curbItems = [];
  const dashItems = [];
  const crosswalkItems = [];
  const lampPoles = [];
  const lampHeads = [];
  const trunkItems = [];
  const frondItems = [];
  const umbrellaItems = [];
  const umbrellaPoles = [];
  const loungerItems = [];
  const dockItems = [];
  const dockPostItems = [];
  const poleItems = [];

  const baseMat = standard(0xffffff, 0.88, 0.02);
  const glassMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const roofMat = standard(0x8c8578, 0.92);
  const awningMat = standard(0xffffff, 0.72);
  const neonMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const curbMat = standard(COLORS.curb, 0.94);
  const sidewalkMat = standard(0xffffff, 0.92, 0);
  const dashMat = standard(0xe8dfcc, 0.78);
  const crossMat = standard(0xf0e6d2, 0.76);
  const metalMat = standard(0x2e353a, 0.55, 0.45);
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffdba6, toneMapped: false });
  const trunkMat = standard(COLORS.trunk, 0.94);
  const frondMat = standard(0xffffff, 0.86);
  const umbrellaMat = standard(0xffffff, 0.7);
  const clothMat = standard(0xffffff, 0.85);
  const dockMat = standard(0x8a6440, 0.94);
  const postMat = standard(0x5b412b, 0.95);

  // Ground, beach, sea, hills and the promenade.
  const asphalt = new THREE.Mesh(new THREE.PlaneGeometry(340, 340), standard(COLORS.asphalt, 0.96));
  asphalt.rotation.x = -Math.PI / 2;
  asphalt.receiveShadow = true;
  scene.add(asphalt);

  const sand = new THREE.Mesh(new THREE.PlaneGeometry(460, 48), standard(COLORS.sand, 0.98));
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.05, 180);
  sand.receiveShadow = true;
  scene.add(sand);

  const promenade = new THREE.Mesh(new THREE.BoxGeometry(460, 0.2, 5), standard(COLORS.sidewalk, 0.9));
  promenade.position.set(0, 0.1, 159.5);
  promenade.receiveShadow = true;
  scene.add(promenade);

  const foam = new THREE.Mesh(new THREE.PlaneGeometry(460, 3.2), new THREE.MeshBasicMaterial({ color: 0xd8f2e9, transparent: true, opacity: 0.5 }));
  foam.rotation.x = -Math.PI / 2;
  foam.position.set(0, 0.04, 199.4);
  scene.add(foam);

  const sea = seaMesh(scene);

  const hillMat = new THREE.MeshStandardMaterial({ color: COLORS.hill, roughness: 1, flatShading: true });
  for (let i = 0; i < 7; i += 1) {
    const hill = new THREE.Mesh(new THREE.ConeGeometry(rng.range(58, 120), rng.range(26, 54), 7), hillMat);
    hill.position.set(-270 + i * 90 + rng.range(-18, 18), -3, -285 - rng.range(0, 60));
    hill.rotation.y = rng.range(0, Math.PI);
    scene.add(hill);
  }
  const villaMat = standard(0xf1e8d6, 0.85);
  const roofTileMat = standard(0xb86f50, 0.9);
  for (let i = 0; i < 9; i += 1) {
    const vx = -190 + i * 47 + rng.range(-8, 8);
    const vz = -196 - rng.range(0, 16);
    const villa = new THREE.Mesh(boxGeo, villaMat);
    villa.position.set(vx, 3.2, vz);
    villa.scale.set(rng.range(9, 14), 6.4, rng.range(7, 11));
    villa.castShadow = true;
    villa.receiveShadow = true;
    scene.add(villa);
    const roof = new THREE.Mesh(boxGeo, roofTileMat);
    roof.position.set(vx, 6.8, vz);
    roof.scale.set(villa.scale.x + 1.4, 0.7, villa.scale.z + 1.4);
    roof.castShadow = true;
    scene.add(roof);
  }

  // A block's sidewalk slab and curb frame.
  for (const cx of GRID.centers) {
    for (const cz of GRID.centers) {
      sidewalkItems.push({
        x: cx, y: 0.11, z: cz, sx: GRID.block, sy: 0.22, sz: GRID.block,
        c: iMod(cx, cz) ? 0xd8cdb7 : 0xcfc4ae,
      });
      for (const side of [-1, 1]) {
        curbItems.push({ x: cx, y: 0.16, z: cz + side * 23, sx: 46.5, sy: 0.32, sz: 0.32, c: 0xb7a98f });
        curbItems.push({ x: cx + side * 23, y: 0.16, z: cz, sx: 0.32, sy: 0.32, sz: 46.5, c: 0xb7a98f });
      }
    }
  }

  // Road markings: dashed centre lines and crosswalks at every intersection.
  for (const road of GRID.roads) {
    for (let p = -148; p <= 148; p += 7.2) {
      dashItems.push({ x: p, y: 0.025, z: road, sx: 3.4, sy: 0.03, sz: 0.16, c: 0xded3bd });
      dashItems.push({ x: road, y: 0.025, z: p, sx: 0.16, sy: 0.03, sz: 3.4, c: 0xded3bd });
    }
  }
  const intersections = [];
  for (const x of GRID.roads) {
    for (const z of GRID.roads) {
      intersections.push({ x, z });
      for (let b = -5; b <= 5; b += 2.3) {
        crosswalkItems.push({ x: x + b, y: 0.03, z: z - 10, sx: 1.15, sy: 0.035, sz: 3.2, c: 0xe9dfc8 });
        crosswalkItems.push({ x: x + b, y: 0.03, z: z + 10, sx: 1.15, sy: 0.035, sz: 3.2, c: 0xe9dfc8 });
        crosswalkItems.push({ x: x - 10, y: 0.03, z: z + b, sx: 3.2, sy: 0.035, sz: 1.15, c: 0xe9dfc8 });
        crosswalkItems.push({ x: x + 10, y: 0.03, z: z + b, sx: 3.2, sy: 0.035, sz: 1.15, c: 0xe9dfc8 });
      }
    }
  }

  // Buildings. Downtown blocks hold one glass tower on a podium; elsewhere one or two low-rises.
  for (let ix = 0; ix < GRID.n; ix += 1) {
    for (let iz = 0; iz < GRID.n; iz += 1) {
      const cx = GRID.centers[ix];
      const cz = GRID.centers[iz];
      const downtown = ix >= 2 && ix <= 3 && iz >= 1 && iz <= 2;
      if (downtown) {
        const podW = rng.range(32, 37);
        const podD = rng.range(32, 37);
        const podH = rng.range(6, 9);
        addBuilding(cx, cz, podW, podD, podH, rng.pick([COLORS.cream, COLORS.sandBuilding, COLORS.white]), false);
        const w = rng.range(21, 27);
        const d = rng.range(21, 27);
        const h = rng.range(46, 88);
        addBuilding(cx + rng.range(-2.5, 2.5), cz + rng.range(-2.5, 2.5), w, d, h + podH, 0x9fc8ca, true, podH);
      } else {
        const two = rng.chance(0.58);
        const color = rng.pick([COLORS.cream, COLORS.coral, COLORS.sandBuilding, COLORS.white, 0xd7b9a1]);
        if (two) {
          const w1 = rng.range(14, 18);
          const w2 = rng.range(14, 18);
          const d1 = rng.range(23, 31);
          const d2 = rng.range(23, 31);
          addBuilding(cx - 10.4, cz + rng.range(-2, 2), w1, d1, rng.range(7, 18), color, false);
          addBuilding(cx + 10.4, cz + rng.range(-2, 2), w2, d2, rng.range(7, 21), rng.pick([COLORS.cream, COLORS.coral, COLORS.white]), false);
        } else {
          const w = rng.range(24, 32);
          const d = rng.range(24, 32);
          addBuilding(cx + rng.range(-2, 2), cz + rng.range(-2, 2), w, d, rng.range(8, 23), color, false);
        }
      }
    }
  }

  function addBuilding(x, z, w, d, h, color, glass, baseY = 0) {
    buildings.push({ x, z, w, d, h, color, glass, baseY });
    colliders.push({ x, z, w, d, h: baseY + h });
    const floors = Math.max(1, Math.floor((h - 3) / 3.1));
    const panes = glass ? [0x2b6d7b, 0x3a8790, 0x215360, 0x63a9ab] : [0x1e4854, 0x2b5f6b, 0x173b46, 0x3d7780];
    for (let f = 0; f < floors; f += 1) {
      const wy = baseY + 3.3 + f * 3.1;
      if (wy > baseY + h - 1.2) break;
      const wh = glass ? 1.9 : 1.25;
      for (let side = 0; side < 4; side += 1) {
        const along = side < 2 ? d - 2.2 : w - 2.2;
        const count = Math.max(2, Math.floor(along / (glass ? 2.5 : 2.9)));
        const step = along / count;
        const span = Math.min(glass ? 1.9 : 1.55, step * 0.62);
        for (let k = 0; k < count; k += 1) {
          const o = -along / 2 + step * (k + 0.5);
          const c = rng.chance(glass ? 0.07 : 0.16) ? 0xffcf92 : panes[(f + k + side) % panes.length];
          if (side === 0) windows.push({ x: x + w / 2 + 0.06, y: wy, z: z + o, sx: 0.1, sy: wh, sz: span, c });
          else if (side === 1) windows.push({ x: x - w / 2 - 0.06, y: wy, z: z + o, sx: 0.1, sy: wh, sz: span, c });
          else if (side === 2) windows.push({ x: x + o, y: wy, z: z + d / 2 + 0.06, sx: span, sy: wh, sz: 0.1, c });
          else windows.push({ x: x + o, y: wy, z: z - d / 2 - 0.06, sx: span, sy: wh, sz: 0.1, c });
        }
      }
    }
    roofItems.push({ x, y: baseY + h + 0.18, z, sx: w + 0.5, sy: 0.35, sz: d + 0.5, c: glass ? 0x6c9494 : 0x8c7b65 });
    const acs = rng.int(1, 3);
    for (let a = 0; a < acs; a += 1) {
      roofItems.push({
        x: x + rng.range(-w / 2 + 3, w / 2 - 3), y: baseY + h + 0.7, z: z + rng.range(-d / 2 + 3, d / 2 - 3),
        sx: rng.range(1.2, 2.8), sy: rng.range(0.6, 1.3), sz: rng.range(1.2, 2.5), c: 0x77776f, ry: rng.range(0, 3.14),
      });
    }
    if (glass) {
      roofItems.push({ x, y: baseY + h + 2.2, z, sx: 0.18, sy: 4.4, sz: 0.18, c: 0x8d958d });
      roofItems.push({ x, y: baseY + h + 4.3, z, sx: 0.55, sy: 0.35, sz: 0.55, c: 0xff4f5a });
    }
    if (!glass) {
      const sides = [0, 1, 2, 3];
      const side = sides[rng.int(0, 3)];
      const aw = rng.range(6, Math.max(7, w - 6));
      const col = rng.pick([COLORS.neonPink, COLORS.coral, COLORS.neonCyan, 0xffb04a]);
      if (side === 0) awningItems.push({ x: x + w / 2 + 0.9, y: 3.45, z, sx: 1.8, sy: 0.22, sz: aw, c: col });
      else if (side === 1) awningItems.push({ x: x - w / 2 - 0.9, y: 3.45, z, sx: 1.8, sy: 0.22, sz: aw, c: col });
      else if (side === 2) awningItems.push({ x, y: 3.45, z: z + d / 2 + 0.9, sx: aw, sy: 0.22, sz: 1.8, c: col });
      else awningItems.push({ x, y: 3.45, z: z - d / 2 - 0.9, sx: aw, sy: 0.22, sz: 1.8, c: col });
      if (rng.chance(0.38)) {
        const nc = rng.pick([COLORS.neonPink, COLORS.neonCyan, COLORS.gold]);
        const ny = rng.range(5.2, Math.max(6.2, h - 2));
        if (rng.chance(0.5)) neonItems.push({ x: x + w / 2 + 0.15, y: ny, z, sx: 0.16, sy: 0.7, sz: rng.range(2.4, 5), c: nc });
        else neonItems.push({ x, y: ny, z: z + d / 2 + 0.15, sx: rng.range(2.4, 5), sy: 0.7, sz: 0.16, c: nc });
      }
    }
    for (let f = 0; f < Math.min(floors, 2); f += 1) {
      const wy = baseY + 1.75 + f * 2.2;
      if (wy > baseY + h - 1) continue;
      for (let side = 0; side < 4; side += 1) {
        const along = side < 2 ? d - 3.4 : w - 3.4;
        const count = Math.max(2, Math.floor(along / 4.2));
        const step = along / count;
        const span = Math.min(3.2, step * 0.78);
        for (let k = 0; k < count; k += 1) {
          const o = -along / 2 + step * (k + 0.5);
          const c = (f + k) % 3 === 0 ? 0xffd9a0 : 0x244f5b;
          if (side === 0) windows.push({ x: x + w / 2 + 0.07, y: wy, z: z + o, sx: 0.1, sy: 1.7, sz: span, c });
          else if (side === 1) windows.push({ x: x - w / 2 - 0.07, y: wy, z: z + o, sx: 0.1, sy: 1.7, sz: span, c });
          else if (side === 2) windows.push({ x: x + o, y: wy, z: z + d / 2 + 0.07, sx: span, sy: 1.7, sz: 0.1, c });
          else windows.push({ x: x + o, y: wy, z: z - d / 2 - 0.07, sx: span, sy: 1.7, sz: 0.1, c });
        }
      }
    }
  }

  function iMod(cx, cz) {
    return (Math.round((cx + 120) / 60) + Math.round((cz + 120) / 60)) % 2;
  }

  // Street lamps on block corners, palms on the beach promenade and a few plazas.
  for (const cx of GRID.centers) {
    for (const cz of GRID.centers) {
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const x = cx + sx * 21.8;
          const z = cz + sz * 21.8;
          lampPoles.push({ x, y: 3, z, sx: 0.11, sy: 6, sz: 0.11 });
          lampHeads.push({ x, y: 6.15, z, sx: 0.55, sy: 0.22, sz: 0.55 });
        }
      }
    }
  }
  for (let x = -148; x <= 148; x += 16) {
    const z = 161.5 + rng.range(-0.8, 0.8);
    const h = rng.range(6.2, 8.6);
    trunkItems.push({ x, y: h / 2, z, sx: 0.18, sy: h, sz: 0.18, rz: rng.range(-0.05, 0.05), c: COLORS.trunk });
    const fronds = 7;
    for (let f = 0; f < fronds; f += 1) {
      const a = (f / fronds) * Math.PI * 2 + rng.range(-0.2, 0.2);
      frondItems.push({
        x: x + Math.sin(a) * 0.9, y: h + rng.range(-0.3, 0.2), z: z + Math.cos(a) * 0.9,
        sx: 0.42, sy: 4.4, sz: 0.12, rx: rng.range(0.9, 1.35), ry: a, rz: rng.range(-0.25, 0.25),
        c: f % 2 ? COLORS.palm : COLORS.palmDark,
      });
    }
  }
  for (let i = 0; i < 18; i += 1) {
    const cx = rng.pick(GRID.centers);
    const cz = rng.pick(GRID.centers);
    const x = cx + rng.pick([-1, 1]) * rng.range(17, 21);
    const z = cz + rng.pick([-1, 1]) * rng.range(17, 21);
    const h = rng.range(5.5, 7.5);
    trunkItems.push({ x, y: h / 2, z, sx: 0.16, sy: h, sz: 0.16, c: COLORS.trunk });
    for (let f = 0; f < 6; f += 1) {
      const a = (f / 6) * Math.PI * 2;
      frondItems.push({ x: x + Math.sin(a) * 0.7, y: h, z: z + Math.cos(a) * 0.7, sx: 0.34, sy: 3.6, sz: 0.1, rx: rng.range(0.9, 1.4), ry: a, c: COLORS.palm });
    }
  }

  // Beach umbrellas and loungers, clear of the marina.
  for (let i = 0; i < 15; i += 1) {
    const x = -142 + i * 11 + rng.range(-2, 2);
    const z = 174 + rng.range(-4, 8);
    const col = rng.pick([COLORS.coral, COLORS.neonPink, COLORS.neonCyan, 0xf3d46b, 0xffffff]);
    umbrellaItems.push({ x, y: 2.35, z, sx: 1.9, sy: 0.6, sz: 1.9, c: col });
    umbrellaPoles.push({ x, y: 1.1, z, sx: 0.05, sy: 2.2, sz: 0.05, c: 0xeee6d2 });
    loungerItems.push({ x: x + 2.3, y: 0.32, z: z + 1.4, sx: 0.8, sy: 0.18, sz: 1.9, c: col, ry: rng.range(-0.2, 0.2) });
  }

  // Marina: three finger docks, a cross dock, posts and moored boats.
  for (const dx of [60, 89, 118]) {
    dockItems.push({ x: dx, y: 0.28, z: 218, sx: 2.6, sy: 0.26, sz: 34, c: 0x8a6440 });
    for (let z = 203; z <= 234; z += 4) {
      for (const side of [-1, 1]) dockPostItems.push({ x: dx + side * 1.35, y: 0.6, z, sx: 0.16, sy: 1.2, sz: 0.16, c: 0x5b412b });
    }
  }
  dockItems.push({ x: 89, y: 0.28, z: 234, sx: 64, sy: 0.26, sz: 4, c: 0x8a6440 });
  const boatHull = standard(0xf4efe4, 0.55, 0.1);
  const boatDeck = standard(0x9c3f35, 0.6);
  const boatCabin = standard(0xe8e1d3, 0.55);
  const boatDark = standard(0x1e5260, 0.3, 0.2);
  const boats = [];
  for (let i = 0; i < 9; i += 1) {
    const side = i % 2 === 0 ? 1 : -1;
    const dx = [60, 89, 118][i % 3];
    const bx = dx + side * 5.6;
    const bz = 207 + Math.floor(i / 3) * 8.5;
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(boxGeo, boatHull);
    hull.position.y = 0.55;
    hull.scale.set(3.4, 1.0, 1.7);
    hull.castShadow = true;
    boat.add(hull);
    const deck = new THREE.Mesh(boxGeo, boatDeck);
    deck.position.y = 1.08;
    deck.scale.set(3.2, 0.18, 1.55);
    boat.add(deck);
    const cabin = new THREE.Mesh(boxGeo, boatCabin);
    cabin.position.set(-0.2, 1.55, 0);
    cabin.scale.set(1.7, 0.9, 1.2);
    cabin.castShadow = true;
    boat.add(cabin);
    const glass = new THREE.Mesh(boxGeo, boatDark);
    glass.position.set(-0.2, 1.75, 0);
    glass.scale.set(1.3, 0.35, 1.23);
    boat.add(glass);
    const mast = new THREE.Mesh(cylGeo, metalMat);
    mast.position.set(0.8, 3.3, 0);
    mast.scale.set(0.07, 4.2, 0.07);
    boat.add(mast);
    boat.position.set(bx, 0, bz);
    boat.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
    scene.add(boat);
    boats.push(boat);
  }

  // Small marina pavilion on the sand.
  const pavilion = new THREE.Mesh(boxGeo, standard(0xf0e3ca, 0.85));
  pavilion.position.set(44, 2, 193);
  pavilion.scale.set(12, 4, 7);
  pavilion.castShadow = true;
  pavilion.receiveShadow = true;
  scene.add(pavilion);
  const pavilionRoof = new THREE.Mesh(boxGeo, standard(0xb86f50, 0.85));
  pavilionRoof.position.set(44, 4.4, 193);
  pavilionRoof.scale.set(14, 0.5, 9);
  pavilionRoof.castShadow = true;
  scene.add(pavilionRoof);
  colliders.push({ x: 44, z: 193, w: 12, d: 7, h: 4 });

  // Traffic signals: pole and three lamps at a handful of downtown intersections.
  const signalMats = {
    red: new THREE.MeshBasicMaterial({ color: 0x5a1010, toneMapped: false }),
    amber: new THREE.MeshBasicMaterial({ color: 0x5a4210, toneMapped: false }),
    green: new THREE.MeshBasicMaterial({ color: 0x0b3d29, toneMapped: false }),
  };
  const signalSpots = [
    [-90, -90], [-30, -90], [30, -90], [-90, -30], [-30, -30], [30, -30],
    [-90, 30], [-30, 30], [30, 30],
  ];
  const redLamps = [];
  const amberLamps = [];
  const greenLamps = [];
  for (const [x, z] of signalSpots) {
    poleItems.push({ x: x + 8.6, y: 2.2, z: z + 8.6, sx: 0.13, sy: 4.4, sz: 0.13 });
    poleItems.push({ x: x + 8.2, y: 4.3, z: z + 8.2, sx: 0.8, sy: 1.5, sz: 0.55 });
    redLamps.push({ x: x + 8.2, y: 4.7, z: z + 7.88, sx: 0.17, sy: 0.17, sz: 0.17 });
    amberLamps.push({ x: x + 8.2, y: 4.3, z: z + 7.88, sx: 0.17, sy: 0.17, sz: 0.17 });
    greenLamps.push({ x: x + 8.2, y: 3.9, z: z + 7.88, sx: 0.17, sy: 0.17, sz: 0.17 });
  }

  instanced(scene, boxGeo, sidewalkMat, sidewalkItems, false, true);
  instanced(scene, boxGeo, curbMat, curbItems, false, true);
  instanced(scene, boxGeo, dashMat, dashItems, false, true);
  instanced(scene, boxGeo, crossMat, crosswalkItems, false, true);
  instanced(scene, boxGeo, baseMat, buildings.map((b) => ({ x: b.x, y: b.baseY + b.h / 2, z: b.z, sx: b.w, sy: b.h, sz: b.d, c: b.color })), true, true);
  instanced(scene, boxGeo, glassMat, windows.map((w) => ({ ...w, c: w.c ?? 0x3c8d9a })), false, false);
  instanced(scene, boxGeo, roofMat, roofItems, false, true);
  instanced(scene, boxGeo, awningMat, awningItems, false, true);
  instanced(scene, boxGeo, neonMat, neonItems, false, false);
  instanced(scene, cylGeo, metalMat, lampPoles, true, false);
  instanced(scene, boxGeo, lampMat, lampHeads, false, false);
  instanced(scene, cylGeo, trunkMat, trunkItems, true, false);
  instanced(scene, coneGeo, frondMat, frondItems, true, false);
  instanced(scene, coneGeo, umbrellaMat, umbrellaItems, true, false);
  instanced(scene, cylGeo, clothMat, umbrellaPoles, false, false);
  instanced(scene, boxGeo, clothMat, loungerItems, false, true);
  instanced(scene, boxGeo, dockMat, dockItems, false, true);
  instanced(scene, boxGeo, postMat, dockPostItems, false, false);
  instanced(scene, boxGeo, metalMat, poleItems, true, false);
  instanced(scene, sphereGeo, signalMats.red, redLamps, false, false);
  instanced(scene, sphereGeo, signalMats.amber, amberLamps, false, false);
  instanced(scene, sphereGeo, signalMats.green, greenLamps, false, false);

  const routes = [
    ring(-146.5, 146.5, -146.5, 146.5),
    ring(-26.5, 26.5, -26.5, 26.5),
    ring(33.5, 86.5, -26.5, 26.5),
    ring(-86.5, -33.5, -86.5, -33.5),
    ring(-86.5, 86.5, 86.5, 146.5),
    ring(93.5, 146.5, -26.5, 26.5),
    ring(-146.5, -93.5, 33.5, 86.5),
  ];

  const missionPoints = {
    pickup: { x: 37, z: 88, label: 'Meet the contact at the pier lot' },
    stops: [
      { x: -127, z: -123, label: 'Drop the package at the north warehouse' },
      { x: 126, z: -60, label: 'Drop the package at the east arcade' },
      { x: 89, z: 226, label: 'Final drop at the marina' },
    ],
  };

  function update(time) {
    sea.material.uniforms.time.value = time;
    const state = signalStateAt('x', time);
    signalMats.red.color.setHex(state === 0 ? 0xff3a2c : 0x4a1210);
    signalMats.amber.color.setHex(state === 2 ? 0xffbb33 : 0x4a3c10);
    signalMats.green.color.setHex(state === 1 ? 0x35e08a : 0x0b3d29);
  }

  return {
    colliders, buildings, routes, intersections, missionPoints, boats,
    signalState: signalStateAt,
    beachStart: WORLD.beachStart,
    seaStart: WORLD.seaStart,
    update,
  };
}
