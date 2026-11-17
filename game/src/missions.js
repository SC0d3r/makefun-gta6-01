// Courier Run: one mission state machine with a marker, objective text, a countdown, three drops,
// cash rewards, failure and retry. The marker is a rotating gold diamond over a soft light beam.

import { MISSION } from './config.js';

const diamondGeo = new THREE.OctahedronGeometry(0.7, 0);
const ringGeo = new THREE.TorusGeometry(2.2, 0.1, 6, 28);
const beamGeo = new THREE.CylinderGeometry(1.5, 2.1, 26, 16, 1, true);

export function createMissions(scene, city, player, hooks = {}) {
  const group = new THREE.Group();
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xffc94a, transparent: true, opacity: 0.10, side: THREE.DoubleSide, depthWrite: false });
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.position.y = 13;
  group.add(beam);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffc94a, toneMapped: false });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.12;
  group.add(ring);
  const diamondMat = new THREE.MeshStandardMaterial({ color: 0xffc94a, emissive: 0xb87a00, emissiveIntensity: 1.3, metalness: 0.4, roughness: 0.25 });
  const diamond = new THREE.Mesh(diamondGeo, diamondMat);
  diamond.position.y = 2.6;
  group.add(diamond);
  const glow = new THREE.PointLight(0xffbe4a, 1.8, 12, 2);
  glow.position.y = 2.3;
  group.add(glow);
  group.visible = false;
  scene.add(group);

  const points = [city.missionPoints.pickup, ...city.missionPoints.stops];
  const state = {
    status: 'idle', stage: 0, timeLeft: 0, title: MISSION.title, objective: 'Reach the yellow marker',
    override: null, cashEarned: 0, x: points[0].x, z: points[0].z, visible: true, bob: 0,
  };

  function setPoint(x, z, visible = true) {
    state.x = x;
    state.z = z;
    state.visible = visible;
    group.position.set(x, 0, z);
    group.visible = visible;
  }

  function start() {
    state.status = 'active';
    state.stage = 0;
    state.timeLeft = MISSION.time;
    state.override = null;
    state.objective = points[1].label;
    setPoint(points[1].x, points[1].z, true);
    if (hooks.toast) hooks.toast('COURIER RUN STARTED');
  }

  function deliver() {
    if (state.status !== 'active') return;
    const reward = MISSION.stopReward;
    state.cashEarned += reward;
    if (hooks.addCash) hooks.addCash(reward);
    state.stage += 1;
    if (state.stage >= points.length - 1) {
      state.status = 'complete';
      state.override = null;
      state.objective = `Delivery complete · +$${MISSION.reward.toLocaleString('en-US')}`;
      state.timeLeft = 0;
      state.cashEarned += MISSION.reward;
      if (hooks.addCash) hooks.addCash(MISSION.reward);
      setPoint(state.x, state.z, false);
      if (hooks.toast) hooks.toast('COURIER RUN COMPLETE');
      if (hooks.save) hooks.save();
      if (hooks.complete) hooks.complete();
      return;
    }
    state.timeLeft = Math.min(MISSION.time, state.timeLeft + MISSION.stopTime);
    state.objective = points[state.stage + 1].label;
    setPoint(points[state.stage + 1].x, points[state.stage + 1].z, true);
    if (hooks.toast) hooks.toast(`DROP ${state.stage} OF ${points.length - 1} CLEARED`);
  }

  function fail(reason) {
    if (state.status !== 'active') return;
    state.status = 'failed';
    state.override = null;
    state.objective = reason || 'Mission failed · press R to retry';
    setPoint(state.x, state.z, false);
    if (hooks.toast) hooks.toast('COURIER RUN FAILED');
    if (hooks.fail) hooks.fail();
  }

  function retry() {
    state.status = 'idle';
    state.stage = 0;
    state.timeLeft = 0;
    state.override = null;
    state.objective = 'Reach the yellow marker';
    setPoint(points[0].x, points[0].z, true);
    if (hooks.toast) hooks.toast('RETRY COURIER RUN');
  }

  function interact() {
    const d = Math.hypot(player.x - state.x, player.z - state.z);
    if (state.status === 'idle' && d < MISSION.interact) {
      start();
      return true;
    }
    if (state.status === 'active' && d < MISSION.radius) {
      deliver();
      return true;
    }
    return false;
  }

  function update(dt) {
    state.bob += dt;
    if (group.visible) {
      diamond.rotation.y += dt * 1.8;
      diamond.position.y = 2.6 + Math.sin(state.bob * 2.2) * 0.22;
      ring.scale.setScalar(1 + Math.sin(state.bob * 2.6) * 0.08);
      beamMat.opacity = 0.08 + Math.sin(state.bob * 1.7) * 0.025;
    }
    if (state.status === 'active') {
      state.timeLeft -= dt;
      if (state.timeLeft <= 0) fail('Out of time · press R to retry');
    }
  }

  function stageFinal() {
    state.status = 'active';
    state.stage = points.length - 2;
    state.timeLeft = 42;
    state.override = null;
    state.objective = points[points.length - 1].label;
    setPoint(points[points.length - 1].x, points[points.length - 1].z, true);
  }

  function objective() {
    return state.override ?? state.objective;
  }

  return { state, group, points, start, deliver, fail, retry, interact, update, stageFinal, objective, setPoint };
}
