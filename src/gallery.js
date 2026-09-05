import * as THREE from 'three';
import { gallerySlots, projects } from './projects.js';
import { createArtwork, studyNames } from './artwork.js';

// Recycle only outside the visible stage, equally in either scroll direction.
export function wrapSpiralOffset(offset, span) {
  return ((offset + span / 2) % span + span) % span - span / 2;
}

export const SPIRAL_LAYOUT = {
  desktop: { radius: 3.35, pitch: 14, step: 1, width: 3.35, aspect: 1.6, count: 23, cameraZ: 11.8 },
  mobile: { radius: 1.65, pitch: 13, step: 1, width: 2.35, aspect: 1.6, count: 23, cameraZ: 10.4 },
  fov: 43, damping: 10, wheelSpeed: .0017, dragSpeed: .007, pixelRatio: 1.75,
  focus: { clearAngle: .48, softAngle: 2.4, maxBlur: .018 },
};

// A fixed viewing zone: each card becomes sharp as it reaches the front center.
export function spiralDefocus(offset) {
  const { clearAngle, softAngle } = SPIRAL_LAYOUT.focus;
  return THREE.MathUtils.smoothstep(Math.abs(offset), clearAngle, softAngle);
}

function applyFocus(surface, aspect) {
  const blur = { value: 0 };
  surface.userData.blur = blur;
  surface.onBeforeCompile = shader => {
    shader.uniforms.spiralBlur = blur;
    shader.uniforms.spiralAspect = { value: aspect };
    shader.fragmentShader = 'uniform float spiralBlur;\nuniform float spiralAspect;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
      #ifdef USE_MAP
        vec4 sampledDiffuseColor = texture2D(map, vMapUv);
        if (spiralBlur > 0.00001) {
          vec4 blurred = vec4(0.0);
          float total = 0.0;
          // Gaussian sampling in card space preserves the curved silhouette.
          for (int y = -2; y <= 2; y++) {
            for (int x = -2; x <= 2; x++) {
              vec2 tap = vec2(float(x), float(y));
              float weight = exp(-dot(tap, tap) * 0.5);
              vec2 uv = vMapUv + tap * spiralBlur * vec2(1.0, spiralAspect);
              blurred += texture2D(map, clamp(uv, vec2(0.001), vec2(0.999)), 2.0 * spiralBlur / ${SPIRAL_LAYOUT.focus.maxBlur}) * weight;
              total += weight;
            }
          }
          sampledDiffuseColor = blurred / total;
        }
        diffuseColor *= sampledDiffuseColor;
        // Rounded silhouette applies equally to artwork and uploaded covers.
        vec2 halfSize = vec2(0.5, 0.5 / spiralAspect);
        float radius = 0.065;
        vec2 corner = abs((vMapUv - 0.5) * vec2(1.0, 1.0 / spiralAspect)) - halfSize + radius;
        float edge = length(max(corner, 0.0)) + min(max(corner.x, corner.y), 0.0) - radius;
        float aa = max(fwidth(edge), 0.0001);
        diffuseColor.a *= 1.0 - smoothstep(-aa, aa, edge);
      #endif
    `);
  };
  surface.customProgramCacheKey = () => 'spiral-focus-rounded-v2';
}

export function mountGallery(host) {
  const canvas = host.querySelector('canvas'), fallback = host.querySelector('.gallery-fallback');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const state = { reveal: 0 };
  let renderer, config, cards = [], resources = [], frame = 0, last = 0;
  let enabled = false, disposed = false, current = 0, target = 0, pointer = null, pointerY = 0;
  let dirty = true, previousReveal = -1, listMode = false;
  const artwork = studyNames.map((_, i) => createArtwork(i));
  [...fallback.children].forEach((card, i) => { card.style.backgroundImage = `url(${artwork[i % artwork.length].toDataURL()})`; });
  const shell = host.parentElement, list = shell.querySelector('.gallery-list');
  const buttons = [...shell.querySelectorAll('[data-view]')];
  const entries = projects.length ? projects : studyNames.map((title, i) => ({title, cover: artwork[i].toDataURL(), placeholder: true}));
  entries.forEach((entry, i) => {
    const row = document.createElement('div'); row.className = 'gallery-list-row';
    const img = document.createElement('img'); img.src = entry.cover; img.alt = '';
    const name = document.createElement('span'); name.textContent = entry.title;
    const meta = document.createElement('small'); meta.textContent = entry.placeholder ? '视觉预览 / '+String(i+1).padStart(2,'0') : String(i+1).padStart(2,'0');
    row.append(img, name, meta); list.append(row);
  });
  function switchView(event) {
    listMode = event.currentTarget.dataset.view === 'list';
    list.hidden = !listMode; host.style.visibility = listMode ? 'hidden' : 'visible';
    buttons.forEach(button => button.setAttribute('aria-pressed', String((button.dataset.view === 'list') === listMode)));
    up(); dirty = true; wake();
  }
  buttons.forEach(button => button.addEventListener('click', switchView));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(SPIRAL_LAYOUT.fov, 1, .1, 100);
  const geometry = new THREE.PlaneGeometry(1, 1, 40, 12);
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i);
    positions.setZ(i, -.32 * x * x + .045 * Math.sin(x * Math.PI) * y);
  }
  geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, transparent: true, alphaTest: .05 });
  function fail() {
    canvas.hidden = true; fallback.hidden = false; enabled = false;
    cancelAnimationFrame(frame); frame = 0;
  }
  try {
    if (new URLSearchParams(location.search).has('no-webgl')) throw new Error('Fallback requested');
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setClearColor(0x11110f, 0);
  } catch { fail(); }
  function rebuild() {
    cards.forEach(card => scene.remove(card));
    resources.forEach(resource => resource.dispose()); resources = [];
    const loader = new THREE.TextureLoader();
    const sequenceLength = projects.length || studyNames.length;
    const poolSize = Math.ceil(config.count / sequenceLength) * sequenceLength;
    cards = gallerySlots(poolSize).map(slot => {
      const group = new THREE.Group();
      const surface = material.clone(); resources.push(surface);
      applyFocus(surface, config.aspect);
      const texture = slot.cover ? loader.load(slot.cover, () => { dirty = true; wake(); }, undefined, () => {
        surface.map = new THREE.CanvasTexture(artwork[slot.study ?? 0]);
        surface.map.colorSpace = THREE.SRGBColorSpace; resources.push(surface.map);
        surface.needsUpdate = true; dirty = true; wake();
      }) : new THREE.CanvasTexture(artwork[slot.study]);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(8, renderer?.capabilities.getMaxAnisotropy() ?? 1);
      resources.push(texture); surface.map = texture;
      group.add(new THREE.Mesh(geometry, surface));
      group.userData = slot; scene.add(group); return group;
    });
  }
  function draw() {
    const spread = .78 + state.reveal * .22;
    cards.forEach((card, i) => {
      const offset = wrapSpiralOffset((i - Math.floor(cards.length / 2)) * config.step + current, cards.length * config.step);
      const angle = offset;
      card.position.set(Math.sin(angle) * config.radius * spread, offset * config.pitch / (Math.PI * 2) * spread, Math.cos(angle) * config.radius);
      card.rotation.set(.08 * Math.sin(angle), angle - .22 * Math.sin(angle), -.055 * Math.sin(angle));
      const surface = card.children[0].material;
      const defocus = spiralDefocus(offset);
      surface.userData.blur.value = defocus * SPIRAL_LAYOUT.focus.maxBlur;
      surface.color.setScalar(1 - .32 * defocus);
      card.scale.set(config.width, config.width / config.aspect, 1);
    });
    renderer?.render(scene, camera);
  }
  function tick(time) {
    frame = 0;
    if (disposed || document.hidden || !renderer || canvas.hidden) return;
    const dt = Math.min((time - (last || time)) / 1000, .05); last = time;
    const moving = Math.abs(target - current) > .0001;
    if (moving) current = motion.matches ? target : THREE.MathUtils.damp(current, target, SPIRAL_LAYOUT.damping, dt);
    else current = target;
    // Keep long sessions numerically stable without changing the easing distance.
    const span = cards.length * config.step;
    const cycles = Math.trunc(current / span);
    if (cycles) { current -= cycles * span; target -= cycles * span; }
    if (dirty || moving || previousReveal !== state.reveal) draw();
    previousReveal = state.reveal; dirty = false;
    if (moving || state.reveal > 0 && state.reveal < 1) wake();
  }
  function wake() {
    if (!frame && !disposed && !document.hidden && renderer && !canvas.hidden) frame = requestAnimationFrame(tick);
  }
  function resize() {
    const next = innerWidth < 700 ? SPIRAL_LAYOUT.mobile : SPIRAL_LAYOUT.desktop;
    if (next !== config) { config = next; rebuild(); }
    const width = host.clientWidth, height = host.clientHeight;
    camera.aspect = width / Math.max(1, height);
    camera.position.set(0, 0, Math.max(config.cameraZ, (config.radius + config.width * .55) / Math.tan(THREE.MathUtils.degToRad(SPIRAL_LAYOUT.fov / 2)) / camera.aspect + config.radius));
    camera.updateProjectionMatrix();
    renderer?.setPixelRatio(Math.min(devicePixelRatio, SPIRAL_LAYOUT.pixelRatio));
    renderer?.setSize(width, height, false);
    dirty = true; wake();
  }
  function move(delta) { target += delta; wake(); }
  function wheel(event) {
    if (!enabled || listMode || event.ctrlKey) return;
    event.preventDefault();
    const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1);
    move(THREE.MathUtils.clamp(pixels, -160, 160) * SPIRAL_LAYOUT.wheelSpeed);
  }
  function down(event) {
    if (!enabled || listMode || event.button !== 0 || !event.isPrimary) return;
    host.classList.add('is-dragging'); pointer = event.pointerId; pointerY = event.clientY; host.setPointerCapture(pointer);
  }
  function drag(event) {
    if (!enabled || event.pointerId !== pointer) return;
    move((pointerY - event.clientY) * SPIRAL_LAYOUT.dragSpeed); pointerY = event.clientY;
  }
  function up() { host.classList.remove('is-dragging'); if (pointer !== null && host.hasPointerCapture(pointer)) host.releasePointerCapture(pointer); pointer = null; }
  function key(event) {
    if (!enabled || listMode || !['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp'].includes(event.key)) return;
    event.preventDefault(); move(event.key.includes('Down') ? .5 : -.5);
  }
  function visibility() { cancelAnimationFrame(frame); frame = 0; last = 0; if (!document.hidden) { dirty = true; wake(); } }
  function lost(event) { event.preventDefault(); fail(); }
  host.addEventListener('wheel', wheel, { passive: false });
  host.addEventListener('pointerdown', down); host.addEventListener('pointermove', drag);
  host.addEventListener('pointerup', up); host.addEventListener('pointercancel', up); host.addEventListener('keydown', key);
  canvas.addEventListener('webglcontextlost', lost);
  window.addEventListener('resize', resize); document.addEventListener('visibilitychange', visibility);
  resize();
  return {
    state, update() { dirty = true; wake(); },
    enable(value) { enabled = value && !!renderer && !canvas.hidden; if (!value) up(); host.dataset.interactive = String(enabled); },
    reset() { enabled = false; current = target = state.reveal = 0; dirty = true; wake(); },
    dispose() {
      disposed = true; cancelAnimationFrame(frame); up();
      host.removeEventListener('wheel', wheel); host.removeEventListener('pointerdown', down);
      host.removeEventListener('pointermove', drag); host.removeEventListener('pointerup', up); host.removeEventListener('pointercancel', up);
      host.removeEventListener('keydown', key); canvas.removeEventListener('webglcontextlost', lost);
      window.removeEventListener('resize', resize); document.removeEventListener('visibilitychange', visibility);
      buttons.forEach(button => button.removeEventListener('click', switchView)); list.replaceChildren();
      geometry.dispose(); material.dispose();
      resources.forEach(resource => resource.dispose()); renderer?.dispose();
    },
  };
}
