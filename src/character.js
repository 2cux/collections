import { CHARACTER_ART } from "./character-art.js";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const GREETINGS = [
  '嗨，你来啦，很高兴见到你！',
  '看到你，今天又多了一点开心。',
  '你好呀，今天过得怎么样？',
  '我在呢，陪你待一会儿。',
  '嘿，记得给自己一个小小的微笑。',
  '忙累了的话，就在这里歇一会儿吧。',
  '你的鼠标去哪儿，我的目光就去哪儿。',
  '又和你对上眼啦，你好呀！',
];
const GREETING_SHAPES = ['silk', 'bloom', 'petal'];

// Project a point on a round face, as in the reference: the far eye narrows.
export function projectEye(side, yaw, pitch) {
  const radius = 440;
  const x0 = side * 185 / radius;
  const z0 = Math.sqrt(1 - x0 * x0);
  const x1 = x0 * Math.cos(yaw) + z0 * Math.sin(yaw);
  const z1 = -x0 * Math.sin(yaw) + z0 * Math.cos(yaw);
  return {
    x: x1 * radius,
    y: -z1 * Math.sin(pitch) * radius,
    width: .35 + .65 * Math.max(0, z1 * Math.cos(pitch)),
  };
}

export function mountCharacter({ cardButton, card, scene, backButton, artHost, pageTransition }) {
  artHost.innerHTML = CHARACTER_ART;
  const viewBox = artHost.querySelector('svg').viewBox.baseVal;
  artHost.parentElement.style.setProperty('--character-aspect', `${viewBox.width} / ${viewBox.height}`);
  const head = artHost.querySelector('[data-character-head]');
  const body = artHost.querySelector('[data-character-body]');
  const eyes = [...artHost.querySelectorAll('[data-character-eye]')];
  const greeting = scene.querySelector('.character-greeting');
  const greetingText = greeting.querySelector('.character-greeting-text');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let active = false, disposed = false, frame = null, lastTime = 0;
  let blinkTimer = null, blinkStart = null;
  let x = 0, y = 0, vx = 0, vy = 0, targetX = 0, targetY = 0;
  let stageBounds;
  let homeScroll = 0;
  let greetingTimer = null, nextGreetingAt = 0, pointerTravel = 0, lastPointer = null;
  let greetingBag = [], previousGreeting = null;
  let previousShape = null;
  const cleanups = [];
  const on = (target, event, handler) => {
    target.addEventListener(event, handler);
    cleanups.push(() => target.removeEventListener(event, handler));
  };

  function paint(blink = 1) {
    const angle = 20 * Math.PI / 180;
    const localX = x * Math.cos(angle) + y * Math.sin(angle);
    const localY = -x * Math.sin(angle) + y * Math.cos(angle);
    eyes.forEach((eye, index) => {
      const projected = projectEye(
        index ? 1 : -1,
        clamp(localX, -1, 1) * .10,
        -clamp(localY, -1, 1) * .075,
      );
      // Normalize width to the original neutral pose.
      const neutral = projectEye(index ? 1 : -1, 0, 0).width;
      eye.setAttribute('transform', `translate(${projected.x.toFixed(3)} ${projected.y.toFixed(3)}) scale(${(projected.width / neutral).toFixed(3)} ${blink.toFixed(3)})`);
    });
    const amount = reduced.matches ? 0 : 1;
    head.setAttribute('transform', `translate(${x * 22 * amount} ${y * 12 * amount}) rotate(${x * 2.5 * amount} 650 1070)`);
    body.setAttribute('transform', `translate(${x * 7 * amount} 0) rotate(${x * .6 * amount} 600 1254)`);
  }

  function scheduleFrame() {
    if (frame == null && active && !document.hidden && !disposed) frame = requestAnimationFrame(tick);
  }

  function tick(now) {
    frame = null;
    if (!active || disposed || document.hidden) return;
    const dt = Math.min((now - (lastTime || now - 16.67)) / 1000, .035);
    lastTime = now;
    if (reduced.matches) { x = targetX; y = targetY; vx = 0; vy = 0; }
    else {
      vx += ((targetX - x) * 360 - vx * 32) * dt;
      vy += ((targetY - y) * 360 - vy * 32) * dt;
      x += vx * dt; y += vy * dt;
    }
    let blink = 1;
    if (blinkStart != null) {
      const progress = (now - blinkStart) / 220;
      if (progress >= 1) blinkStart = null;
      else blink = Math.max(.06, Math.abs(2 * progress - 1));
    }
    paint(blink);
    if (blinkStart != null || Math.abs(x - targetX) + Math.abs(y - targetY) + Math.abs(vx) + Math.abs(vy) > .001) scheduleFrame();
    else { x = targetX; y = targetY; lastTime = 0; paint(); }
  }

  function queueBlink() {
    clearTimeout(blinkTimer);
    if (!active || document.hidden || reduced.matches) return;
    blinkTimer = setTimeout(() => {
      blinkStart = performance.now();
      scheduleFrame();
      queueBlink();
    }, 2800 + Math.random() * 2600);
  }

  function stop() {
    if (frame != null) cancelAnimationFrame(frame);
    frame = null; lastTime = 0;
    clearTimeout(blinkTimer); blinkStart = null;
    clearTimeout(greetingTimer); greetingTimer = null;
    greeting.classList.remove('is-visible', 'is-leaving');
    greetingText.textContent = '';
    lastPointer = null; pointerTravel = 0;
  }

  function greet(event) {
    if (document.hidden || event.isPrimary === false) return;
    const now = performance.now();
    if (lastPointer) pointerTravel += Math.hypot(event.clientX - lastPointer.x, event.clientY - lastPointer.y);
    else pointerTravel = 70;
    lastPointer = { x: event.clientX, y: event.clientY };
    if (now < nextGreetingAt) { pointerTravel = 0; return; }
    if (pointerTravel < 70) return;
    if (!greetingBag.length) {
      greetingBag = [...GREETINGS];
      // Draw without replacement, including across the boundary between bags.
    }
    const choices = greetingBag.filter(text => text !== previousGreeting);
    const message = choices[Math.floor(Math.random() * choices.length)];
    greetingBag.splice(greetingBag.indexOf(message), 1);
    previousGreeting = message;
    const shapes = GREETING_SHAPES.filter(shape => shape !== previousShape);
    const shape = shapes[Math.floor(Math.random() * shapes.length)];
    greeting.dataset.shape = shape;
    previousShape = shape;
    greeting.classList.remove('is-leaving');
    greetingText.textContent = message;
    greeting.classList.add('is-visible');
    pointerTravel = 0;
    nextGreetingAt = now + 6500;
    clearTimeout(greetingTimer);
    greetingTimer = setTimeout(() => {
      greeting.classList.remove('is-visible');
      if (!reduced.matches) greeting.classList.add('is-leaving');
      else greetingText.textContent = '';
      greetingTimer = null;
    }, 3600);
  }

  function measure() {
    if (active) stageBounds = artHost.getBoundingClientRect();
  }

  function resetGaze() { targetX = 0; targetY = 0; lastPointer = null; pointerTravel = 0; scheduleFrame(); }

  function open() {
    if (active || disposed || !document.querySelector('#intro').hidden) return;
    pageTransition.run(() => {
      homeScroll = window.scrollY;
      active = true;
      nextGreetingAt = 0;
      card.hidden = true; scene.hidden = false;
      document.querySelector('main').dataset.view = 'character';
      window.scrollTo({ top: 0, behavior: 'instant' });
      measure(); resetGaze(); queueBlink();
      scene.focus({ preventScroll: true });
    });
  }

  function close() {
    if (!active) return;
    pageTransition.run(closeView, { reverse: true });
  }

  function closeView() {
    active = false; stop();
    scene.hidden = true; card.hidden = false;
    document.querySelector('main').dataset.view = 'greeting';
    x = y = vx = vy = targetX = targetY = 0; paint();
    window.scrollTo({ top: homeScroll, behavior: 'instant' });
    cardButton.focus({ preventScroll: true });
  }

  function pointer(event) {
    if (!active || !stageBounds) return;
    // The supplied portrait's face center in the padded SVG viewBox.
    measure();
    const cx = stageBounds.left + stageBounds.width * ((700 - viewBox.x) / viewBox.width);
    const cy = stageBounds.top + stageBounds.height * ((737 - viewBox.y) / viewBox.height);
    // Reach the same gaze range with a smaller pointer movement.
    const distance = Math.max(stageBounds.width * .55, 95);
    targetX = clamp((event.clientX - cx) / distance, -1, 1);
    targetY = clamp((event.clientY - cy) / distance, -1, 1);
    scheduleFrame();
    greet(event);
  }

  on(cardButton, 'click', open);
  on(greeting, 'animationend', event => {
    if (event.target === greeting && event.animationName === 'character-greeting-out') {
      greeting.classList.remove('is-leaving');
      greetingText.textContent = '';
    }
  });
  on(backButton, 'click', close);
  on(window, 'pointermove', pointer);
  on(window, 'pointerdown', pointer);
  on(document.documentElement, 'pointerleave', resetGaze);
  on(window, 'blur', resetGaze);
  on(window, 'resize', measure);
  on(window, 'scroll', measure);
  on(document, 'keydown', event => { if (event.key === 'Escape' && active) { event.preventDefault(); close(); } });
  on(document, 'visibilitychange', () => {
    if (document.hidden) stop();
    else { measure(); resetGaze(); queueBlink(); }
  });
  on(reduced, 'change', () => { stop(); paint(); scheduleFrame(); queueBlink(); });
  paint();
  return () => { disposed = true; active = false; stop(); cleanups.forEach(cleanup => cleanup()); };
}
