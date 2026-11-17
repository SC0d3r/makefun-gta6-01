// Keyboard, mouse and pointer lock. Held keys are read directly; one-shot presses (pause, use,
// retry) are queued as bit flags so a press between frames is never lost. Mouse movement is
// accumulated and consumed once per frame by the camera.

export const ACTION_PAUSE = 1;
export const ACTION_INTERACT = 2;
export const ACTION_SHOOT = 4;
export const ACTION_JUMP = 8;
export const ACTION_RETRY = 16;
export const ACTION_ZOOM = 32;

const GAME_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'ShiftLeft', 'ShiftRight', 'Space', 'KeyF', 'KeyE', 'KeyR', 'KeyP', 'Escape',
]);

export function createInput(canvas, options = {}) {
  const held = new Set();
  let actions = 0;
  let dx = 0;
  let dy = 0;
  let shootHeld = false;
  let locked = false;
  let enabled = true;

  function changeLock(next) {
    locked = next;
    if (options.onLock) options.onLock(next);
    if (!next) shootHeld = false;
  }

  window.addEventListener('keydown', (event) => {
    if (GAME_KEYS.has(event.code)) event.preventDefault();
    if (event.repeat) return;
    held.add(event.code);
    if (event.code === 'KeyP' || event.code === 'Escape') actions |= ACTION_PAUSE;
    else if (event.code === 'KeyE' || event.code === 'KeyF') actions |= ACTION_INTERACT;
    else if (event.code === 'KeyR') actions |= ACTION_RETRY;
    else if (event.code === 'Space') actions |= ACTION_JUMP;
  });
  window.addEventListener('keyup', (event) => held.delete(event.code));
  window.addEventListener('blur', () => {
    held.clear();
    shootHeld = false;
    if (locked) document.exitPointerLock?.();
  });

  canvas.addEventListener('pointerdown', (event) => {
    if (!enabled) return;
    if (!locked && event.button === 0) {
      canvas.requestPointerLock?.();
      return;
    }
    if (event.button === 0) {
      shootHeld = true;
      actions |= ACTION_SHOOT;
    }
  });
  window.addEventListener('pointerup', (event) => {
    if (event.button === 0) shootHeld = false;
  });
  document.addEventListener('mousemove', (event) => {
    if (!locked) return;
    dx += event.movementX || 0;
    dy += event.movementY || 0;
  });
  document.addEventListener('wheel', (event) => {
    if (locked) {
      event.preventDefault();
      actions |= ACTION_ZOOM;
    }
  }, { passive: false });
  document.addEventListener('pointerlockchange', () => changeLock(document.pointerLockElement === canvas));
  document.addEventListener('contextmenu', (event) => {
    if (locked) event.preventDefault();
  });

  return {
    get locked() { return locked; },
    get shooting() { return shootHeld; },
    get handbrake() { return held.has('Space'); },
    isDown(code) { return held.has(code); },
    setEnabled(value) { enabled = value; if (!value) { held.clear(); shootHeld = false; } },
    requestLock() {
      if (!locked) return canvas.requestPointerLock?.();
      return undefined;
    },
    releaseLock() {
      if (locked) document.exitPointerLock?.();
    },
    /** Forward/strafe in -1..1, from WASD or the arrow keys. */
    move() {
      const forward = (held.has('KeyW') || held.has('ArrowUp') ? 1 : 0) - (held.has('KeyS') || held.has('ArrowDown') ? 1 : 0);
      const strafe = (held.has('KeyD') || held.has('ArrowRight') ? 1 : 0) - (held.has('KeyA') || held.has('ArrowLeft') ? 1 : 0);
      return { forward, strafe, sprint: held.has('ShiftLeft') || held.has('ShiftRight') };
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** Mouse movement since the previous call, in raw pixels. */
    takeMouse() {
      const out = { dx, dy };
      dx = 0;
      dy = 0;
      return out;
    },
  };
}
