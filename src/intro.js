import { gsap } from "gsap";
import * as THREE from "three";

// 入口相关文案集中配置，首页本身仍然使用 index.html 里的内容。
export const INTRO_COPY = {
  greeting: "hello!",
  name: "I'm caobo",
  finalKicker: "软件工程与 AI 的学习者",
  finalDescription: "把复杂的事，做得清楚。",
  action: "enter",
};

// 所有动画节奏集中配置。调试时优先调整这里，不要在时间轴中散落数字。
export const INTRO_TIMING = {
  helloReveal: 0.68,
  helloHold: 0.68,
  flight: 1.72,
  nameRevealDelay: 0.4,
  nameReveal: 0.42,
  handoff: 1.22,
  finalCopyReveal: 0.48,
  ctaReveal: 0.5,
  exit: 0.7,
  exitCopy: 0.28,
};

export const INTRO_LAYOUT = {
  cameraFov: 34,
  cameraZ: 7.4,
  sphereRadius: 0.42,
  boxHalfExtents: [0.86, 0.5, 0.58],
  morphRoundness: 0.12,
  startBallRatio: 0.54,
  maxStartBallPixels: 74,
  arcHeightRatio: 0.28,
  finalOrbRatio: 0.82,
  pixelRatioCap: 1.75,
  sphereSegments: 32,
  sphereRings: 24,
};

export const INTRO_COLORS = {
  background: 0x11110f,
  mint: 0x5ae1b6,
  teal: 0x1eb6b1,
  cyan: 0x54d7df,
  yellow: 0xe3e66e,
  darkTeal: 0x176e72,
};

const SESSION_SEEN_KEY = "cao-bo-intro-seen";
const SESSION_ENTERED_KEY = "cao-bo-site-entered";

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const smoothstep = (value) => value * value * (3 - 2 * value);
const smootherstep = (value) => value * value * value * (value * (value * 6 - 15) + 10);
const lerp = (from, to, progress) => from + (to - from) * progress;

function readSession(key) {
  try {
    return window.sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeSession(key) {
  try {
    window.sessionStorage.setItem(key, "1");
  } catch {
    // 隐私模式或禁用存储时仍然允许当前页面正常运行。
  }
}

function setHomeReady(home, nav, visual, focusTarget) {
  gsap.set([home, nav, visual].filter(Boolean), { autoAlpha: 1, x: 0, y: 0 });
  home?.removeAttribute("inert");
  home?.classList.add("is-ready");
  nav?.classList.add("is-ready");
  visual?.classList.add("is-ready");
  if (focusTarget instanceof HTMLElement) {
    focusTarget.focus({ preventScroll: true });
  }
}

function setIntroHidden(intro) {
  if (!intro) return;
  intro.hidden = true;
  intro.setAttribute("aria-hidden", "true");
  intro.classList.add("is-hidden");
}

function setIntroVisible(intro) {
  intro.hidden = false;
  intro.removeAttribute("aria-hidden");
  intro.classList.remove("is-hidden");
  intro.setAttribute("tabindex", "-1");
}

function screenToWorld(screenX, screenY, canvas, camera, planeZ = 0) {
  const rect = canvas.getBoundingClientRect();
  const ndc = new THREE.Vector3(
    ((screenX - rect.left) / rect.width) * 2 - 1,
    -((screenY - rect.top) / rect.height) * 2 + 1,
    0.5,
  );
  ndc.unproject(camera);
  const direction = ndc.sub(camera.position).normalize();
  const distance = (planeZ - camera.position.z) / direction.z;
  return camera.position.clone().add(direction.multiplyScalar(distance));
}

function worldUnitsPerPixel(canvas, camera, planeZ = 0) {
  const rect = canvas.getBoundingClientRect();
  const distance = Math.abs(camera.position.z - planeZ);
  const worldHeight = 2 * distance * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  return worldHeight / Math.max(1, rect.height);
}

function createMorphGeometry() {
  const { sphereRadius, boxHalfExtents, morphRoundness, sphereSegments, sphereRings } = INTRO_LAYOUT;
  const positions = [];
  const boxPositions = [];
  const normals = [];
  const boxNormals = [];
  const colors = [];
  const uvs = [];
  const indices = [];

  const palette = [
    new THREE.Color(INTRO_COLORS.mint),
    new THREE.Color(INTRO_COLORS.teal),
    new THREE.Color(INTRO_COLORS.cyan),
    new THREE.Color(INTRO_COLORS.yellow),
    new THREE.Color(INTRO_COLORS.darkTeal),
  ];

  for (let ring = 0; ring <= sphereRings; ring += 1) {
    const v = ring / sphereRings;
    const phi = v * Math.PI;
    const sinPhi = Math.sin(phi);
    const cosPhi = Math.cos(phi);

    for (let segment = 0; segment <= sphereSegments; segment += 1) {
      const u = segment / sphereSegments;
      const theta = u * Math.PI * 2;
      const direction = new THREE.Vector3(
        sinPhi * Math.cos(theta),
        cosPhi,
        sinPhi * Math.sin(theta),
      );

      const spherePoint = direction.clone().multiplyScalar(sphereRadius);
      const maxAxis = Math.max(Math.abs(direction.x), Math.abs(direction.y), Math.abs(direction.z), 0.0001);
      const cubeSurface = direction.clone().multiplyScalar(1 / maxAxis);
      const roundedSurface = cubeSurface
        .multiplyScalar(1 - morphRoundness)
        .add(direction.clone().multiplyScalar(morphRoundness));
      const boxPoint = new THREE.Vector3(
        roundedSurface.x * boxHalfExtents[0],
        roundedSurface.y * boxHalfExtents[1],
        roundedSurface.z * boxHalfExtents[2],
      );

      const dominantAxis = [Math.abs(direction.x), Math.abs(direction.y), Math.abs(direction.z)].indexOf(maxAxis);
      const faceNormal = new THREE.Vector3();
      faceNormal.setComponent(dominantAxis, Math.sign(direction.getComponent(dominantAxis)) || 1);
      const boxNormal = direction.clone().lerp(faceNormal, 0.78).normalize();

      positions.push(spherePoint.x, spherePoint.y, spherePoint.z);
      boxPositions.push(boxPoint.x, boxPoint.y, boxPoint.z);
      normals.push(direction.x, direction.y, direction.z);
      boxNormals.push(boxNormal.x, boxNormal.y, boxNormal.z);
      uvs.push(u, 1 - v);

      const sideColor = palette[4].clone().lerp(palette[1], clamp((direction.z + 1) * 0.5));
      const topColor = palette[0].clone().lerp(palette[2], clamp((direction.x + 1) * 0.5));
      const vertexColor = sideColor.lerp(topColor, clamp((direction.y + 1) * 0.5));
      if (direction.y > 0.46) {
        vertexColor.lerp(palette[3], clamp((direction.y - 0.46) * 1.7));
      }
      const lightBias = 0.82 + Math.max(0, direction.y) * 0.16;
      vertexColor.multiplyScalar(lightBias);
      colors.push(vertexColor.r, vertexColor.g, vertexColor.b);
    }
  }

  for (let ring = 0; ring < sphereRings; ring += 1) {
    for (let segment = 0; segment < sphereSegments; segment += 1) {
      const current = ring * (sphereSegments + 1) + segment;
      const next = current + sphereSegments + 1;
      indices.push(current, next, current + 1, next, next + 1, current + 1);
    }
  }

  const geometry = new THREE.BufferGeometry();
  const positionAttribute = new THREE.Float32BufferAttribute(positions, 3);
  positionAttribute.setUsage(THREE.StaticDrawUsage);
  geometry.setAttribute("position", positionAttribute);
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.morphAttributes.position = [new THREE.Float32BufferAttribute(boxPositions, 3)];
  geometry.morphAttributes.normal = [new THREE.Float32BufferAttribute(boxNormals, 3)];
  geometry.morphTargetsRelative = false;
  geometry.computeBoundingSphere();
  return geometry;
}

function createSmileyTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  if (!context) return null;

  const base = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  base.addColorStop(0, "#1a7775");
  base.addColorStop(0.38, "#5bdcb4");
  base.addColorStop(0.68, "#2bc1bd");
  base.addColorStop(1, "#124a55");
  context.fillStyle = base;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const patch = (x, y, radius, color, alpha = 1) => {
    context.save();
    context.globalAlpha = alpha;
    context.fillStyle = color;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
    context.restore();
  };

  patch(245, 132, 160, "#8ae8c2", 0.64);
  patch(795, 168, 190, "#0e5b6b", 0.52);
  patch(190, 407, 140, "#d9e56a", 0.68);
  patch(834, 393, 162, "#34b5b8", 0.66);

  const highlight = context.createRadialGradient(380, 104, 8, 380, 104, 170);
  highlight.addColorStop(0, "rgba(255,255,255,.85)");
  highlight.addColorStop(0.2, "rgba(255,255,255,.28)");
  highlight.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = highlight;
  context.fillRect(120, 0, 440, 270);

  const drawFace = (centerX) => {
    context.save();
    context.fillStyle = "rgba(7, 37, 45, .88)";
    // 球体正面在不同 three.js 版本/纹理翻转设置下可能落在 u=.25 或 u=.75，
    // 两侧各绘制一次只影响不可见背面，保证前视角始终拿到贴合球面的表情。
    context.translate(centerX, 270);
    context.rotate(-0.035);
    context.beginPath();
    context.ellipse(-120, -58, 34, 48, -0.18, 0, Math.PI * 2);
    context.ellipse(112, -58, 34, 48, 0.18, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "rgba(255,255,255,.86)";
    context.beginPath();
    context.arc(-109, -73, 9, 0, Math.PI * 2);
    context.arc(102, -73, 9, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "rgba(7, 37, 45, .92)";
    context.lineWidth = 22;
    context.lineCap = "round";
    context.beginPath();
    context.arc(0, 2, 143, 0.19, Math.PI - 0.19);
    context.stroke();
    context.restore();
  };
  drawFace(256);
  drawFace(768);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 2;
  texture.needsUpdate = true;
  return texture;
}

function createIntroScene(canvas) {
  if (!canvas || !window.WebGLRenderingContext) return null;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
  } catch {
    return null;
  }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(INTRO_LAYOUT.cameraFov, 1, 0.1, 100);
  camera.position.set(0, 0, INTRO_LAYOUT.cameraZ);
  camera.lookAt(0, 0, 0);

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, INTRO_LAYOUT.pixelRatioCap));
  renderer.setClearColor(INTRO_COLORS.background, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;

  const ambient = new THREE.HemisphereLight(0xcfffee, 0x102a32, 1.35);
  scene.add(ambient);

  const keyLight = new THREE.DirectionalLight(0xffffff, 2.75);
  keyLight.position.set(-3.5, 4.5, 5.5);
  scene.add(keyLight);

  const fillLight = new THREE.PointLight(INTRO_COLORS.cyan, 1.7, 11, 2);
  fillLight.position.set(3.6, 0.5, 4.3);
  scene.add(fillLight);

  const geometry = createMorphGeometry();
  const smileyTexture = createSmileyTexture();
  const boxMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.32,
    metalness: 0.04,
    transparent: true,
    opacity: 1,
  });
  const smileyMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: smileyTexture || undefined,
    roughness: 0.44,
    metalness: 0.02,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });

  const boxMesh = new THREE.Mesh(geometry, boxMaterial);
  const smileyMesh = new THREE.Mesh(geometry, smileyMaterial);
  boxMesh.renderOrder = 3;
  smileyMesh.renderOrder = 4;
  const objectGroup = new THREE.Group();
  objectGroup.add(boxMesh, smileyMesh);
  scene.add(objectGroup);

  let frameId = null;
  let disposed = false;

  const renderOnce = () => {
    if (!disposed) renderer.render(scene, camera);
  };

  const renderLoop = () => {
    if (disposed) return;
    frameId = requestAnimationFrame(renderLoop);
    renderer.render(scene, camera);
  };

  const startLoop = () => {
    if (frameId === null) renderLoop();
  };

  const stopLoop = () => {
    if (frameId !== null) {
      cancelAnimationFrame(frameId);
      frameId = null;
    }
  };

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, rect.width || window.innerWidth);
    const height = Math.max(1, rect.height || window.innerHeight);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  };

  resize();

  return {
    camera,
    canvas,
    objectGroup,
    boxMesh,
    smileyMesh,
    boxMaterial,
    smileyMaterial,
    sphereRadius: INTRO_LAYOUT.sphereRadius,
    startLoop,
    stopLoop,
    renderOnce,
    resize,
    dispose: () => {
      disposed = true;
      stopLoop();
      geometry.dispose();
      boxMaterial.dispose();
      smileyMaterial.dispose();
      smileyTexture?.dispose();
      renderer.dispose();
    },
  };
}

function getCenter(rect) {
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

function measureLayout(sceneController, hello, orbTarget) {
  if (!sceneController || !hello || !orbTarget) return null;
  const helloRect = hello.getBoundingClientRect();
  const orbRect = orbTarget.getBoundingClientRect();
  const helloCenter = getCenter(helloRect);
  const orbCenter = getCenter(orbRect);
  const { camera, canvas, sphereRadius } = sceneController;
  const unitsPerPixel = worldUnitsPerPixel(canvas, camera);
  const startBallPixels = Math.min(
    INTRO_LAYOUT.maxStartBallPixels,
    Math.max(18, helloRect.height * INTRO_LAYOUT.startBallRatio),
  );
  const finalOrbPixels = Math.max(24, Math.min(orbRect.width, orbRect.height) * INTRO_LAYOUT.finalOrbRatio);
  const arcPixels = Math.max(96, canvas.getBoundingClientRect().height * INTRO_LAYOUT.arcHeightRatio);
  const startWorld = screenToWorld(helloCenter.x, helloCenter.y, canvas, camera);
  const finalWorld = screenToWorld(orbCenter.x, orbCenter.y, canvas, camera);

  return {
    startWorld,
    finalWorld,
    startScale: (startBallPixels * unitsPerPixel) / (sphereRadius * 2),
    finalScale: (finalOrbPixels * unitsPerPixel) / (sphereRadius * 2),
    boxScale: (startBallPixels * 1.12 * unitsPerPixel) / (sphereRadius * 2),
    arcWorld: arcPixels * unitsPerPixel,
  };
}

function applyObjectState(sceneController, visualState, layout, phase) {
  if (!sceneController || !layout) return;

  const { objectGroup, boxMesh, smileyMesh, boxMaterial, smileyMaterial } = sceneController;
  const flightProgress = clamp(visualState.flight);
  const handoffProgress = clamp(visualState.handoff);
  const inFlight = phase === "flight";
  const inHandoff = phase === "handoff" || phase === "final" || phase === "entering";

  if (inFlight) {
    const horizontalProgress = smoothstep(flightProgress);
    const verticalArc = Math.sin(Math.PI * flightProgress) * layout.arcWorld;
    objectGroup.position.x = lerp(layout.startWorld.x, layout.startWorld.x + 0.08, horizontalProgress);
    objectGroup.position.y = lerp(layout.startWorld.y, layout.startWorld.y - 0.04, horizontalProgress) + verticalArc;
    objectGroup.position.z = layout.startWorld.z;
    objectGroup.scale.set(
      layout.startScale * visualState.stretchX,
      layout.startScale * visualState.stretchY,
      layout.startScale * visualState.stretchZ,
    );
    objectGroup.rotation.set(
      visualState.rotationX,
      visualState.rotationY,
      visualState.rotationZ,
    );
    visualState.morph = smootherstep(clamp((flightProgress - 0.53) / 0.47));
    visualState.smileMix = 0;
  } else if (inHandoff) {
    const moveProgress = smootherstep(handoffProgress);
    const morphProgress = smootherstep(clamp((handoffProgress - 0.12) / 0.88));
    const smileProgress = smootherstep(clamp((handoffProgress - 0.4) / 0.6));
    objectGroup.position.lerpVectors(layout.startWorld, layout.finalWorld, moveProgress);
    objectGroup.position.z = lerp(layout.startWorld.z, layout.finalWorld.z, moveProgress);
    objectGroup.scale.setScalar(lerp(layout.boxScale, layout.finalScale, moveProgress));
    objectGroup.rotation.set(
      lerp(visualState.rotationX, 0.04, moveProgress),
      lerp(visualState.rotationY, Math.PI * 0.16, moveProgress),
      lerp(visualState.rotationZ, -0.035, moveProgress),
    );
    visualState.morph = 1 - morphProgress;
    visualState.smileMix = smileProgress;
  }

  boxMesh.morphTargetInfluences[0] = visualState.morph;
  smileyMesh.morphTargetInfluences[0] = visualState.morph;
  boxMaterial.opacity = 1 - visualState.smileMix;
  smileyMaterial.opacity = visualState.smileMix;
  boxMesh.visible = boxMaterial.opacity > 0.001;
  smileyMesh.visible = smileyMaterial.opacity > 0.001;
}

function prepareFinalState({ intro, hello, name, finalCopy, enterButton, skipButton, visualState, sceneController, layout }) {
  visualState.flight = 1;
  visualState.handoff = 1;
  visualState.stretchX = 1;
  visualState.stretchY = 1;
  visualState.stretchZ = 1;
  visualState.rotationX = 0.12;
  visualState.rotationY = -0.14;
  visualState.rotationZ = -0.08;
  applyObjectState(sceneController, visualState, layout, "final");
  gsap.set(hello, { autoAlpha: 0, yPercent: -55 });
  gsap.set(name, { autoAlpha: 0, yPercent: -55 });
  gsap.set(finalCopy, { autoAlpha: 1, y: 0 });
  gsap.set(enterButton, { autoAlpha: 1, y: 0 });
  gsap.set(skipButton, { autoAlpha: 0, y: -8 });
  enterButton.disabled = false;
  enterButton.removeAttribute("aria-hidden");
  enterButton.classList.add("is-ready");
  intro.classList.add("is-final");
  sceneController?.renderOnce();
  sceneController?.stopLoop();
}

/** Mounts the intro and returns a complete teardown function. */
export function mountIntro({
  intro,
  home,
  enterButton,
  homeNavigation,
  homeVisual,
  homeFocusTarget,
}) {
  if (!intro || !home || !enterButton) return () => {};

  const canvas = intro.querySelector("#intro-canvas");
  const hello = intro.querySelector(".intro-hello");
  const name = intro.querySelector(".intro-name");
  const finalCopy = intro.querySelector(".intro-final-copy");
  const skipButton = intro.querySelector("#skip-intro");
  const orbTarget = intro.querySelector(".intro-orb-target");
  const fallbackOrb = intro.querySelector(".intro-fallback-orb");
  const isReplay = new URLSearchParams(window.location.search).has("replay");
  // replay 参数是开发时重播钩子，便于在启用系统 reduced-motion 的环境里检查完整动效。
  const reducedMotion = !isReplay && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isAlreadyEntered = !isReplay && readSession(SESSION_ENTERED_KEY);
  const hasSeenIntro = !isReplay && readSession(SESSION_SEEN_KEY);
  let sceneController = null;
  let layout = null;
  let masterTimeline = null;
  let currentState = isAlreadyEntered ? "entered" : hasSeenIntro ? "final" : "playing";
  let disposed = false;

  const visualState = {
    flight: 0,
    handoff: 0,
    morph: 0,
    smileMix: 0,
    stretchX: 1,
    stretchY: 1,
    stretchZ: 1,
    rotationX: 0,
    rotationY: 0,
    rotationZ: 0,
  };

  intro.querySelectorAll("[data-intro-copy]").forEach((target) => {
    const key = target.dataset.introCopy;
    if (key in INTRO_COPY) target.textContent = INTRO_COPY[key];
  });

  const finishEnter = () => {
    if (disposed) return;
    currentState = "entered";
    writeSession(SESSION_ENTERED_KEY);
    setIntroHidden(intro);
    document.documentElement.classList.remove("is-intro-active");
    setHomeReady(home, homeNavigation, homeVisual, homeFocusTarget);
    sceneController?.dispose();
    sceneController = null;
  };

  const enterSite = () => {
    if (disposed || currentState !== "final") return;
    if (!masterTimeline) {
      // WebGL 失败时没有 3D 离场时间轴，仍然保留同一个语义按钮进入首页。
      finishEnter();
      return;
    }
    currentState = "entering";
    enterButton.disabled = true;
    enterButton.setAttribute("aria-hidden", "true");
    sceneController?.startLoop();
    masterTimeline.play("exit");
  };

  const skipToFinal = () => {
    if (disposed || !masterTimeline || !["playing", "flight", "handoff"].includes(currentState)) return;
    currentState = "final";
    masterTimeline.pause();
    masterTimeline.seek("final");
    prepareFinalState({
      intro,
      hello,
      name,
      finalCopy,
      enterButton,
      skipButton,
      visualState,
      sceneController,
      layout,
    });
  };

  const handleKeyDown = (event) => {
    if (event.key === "Escape" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (["playing", "flight", "handoff"].includes(currentState)) skipToFinal();
      else if (currentState === "final") enterSite();
    }
  };

  const handleResize = () => {
    if (!sceneController || disposed) return;
    sceneController.resize();
    layout = measureLayout(sceneController, hello, orbTarget);
    applyObjectState(sceneController, visualState, layout, currentState === "playing" ? "flight" : currentState);
    sceneController.renderOnce();
  };

  const showStaticFallback = () => {
    intro.classList.add("is-webgl-fallback", "is-final");
    fallbackOrb?.setAttribute("aria-hidden", "false");
    gsap.set([hello, name], { autoAlpha: 0 });
    gsap.set(finalCopy, { autoAlpha: 1, y: 0 });
    gsap.set(enterButton, { autoAlpha: 1, y: 0 });
    gsap.set(skipButton, { autoAlpha: 0 });
    enterButton.disabled = false;
    enterButton.removeAttribute("aria-hidden");
    enterButton.classList.add("is-ready");
    currentState = "final";
  };

  enterButton.addEventListener("click", enterSite);
  skipButton?.addEventListener("click", skipToFinal);
  document.addEventListener("keydown", handleKeyDown);
  window.addEventListener("resize", handleResize, { passive: true });

  if (isAlreadyEntered) {
    setIntroHidden(intro);
    setHomeReady(home, homeNavigation, homeVisual, homeFocusTarget);
    document.documentElement.classList.remove("is-intro-active");
    return () => {
      disposed = true;
      enterButton.removeEventListener("click", enterSite);
      skipButton?.removeEventListener("click", skipToFinal);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleResize);
    };
  }

  writeSession(SESSION_SEEN_KEY);
  document.documentElement.classList.add("is-intro-active");
  home.setAttribute("inert", "");
  setIntroVisible(intro);
  intro.focus({ preventScroll: true });
  enterButton.disabled = true;
  enterButton.setAttribute("aria-hidden", "true");

  const start = async () => {
    if (disposed) return;
    try {
      if (document.fonts?.ready) await document.fonts.ready;
    } catch {
      // 字体加载失败时使用系统字体继续运行，布局仍由实际 DOM 测量决定。
    }
    if (disposed) return;

    sceneController = createIntroScene(canvas);
    if (!sceneController) {
      showStaticFallback();
      return;
    }

    layout = measureLayout(sceneController, hello, orbTarget);
    if (!layout) {
      showStaticFallback();
      return;
    }

    const animationState = { value: 0 };
    masterTimeline = gsap.timeline({
      paused: true,
      defaults: { overwrite: "auto" },
      onComplete: () => {
        if (currentState !== "entering") return;
        finishEnter();
      },
    });

    masterTimeline
      .set(hello, { autoAlpha: 0, yPercent: 110 })
      .set(name, { autoAlpha: 0, yPercent: 110 })
      .set(finalCopy, { autoAlpha: 0, y: 18 })
      .set(enterButton, { autoAlpha: 0, y: 22 })
      .set(skipButton, { autoAlpha: 1, y: 0 })
      .addLabel("hello")
      .to(hello, {
        autoAlpha: 1,
        yPercent: 0,
        duration: reducedMotion ? 0 : INTRO_TIMING.helloReveal,
        ease: "power4.out",
      }, "hello")
      .to(animationState, {
        value: 1,
        duration: reducedMotion ? 0 : INTRO_TIMING.helloHold,
        ease: "none",
      }, "hello+=0.1")
      .addLabel("flight")
      .to(visualState, {
        flight: 1,
        duration: reducedMotion ? 0 : INTRO_TIMING.flight,
        ease: "none",
        onStart: () => {
          currentState = "flight";
          sceneController.startLoop();
        },
        onUpdate: () => {
          const t = visualState.flight;
          const velocity = Math.cos(Math.PI * t);
          visualState.stretchX = 1 - Math.abs(velocity) * 0.12;
          visualState.stretchY = 1 + Math.abs(velocity) * 0.15;
          visualState.stretchZ = visualState.stretchX;
          visualState.rotationX = t * 0.78;
          visualState.rotationY = -t * 0.92;
          visualState.rotationZ = -t * 0.48;
          applyObjectState(sceneController, visualState, layout, "flight");
        },
      }, "flight")
      .to(hello, {
        autoAlpha: 0,
        yPercent: -55,
        duration: 0.3,
        ease: "power3.in",
      }, "flight+=0.18")
      .to(name, {
        autoAlpha: 1,
        yPercent: 0,
        duration: INTRO_TIMING.nameReveal,
        ease: "power4.out",
      }, `flight+=${INTRO_TIMING.nameRevealDelay}`)
      .addLabel("handoff")
      .to(visualState, {
        handoff: 1,
        duration: reducedMotion ? 0 : INTRO_TIMING.handoff,
        ease: "power3.inOut",
        onStart: () => {
          currentState = "handoff";
          sceneController.startLoop();
        },
        onUpdate: () => applyObjectState(sceneController, visualState, layout, "handoff"),
      }, "handoff")
      .to(name, {
        autoAlpha: 0,
        yPercent: -55,
        duration: INTRO_TIMING.exitCopy,
        ease: "power3.in",
      }, "handoff+=0.12")
      .to(finalCopy, {
        autoAlpha: 1,
        y: 0,
        duration: INTRO_TIMING.finalCopyReveal,
        ease: "power3.out",
      }, `handoff+=${INTRO_TIMING.handoff * 0.56}`)
      .to(enterButton, {
        autoAlpha: 1,
        y: 0,
        duration: INTRO_TIMING.ctaReveal,
        ease: "back.out(1.18)",
        onStart: () => {
          enterButton.disabled = false;
          enterButton.removeAttribute("aria-hidden");
          enterButton.classList.add("is-ready");
        },
      }, `handoff+=${INTRO_TIMING.handoff * 0.78}`)
      .to(skipButton, {
        autoAlpha: 0,
        y: -8,
        duration: 0.24,
        ease: "power2.out",
      }, `handoff+=${INTRO_TIMING.handoff * 0.74}`)
      .call(() => {
        currentState = "final";
        intro.classList.add("is-final");
        sceneController.renderOnce();
        sceneController.stopLoop();
      }, null, "handoff+=1.22")
      .addLabel("final")
      .addPause("final")
      .addLabel("exit")
      .to([finalCopy, enterButton], {
        autoAlpha: 0,
        y: -18,
        duration: INTRO_TIMING.exitCopy,
        ease: "power3.in",
        stagger: 0.035,
      }, "exit")
      .to(intro, {
        autoAlpha: 0,
        duration: INTRO_TIMING.exit,
        ease: "power3.inOut",
      }, "exit+=0.08");

    // 让首帧球体已经和 hello! 的实际 DOM 锚点重合；画布在文字下方，视觉上像从字里弹出。
    applyObjectState(sceneController, visualState, layout, "flight");
    sceneController.renderOnce();

    if (hasSeenIntro || reducedMotion) {
      currentState = "final";
      masterTimeline.seek("final");
      prepareFinalState({
        intro,
        hello,
        name,
        finalCopy,
        enterButton,
        skipButton,
        visualState,
        sceneController,
        layout,
      });
    } else {
      currentState = "playing";
      masterTimeline.play();
    }
  };

  void start();

  return () => {
    disposed = true;
    masterTimeline?.kill();
    sceneController?.dispose();
    enterButton.removeEventListener("click", enterSite);
    skipButton?.removeEventListener("click", skipToFinal);
    document.removeEventListener("keydown", handleKeyDown);
    window.removeEventListener("resize", handleResize);
    document.documentElement.classList.remove("is-intro-active");
    home.removeAttribute("inert");
  };
}
