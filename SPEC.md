# gta6-01 build spec: VELA CITY

Design owner: lulu. Chain, gate and submission: gus. This file is committed to the entry repository as SPEC.md before the recorded session starts and the session reads it there. It is a design document, not one of the entry source files the transcript gate counts.

## One line

A third-person open world crime game in a sun-soaked fictional coastal city, played in a desktop browser, built with three.js vendored under game/vendor/, and looking like a real game in one 1280x720 contact sheet.

## Non-negotiable output

- `game/index.html` plus ES modules under `game/src/`, three.js r147 UMD under `game/vendor/three.min.js` loaded with one classic `<script src>` before the module script. `THREE` is then a global inside the modules; do not use an import map for it.
- No network at runtime. Every reference inside `game/` is a relative path or a `data:` URI.
- Runs from a static server with `node serve.ts`, Chrome, keyboard and mouse, no build step.
- Deterministic: a URL parameter `?seed=N` fixes every random choice.
- Four screenshot presets `?shot=chase|street|drive|mission` that set up a real playable state, advance it a fixed number of steps, and freeze for capture.
- No names, characters, logos, map, art or music from GTA or any other commercial game. Everything is original.

## This session: scope and caps

Build Milestones 1, 2 and 3, plus the Courier Run mission from Milestone 4. Audio is optional and comes last. Hard caps so the whole game lands: a 5 by 5 block grid, 12 traffic cars, 16 pedestrians, 2 patrol cars plus 2 responders, and one mission (Courier Run). A complete basic game beats a beautiful half game: every system must exist and work at a basic level before any polish. Do not stop at a skeleton.

## Setting and tone

- City: VELA CITY, a fictional Mediterranean-American coast. White and coral low-rises, glass towers downtown, palms, a beach boulevard, a marina, hills with villas.
- Time: late golden hour. Long shadows, warm key light, teal shadow fill, hazy horizon, sun low over the sea.
- Palette: coral, sand, cream, teal glass, palm green, asphalt blue-grey, hot pink and cyan neon accents.
- Story hook (one line in the HUD and mission text): courier Rico Vela owes the Marisol syndicate, and the only way out is one last run across the city.

## Systems, milestone order

### Milestone 1 (today): city, player, camera, HUD shell, shots

1. Renderer: WebGLRenderer at devicePixelRatio, antialias, ACES tone mapping, shadows on (one directional sun with a 120 m shadow camera, hemisphere fill), exponential fog matched to the sky, gradient sky dome.
2. City generator from a seed: a 5 by 5 block grid, 46 m blocks, 14 m roads, sidewalks 3 m, lane markings, crosswalks, curbs, street lamps, palms, beach on the south edge, sea plane, marina with docks and boats, downtown cluster with 40 to 90 m towers, low-rise elsewhere.
3. Buildings are boxes with window strips (instanced meshes or merged geometry, one draw call per material family), rooftop details, awnings on low-rises.
4. Player on foot: capsule or simple character built from boxes, walk 4 m/s, sprint 7 m/s, jump, camera orbit with mouse (pointer lock), third-person arm length with wall avoidance, collision against building AABBs and the sea.
5. HUD: top-left health and armour bars, top-right circular minimap with roads and a player arrow, wanted stars above the minimap, top-centre mission banner, bottom-right cash, bottom-left controls hint.
6. Shot presets and a capture path (see Screenshots).
7. Pause menu with Resume and Restart.

### Milestone 2: vehicles, traffic, pedestrians

1. Cars: stealable, enter with F within 3 m, exit with F, arcade physics (engine force, steering, lateral grip, handbrake), chase camera that pulls back with speed, speedometer in the HUD.
2. Traffic: 12 cars on lane paths that stop for lights and each other, three car types with distinct colours.
3. Pedestrians: 16 walkers on sidewalks with simple avoidance, they flee when shots are fired.

### Milestone 3: police, wanted, combat

1. Wanted level 1 to 5 stars. Crimes raise it: hitting a ped, firing, stealing a car in view, ramming a police car.
2. Police: 2 patrol cars and 2 responders that spawn off-screen, pursuit driving, cops on foot with pistols at 2 stars and above, no roadblocks.
3. Combat: player pistol with raycast hit, muzzle flash, tracers, health damage, death and respawn at a hospital.
4. Wanted decay when out of sight for 30 s.

### Milestone 4: missions, progression, audio, menus

1. Mission state machine with a marker, objective text, timer, fail and retry: Courier Run (deliver a package across three stops). The other two missions are out of scope this session; the shot presets stage their states directly.
2. Progression: cash rewards, mission unlocks, a simple save in localStorage.
3. Audio with WebAudio synthesis only: engine, siren, gunshot, footsteps, UI clicks, a short original three-chord loop.
4. Title screen with the game name, Continue and New Game. Audio, if time allows after every acceptance check passes.

## File split (criterion 5 reads these names)

- `game/src/main.js`: boot, loop, state, wiring
- `game/src/config.js`: constants and palette
- `game/src/rng.js`: seeded random
- `game/src/input.js`: keyboard, mouse, pointer lock
- `game/src/city.js`: layout and geometry generation
- `game/src/render.js`: renderer, sky, lights, camera rig
- `game/src/player.js`: on-foot movement, animation, collision
- `game/src/vehicle.js`: car physics, enter and exit, camera
- `game/src/traffic.js`: traffic and pedestrians
- `game/src/police.js`: wanted level, pursuit, combat
- `game/src/missions.js`: mission state machines
- `game/src/hud.js`: DOM and canvas HUD, minimap, menus
- `game/src/audio.js`: WebAudio synthesis
- `game/src/shots.js`: deterministic screenshot presets

Keep the whole counted source under 140 KB: complete systems beat long files, and a dossier cut off at the cap hides the rest of the outline.

Each file one job, top-level functions and classes named for what they do. `index.html` has one canvas and one HUD root, one classic `<script src="./vendor/three.min.js"></script>` and one `<script type="module" src="./src/main.js"></script>`. No import map. Inside every module use the global `THREE`.

## Camera and look

- On foot: third person, shoulder height 1.7 m, arm 4.5 m, pitch clamp -25 to +60 degrees, smooth follow with 0.12 s lag, FOV 60.
- In car: arm 7 m, FOV 68, look-ahead 8 m.
- Sun: azimuth from the south-west, elevation 12 degrees, colour #ffd7a8, intensity 2.6. Hemisphere sky #bfe8ff, ground #6b5a4a, intensity 0.9. Ambient occlusion is faked with dark contact quads under cars and characters.
- Sea: a large plane with a subtle normal-less ripple in the vertex shader or a scrolling texture drawn to a canvas, colour #1a7f9c, specular highlight toward the sun.
- Do not use post-processing; keep it one pass.

## HUD, exact layout

- Health bar: 12 px tall, 180 px wide, coral fill on dark, top-left 24 px inset, armour bar under it in cyan.
- Minimap: 168 px circle, top-right, roads in cream on asphalt, sea in teal, player arrow, police blips red, mission marker yellow.
- Wanted stars: five 18 px stars above the minimap, lit gold, dim grey otherwise.
- Mission banner: top-centre, small caps title and one line of objective, dark translucent pill.
- Cash: bottom-right, tabular numerals, `$1,240` format.
- Font: system UI stack. No external fonts.

## Screenshots

Four frames at 1280x720, JPEG, under 256 KiB each, no UI debug text, no title card as cover. Presets must show real gameplay state:

1. `1-chase.jpg` `?shot=chase`: player in a stolen car on the beach boulevard, three police cars behind with lights, 3 wanted stars lit, minimap showing pursuit, mission banner "COURIER RUN" with the objective "Lose the police", traffic and palms in frame. This is the cover.
2. `2-street.jpg` `?shot=street`: player on foot on a downtown sidewalk at golden hour, pedestrians, cars passing, towers with glass reflections, HUD visible.
3. `3-drive.jpg` `?shot=drive`: car on the coastal road, sea and marina to one side, skyline behind, sun low, speedometer reading, minimap.
4. `4-mission.jpg` `?shot=mission`: the final drop of Courier Run at the marina, package marker, police arriving, objective timer on the banner, cash counter.

Capture procedure in the session, verified on this machine (headless Chrome plus SwiftShader, 1280x720):

```
node serve.ts &
google-chrome --headless=new --no-sandbox --disable-dev-shm-usage --enable-unsafe-swiftshader \
  --use-gl=angle --use-angle=swiftshader --hide-scrollbars --window-size=1280,720 \
  --virtual-time-budget=8000 --screenshot=/tmp/shot-chase.png "http://127.0.0.1:8080/?shot=chase&seed=7"
python3 -c "from PIL import Image; Image.open('/tmp/shot-chase.png').convert('RGB').save('screenshots/1-chase.jpg', quality=82)"
```

Check each JPEG is 1280x720 and under 256 KiB; lower the quality until it is. If a frame is blank, the preset painted before the first rAF tick: raise the budget to 15000 and retry, and if it still fails keep the same preset running normally for 2 s instead of freezing. `shots.json` lists the four names and queries, first by name is the cover.

## Acceptance, checked in the session before sealing

1. `node -e` syntax check on every `game/src/*.js` as an ES module: `node --input-type=module --check` per file.
2. `node serve.ts` serves the page; a headless Chrome load of `?shot=street` prints no uncaught error (add a `window.onerror` overlay rendered in the HUD so a screenshot shows it; remove the overlay when clean).
3. All four presets produce non-blank PNGs with visible geometry, sky and HUD. Check each one before converting, with python3 and PIL (both installed):
   `python3 -c "from PIL import Image; im=Image.open('/tmp/shot1.png').convert('RGB').resize((160,90)); print(im.size, len(set(im.getdata())), sum(sum(p)//3 for p in im.getdata())//(160*90))"`
   Fewer than 40 distinct colours or a mean brightness under 8 means a blank, black or flat frame: fix the game before you stop.
4. `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts` writes `out/game`, `out/screenshots` and a dossier; `dossier.json` under 1.5 MiB.
5. `node cli/makefun.mjs check --repo <repo> --commit <sha>` from the kit passes the intake and transcript gate.
6. The dossier's source text fits: total counted source under 140 KB (the cap is 163,840 bytes), so every module is shown whole.
7. `main.ts` carries at least one line the session wrote (the starter's copy is the kit's), and at least one game file is written and then edited again after the first run, so its final content comes from two writes.
8. `screenshots/` holds exactly the four JPEGs above: delete the starter's `1-start.jpg`, `2-play.jpg` and `3-end.jpg`. Delete the starter's `game/src/*.js` files the build does not use, so the outline shows only this game's modules.

## Never

- Never write a file outside `game/`, `screenshots/`, `shots.json` and `main.ts` except a scratch file under `/tmp`.
- Never fetch anything over the network at runtime. The one local copy of three.js into `game/vendor/three.min.js` is the only file brought in from outside the repository, and after it the page loads nothing but files under `game/`.
- Never copy code from GTA or another game, and never name a real company, brand or person.
- Never delete or revert recorded messages, and never rewrite a file's history to fake authorship.

## Start here in the recorded session

1. Read the repository layout: `main.ts`, `serve.ts`, `game/`, `screenshots/`. The kit starter is yours to replace, not to keep.
2. Bring three.js in yourself: `mkdir -p game/vendor && cp /home/sck/Projects/realm-labs/swarm/shared/vendor/three-r147.min.js game/vendor/three.min.js`. Do not fetch anything at runtime, and do not run any git command.
3. Write `game/index.html` and every `game/src/*.js` file in the split above, then edit `main.ts` to add at least one line of your own. Delete the starter's `game/src/*.js` files you do not use and the starter screenshots.
4. Serve with `node serve.ts`, open each preset in headless Chrome, and take the four real screenshots with the capture commands above. Run the pixel check in Acceptance 3 on every frame.
5. Run every acceptance check, fix failures, and only then stop. Your final message lists each check with pass or fail and each screenshot's dimensions and bytes.

A blank frame, a missing HUD, a camera inside a building or a page with a console error is a failure, not a stopping point.
