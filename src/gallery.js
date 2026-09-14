import * as THREE from 'three';
import { gallerySlots, projects } from './projects.js';
import { createArtwork, studyNames } from './artwork.js';

// Recycle only outside the visible stage, equally in either scroll direction.
export function wrapSpiralOffset(offset, span) {
  return ((offset + span / 2) % span + span) % span - span / 2;
}

export const SPIRAL_LAYOUT = {
  desktop: { radius: 3.85, pitch: 10.4, step: 0.9, width: 3.05, aspect: 1.6, count: 25, cameraShare: 0.29 },
  mobile: { radius: 2.15, pitch: 9.0, step: 0.94, width: 2.05, aspect: 1.6, count: 23, targetShare: 0.76, cameraMin: 7.0, cameraMax: 12.5, rootRotationZ: -0.035, rootOffsetX: -0.05, rootOffsetY: 0.04 },
  compactLandscape: { radius: 2.1, pitch: 8.8, step: 0.96, width: 2.0, aspect: 1.6, count: 23, targetShare: 0.66, cameraMin: 3.25, cameraMax: 7.8, rootRotationZ: -0.035, rootOffsetX: -0.05, rootOffsetY: 0.04 },
  fov: 43, normalDamping: 14, snapDamping: 16, wheelSpeed: .0026, dragSpeed: .009, pixelRatio: 1.75,
  autoRotation: { speed: 0.11 },
  focus: { minDistance: .15, maxDistance: 2.4, maxBlur: .005 },
};

// The calibration route is intentionally pinned to the previously accepted
// mobile frame too. Normal mobile browsing uses the stage-three configuration
// above, but calibration never inherits those visual changes.
const CALIBRATION_MOBILE_LAYOUT = { radius: 2.12, pitch: 7.8, step: 0.78, width: 2.32, aspect: 1.6, count: 23, cameraMin: 4.4, cameraMax: 14.2, targetShare: 0.78, landscapeShare: 0.72, rootRotationZ: -0.05, rootOffsetX: -0.12, rootOffsetY: 0.05 };

export const QUALITY_PRESETS = Object.freeze({
  high: Object.freeze({ pixelRatio: 1.75, blurSamples: 9, motionBlur: true, anisotropy: 8 }),
  medium: Object.freeze({ pixelRatio: 1.5, blurSamples: 9, motionBlur: false, anisotropy: 4 }),
  low: Object.freeze({ pixelRatio: 1.25, blurSamples: 1, motionBlur: false, anisotropy: 2 }),
});

const SNAP_EPSILON = .0005;
const HOVER_RAYCAST_INTERVAL = 32;
const HOVER_IN_DURATION = 180;
const HOVER_OUT_DURATION = 150;

function isCompactViewport(width, height) {
  const shortEdge = Math.min(width, height);
  return shortEdge < 700 || width < 900 && height >= width || height < 560 && width < 1000;
}

function chooseQuality(width, height, dpr, isMobile, reducedMotion) {
  const pixels = width * height * Math.max(1, dpr) ** 2;
  if (pixels > 11_000_000) return 'low';
  if (reducedMotion || isMobile || pixels > 5_500_000) return 'medium';
  return 'high';
}

function textureAspect(texture, fallback = 1.6) {
  const image = texture?.image;
  const width = image?.naturalWidth || image?.videoWidth || image?.width;
  const height = image?.naturalHeight || image?.videoHeight || image?.height;
  return width > 0 && height > 0 ? width / height : fallback;
}

export function normalizeSpiralAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

export function calculateSpiralTransform({ offset, radius, pitch, spread = 1 }) {
  const angle = offset;
  const wrappedAngle = normalizeSpiralAngle(angle);
  return {
    angle,
    wrappedAngle,
    position: {
      x: Math.sin(angle) * radius * spread,
      y: angle * pitch / (Math.PI * 2) * spread,
      z: Math.cos(angle) * radius,
    },
    rotation: {
      pitch: Math.sin(angle) * 0.025,
      yaw: THREE.MathUtils.clamp(wrappedAngle * 0.28, -0.72, 0.72),
      roll: -Math.sin(angle) * 0.055,
    },
  };
}

export function calculateCameraZ({ radius, cardWidth, viewportAspect, fov, targetScreenShare }) {
  const halfFov = THREE.MathUtils.degToRad(fov / 2);
  const safeAspect = Math.max(0.01, viewportAspect);
  const safeShare = THREE.MathUtils.clamp(targetScreenShare, 0.01, 0.99);
  const distanceFromFrontCard = cardWidth / (
    2 * safeShare * Math.tan(halfFov) * safeAspect
  );
  return radius + distanceFromFrontCard;
}

export function applyCardTransform(card, transform, { width, aspect = 1.6, tiltX = 0, tiltY = 0, tiltZ = 0 }) {
  const cardWidth = width;
  const cardHeight = cardWidth / aspect;
  card.position.set(transform.position.x, transform.position.y, transform.position.z);
  card.rotation.set(transform.rotation.pitch + tiltX, transform.rotation.yaw + tiltY, transform.rotation.roll + tiltZ);
  card.scale.set(cardWidth, cardHeight, 1);
}

// Kept as a small compatibility helper for callers that only need angular defocus.
export function spiralDefocus(offset) {
  const { minDistance, maxDistance } = SPIRAL_LAYOUT.focus;
  return THREE.MathUtils.smoothstep(Math.abs(normalizeSpiralAngle(offset)), minDistance, maxDistance);
}

export function calculateFocusAmount(offset, step) {
  const normalizedDistance = Math.abs(offset) / Math.max(step, Number.EPSILON);
  const { minDistance, maxDistance } = SPIRAL_LAYOUT.focus;
  return 1 - THREE.MathUtils.smoothstep(normalizedDistance, minDistance, maxDistance);
}

function colorValue(value) {
  try { return new THREE.Color(value); } catch { return new THREE.Color('#11110f'); }
}

function applyFocus(surface, cardData, quality) {
  const uniforms = {
    spiralBlur: { value: 0 },
    spiralSourceAspect: { value: 1.6 },
    spiralCardAspect: { value: cardData.aspect },
    spiralFocal: { value: new THREE.Vector2(cardData.focalX, 1 - cardData.focalY) },
    spiralFitContain: { value: cardData.fit === 'contain' ? 1 : 0 },
    spiralBackgroundColor: { value: colorValue(cardData.backgroundColor) },
    spiralMotionAmount: { value: 0 },
    spiralMotionDirection: { value: new THREE.Vector2(0, 0) },
    spiralBlurEnabled: { value: quality.blurSamples > 1 ? 1 : 0 },
  };
  surface.userData.blur = uniforms.spiralBlur;
  surface.userData.shaderUniforms = uniforms;
  surface.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    const sampleBlock = quality.blurSamples > 1 ? `
        if (spiralBlurEnabled > 0.5 && (spiralBlur > 0.00001 || spiralMotionAmount > 0.00001)) {
          vec4 blurred = vec4(0.0);
          float total = 0.0;
          // Fixed 3x3 kernel: static focus blur and speed blur share nine taps.
          for (int y = -1; y <= 1; y++) {
            for (int x = -1; x <= 1; x++) {
              vec2 gridTap = vec2(float(x), float(y));
              vec2 uv = cardUv + gridTap * spiralBlur * vec2(1.0, spiralCardAspect);
              uv += spiralMotionDirection * spiralMotionAmount * 0.012 * float(x);
              float weight = (x == 0 && y == 0) ? 4.0 : (x == 0 || y == 0 ? 2.0 : 1.0);
              blurred += sampleSpiralCard(uv) * weight;
              total += weight;
            }
          }
          sampledDiffuseColor = blurred / total;
        } else {
          sampledDiffuseColor = sampleSpiralCard(cardUv);
        }` : `
        // Low quality keeps the exact same mapping with one texture sample.
        sampledDiffuseColor = sampleSpiralCard(cardUv);`;
    const customUniforms = `
      uniform float spiralBlur;
      uniform float spiralSourceAspect;
      uniform float spiralCardAspect;
      uniform vec2 spiralFocal;
      uniform float spiralFitContain;
      uniform vec3 spiralBackgroundColor;
      uniform float spiralMotionAmount;
      uniform vec2 spiralMotionDirection;
      uniform float spiralBlurEnabled;
    `;
    const sampleHelper = `
      vec4 sampleSpiralCard(vec2 cardUv) {
        vec2 imageWindow = vec2(1.0);
        vec2 inset = vec2(0.0);
        if (spiralFitContain > 0.5) {
          if (spiralSourceAspect > spiralCardAspect) imageWindow.y = spiralCardAspect / spiralSourceAspect;
          else imageWindow.x = spiralSourceAspect / spiralCardAspect;
          inset = (vec2(1.0) - imageWindow) * 0.5;
          if (cardUv.x < inset.x || cardUv.x > inset.x + imageWindow.x || cardUv.y < inset.y || cardUv.y > inset.y + imageWindow.y) {
            return vec4(spiralBackgroundColor, 1.0);
          }
          return texture2D(map, clamp((cardUv - inset) / imageWindow, vec2(0.001), vec2(0.999)));
        }
        if (spiralSourceAspect > spiralCardAspect) imageWindow.x = spiralCardAspect / spiralSourceAspect;
        else imageWindow.y = spiralSourceAspect / spiralCardAspect;
        vec2 crop = vec2(1.0) - imageWindow;
        return texture2D(map, clamp(spiralFocal * crop + cardUv * imageWindow, vec2(0.001), vec2(0.999)));
      }
    `;
    // map_pars_fragment declares the built-in sampler. Insert the helper
    // after that include so the custom function has a declared map uniform.
    shader.fragmentShader = customUniforms + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_pars_fragment>', `#include <map_pars_fragment>\n${sampleHelper}`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
      #ifdef USE_MAP
        vec2 cardUv = vMapUv;
        vec4 sampledDiffuseColor;
        ${sampleBlock}
        diffuseColor *= sampledDiffuseColor;
        // The SDF uses physical card coordinates, so portrait corners match
        // landscape corners after the card's non-uniform scale.
        vec2 physical = (cardUv - 0.5) * vec2(spiralCardAspect, 1.0);
        vec2 halfSize = vec2(spiralCardAspect, 1.0) * 0.5 - 0.06;
        float radius = 0.06;
        vec2 corner = abs(physical) - halfSize;
        float edge = length(max(corner, 0.0)) + min(max(corner.x, corner.y), 0.0) - radius;
        float aa = max(fwidth(edge), 0.0001);
        diffuseColor.a *= 1.0 - smoothstep(-aa, aa, edge);
      #endif
    `);
  };
  surface.customProgramCacheKey = () => `spiral-focus-rounded-v6-${quality.blurSamples}`;
}

export function mountGallery(host) {
  const canvas = host.querySelector('canvas'), fallback = host.querySelector('.gallery-fallback');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const precisePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const calibrationMode = new URLSearchParams(location.search).get('spiral-calibration') === '1';
  const calibrationCardDefaults = Object.freeze({ aspect: 1.6, fit: 'cover', focalX: 0.5, focalY: 0.5, size: 1, tiltX: 0, tiltY: 0, tiltZ: 0, radialOffset: 0, backgroundColor: '#11110f' });
  const baseStageLabel = host.getAttribute('aria-label') || '螺旋画廊';
  const motionState = {
    current: 0,
    target: 0,
    velocity: 0,
    autoVelocity: 0,
    isDragging: false,
    isReceivingWheel: false,
    snapRequested: false,
    isSnapping: false,
    snapTarget: null,
    lastInputTime: 0,
  };
  const state = {
    reveal: calibrationMode ? 1 : 0,
    activeIndex: 0,
    activeCardIndex: -1,
    activeProject: null,
    layout: 'desktop',
    cameraZ: 0,
  };
  let renderer, config, cards = [], resources = new Set(), resourceRefs = new Map(), frame = 0, last = 0, buildVersion = 0;
  let enabled = false, disposed = false;
  let previousCurrent = 0;
  let compactLayout = false, viewportWidth = 0, viewportHeight = 0, resizeFrame = 0;
  let dirty = true, previousReveal = -1, listMode = false, calibrationLogKey = '', lastHoverRaycast = 0;
  let hoveredCard = null, contextLost = false;
  let pointerInside = false;
  const quality = { level: 'high', ...QUALITY_PRESETS.high, blurEnabled: { value: calibrationMode ? 0 : 1 } };
  const artwork = studyNames.map((_, i) => createArtwork(i));
  [...fallback.children].forEach((card, i) => { card.style.backgroundImage = `url(${artwork[i % artwork.length].toDataURL()})`; });
  const shell = host.parentElement, list = shell.querySelector('.gallery-list'), grid = shell.querySelector('.gallery-grid');
  shell.classList.toggle('is-calibration', calibrationMode);
  host.dataset.spiralAutoOnly = 'true';
  host.dataset.interactive = 'false';
  const buttons = [...shell.querySelectorAll('[data-view]')];
  const entries = projects.length ? gallerySlots(projects.length) : gallerySlots(studyNames.length).map(slot => ({
    ...slot,
    title: studyNames[slot.study],
    cover: artwork[slot.study].toDataURL(),
  }));
  entries.forEach((entry, i) => {
    const row = document.createElement('div'); row.className = 'gallery-list-row';
    const img = document.createElement('img'); img.src = entry.cover || artwork[entry.study ?? i % artwork.length].toDataURL(); img.alt = entry.placeholder ? '' : entry.title;
    img.style.aspectRatio = String(entry.aspect); img.style.objectFit = entry.fit; img.style.objectPosition = `${entry.focalX * 100}% ${entry.focalY * 100}%`; img.style.backgroundColor = entry.backgroundColor;
    const name = entry.link && !entry.placeholder ? document.createElement('a') : document.createElement('span'); name.textContent = entry.title;
    if (name.tagName === 'A') { name.href = entry.link; name.target = '_blank'; name.rel = 'noreferrer'; }
    const meta = document.createElement('small'); meta.textContent = entry.placeholder ? '视觉预览 / '+String(i+1).padStart(2,'0') : String(i+1).padStart(2,'0');
    row.append(img, name, meta); list.append(row);
  });
  function switchView(event) {
    if (calibrationMode) return;
    listMode = event.currentTarget.dataset.view === 'list';
    clearHover();
    list.hidden = !listMode; host.style.visibility = listMode ? 'hidden' : 'visible';
    buttons.forEach(button => button.setAttribute('aria-pressed', String((button.dataset.view === 'list') === listMode)));
    dirty = true; wake();
  }
  buttons.forEach(button => button.addEventListener('click', switchView));
  const scene = new THREE.Scene();
  const spiralRoot = new THREE.Group();
  spiralRoot.rotation.z = -0.05;
  spiralRoot.position.set(-0.12, 0.05, 0);
  scene.add(spiralRoot);
  const camera = new THREE.PerspectiveCamera(SPIRAL_LAYOUT.fov, 1, .1, 100);
  // 24x8 keeps the shallow transverse bow smooth while reducing vertex work per card.
  const geometry = new THREE.PlaneGeometry(1, 1, 24, 8);
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    // A restrained bow keeps the card readable while its edges recede slightly.
    positions.setZ(i, -.22 * x * x);
  }
  geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  const material = new THREE.MeshBasicMaterial({
    side: THREE.FrontSide,
    transparent: false,
    alphaTest: .08,
    alphaToCoverage: true,
  });
  const projectedPosition = new THREE.Vector3();
  const worldPosition = new THREE.Vector3();
  const projectedTangent = new THREE.Vector3();
  const tangentPosition = new THREE.Vector3();
  const cameraToCard = new THREE.Vector3();
  const cardNormal = new THREE.Vector3();
  const clickableMeshes = [];
  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();
  let hoverX = 0, hoverY = 0;
  const tooltipStyle = document.createElement('style');
  tooltipStyle.dataset.spiralTooltipStyle = '';
  tooltipStyle.textContent = `
    .gallery-stage[data-spiral-auto-only="true"] { cursor: default !important; touch-action: auto; }
    .spiral-project-pill {
      position: fixed; left: 0; top: 0; z-index: 10000;
      display: flex; align-items: center; gap: 12px;
      min-width: 178px; max-width: min(310px, calc(100vw - 24px));
      min-height: 62px; padding: 8px 18px 8px 8px;
      color: #0b0b0b; background: rgba(255,255,255,.96);
      border: 1px solid rgba(0,0,0,.08); border-radius: 18px;
      box-shadow: 0 14px 38px rgba(0,0,0,.18);
      opacity: 0; visibility: hidden; pointer-events: none;
      transform: translate3d(var(--pill-x,0),var(--pill-y,0),0) scale(.94);
      transform-origin: 18px 50%;
      transition: opacity 150ms ease, visibility 150ms ease, transform 180ms cubic-bezier(.22,1,.36,1);
      will-change: transform, opacity;
    }
    .spiral-project-pill.is-visible {
      opacity: 1; visibility: visible;
      transform: translate3d(var(--pill-x,0),var(--pill-y,0),0) scale(1);
    }
    .spiral-project-pill__thumb {
      width: 48px; height: 48px; flex: 0 0 48px; display: block;
      object-fit: cover; border-radius: 12px; background: #111;
    }
    .spiral-project-pill__title {
      min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      font: 500 clamp(16px,1.35vw,22px)/1.05 Arial,Helvetica,sans-serif;
      letter-spacing: -.035em;
    }
    @media (max-width: 700px), (hover: none), (pointer: coarse) {
      .spiral-project-pill { display: none; }
    }
  `;
  document.head.append(tooltipStyle);
  const tooltip = document.createElement('div');
  tooltip.className = 'spiral-project-pill';
  tooltip.setAttribute('aria-hidden', 'true');
  const tooltipThumb = document.createElement('img');
  tooltipThumb.className = 'spiral-project-pill__thumb';
  tooltipThumb.alt = '';
  const tooltipTitle = document.createElement('strong');
  tooltipTitle.className = 'spiral-project-pill__title';
  tooltip.append(tooltipThumb, tooltipTitle);
  document.body.append(tooltip);

  function retainResource(resource) {
    if (!resource || typeof resource.dispose !== 'function') return resource;
    resources.add(resource);
    resourceRefs.set(resource, (resourceRefs.get(resource) || 0) + 1);
    return resource;
  }

  function releaseResource(resource) {
    if (!resource || !resourceRefs.has(resource)) return;
    const refs = resourceRefs.get(resource) - 1;
    if (refs > 0) { resourceRefs.set(resource, refs); return; }
    resourceRefs.delete(resource); resources.delete(resource); resource.dispose();
  }

  function disposeBuild() {
    cards.forEach(card => {
      const surface = card.children[0]?.material;
      if (surface?.map) releaseResource(surface.map);
      if (surface) releaseResource(surface);
      spiralRoot.remove(card);
    });
    cards = [];
    // Catch a resource retained by a late callback before a build switch.
    [...resources].forEach(resource => { resource.dispose(); resources.delete(resource); resourceRefs.delete(resource); });
  }

  function updateTextureUniforms(surface, texture) {
    const uniforms = surface.userData.shaderUniforms;
    if (uniforms) uniforms.spiralSourceAspect.value = textureAspect(texture);
  }

  function configureTexture(texture) {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.anisotropy = Math.min(quality.anisotropy, renderer?.capabilities.getMaxAnisotropy() ?? 1);
    return texture;
  }

  function replaceSurfaceMap(surface, texture) {
    if (surface.map === texture) return;
    const previous = surface.map;
    surface.map = retainResource(configureTexture(texture));
    if (previous) releaseResource(previous);
    updateTextureUniforms(surface, texture);
    surface.needsUpdate = true;
  }

  function fail() {
    canvas.hidden = true; fallback.hidden = false; enabled = false;
    cancelAnimationFrame(frame); frame = 0;
  }
  try {
    if (new URLSearchParams(location.search).has('no-webgl')) throw new Error('Fallback requested');
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setClearColor(0x11110f, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
  } catch { fail(); }
  function rebuild() {
    const version = ++buildVersion;
    disposeBuild();
    const loader = new THREE.TextureLoader();
    const coverRequests = new Map();
    const sequenceLength = projects.length || studyNames.length;
    const poolSize = Math.ceil(config.count / sequenceLength) * sequenceLength;
    cards = gallerySlots(poolSize).map((slot, i) => {
      const group = new THREE.Group();
      const surface = retainResource(material.clone());
      if (!calibrationMode) applyFocus(surface, slot, quality);
      const fallbackArtwork = artwork[slot.study ?? i % artwork.length];
      const createFallbackTexture = () => {
        const fallbackTexture = new THREE.CanvasTexture(fallbackArtwork);
        return configureTexture(fallbackTexture);
      };
      // Show a deterministic 1.6 placeholder until the image has a measured
      // size. An unloaded image must never be treated as an unknown 1:1 card.
      surface.map = retainResource(createFallbackTexture());
      updateTextureUniforms(surface, surface.map);
      surface.needsUpdate = true;
      if (slot.cover) {
        let request = coverRequests.get(slot.cover);
        if (!request) { request = { surfaces: new Set(), started: false }; coverRequests.set(slot.cover, request); }
        request.surfaces.add(surface);
        if (!request.started) {
          request.started = true;
          loader.load(slot.cover, loadedTexture => {
            if (version !== buildVersion || disposed || !request.surfaces.size) { loadedTexture.dispose(); return; }
            configureTexture(loadedTexture);
            request.surfaces.forEach(targetSurface => replaceSurfaceMap(targetSurface, loadedTexture));
            dirty = true; wake();
          }, undefined, () => {
            // The placeholder remains the visual fallback on load failure.
            if (version === buildVersion && !disposed) { dirty = true; wake(); }
          });
        }
      }
      // Keep the card body opaque. Semi-transparent cards with depthWrite and
      // a changing renderOrder visibly swap through each other at the focus
      // hand-off. Alpha test is sufficient for the rounded silhouette.
      surface.transparent = false;
      surface.opacity = 1;
      surface.depthTest = true;
      surface.depthWrite = true;
      const mesh = new THREE.Mesh(geometry, surface);
      group.add(mesh);
      group.userData = { ...slot, projectIndex: i % sequenceLength, isActive: false, focusAmount: 0 };
      spiralRoot.add(group); return group;
    });
  }
  function updateActiveCard(nextCardIndex) {
    if (!cards.length || nextCardIndex < 0 || nextCardIndex >= cards.length) return;
    if (nextCardIndex === state.activeCardIndex) return;
    if (state.activeCardIndex >= 0 && cards[state.activeCardIndex]) cards[state.activeCardIndex].userData.isActive = false;
    const activeCard = cards[nextCardIndex];
    activeCard.userData.isActive = true;
    state.activeCardIndex = nextCardIndex;
    const nextProjectIndex = activeCard.userData.projectIndex ?? activeCard.userData.study ?? nextCardIndex;
    state.activeProject = activeCard.userData.placeholder ? null : activeCard.userData;
    host.setAttribute('aria-label', state.activeProject
      ? `${baseStageLabel}，当前项目：${state.activeProject.title}`
      : baseStageLabel);
    if (nextProjectIndex !== state.activeIndex) {
      state.activeIndex = nextProjectIndex;
    }
  }

  function logCalibrationMetrics() {
    const viewportKey = `${viewportWidth}x${viewportHeight}`;
    if (!import.meta.env.DEV || !calibrationMode || calibrationLogKey === viewportKey || !cards.length) return;
    const activeCard = cards[state.activeCardIndex] || cards[Math.floor(cards.length / 2)];
    const mesh = activeCard?.children[0];
    if (!mesh || !viewportWidth || !viewportHeight) return;
    scene.updateMatrixWorld(true);
    const left = new THREE.Vector3(-0.5, 0, 0).applyMatrix4(mesh.matrixWorld).project(camera);
    const right = new THREE.Vector3(0.5, 0, 0).applyMatrix4(mesh.matrixWorld).project(camera);
    const center = new THREE.Vector3(0, 0, 0).applyMatrix4(activeCard.matrixWorld).project(camera);
    console.info('[spiral-calibration]', JSON.stringify({
      viewportWidth,
      viewportHeight,
      cameraZ: camera.position.z,
      radius: config.radius,
      pitch: config.pitch,
      step: config.step,
      cardWidth: config.width,
      visibleCardCount: cards.filter(card => card.visible).length,
      activeCardProjectedWidth: Math.abs(right.x - left.x) * viewportWidth / 2,
      activeCardProjectedCenter: {
        x: (center.x + 1) * viewportWidth / 2,
        y: (1 - center.y) * viewportHeight / 2,
      },
    }));
    calibrationLogKey = viewportKey;
  }

  function draw() {
    camera.updateMatrixWorld(true);
    const spread = .78 + state.reveal * .22;
    let closestCardIndex = -1;
    let closestDistance = Infinity;
    clickableMeshes.length = 0;
    spiralRoot.updateMatrixWorld(true);
    cards.forEach((card, i) => {
      const baseOffset = (i - Math.floor(cards.length / 2)) * config.step;
      const offset = wrapSpiralOffset(baseOffset + motionState.current, cards.length * config.step);
      const cardData = calibrationMode ? calibrationCardDefaults : card.userData;
      const { aspect, size, radialOffset, tiltX, tiltY, tiltZ } = cardData;
      // Small authored depth offsets survive, but cannot pull neighbours into
      // the same physical lane and create an actual mesh intersection.
      const radius = config.radius + THREE.MathUtils.clamp(radialOffset, -.08, .08);
      const transform = calculateSpiralTransform({ offset, radius, pitch: config.pitch, spread });
      applyCardTransform(card, transform, { width: config.width * size, aspect, tiltX, tiltY, tiltZ });
      const surface = card.children[0].material;
      card.updateMatrixWorld(true);
      worldPosition.copy(card.position).applyMatrix4(spiralRoot.matrixWorld);
      const projected = projectedPosition.copy(worldPosition).project(camera);
      const absoluteOffset = Math.abs(offset);
      if (absoluteOffset < closestDistance) {
        closestDistance = absoluteOffset;
        closestCardIndex = i;
      }

      if (calibrationMode) {
        card.userData.focusAmount = 1;
        card.visible = projected.z > -1.08 && projected.z < 1.08 && Math.abs(projected.x) < 1.45 && Math.abs(projected.y) < 1.45;
        card.renderOrder = 0;
        card.children[0].renderOrder = 0;
        surface.transparent = false;
        surface.opacity = 1;
        surface.depthTest = true;
        surface.depthWrite = true;
        surface.color.setScalar(1);
        return;
      }

      const focusAmount = calculateFocusAmount(offset, config.step);
      const focusScale = THREE.MathUtils.lerp(.92, 1.05, focusAmount);
      const brightness = THREE.MathUtils.lerp(.78, 1, focusAmount);
      const blur = quality.blurEnabled.value
        ? THREE.MathUtils.clamp((1 - focusAmount) * .004, 0, SPIRAL_LAYOUT.focus.maxBlur)
        : 0;
      card.userData.focusAmount = focusAmount;
      card.visible = projected.z > -1.08 && projected.z < 1.08 && Math.abs(projected.x) < 1.45 && Math.abs(projected.y) < 1.45;
      card.renderOrder = 0;
      // Opaque cards use the real depth buffer. A distance-derived renderOrder
      // flips as two cards cross and looks like geometry passing through.
      card.children[0].renderOrder = 0;
      surface.userData.blur.value = blur;
      const hoverProgress = card.userData.hoverProgress || 0;
      const hoverScale = 1 + .035 * hoverProgress;
      surface.color.setScalar(brightness * (1 + .06 * hoverProgress));
      surface.opacity = 1;
      surface.transparent = false;
      surface.depthTest = true;
      surface.depthWrite = true;
      // Portrait work receives a narrower plane so its much larger height
      // cannot cut through the cards immediately above and below it.
      const portraitCompensation = aspect < 1
        ? THREE.MathUtils.lerp(.72, 1, THREE.MathUtils.clamp((aspect - .75) / .25, 0, 1))
        : 1;
      const cardWidth = config.width * Math.min(1.06, size) * portraitCompensation * focusScale * hoverScale;
      card.scale.set(cardWidth, cardWidth / aspect, 1);
      // Move toward the camera in world space. This is kept in the Three.js
      // positioning pass, so it cannot compete with a CSS transform.
      if (hoverProgress > .0001) {
        const worldUnitsPerPixel = 2 * camera.position.distanceTo(worldPosition)
          * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / Math.max(1, viewportHeight);
        cameraToCard.copy(camera.position).sub(worldPosition).normalize();
        card.position.add(cameraToCard.multiplyScalar(24 * worldUnitsPerPixel * hoverProgress));
      }
      const uniforms = surface.userData.shaderUniforms;
      if (uniforms) {
        const speedFactor = quality.motionBlur && !motion.matches
          ? THREE.MathUtils.clamp(Math.abs(motionState.velocity) / 1.35, 0, 1)
          : 0;
        const motionAmount = speedFactor * (1 - focusAmount) * .22;
        uniforms.spiralMotionAmount.value = motionAmount;
        if (motionAmount > .00001) {
          tangentPosition.set(
            card.position.x + Math.cos(offset) * radius * .05,
            card.position.y + config.pitch / (Math.PI * 2) * .05,
            card.position.z - Math.sin(offset) * radius * .05,
          ).applyMatrix4(spiralRoot.matrixWorld);
          projectedTangent.copy(tangentPosition).project(camera);
          const dx = projectedTangent.x - projected.x;
          const dy = -(projectedTangent.y - projected.y);
          const length = Math.hypot(dx, dy);
          uniforms.spiralMotionDirection.value.set(length > .00001 ? dx / length : 0, length > .00001 ? dy / length : 0);
        } else {
          uniforms.spiralMotionDirection.value.set(0, 0);
        }
      }
      card.updateMatrixWorld(true);
      cardNormal.set(0, 0, 1).transformDirection(card.matrixWorld);
      cameraToCard.copy(camera.position).sub(worldPosition).normalize();
      const isFacingCamera = cardNormal.dot(cameraToCard) > .16;
      // Meshes are opaque, so focus brightness is the real visibility proxy.
      // The front-facing check keeps rear cards from winning raycasts through
      // visual overlaps.
      card.userData.isInteractive = card.visible && brightness > .45 && isFacingCamera;
      if (card.userData.isInteractive) clickableMeshes.push(card.children[0]);
    });
    updateActiveCard(closestCardIndex);
    if (grid) {
      if (calibrationMode || motion.matches || compactLayout) grid.style.transform = 'none';
      else grid.style.transform = `translate3d(${Math.sin(motionState.current * .5) * 2}px, ${THREE.MathUtils.clamp(motionState.current * .2, -3, 3)}px, 0)`;
    }
    renderer?.render(scene, camera);
    updateTooltipPosition();
    logCalibrationMetrics();
  }
  function normalizeTravel(span) {
    if (!Number.isFinite(span) || span <= 0 || !Number.isFinite(motionState.current)) return;
    const normalized = wrapSpiralOffset(motionState.current, span);
    const distance = motionState.current - normalized;
    if (Math.abs(distance) < SNAP_EPSILON) return;
    motionState.current = normalized;
    motionState.target -= distance;
    previousCurrent -= distance;
    if (motionState.snapTarget !== null) motionState.snapTarget -= distance;
  }
  function tick(time) {
    frame = 0;
    if (disposed || document.hidden || !renderer || canvas.hidden) return;
    const dt = Math.min((time - (last || time)) / 1000, .05); last = time;
    let hoverAnimating = false;
    cards.forEach(card => {
      const target = card === hoveredCard ? 1 : 0;
      const duration = target ? HOVER_IN_DURATION : HOVER_OUT_DURATION;
      const ease = 1 - Math.exp(-(dt * 1000) / (duration / 3));
      const next = (card.userData.hoverProgress || 0) + (target - (card.userData.hoverProgress || 0)) * ease;
      card.userData.hoverProgress = Math.abs(target - next) < .001 ? target : next;
      hoverAnimating ||= card.userData.hoverProgress > .001 && card.userData.hoverProgress < .999;
    });
    if (calibrationMode) {
      motionState.current = 0;
      motionState.target = 0;
      motionState.velocity = 0;
      motionState.autoVelocity = 0;
      motionState.isReceivingWheel = false;
      motionState.snapRequested = false;
      motionState.isSnapping = false;
      motionState.snapTarget = null;
    }
    const span = cards.length * config.step;
    normalizeTravel(span);
    const autoMoving = enabled && !calibrationMode && !listMode;
    if (autoMoving) {
      // Non-interruptible, frame-rate-independent motion: hover and pointer
      // input never alter the angle or the angular velocity.
      motionState.autoVelocity = SPIRAL_LAYOUT.autoRotation.speed;
      motionState.current += motionState.autoVelocity * dt;
      motionState.target = motionState.current;
    } else {
      motionState.autoVelocity = 0;
    }
    normalizeTravel(span);
    const renderVelocity = (motionState.current - previousCurrent) / Math.max(dt, .001);
    motionState.velocity = THREE.MathUtils.damp(motionState.velocity, renderVelocity, 10, dt);
    if (dirty || autoMoving || hoverAnimating || previousReveal !== state.reveal) draw();
    if (pointerInside && precisePointer.matches && enabled && !listMode && time - lastHoverRaycast >= HOVER_RAYCAST_INTERVAL) {
      runHoverRaycast(time);
    }
    previousCurrent = motionState.current;
    previousReveal = state.reveal; dirty = false;
    if (autoMoving || hoverAnimating || state.reveal > 0 && state.reveal < 1) wake();
  }
  function wake() {
    if (!frame && !disposed && !document.hidden && renderer && !canvas.hidden) frame = requestAnimationFrame(tick);
  }

  function showTooltip(card) {
    tooltipTitle.textContent = card.userData.title || 'Untitled Project';
    tooltipThumb.src = card.userData.cover
      || artwork[card.userData.study ?? card.userData.projectIndex % artwork.length]?.toDataURL()
      || '';
    tooltip.classList.add('is-visible');
    tooltip.setAttribute('aria-hidden', 'false');
    updateTooltipPosition();
  }

  function closeProjectTooltip() {
    tooltip.classList.remove('is-visible');
    tooltip.setAttribute('aria-hidden', 'true');
  }

  function updateTooltipPosition() {
    if (!hoveredCard || !tooltip.classList.contains('is-visible')) return;
    const margin = 12;
    const bounds = tooltip.getBoundingClientRect();
    let x = hoverX + 18;
    let y = hoverY + 20;
    if (x + bounds.width > window.innerWidth - margin) x = hoverX - bounds.width - 18;
    if (y + bounds.height > window.innerHeight - margin) y = hoverY - bounds.height - 18;
    x = THREE.MathUtils.clamp(x, margin, Math.max(margin, window.innerWidth - bounds.width - margin));
    y = THREE.MathUtils.clamp(y, margin, Math.max(margin, window.innerHeight - bounds.height - margin));
    tooltip.style.setProperty('--pill-x', `${Math.round(x)}px`);
    tooltip.style.setProperty('--pill-y', `${Math.round(y)}px`);
  }

  function setHoveredCard(card) {
    if (card === hoveredCard) return;
    hoveredCard = card;
    showTooltip(card);
    host.style.cursor = card.userData.link && !card.userData.placeholder ? 'pointer' : 'default';
    dirty = true; wake();
  }

  function clearHover() {
    if (!hoveredCard) return;
    hoveredCard = null;
    closeProjectTooltip();
    host.style.removeProperty('cursor');
    dirty = true; wake();
  }

  function updatePointerNdc(event) {
    const rect = host.getBoundingClientRect();
    pointerNdc.x = ((event.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
    pointerNdc.y = -((event.clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1;
  }

  function raycastAt(event) {
    if (!renderer || canvas.hidden || listMode || !clickableMeshes.length) return null;
    updatePointerNdc(event);
    raycaster.setFromCamera(pointerNdc, camera);
    return raycaster.intersectObjects(clickableMeshes, false)[0] || null;
  }

  function runHoverRaycast(now = performance.now()) {
    if (!precisePointer.matches || !pointerInside || !enabled || listMode || document.hidden) { clearHover(); return; }
    lastHoverRaycast = now;
    const hit = raycastAt({ clientX: hoverX, clientY: hoverY });
    const nextCard = hit?.object?.parent || null;
    if (nextCard) setHoveredCard(nextCard);
    else clearHover();
  }

  function hover(event) {
    if (!precisePointer.matches || !enabled || listMode) return;
    pointerInside = true;
    hoverX = event.clientX; hoverY = event.clientY;
    updateTooltipPosition();
    runHoverRaycast();
  }

  function pointerEnter(event) {
    pointerInside = true;
    hover(event);
  }

  function stagePointerLeave() {
    pointerInside = false;
    clearHover();
  }

  function navigateFromPointer(event) {
    const hit = raycastAt(event);
    const card = hit?.object?.parent;
    const link = card?.userData?.link;
    if (!card || card.userData.placeholder || typeof link !== 'string' || !link.trim()) return;
    window.location.assign(link);
  }

  function mobileCameraZ(width, height) {
    const mobile = config;
    const viewportAspect = Math.max(.34, width / Math.max(1, height));
    const targetShare = mobile.targetShare;
    // Solve for the distance that lets the focused first card occupy the
    // intended width. This deliberately does not use the desktop framing rule.
    const focusedCardWidth = mobile.width * 1.1;
    const distance = focusedCardWidth / (2 * targetShare * Math.tan(THREE.MathUtils.degToRad(SPIRAL_LAYOUT.fov / 2)) * viewportAspect);
    return THREE.MathUtils.clamp(mobile.radius + distance, mobile.cameraMin, mobile.cameraMax);
  }

  function updateViewport() {
    const width = host.clientWidth, height = host.clientHeight;
    const nextCompact = isCompactViewport(width, height);
    const isCompactLandscape = nextCompact && width > height && height < 560;
    const next = calibrationMode
      ? nextCompact ? CALIBRATION_MOBILE_LAYOUT : SPIRAL_LAYOUT.desktop
      : nextCompact ? (isCompactLandscape ? SPIRAL_LAYOUT.compactLandscape : SPIRAL_LAYOUT.mobile) : SPIRAL_LAYOUT.desktop;
    const nextQualityLevel = calibrationMode ? 'high' : chooseQuality(width, height, window.devicePixelRatio || 1, nextCompact, motion.matches);
    const qualityChanged = nextQualityLevel !== quality.level;
    const layoutChanged = next !== config || nextCompact !== compactLayout;
    compactLayout = nextCompact;
    config = next;
    host.dataset.layout = compactLayout ? (isCompactLandscape && !calibrationMode ? 'compact-landscape' : 'mobile') : 'desktop';
    const rootRotationZ = compactLayout ? (config.rootRotationZ ?? -0.05) : -0.05;
    const rootOffsetX = compactLayout ? (config.rootOffsetX ?? -0.12) : -0.12;
    const rootOffsetY = compactLayout ? (config.rootOffsetY ?? 0.05) : 0.05;
    spiralRoot.rotation.z = rootRotationZ;
    spiralRoot.position.set(rootOffsetX, rootOffsetY, 0);
    if (qualityChanged) {
      Object.assign(quality, QUALITY_PRESETS[nextQualityLevel], { level: nextQualityLevel });
      quality.blurEnabled.value = calibrationMode ? 0 : quality.blurSamples > 1 ? 1 : 0;
    }
    camera.aspect = width / Math.max(1, height);
    if (compactLayout) {
      camera.position.set(0, 0, mobileCameraZ(width, height));
    } else {
      const calculatedCameraZ = calculateCameraZ({
        radius: config.radius,
        cardWidth: config.width,
        viewportAspect: camera.aspect,
        fov: SPIRAL_LAYOUT.fov,
        targetScreenShare: config.cameraShare,
      });
      camera.position.set(0, 0, calculatedCameraZ);
    }
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    state.layout = compactLayout ? (isCompactLandscape && !calibrationMode ? 'compact-landscape' : 'mobile') : 'desktop';
    state.cameraZ = camera.position.z;
    state.quality = quality.level;
    viewportWidth = width; viewportHeight = height;
    if (layoutChanged || qualityChanged) {
      if (renderer && !canvas.hidden) rebuild();
    }
    const pixelRatio = calibrationMode ? SPIRAL_LAYOUT.pixelRatio : Math.min(quality.pixelRatio, Math.max(1, window.devicePixelRatio || 1));
    renderer?.setPixelRatio(pixelRatio);
    renderer?.setSize(width, height, false);
    motionState.velocity = 0;
    previousCurrent = motionState.current;
    last = 0;
    dirty = true; wake();
  }
  function visibility() {
    if (document.hidden) clearHover();
    motionState.velocity = 0;
    motionState.autoVelocity = 0;
    cancelAnimationFrame(frame); frame = 0; last = 0; previousCurrent = motionState.current;
    if (!document.hidden) { dirty = true; wake(); }
  }
  let resumeAfterContextRestore = false;
  function lost(event) {
    event.preventDefault();
    resumeAfterContextRestore = enabled;
    contextLost = true;
    clearHover(); fail();
  }
  function restored() {
    if (disposed || !contextLost) return;
    contextLost = false;
    canvas.hidden = false; fallback.hidden = true;
    enabled = resumeAfterContextRestore;
    host.dataset.interactive = 'false';
    dirty = true; updateViewport(); wake();
  }
  function motionChanged() {
    quality.blurEnabled.value = calibrationMode ? 0 : quality.blurSamples > 1 ? 1 : 0;
    dirty = true; wake();
  }
  function queueResize() {
    if (resizeFrame) return;
    resizeFrame = requestAnimationFrame(() => { resizeFrame = 0; updateViewport(); });
  }
  host.addEventListener('pointerenter', pointerEnter);
  host.addEventListener('pointermove', hover);
  host.addEventListener('pointerleave', stagePointerLeave);
  host.addEventListener('click', navigateFromPointer);
  canvas.addEventListener('webglcontextlost', lost); canvas.addEventListener('webglcontextrestored', restored);
  motion.addEventListener?.('change', motionChanged);
  window.addEventListener('resize', queueResize); document.addEventListener('visibilitychange', visibility);
  updateViewport();
  return {
    state, motionState, update() { dirty = true; wake(); },
    enable(value) {
      enabled = value && !!renderer && !canvas.hidden;
      if (!value) {
        clearHover();
        motionState.isReceivingWheel = false;
        motionState.isSnapping = false;
        motionState.snapRequested = false;
        motionState.snapTarget = null;
        motionState.velocity = 0;
        motionState.autoVelocity = 0;
      }
      host.dataset.interactive = 'false';
      if (enabled) wake();
    },
    reset() {
      enabled = false; clearHover(); motionState.current = motionState.target = 0; motionState.velocity = 0;
      motionState.isDragging = false; motionState.isReceivingWheel = false; motionState.snapRequested = false; motionState.isSnapping = false; motionState.snapTarget = null; motionState.lastInputTime = 0;
      motionState.autoVelocity = 0;
      state.reveal = calibrationMode ? 1 : 0;
      cards.forEach(card => { card.userData.isActive = false; });
      state.activeIndex = 0; state.activeCardIndex = -1; state.activeProject = null; host.setAttribute('aria-label', baseStageLabel);
      previousCurrent = 0; last = 0; dirty = true; wake();
    },
    dispose() {
      if (disposed) return;
      disposed = true; cancelAnimationFrame(frame); cancelAnimationFrame(resizeFrame); resizeFrame = 0; clearHover();
      host.removeEventListener('pointerenter', pointerEnter); host.removeEventListener('pointermove', hover);
      host.removeEventListener('click', navigateFromPointer); canvas.removeEventListener('webglcontextlost', lost);
      host.removeEventListener('pointerleave', stagePointerLeave); canvas.removeEventListener('webglcontextrestored', restored);
      motion.removeEventListener?.('change', motionChanged);
      window.removeEventListener('resize', queueResize); document.removeEventListener('visibilitychange', visibility);
      buttons.forEach(button => button.removeEventListener('click', switchView)); list.replaceChildren();
      tooltip.remove(); tooltipStyle.remove(); disposeBuild(); geometry.dispose(); material.dispose(); renderer?.dispose();
    },
  };
}
