// Renderer, golden-hour lighting, sky and the third-person camera rig. There is one render pass,
// ACES tone mapping, shadowed warm sun, cool hemisphere fill and exponential fog that matches the
// horizon colour, so distant towers read as haze rather than a hard edge.

import { PLAYER, CAR, RENDER } from './config.js';

const SUN_DIR = new THREE.Vector3(-0.66, 0.22, 0.72).normalize();

function makeSky() {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      sunDir: { value: SUN_DIR.clone() },
      top: { value: new THREE.Color(0x2f7fa3) },
      mid: { value: new THREE.Color(0x7fb7c4) },
      horizon: { value: new THREE.Color(0xffb98a) },
      low: { value: new THREE.Color(0xa8574c) },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 sunDir;
      uniform vec3 top; uniform vec3 mid; uniform vec3 horizon; uniform vec3 low;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float h = clamp(d.y, -1.0, 1.0);
        vec3 c = mix(horizon, mid, smoothstep(0.0, 0.22, h));
        c = mix(c, top, smoothstep(0.18, 0.85, h));
        c = mix(c, low, smoothstep(0.0, -0.18, h));
        float sd = max(dot(d, normalize(sunDir)), 0.0);
        c += vec3(1.0, 0.58, 0.22) * pow(sd, 320.0) * 1.35;
        c += vec3(1.0, 0.49, 0.18) * pow(sd, 12.0) * 0.14;
        c += vec3(0.9, 0.34, 0.42) * pow(max(0.0, 1.0 - abs(h)), 5.0) * 0.06;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 20), material);
  sky.frustumCulled = false;
  sky.renderOrder = -10;
  return sky;
}

export function createGraphics(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = RENDER.exposure;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(RENDER.fogColor);
  scene.fog = new THREE.FogExp2(RENDER.fogColor, RENDER.fog);

  const camera = new THREE.PerspectiveCamera(RENDER.fov, window.innerWidth / window.innerHeight, RENDER.near, RENDER.far);
  scene.add(camera);

  const sky = makeSky();
  scene.add(sky);

  const hemi = new THREE.HemisphereLight(RENDER.hemiSky, RENDER.hemiGround, RENDER.hemiIntensity);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(RENDER.sunColor, RENDER.sunIntensity);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const half = RENDER.shadowSize / 2;
  sun.shadow.camera.left = -half;
  sun.shadow.camera.right = half;
  sun.shadow.camera.top = half;
  sun.shadow.camera.bottom = -half;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 420;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.03;
  scene.add(sun);
  scene.add(sun.target);

  const rim = new THREE.DirectionalLight(0x6fb6d9, 0.24);
  rim.position.set(120, 80, -160);
  scene.add(rim);

  function resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);

  function followSun(center) {
    sun.position.copy(center).addScaledVector(SUN_DIR, 170);
    sun.target.position.copy(center);
    sun.target.updateMatrixWorld();
    sky.position.set(center.x, 0, center.z);
  }

  function render() {
    renderer.render(scene, camera);
  }

  return { renderer, scene, camera, sun, sky, resize, render, followSun, sunDir: SUN_DIR };
}

function rayBox(ox, oy, oz, dx, dy, dz, box, maxT) {
  let tmin = 0;
  let tmax = maxT;
  const axes = [
    [ox, dx, box.x - box.w / 2, box.x + box.w / 2],
    [oy, dy, 0, box.h],
    [oz, dz, box.z - box.d / 2, box.z + box.d / 2],
  ];
  for (const [origin, dir, lo, hi] of axes) {
    if (Math.abs(dir) < 1e-7) {
      if (origin < lo || origin > hi) return Infinity;
    } else {
      let t1 = (lo - origin) / dir;
      let t2 = (hi - origin) / dir;
      if (t1 > t2) { const swap = t1; t1 = t2; t2 = swap; }
      if (t1 > tmin) tmin = t1;
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return Infinity;
    }
  }
  return tmin;
}

/** Third-person camera with a smoothed arm, wall avoidance, speed pull-back and a cinematic override. */
export function createCameraRig(graphics, colliders) {
  const current = new THREE.Vector3(0, 4, 10);
  const look = new THREE.Vector3();
  const desired = new THREE.Vector3();
  const target = new THREE.Vector3();
  const shot = { on: false, pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 55 };
  let first = true;

  function safeArm(from, to) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dz = to.z - from.z;
    const length = Math.hypot(dx, dy, dz) || 1;
    let best = 1;
    for (const box of colliders) {
      const t = rayBox(from.x, from.y, from.z, dx / length, dy / length, dz / length, box, length);
      if (t < length) best = Math.min(best, Math.max(0.12, (t - 0.3) / length));
    }
    to.copy(from).addScaledVector(new THREE.Vector3(dx, dy, dz), best);
    if (to.y < 0.7) to.y = 0.7;
  }

  function update(dt, player, mode, yaw, pitch, speed) {
    if (shot.on) {
      current.copy(shot.pos);
      look.copy(shot.look);
      graphics.camera.position.copy(current);
      graphics.camera.lookAt(look);
      graphics.camera.fov += (shot.fov - graphics.camera.fov) * Math.min(1, dt * 6);
      graphics.camera.updateProjectionMatrix();
      return;
    }
    const inCar = mode === 'car';
    const arm = inCar ? CAR.arm : PLAYER.arm;
    const clampedPitch = Math.max(PLAYER.pitchMin, Math.min(PLAYER.pitchMax, pitch));
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    const baseY = inCar ? player.y + 1.35 : player.y + PLAYER.shoulder;
    const shoulder = inCar ? 0 : 0.42;
    target.set(player.x + Math.cos(yaw) * shoulder, baseY, player.z - Math.sin(yaw) * shoulder);
    if (inCar) target.z += fz * 0.6;
    const back = arm * Math.cos(clampedPitch) + Math.min(4.8, speed * 0.075);
    desired.set(target.x - fx * back, baseY + arm * Math.sin(clampedPitch) + (inCar ? 0.55 : 0), target.z - fz * back);
    safeArm(target, desired);
    const lookAhead = inCar ? CAR.lookAhead + speed * 0.22 : 0;
    const targetLook = inCar
      ? new THREE.Vector3(target.x + fx * lookAhead, baseY + 0.35, target.z + fz * lookAhead)
      : new THREE.Vector3(target.x - fx * 1.3, baseY - 0.08, target.z - fz * 1.3);
    if (first) {
      current.copy(desired);
      look.copy(targetLook);
      first = false;
    } else {
      const k = 1 - Math.exp(-dt / PLAYER.lag);
      const kFast = 1 - Math.exp(-dt / (inCar ? 0.075 : 0.1));
      current.lerp(desired, kFast);
      look.lerp(targetLook, k);
    }
    graphics.camera.position.copy(current);
    graphics.camera.lookAt(look);
    const fov = inCar ? CAR.fov : PLAYER.fov;
    graphics.camera.fov += (fov - graphics.camera.fov) * Math.min(1, dt * 5);
    graphics.camera.updateProjectionMatrix();
  }

  function snap(player, mode, yaw, pitch) {
    first = true;
    update(0.016, player, mode, yaw, pitch, 0);
    first = false;
  }

  function setShot(pos, targetPoint, fov = 55) {
    shot.on = true;
    shot.pos.set(pos[0], pos[1], pos[2]);
    shot.look.set(targetPoint[0], targetPoint[1], targetPoint[2]);
    shot.fov = fov;
  }

  function clearShot() {
    shot.on = false;
    first = true;
  }

  return { update, snap, setShot, clearShot, get position() { return current; } };
}
