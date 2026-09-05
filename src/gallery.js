import * as THREE from 'three';
import { gallerySlots } from './projects.js';

export const SPIRAL_LAYOUT = {
  desktop: { radius: 2.65, pitch: 6.2, step: .82, width: 2.35, aspect: 1.6, count: 19, cameraZ: 11.6 },
  mobile: { radius: 1.25, pitch: 5.8, step: .94, width: 1.6, aspect: 1.5, count: 13, cameraZ: 10.4 },
  fov: 43, damping: 10, wheelSpeed: .0017, dragSpeed: .007, pixelRatio: 1.75,
};

export function mountGallery(host) {
  const canvas = host.querySelector('canvas'), fallback = host.querySelector('.gallery-fallback');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const state = { reveal: 0 };
  let renderer, config, cards = [], resources = [], frame = 0, last = 0;
  let enabled = false, disposed = false, current = 0, target = 0, pointer = null, pointerY = 0;
  let dirty = true, previousReveal = -1;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(SPIRAL_LAYOUT.fov, 1, .1, 100);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x333333, 2));
  const light = new THREE.DirectionalLight(0xffffff, 2.3);
  light.position.set(-3, 6, 8); scene.add(light);
  const geometry = new THREE.PlaneGeometry(1, 1), edges = new THREE.EdgesGeometry(geometry);
  const material = new THREE.MeshStandardMaterial({ color: 0x777875, roughness: .94, side: THREE.DoubleSide });
  const lineMaterial = new THREE.LineBasicMaterial({ color: 0x989a95 });
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
    cards = gallerySlots(config.count).map(slot => {
      const group = new THREE.Group();
      let surface = material;
      if (!slot.placeholder && slot.cover) {
        surface = material.clone(); resources.push(surface);
        const texture = loader.load(slot.cover, () => { dirty = true; wake(); });
        texture.colorSpace = THREE.SRGBColorSpace; resources.push(texture); surface.map = texture;
      }
      group.add(new THREE.Mesh(geometry, surface), new THREE.LineSegments(edges, lineMaterial));
      group.userData = slot; scene.add(group); return group;
    });
  }
  function limit() { return Math.max(0, (cards.length - 7) * config.step / 2); }
  function draw() {
    const spread = .78 + state.reveal * .22;
    cards.forEach((card, i) => {
      const offset = (i - (cards.length - 1) / 2) * config.step + current;
      const angle = offset + .4;
      card.position.set(Math.sin(angle) * config.radius * spread, offset * config.pitch / (Math.PI * 2) * spread, Math.cos(angle) * config.radius);
      card.rotation.set(0, angle, -.045);
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
    target = THREE.MathUtils.clamp(target, -limit(), limit()); current = target;
    dirty = true; wake();
  }
  function move(delta) { target = THREE.MathUtils.clamp(target + delta, -limit(), limit()); wake(); }
  function wheel(event) {
    if (!enabled || event.ctrlKey) return;
    event.preventDefault();
    const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1);
    move(THREE.MathUtils.clamp(pixels, -160, 160) * SPIRAL_LAYOUT.wheelSpeed);
  }
  function down(event) {
    if (!enabled || event.pointerType === 'mouse' || !event.isPrimary) return;
    pointer = event.pointerId; pointerY = event.clientY; host.setPointerCapture(pointer);
  }
  function drag(event) {
    if (!enabled || event.pointerId !== pointer) return;
    move((pointerY - event.clientY) * SPIRAL_LAYOUT.dragSpeed); pointerY = event.clientY;
  }
  function up() { if (pointer !== null && host.hasPointerCapture(pointer)) host.releasePointerCapture(pointer); pointer = null; }
  function key(event) {
    if (!enabled || !['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp'].includes(event.key)) return;
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
      geometry.dispose(); edges.dispose(); material.dispose(); lineMaterial.dispose();
      resources.forEach(resource => resource.dispose()); renderer?.dispose();
    },
  };
}
