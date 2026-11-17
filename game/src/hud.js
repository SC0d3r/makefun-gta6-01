// DOM and canvas HUD: health and armour, wanted stars, a north-up player-centred minimap, mission
// banner with timer, cash and speedometer, controls hint, title, pause and wasted panels. Also the
// dev error strip, which is hidden unless something actually throws.

import { CSS } from './config.js';

export function createHud(root) {
  const $ = (id) => document.getElementById(id);
  const healthFill = $('healthFill');
  const healthText = $('healthText');
  const armourFill = $('armourFill');
  const cashEl = $('cash');
  const stars = [...document.querySelectorAll('.star')];
  const banner = $('banner');
  const bannerTitle = $('bannerTitle');
  const bannerObjective = $('bannerObjective');
  const bannerTimer = document.createElement('span');
  bannerTimer.id = 'bannerTimer';
  bannerObjective.appendChild(bannerTimer);
  const speedo = $('speedo');
  const speedVal = $('speedVal');
  const speedBar = document.querySelector('#speedBar i');
  const ammo = $('ammo');
  const ammoVal = $('ammoVal');
  const toastEl = $('toast');
  const minimap = $('minimap');
  const miniCtx = minimap.getContext('2d');
  const title = $('title');
  const continueBtn = $('continueGame');
  const overlay = $('overlay');
  const overlayTitle = $('overlayTitle');
  const overlaySub = $('overlaySub');
  const wasted = $('wasted');
  const wastedText = $('wastedText');
  const error = $('error');
  let toastTimer = 0;
  let toastLife = 0;
  let callbacks = {};

  window.addEventListener('error', (event) => {
    error.style.display = 'block';
    error.textContent = `ERROR ${event.message} @ ${event.filename}:${event.lineno}`;
    window.__gameError = error.textContent;
  });
  window.addEventListener('unhandledrejection', (event) => {
    error.style.display = 'block';
    error.textContent = `PROMISE ${event.reason && (event.reason.stack || event.reason.message || event.reason)}`;
    window.__gameError = error.textContent;
  });

  function bind(next) {
    callbacks = next;
    $('newGame').addEventListener('click', () => { callbacks.click?.(); callbacks.newGame?.(); });
    continueBtn.addEventListener('click', () => { callbacks.click?.(); callbacks.continue?.(); });
    $('resumeBtn').addEventListener('click', () => { callbacks.click?.(); callbacks.resume?.(); });
    $('restartBtn').addEventListener('click', () => { callbacks.click?.(); callbacks.restart?.(); });
  }

  function setPlaying(bool) {
    root.classList.toggle('intro', !bool);
  }

  function showTitle(canContinue) {
    title.classList.remove('off');
    continueBtn.style.display = canContinue ? 'block' : 'none';
    setPlaying(false);
  }

  function hideTitle() {
    title.classList.add('off');
    setPlaying(true);
  }

  function setPaused(bool) {
    overlay.classList.toggle('on', bool);
    if (bool) {
      overlayTitle.textContent = 'PAUSED';
      overlaySub.textContent = 'THE CITY CAN WAIT';
    }
  }

  function showEndCard(endTitle, sub) {
    overlayTitle.textContent = endTitle;
    overlaySub.textContent = sub;
    overlay.classList.add('on');
    $('resumeBtn').style.display = 'none';
    $('restartBtn').textContent = 'PLAY AGAIN';
  }

  function resetEndCard() {
    $('resumeBtn').style.display = 'block';
    $('restartBtn').textContent = 'RESTART';
    overlay.classList.remove('on');
  }

  function showWasted(bool, text = 'WASTED') {
    wastedText.textContent = text;
    wasted.classList.toggle('on', bool);
  }

  function toast(text, seconds = 2.2) {
    toastEl.textContent = text;
    toastEl.classList.add('on');
    toastLife = seconds;
  }

  function clearToast() {
    toastLife = 0;
    toastEl.classList.remove('on');
  }

  function money(n) {
    return `$${Math.round(n).toLocaleString('en-US')}`;
  }

  function timeLabel(seconds) {
    const s = Math.max(0, Math.ceil(seconds));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  function drawMinimap(game) {
    const ctx = miniCtx;
    const size = 168;
    const scale = 0.92;
    const px = game.player.x;
    const pz = game.player.z;
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#243039';
    ctx.fillRect(0, 0, size, size);
    const mapX = (x) => size / 2 + (x - px) * scale;
    const mapZ = (z) => size / 2 + (z - pz) * scale;
    ctx.fillStyle = '#c9ad78';
    ctx.fillRect(mapX(-500), mapZ(157), 1000 * scale, 43 * scale);
    ctx.fillStyle = '#175f75';
    ctx.fillRect(mapX(-500), mapZ(200), 1000 * scale, 900 * scale);
    for (const cx of [-120, -60, 0, 60, 120]) {
      for (const cz of [-120, -60, 0, 60, 120]) {
        ctx.fillStyle = '#384550';
        ctx.fillRect(mapX(cx - 23), mapZ(cz - 23), 46 * scale, 46 * scale);
      }
    }
    ctx.strokeStyle = '#d9c9a4';
    ctx.lineWidth = 3.4;
    ctx.lineCap = 'butt';
    for (const road of [-150, -90, -30, 30, 90, 150]) {
      ctx.beginPath();
      ctx.moveTo(mapX(road), mapZ(-160));
      ctx.lineTo(mapX(road), mapZ(160));
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(mapX(-160), mapZ(road));
      ctx.lineTo(mapX(160), mapZ(road));
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,244,214,.7)';
    ctx.lineWidth = 1.2;
    for (const road of [-150, -90, -30, 30, 90, 150]) {
      ctx.beginPath();
      ctx.moveTo(mapX(road), mapZ(-160));
      ctx.lineTo(mapX(road), mapZ(160));
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(mapX(-160), mapZ(road));
      ctx.lineTo(mapX(160), mapZ(road));
      ctx.stroke();
    }
    const mission = game.missions && game.missions.state;
    if (mission && mission.visible) {
      const mx = mapX(mission.x);
      const mz = mapZ(mission.z);
      ctx.save();
      ctx.translate(mx, mz);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = CSS.gold;
      ctx.fillRect(-3.5, -3.5, 7, 7);
      ctx.restore();
    }
    const police = game.police.state;
    for (const unit of police.units) {
      if (!unit.spawned || !unit.car.group.visible) continue;
      const x = mapX(unit.car.x);
      const z = mapZ(unit.car.z);
      ctx.fillStyle = '#ff4a42';
      ctx.beginPath();
      ctx.arc(x, z, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const cop of police.cops) {
      if (!cop.alive) continue;
      ctx.fillStyle = '#ff4a42';
      ctx.beginPath();
      ctx.arc(mapX(cop.x), mapZ(cop.z), 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.rotate(Math.PI - game.facingYaw);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 5);
    ctx.lineTo(0, 2.6);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    const grad = ctx.createRadialGradient(size / 2, size / 2, size * 0.27, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,.55)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    ctx.restore();
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    ctx.fillStyle = 'rgba(255,233,180,.8)';
    ctx.font = '700 9px system-ui,sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('N', size / 2, 11);
  }

  function update(game, dt = 0.016) {
    const health = Math.max(0, Math.min(100, game.health));
    healthFill.style.width = `${health}%`;
    healthText.textContent = String(Math.ceil(health));
    armourFill.style.width = `${Math.max(0, Math.min(60, game.armour)) / 0.6}%`;
    cashEl.textContent = money(game.cash);
    const wanted = game.police.state.wanted;
    for (let i = 0; i < stars.length; i += 1) stars[i].classList.toggle('on', i < wanted);
    const mission = game.missions.state;
    if (mission && game.showBanner !== false) {
      banner.classList.remove('hidden');
      bannerTitle.textContent = mission.title;
      const objective = game.missions.objective();
      bannerObjective.firstChild ? (bannerObjective.firstChild.nodeValue = objective) : bannerObjective.prepend(document.createTextNode(objective));
      bannerTimer.textContent = mission.status === 'active' && mission.timeLeft > 0 ? ` · ${timeLabel(mission.timeLeft)}` : '';
    } else banner.classList.add('hidden');
    const inCar = game.player && game.player.inCar ? game.player.inCar.car : null;
    speedo.classList.toggle('on', !!inCar);
    if (inCar) {
      const kmh = Math.round(Math.abs(inCar.speed) * 3.6);
      speedVal.textContent = String(kmh);
      speedBar.style.width = `${Math.min(100, kmh / 1.35)}%`;
    }
    ammo.classList.toggle('on', !inCar);
    ammoVal.textContent = String(game.ammo);
    if (toastLife > 0) {
      toastLife -= dt;
      if (toastLife <= 0) toastEl.classList.remove('on');
    }
    drawMinimap(game);
  }

  function setError(text) {
    error.style.display = 'block';
    error.textContent = text;
  }

  return { update, toast, clearToast, bind, showTitle, hideTitle, setPaused, showWasted, showEndCard, resetEndCard, setPlaying, setError };
}
