import * as THREE from 'three';
import { gallerySlots, projects } from './projects.js';
import { createArtwork, studyNames } from './artwork.js';

// Recycle only outside the visible stage, equally in either scroll direction.
export function wrapSpiralOffset(offset, span) {
  return ((offset + span / 2) % span + span) % span - span / 2;
}

export const SPIRAL_LAYOUT = {
  desktop: { radius: 3.6, pitch: 8.8, step: 0.78, width: 3.2, aspect: 1.6, count: 25, cameraZ: 11.8 },
  mobile: { radius: 2.12, pitch: 7.8, step: 0.78, width: 2.32, aspect: 1.6, count: 23, cameraZ: 9.6, cameraMin: 4.4, cameraMax: 14.2, targetShare: 0.78, landscapeShare: 0.72 },
  fov: 43, damping: 10, wheelSpeed: .0017, dragSpeed: .007, pixelRatio: 1.75,
  focus: { clearAngle: .08, softAngle: 1.45, screenSoftDistance: .9, speedForBlur: 1.8, maxBlur: .012 },
};

const SNAP_DELAY = 150;
const SNAP_EPSILON = .0005;
const HOVER_DRAG_THRESHOLD = 7;

const QUALITY_PRESETS = Object.freeze({
  high: Object.freeze({ pixelRatio: 1.75, blur: true, motionBlur: true, blurScale: 1, anisotropy: 8, maxTextureSize: 2048 }),
  medium: Object.freeze({ pixelRatio: 1.5, blur: true, motionBlur: true, blurScale: .72, anisotropy: 4, maxTextureSize: 1536 }),
  low: Object.freeze({ pixelRatio: 1.25, blur: false, motionBlur: false, blurScale: 0, anisotropy: 2, maxTextureSize: 1024 }),
});

function isCompactViewport(width, height) {
  const shortEdge = Math.min(width, height);
  return shortEdge < 700 || width < 900 && height >= width || height < 560 && width < 1000;
}

function nextLowerQuality(level) {
  return level === 'high' ? 'medium' : level === 'medium' ? 'low' : 'low';
}

function initialQualityLevel(width, height, compact) {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const pixels = width * height * dpr * dpr;
  if (pixels > 8500000 || dpr > 3 || compact && pixels > 4500000) return 'low';
  if (pixels > 4500000 || dpr > 2 || compact && pixels > 2200000) return 'medium';
  return 'high';
}

export function normalizeSpiralAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

// Kept as a small compatibility helper for callers that only need angular defocus.
export function spiralDefocus(offset) {
  const { clearAngle, softAngle } = SPIRAL_LAYOUT.focus;
  return THREE.MathUtils.smoothstep(Math.abs(normalizeSpiralAngle(offset)), clearAngle, softAngle);
}

function calculateFocusAmount({ angle, distance, screenDistance, speed, nearDistance, farDistance }) {
  const wrappedAngle = Math.atan2(
    Math.sin(angle),
    Math.cos(angle)
  );
  const { clearAngle, softAngle, screenSoftDistance, speedForBlur } = SPIRAL_LAYOUT.focus;
  const angularFocus = 1 - THREE.MathUtils.smoothstep(Math.abs(wrappedAngle), clearAngle, softAngle);
  const distanceFocus = 1 - THREE.MathUtils.smoothstep(distance, nearDistance, farDistance);
  const screenFocus = 1 - THREE.MathUtils.smoothstep(screenDistance, .06, screenSoftDistance);
  const speedPenalty = THREE.MathUtils.clamp(speed / speedForBlur, 0, 1) * (1 - angularFocus) * .28;
  return THREE.MathUtils.clamp(
    angularFocus * .52 + distanceFocus * .23 + screenFocus * .25 - speedPenalty,
    0,
    1,
  );
}

function applyFocus(surface, aspect, quality) {
  const blur = { value: 0 };
  const motionDirection = new THREE.Vector2(1, 0);
  const motionDirectionUniform = { value: motionDirection };
  const motionAmount = { value: 0 };
  surface.userData.blur = blur;
  surface.userData.motionDirection = motionDirection;
  surface.userData.motionAmount = motionAmount;
  surface.onBeforeCompile = shader => {
    shader.uniforms.spiralBlur = blur;
    shader.uniforms.spiralAspect = { value: aspect };
    shader.uniforms.spiralBlurEnabled = quality.blurEnabled;
    shader.uniforms.spiralMotionDirection = motionDirectionUniform;
    shader.uniforms.spiralMotionAmount = motionAmount;
    shader.fragmentShader = 'uniform float spiralBlur;\nuniform float spiralAspect;\nuniform float spiralBlurEnabled;\nuniform vec2 spiralMotionDirection;\nuniform float spiralMotionAmount;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
      #ifdef USE_MAP
        vec2 cardUv = gl_FrontFacing ? vMapUv : vec2(1.0 - vMapUv.x, vMapUv.y);
        vec4 sampledDiffuseColor;
        if (spiralBlurEnabled > 0.5 && spiralBlur > 0.00001) {
          vec4 blurred = vec4(0.0);
          float total = 0.0;
          // A 3x3 kernel is enough for the restrained card-space softness.
          // Motion rotates the kernel toward the projected spiral tangent.
          vec2 axis = normalize(spiralMotionDirection);
          vec2 side = vec2(-axis.y, axis.x);
          for (int y = -1; y <= 1; y++) {
            for (int x = -1; x <= 1; x++) {
              vec2 gridTap = vec2(float(x), float(y));
              vec2 directionalTap = axis * (gridTap.x * 1.55) + side * (gridTap.y * .72);
              vec2 tap = mix(gridTap, directionalTap, spiralMotionAmount);
              vec2 uv = cardUv + tap * spiralBlur * vec2(1.0, spiralAspect);
              float weight = (x == 0 && y == 0) ? 4.0 : (x == 0 || y == 0 ? 2.0 : 1.0);
              blurred += texture2D(map, clamp(uv, vec2(0.001), vec2(0.999))) * weight;
              total += weight;
            }
          }
          sampledDiffuseColor = blurred / total;
        } else {
          // The focused card takes one regular sample and no blur taps.
          sampledDiffuseColor = texture2D(map, cardUv);
        }
        diffuseColor *= sampledDiffuseColor;
        // Rounded silhouette applies equally to artwork and uploaded covers.
        // Normalize the UVs by the card width so portrait cards keep the same
        // physical corner radius as landscape cards.
        vec2 halfSize = vec2(0.5, 0.5 / spiralAspect);
        float radius = 0.06;
        vec2 corner = abs((cardUv - 0.5) * vec2(1.0, 1.0 / spiralAspect)) - halfSize + radius;
        float edge = length(max(corner, 0.0)) + min(max(corner.x, corner.y), 0.0) - radius;
        float aa = max(fwidth(edge), 0.0001);
        diffuseColor.a *= 1.0 - smoothstep(-aa, aa, edge);
      #endif
    `);
  };
  surface.customProgramCacheKey = () => 'spiral-focus-rounded-v4-9tap-backface';
}

export function mountGallery(host) {
  const canvas = host.querySelector('canvas'), fallback = host.querySelector('.gallery-fallback');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const state = {
    reveal: 0,
    activeIndex: 0,
    activeCardIndex: -1,
    activeProject: null,
    isPointerDown: false,
    isReceivingInput: false,
    lastInputTime: 0,
    velocity: 0,
    snapTarget: null,
    isSnapping: false,
    hoveredCardIndex: -1,
    hoveredProject: null,
    qualityLevel: null,
    layout: 'desktop',
    cameraZ: SPIRAL_LAYOUT.desktop.cameraZ,
  };
  let renderer, config, cards = [], resources = [], frame = 0, last = 0;
  let enabled = false, disposed = false, current = 0, target = 0, pointer = null, pointerY = 0;
  let lastInputStamp = 0, previousCurrent = 0, motionSpeed = 0, frameDelta = .016;
  let compactLayout = false, viewportWidth = 0, viewportHeight = 0, resizeFrame = 0;
  let buildVersion = 0, hoveredCard = null, pressedCard = null;
  let pointerStartX = 0, pointerStartY = 0, pointerMoved = false, lastHoverRaycast = 0;
  let hoverAnimating = false;
  let dirty = true, previousReveal = -1, listMode = false;
  const quality = {
    level: null,
    pixelRatio: SPIRAL_LAYOUT.pixelRatio,
    blurEnabled: { value: 1 },
    motionBlurEnabled: { value: 1 },
    blurScale: 1,
    anisotropy: 1,
    maxTextureSize: 2048,
    gridParallax: true,
    runtimeFrames: 0,
    runtimeTotalMs: 0,
    runtimeSampled: false,
  };
  const artwork = studyNames.map((_, i) => createArtwork(i));
  [...fallback.children].forEach((card, i) => { card.style.backgroundImage = `url(${artwork[i % artwork.length].toDataURL()})`; });
  const shell = host.parentElement, list = shell.querySelector('.gallery-list'), grid = shell.querySelector('.gallery-grid');
  const buttons = [...shell.querySelectorAll('[data-view]')];
  const entries = projects.length ? gallerySlots(projects.length) : gallerySlots(studyNames.length).map(slot => ({
    ...slot,
    title: studyNames[slot.study],
    cover: artwork[slot.study].toDataURL(),
  }));
  entries.forEach((entry, i) => {
    const row = document.createElement('div'); row.className = 'gallery-list-row';
    const img = document.createElement('img'); img.src = entry.cover || artwork[entry.study ?? i % artwork.length].toDataURL(); img.alt = '';
    img.style.aspectRatio = String(entry.aspect);
    const name = document.createElement('span'); name.textContent = entry.title;
    const meta = document.createElement('small'); meta.textContent = entry.placeholder ? '视觉预览 / '+String(i+1).padStart(2,'0') : String(i+1).padStart(2,'0');
    row.append(img, name, meta); list.append(row);
  });
  function switchView(event) {
    listMode = event.currentTarget.dataset.view === 'list';
    clearHover();
    list.hidden = !listMode; host.style.visibility = listMode ? 'hidden' : 'visible';
    buttons.forEach(button => button.setAttribute('aria-pressed', String((button.dataset.view === 'list') === listMode)));
    up(); dirty = true; wake();
  }
  buttons.forEach(button => button.addEventListener('click', switchView));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(SPIRAL_LAYOUT.fov, 1, .1, 100);
  // 24x8 keeps the transverse bow smooth while reducing vertex work per card.
  const geometry = new THREE.PlaneGeometry(1, 1, 24, 8);
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i);
    // A shallow transverse bow: the center stays readable while both edges
    // recede slightly from the camera. The shared geometry keeps UVs intact.
    positions.setZ(i, -.52 * x * x + .06 * Math.sin(x * Math.PI) * y);
  }
  geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, transparent: true, alphaTest: .05 });
  const projectedPosition = new THREE.Vector3();
  const tangentPosition = new THREE.Vector3();
  const projectedTangent = new THREE.Vector3();
  const raycaster = new THREE.Raycaster();
  const pointerPosition = new THREE.Vector2(-100, -100);
  const clickableMeshes = [];
  const precisePointer = matchMedia('(hover: hover) and (pointer: fine)');

  function setQuality(level) {
    const preset = QUALITY_PRESETS[level];
    if (!preset) return;
    quality.level = level;
    quality.pixelRatio = Math.min(preset.pixelRatio, Math.max(1, window.devicePixelRatio || 1));
    quality.blurScale = preset.blurScale;
    quality.anisotropy = preset.anisotropy;
    quality.maxTextureSize = Math.min(preset.maxTextureSize, renderer?.capabilities.maxTextureSize ?? preset.maxTextureSize);
    quality.blurEnabled.value = preset.blur ? 1 : 0;
    quality.motionBlurEnabled.value = preset.motionBlur && !motion.matches ? 1 : 0;
    quality.gridParallax = !compactLayout && !motion.matches && level !== 'low';
    state.qualityLevel = level;
    if (renderer && viewportWidth && viewportHeight) {
      renderer.setPixelRatio(quality.pixelRatio);
      renderer.setSize(viewportWidth, viewportHeight, false);
    }
    cards.forEach(card => {
      const texture = card.children[0]?.material.map;
      if (texture) {
        limitTextureSize(texture);
        texture.anisotropy = Math.min(quality.anisotropy, renderer?.capabilities.getMaxAnisotropy() ?? 1);
      }
    });
    dirty = true; wake();
  }

  function recordFrameTime(dt) {
    if (!renderer || quality.runtimeSampled) return;
    quality.runtimeFrames += 1;
    quality.runtimeTotalMs += dt * 1000;
    if (quality.runtimeFrames < 36) return;
    quality.runtimeSampled = true;
    const averageMs = quality.runtimeTotalMs / quality.runtimeFrames;
    if (averageMs > 27 && quality.level !== 'low') setQuality(nextLowerQuality(quality.level));
  }

  function limitTextureSize(texture) {
    const image = texture?.image;
    const width = image?.naturalWidth || image?.width || 0;
    const height = image?.naturalHeight || image?.height || 0;
    const maxSize = quality.maxTextureSize;
    if (!width || !height || Math.max(width, height) <= maxSize) return;
    const scale = maxSize / Math.max(width, height);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext('2d');
    if (!context) return;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    texture.image = canvas;
    texture.needsUpdate = true;
  }

  function fail() {
    cancelPointer();
    canvas.hidden = true; fallback.hidden = false; enabled = false;
    cancelAnimationFrame(frame); frame = 0;
  }
  try {
    if (new URLSearchParams(location.search).has('no-webgl')) throw new Error('Fallback requested');
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setClearColor(0x11110f, 0);
  } catch { fail(); }
  function rebuild() {
    const version = ++buildVersion;
    cards.forEach(card => scene.remove(card));
    clickableMeshes.length = 0;
    resources.forEach(resource => resource.dispose()); resources = [];
    const loader = new THREE.TextureLoader();
    const sequenceLength = projects.length || studyNames.length;
    const poolSize = Math.ceil(config.count / sequenceLength) * sequenceLength;
    cards = gallerySlots(poolSize).map((slot, i) => {
      const group = new THREE.Group();
      const surface = material.clone(); resources.push(surface);
      applyFocus(surface, slot.aspect, quality);
      const fallbackArtwork = artwork[slot.study ?? i % artwork.length];
      const createFallbackTexture = () => {
        const fallbackTexture = new THREE.CanvasTexture(fallbackArtwork);
        limitTextureSize(fallbackTexture);
        fallbackTexture.colorSpace = THREE.SRGBColorSpace;
        return fallbackTexture;
      };
      const texture = slot.cover ? loader.load(slot.cover, loadedTexture => {
        if (version !== buildVersion || disposed) { loadedTexture.dispose(); return; }
        limitTextureSize(loadedTexture); dirty = true; wake();
      }, undefined, () => {
        if (version !== buildVersion || disposed) return;
        surface.map?.dispose();
        surface.map = createFallbackTexture(); resources.push(surface.map);
        surface.needsUpdate = true; dirty = true; wake();
      }) : createFallbackTexture();
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(quality.anisotropy, renderer?.capabilities.getMaxAnisotropy() ?? 1);
      resources.push(texture); surface.map = texture;
      surface.depthTest = true;
      surface.depthWrite = true;
      const mesh = new THREE.Mesh(geometry, surface);
      if (!slot.placeholder && slot.link) clickableMeshes.push(mesh);
      group.add(mesh);
      group.userData = { ...slot, projectIndex: i % sequenceLength, isActive: false, hoverAmount: 0, focusAmount: 0 };
      scene.add(group); return group;
    });
  }
  function updateActiveCard() {
    if (!cards.length || !config) return;
    const slotShift = Math.round(current / config.step);
    const nextCardIndex = ((Math.floor(cards.length / 2) - slotShift) % cards.length + cards.length) % cards.length;
    if (nextCardIndex === state.activeCardIndex) return;
    if (state.activeCardIndex >= 0 && cards[state.activeCardIndex]) cards[state.activeCardIndex].userData.isActive = false;
    const activeCard = cards[nextCardIndex];
    activeCard.userData.isActive = true;
    state.activeCardIndex = nextCardIndex;
    const nextProjectIndex = activeCard.userData.projectIndex ?? activeCard.userData.study ?? nextCardIndex;
    state.activeProject = activeCard.userData.placeholder ? null : activeCard.userData;
    if (nextProjectIndex !== state.activeIndex) {
      state.activeIndex = nextProjectIndex;
    }
  }

  function updatePointerPosition(event) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return false;
    pointerPosition.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    return true;
  }

  function getHitCard(event) {
    if (!renderer || canvas.hidden || !updatePointerPosition(event)) return null;
    raycaster.setFromCamera(pointerPosition, camera);
    const intersections = raycaster.intersectObjects(clickableMeshes, false);
    for (let i = 0; i < intersections.length; i++) {
      const mesh = intersections[i].object;
      const card = mesh.parent;
      if (card?.visible && mesh.visible && card.userData.link && card.userData.focusAmount > .04) return card;
    }
    return null;
  }

  function setHover(card) {
    if (hoveredCard === card) return;
    if (hoveredCard) hoveredCard.userData.isHovered = false;
    hoveredCard = card;
    if (hoveredCard) {
      hoveredCard.userData.isHovered = true;
      state.hoveredCardIndex = cards.indexOf(hoveredCard);
      state.hoveredProject = hoveredCard.userData;
      host.dataset.hoverTitle = hoveredCard.userData.title || '';
      host.title = hoveredCard.userData.title || '';
      host.style.cursor = 'pointer';
    } else {
      state.hoveredCardIndex = -1;
      state.hoveredProject = null;
      delete host.dataset.hoverTitle;
      host.removeAttribute('title');
      host.style.cursor = '';
    }
    dirty = true; wake();
  }

  function clearHover() {
    setHover(null);
    pointerPosition.set(-100, -100);
  }

  function updateHover(event) {
    if (!enabled || listMode || state.isPointerDown || compactLayout || !precisePointer.matches || !projects.length) {
      clearHover();
      return;
    }
    const now = performance.now();
    if (now - lastHoverRaycast < 32) return;
    lastHoverRaycast = now;
    setHover(getHitCard(event));
  }

  function openProject(card) {
    if (!card || card.userData.placeholder || typeof card.userData.link !== 'string' || !card.userData.link) return;
    window.location.assign(card.userData.link);
  }

  function draw() {
    const spread = .78 + state.reveal * .22;
    const nearDistance = Math.max(.1, camera.position.z - config.radius * 1.2);
    const farDistance = camera.position.z + config.radius * 1.8 + config.pitch * .75;
    const speed = Math.max(motionSpeed, Math.abs(state.velocity));
    const speedFactor = THREE.MathUtils.clamp(speed / SPIRAL_LAYOUT.focus.speedForBlur, 0, 1);
    hoverAnimating = false;
    updateActiveCard();
    cards.forEach((card, i) => {
      const offset = wrapSpiralOffset((i - Math.floor(cards.length / 2)) * config.step + current, cards.length * config.step);
      const angle = offset;
      const { aspect, size, tiltX, tiltY, tiltZ, radialOffset } = card.userData;
      const radius = config.radius + radialOffset;
      card.position.set(Math.sin(angle) * radius * spread, offset * config.pitch / (Math.PI * 2) * spread, Math.cos(angle) * radius);
      card.rotation.set(.08 * Math.sin(angle) + tiltX, angle - .22 * Math.sin(angle) + tiltY, -.055 * Math.sin(angle) + tiltZ);
      const surface = card.children[0].material;
      const distance = card.position.distanceTo(camera.position);
      const projected = projectedPosition.copy(card.position).project(camera);
      const screenDistance = Math.hypot(projected.x, projected.y);
      const focusAmount = calculateFocusAmount({ angle, distance, screenDistance, speed, nearDistance, farDistance });
      const depthAmount = 1 - THREE.MathUtils.smoothstep(distance, nearDistance, farDistance);
      const focusScale = THREE.MathUtils.lerp(.82, 1.08, focusAmount);
      const brightness = THREE.MathUtils.lerp(.58, 1, focusAmount);
      const opacity = THREE.MathUtils.lerp(.4, 1, focusAmount);
      const hoverTarget = card === hoveredCard ? 1 : 0;
      const previousHover = card.userData.hoverAmount || 0;
      const hoverAmount = THREE.MathUtils.damp(previousHover, hoverTarget, 18, frameDelta);
      card.userData.hoverAmount = hoverAmount;
      if (Math.abs(hoverAmount - hoverTarget) > .001) hoverAnimating = true;
      const blurFalloff = 1 - THREE.MathUtils.smoothstep(focusAmount, .78, .95);
      const blur = quality.blurEnabled.value ? THREE.MathUtils.clamp((1 - focusAmount) * (.005 + speedFactor * .004) * blurFalloff * quality.blurScale, 0, SPIRAL_LAYOUT.focus.maxBlur) : 0;
      const motionAmount = quality.motionBlurEnabled.value ? speedFactor * (1 - focusAmount) * .42 : 0;
      const motionDirection = surface.userData.motionDirection;
      tangentPosition.set(
        card.position.x + Math.cos(angle) * radius * spread * .16,
        card.position.y + config.pitch / (Math.PI * 2) * spread * .16,
        card.position.z - Math.sin(angle) * radius * .16,
      );
      const tangent = projectedTangent.copy(tangentPosition).project(camera);
      const tangentX = tangent.x - projected.x, tangentY = tangent.y - projected.y;
      const tangentLength = Math.hypot(tangentX, tangentY);
      if (motionAmount > .001 && tangentLength > .0001) {
        const direction = state.velocity < 0 ? -1 : 1;
        motionDirection.set(direction * tangentX / tangentLength, direction * tangentY / tangentLength);
      } else motionDirection.set(1, 0);
      card.userData.focusAmount = focusAmount;
      const visible = projected.z > -1.08 && projected.z < 1.08 && Math.abs(projected.x) < 1.45 && Math.abs(projected.y) < 1.45 && opacity > .05;
      card.visible = visible;
      card.renderOrder = 100 + Math.round(depthAmount * 1000);
      card.children[0].renderOrder = card.renderOrder;
      surface.userData.blur.value = blur;
      surface.userData.motionAmount.value = motionAmount;
      surface.color.setScalar(Math.min(1.04, brightness + hoverAmount * .045));
      surface.opacity = opacity;
      const cardWidth = config.width * size;
      // A tiny depth multiplier makes wider cards bow a little more without
      // turning portrait cards into visibly cylindrical surfaces.
      const hoverScale = 1 + hoverAmount * .02;
      card.scale.set(cardWidth * focusScale * hoverScale, cardWidth * focusScale * hoverScale / aspect, .9 + .16 * size);
    });
    if (grid) {
      if (quality.gridParallax) {
        const gridOffsetX = Math.sin(current * .55) * 2.5;
        const gridOffsetY = THREE.MathUtils.clamp(current * .32, -4, 4);
        grid.style.transform = `translate3d(${gridOffsetX.toFixed(2)}px,${gridOffsetY.toFixed(2)}px,0)`;
      } else grid.style.transform = 'none';
    }
    renderer?.render(scene, camera);
  }
  function normalizeTravel(span) {
    if (!Number.isFinite(span) || span <= 0 || !Number.isFinite(current)) return;
    const normalized = wrapSpiralOffset(current, span);
    const distance = current - normalized;
    if (Math.abs(distance) < SNAP_EPSILON) return;
    current = normalized;
    target -= distance;
    if (state.snapTarget !== null) state.snapTarget -= distance;
  }
  function startSnap() {
    if (!config || !cards.length || state.isPointerDown) return;
    state.snapTarget = Math.round(current / config.step) * config.step;
    target = state.snapTarget;
    state.isReceivingInput = false;
    state.isSnapping = Math.abs(target - current) > SNAP_EPSILON;
    if (!state.isSnapping) {
      current = target;
      state.snapTarget = null;
      state.velocity = 0;
    }
  }
  function tick(time) {
    frame = 0;
    if (disposed || document.hidden || !renderer || canvas.hidden) return;
    const dt = Math.min((time - (last || time)) / 1000, .05); last = time;
    frameDelta = dt;
    recordFrameTime(dt);
    if (state.isReceivingInput && !state.isPointerDown && !state.isSnapping && time - state.lastInputTime >= SNAP_DELAY) startSnap();
    const moving = Math.abs(target - current) > .0001;
    if (moving) {
      const damping = state.isSnapping ? (motion.matches ? 26 : 14) : (motion.matches ? 100 : SPIRAL_LAYOUT.damping);
      current = THREE.MathUtils.damp(current, target, damping, dt);
    }
    else current = target;
    // Keep long sessions numerically stable without changing the easing distance.
    const span = cards.length * config.step;
    normalizeTravel(span);
    const frameVelocity = (current - previousCurrent) / Math.max(dt, .001);
    motionSpeed = motion.matches ? 0 : THREE.MathUtils.damp(motionSpeed, Math.abs(frameVelocity), 12, dt);
    state.velocity = motion.matches ? 0 : THREE.MathUtils.damp(state.velocity, frameVelocity, 10, dt);
    if (state.isSnapping && Math.abs(target - current) <= SNAP_EPSILON) {
      current = target;
      state.snapTarget = null;
      state.isSnapping = false;
      state.velocity = 0;
    }
    if (dirty || moving || previousReveal !== state.reveal) draw();
    previousCurrent = current;
    previousReveal = state.reveal; dirty = false;
    const waitingForSnap = state.isReceivingInput && !state.isPointerDown && !state.isSnapping;
    if (moving || waitingForSnap || state.isSnapping || hoverAnimating || state.reveal > 0 && state.reveal < 1) wake();
  }
  function wake() {
    if (!frame && !disposed && !document.hidden && renderer && !canvas.hidden) frame = requestAnimationFrame(tick);
  }

  function mobileCameraZ(width, height) {
    const mobile = SPIRAL_LAYOUT.mobile;
    const viewportAspect = Math.max(.34, width / Math.max(1, height));
    const targetShare = width > height ? mobile.landscapeShare : mobile.targetShare;
    // Solve for the distance that lets the focused first card occupy the
    // intended width. This deliberately does not use the desktop framing rule.
    const focusedCardWidth = mobile.width * 1.08 * 1.08;
    const distance = focusedCardWidth / (2 * targetShare * Math.tan(THREE.MathUtils.degToRad(SPIRAL_LAYOUT.fov / 2)) * viewportAspect);
    return THREE.MathUtils.clamp(mobile.radius + distance, mobile.cameraMin, mobile.cameraMax);
  }

  function resize() {
    const width = host.clientWidth, height = host.clientHeight;
    const nextCompact = isCompactViewport(width, height);
    const next = nextCompact ? SPIRAL_LAYOUT.mobile : SPIRAL_LAYOUT.desktop;
    const layoutChanged = next !== config || nextCompact !== compactLayout;
    compactLayout = nextCompact;
    config = next;
    host.dataset.layout = compactLayout ? 'mobile' : 'desktop';
    camera.aspect = width / Math.max(1, height);
    if (compactLayout) {
      camera.position.set(0, 0, mobileCameraZ(width, height));
    } else {
      camera.position.set(0, 0, Math.max(config.cameraZ, (config.radius + config.width * .55) / Math.tan(THREE.MathUtils.degToRad(SPIRAL_LAYOUT.fov / 2)) / camera.aspect + config.radius));
    }
    camera.updateProjectionMatrix();
    state.layout = compactLayout ? 'mobile' : 'desktop';
    state.cameraZ = camera.position.z;
    viewportWidth = width; viewportHeight = height;
    const requestedQuality = initialQualityLevel(width, height, compactLayout);
    const qualityOrder = { high: 0, medium: 1, low: 2 };
    if (!quality.level || qualityOrder[requestedQuality] > qualityOrder[quality.level]) setQuality(requestedQuality);
    if (layoutChanged) {
      quality.runtimeFrames = 0; quality.runtimeTotalMs = 0; quality.runtimeSampled = false;
      if (renderer && !canvas.hidden) rebuild();
    }
    renderer?.setPixelRatio(quality.pixelRatio);
    renderer?.setSize(width, height, false);
    dirty = true; wake();
  }
  function move(delta) {
    if (!Number.isFinite(delta) || delta === 0) return;
    const now = performance.now();
    const elapsed = Math.max(.016, (now - (lastInputStamp || now - 16)) / 1000);
    const inputVelocity = THREE.MathUtils.clamp(delta / elapsed, -6, 6);
    state.velocity = THREE.MathUtils.clamp(state.velocity * .35 + inputVelocity * .65, -6, 6);
    lastInputStamp = now;
    state.lastInputTime = now;
    state.isReceivingInput = true;
    state.isSnapping = false;
    state.snapTarget = null;
    target += delta;
    wake();
  }
  function wheel(event) {
    if (!enabled || listMode || event.ctrlKey) return;
    event.preventDefault();
    clearHover();
    const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1);
    move(THREE.MathUtils.clamp(pixels, -160, 160) * SPIRAL_LAYOUT.wheelSpeed);
  }
  function down(event) {
    if (!enabled || listMode || event.button !== 0 || !event.isPrimary) return;
    host.focus({ preventScroll: true });
    const now = performance.now();
    pressedCard = projects.length ? getHitCard(event) : null;
    clearHover();
    pointerStartX = event.clientX; pointerStartY = event.clientY; pointerMoved = false;
    state.isPointerDown = true;
    state.isReceivingInput = true;
    state.isSnapping = false;
    state.snapTarget = null;
    state.velocity = 0;
    state.lastInputTime = now;
    lastInputStamp = now;
    host.classList.add('is-dragging'); pointer = event.pointerId; pointerY = event.clientY; host.setPointerCapture(pointer);
  }
  function drag(event) {
    if (!enabled) return;
    if (event.pointerId !== pointer) {
      if (pointer === null) updateHover(event);
      return;
    }
    if (!pointerMoved && Math.hypot(event.clientX - pointerStartX, event.clientY - pointerStartY) > HOVER_DRAG_THRESHOLD) pointerMoved = true;
    clearHover();
    move((pointerY - event.clientY) * SPIRAL_LAYOUT.dragSpeed); pointerY = event.clientY;
  }
  function endPointerInput(withInertia = true, event = null) {
    const wasPointerActive = state.isPointerDown || pointer !== null;
    const clickedCard = withInertia && event && !pointerMoved && pressedCard && getHitCard(event) === pressedCard ? pressedCard : null;
    if (wasPointerActive) {
      if (withInertia && !motion.matches) target += THREE.MathUtils.clamp(state.velocity * .045, -.16, .16);
      state.isPointerDown = false;
      state.isReceivingInput = true;
      state.lastInputTime = performance.now();
      state.isSnapping = false;
      state.snapTarget = null;
    }
    host.classList.remove('is-dragging');
    if (pointer !== null && host.hasPointerCapture(pointer)) host.releasePointerCapture(pointer);
    pointer = null;
    pressedCard = null; pointerMoved = false;
    clearHover();
    if (clickedCard) openProject(clickedCard);
    wake();
  }
  function up(event = null) {
    if (event && pointer !== null && event.pointerId !== pointer) return;
    endPointerInput(true, event);
  }
  function cancelPointer() {
    endPointerInput(false);
    clearHover();
  }
  function leave() { clearHover(); }
  function key(event) {
    if (!enabled || listMode || !['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp'].includes(event.key)) return;
    event.preventDefault();
    clearHover();
    const steps = event.key.startsWith('Page') ? 3 : 1;
    move((event.key.includes('Down') ? 1 : -1) * config.step * steps);
  }
  function visibility() {
    if (document.hidden) cancelPointer();
    clearHover(); motionSpeed = 0; state.velocity = 0;
    cancelAnimationFrame(frame); frame = 0; last = 0; previousCurrent = current;
    if (!document.hidden) { dirty = true; wake(); }
  }
  function lost(event) { event.preventDefault(); fail(); }
  function queueResize() {
    if (resizeFrame) return;
    resizeFrame = requestAnimationFrame(() => { resizeFrame = 0; resize(); });
  }
  function motionChange() {
    if (quality.level) setQuality(quality.level);
    dirty = true; wake();
  }
  host.addEventListener('wheel', wheel, { passive: false });
  host.addEventListener('pointerdown', down); host.addEventListener('pointermove', drag);
  host.addEventListener('pointerup', up); host.addEventListener('pointercancel', cancelPointer); host.addEventListener('pointerleave', leave); host.addEventListener('keydown', key);
  canvas.addEventListener('webglcontextlost', lost);
  window.addEventListener('resize', queueResize); window.addEventListener('blur', cancelPointer); document.addEventListener('visibilitychange', visibility);
  motion.addEventListener?.('change', motionChange);
  resize();
  return {
    state, update() { dirty = true; wake(); },
    enable(value) { enabled = value && !!renderer && !canvas.hidden; if (!value) cancelPointer(); host.dataset.interactive = String(enabled); },
    reset() {
      enabled = false; cancelPointer(); clearHover(); current = target = state.reveal = 0;
      state.activeIndex = 0; state.activeCardIndex = -1; state.activeProject = null;
      state.isPointerDown = false; state.isReceivingInput = false; state.lastInputTime = 0;
      state.velocity = 0; state.snapTarget = null; state.isSnapping = false; state.hoveredCardIndex = -1; state.hoveredProject = null;
      lastInputStamp = 0; previousCurrent = 0; motionSpeed = 0; hoverAnimating = false; dirty = true; wake();
    },
    dispose() {
      disposed = true; cancelAnimationFrame(frame); cancelAnimationFrame(resizeFrame); resizeFrame = 0; cancelPointer();
      host.removeEventListener('wheel', wheel); host.removeEventListener('pointerdown', down);
      host.removeEventListener('pointermove', drag); host.removeEventListener('pointerup', up); host.removeEventListener('pointercancel', cancelPointer); host.removeEventListener('pointerleave', leave);
      host.removeEventListener('keydown', key); canvas.removeEventListener('webglcontextlost', lost);
      window.removeEventListener('resize', queueResize); window.removeEventListener('blur', cancelPointer); document.removeEventListener('visibilitychange', visibility);
      motion.removeEventListener?.('change', motionChange);
      buttons.forEach(button => button.removeEventListener('click', switchView)); list.replaceChildren();
      geometry.dispose(); material.dispose();
      resources.forEach(resource => resource.dispose()); renderer?.dispose();
    },
  };
}
