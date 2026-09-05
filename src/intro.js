import { gsap } from "gsap";

// 后续替换入口文案时只需修改这里，HTML 结构和时间轴不需要动。
export const INTRO_COPY = {
  greeting: "你好，我是曹波",
  focus: "正在探索软件工程与 AI",
  kicker: "你好，欢迎来到我的空间",
  subtitle: "记录正在发生的思考与实践。",
  action: "进入网站",
};

// 所有可感知的节奏都集中在这里，便于快速微调。
export const INTRO_TIMING = {
  textDuration: 0.78,
  textStagger: 0.14,
  textEase: "power4.out",
  textDistance: 56,
  ctaDelay: 0.08,
  ctaDuration: 0.42,
  ctaDistance: 18,
  exitTextDuration: 0.42,
  exitOverlayDelay: 0.12,
  exitOverlayDuration: 0.78,
  exitEase: "power4.inOut",
  homeNavDuration: 0.42,
  homeVisualDuration: 0.72,
  homeStagger: 0.1,
};

const SESSION_KEY = "cao-bo-intro-seen";

function shouldSkipIntro() {
  try {
    return window.sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

function markIntroSeen() {
  try {
    window.sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    // 隐私模式或禁用存储时，当前页面仍然可以正常运行。
  }
}

function setHomeReady(home, nav, visual, focusTarget) {
  // timeline 的初始 set 会留下 inline style；交接完成后显式打开首页，避免 opacity: 0 残留。
  gsap.set([home, nav, visual].filter(Boolean), { autoAlpha: 1, x: 0, y: 0 });
  home?.removeAttribute("inert");
  home?.classList.add("is-ready");
  if (nav) nav.classList.add("is-ready");
  if (visual) visual.classList.add("is-ready");
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

/**
 * Mounts the first-visit intro and returns a cleanup function for unmounts.
 * The intro owns one GSAP timeline so enter, skip, and teardown share state.
 */
export function mountIntro({
  intro,
  home,
  enterButton,
  homeNavigation,
  homeVisual,
  homeFocusTarget,
}) {
  if (!intro || !home || !enterButton) return () => {};

  const lineEls = [...intro.querySelectorAll(".intro-line")];
  const kicker = intro.querySelector(".intro-kicker");
  const subtitle = intro.querySelector(".intro-subtitle");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const speed = reducedMotion ? 0.42 : 1;
  const timing = Object.fromEntries(
    Object.entries(INTRO_TIMING).map(([key, value]) => [
      key,
      typeof value === "number" ? value * speed : value,
    ]),
  );
  let isExiting = false;

  const copyTargets = intro.querySelectorAll("[data-intro-copy]");
  copyTargets.forEach((target) => {
    const copyKey = target.dataset.introCopy;
    if (copyKey in INTRO_COPY) target.textContent = INTRO_COPY[copyKey];
  });

  const handleKeyDown = (event) => {
    if (event.key === "Escape" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      exitIntro();
    }
  };
  const handleButtonClick = () => exitIntro();

  // 同一标签页只标记一次；这样刷新或从站内返回首页都不会重新播放。
  if (shouldSkipIntro()) {
    setIntroHidden(intro);
    setHomeReady(home, homeNavigation, homeVisual, homeFocusTarget);
    document.documentElement.classList.remove("is-intro-active");
    return () => {};
  }

  markIntroSeen();
  document.documentElement.classList.add("is-intro-active");
  home.setAttribute("inert", "");
  intro.hidden = false;
  intro.removeAttribute("aria-hidden");
  intro.classList.remove("is-hidden");
  intro.setAttribute("tabindex", "-1");
  intro.focus({ preventScroll: true });
  enterButton.disabled = true;
  enterButton.setAttribute("aria-hidden", "true");

  const introTimeline = gsap.timeline({
    paused: true,
    defaults: { overwrite: "auto" },
    onComplete: () => {
      if (!isExiting) return;
      setIntroHidden(intro);
      document.documentElement.classList.remove("is-intro-active");
      setHomeReady(home, homeNavigation, homeVisual, homeFocusTarget);
    },
  });

  // 初始状态由 timeline 设置，避免 JS 执行前发生内容闪现。
  introTimeline
    .set(kicker, { autoAlpha: 0, y: reducedMotion ? 0 : 12 })
    .set(lineEls, { autoAlpha: 0, y: reducedMotion ? 0 : timing.textDistance })
    .set(subtitle, { autoAlpha: 0, y: reducedMotion ? 0 : 10 })
    .set(enterButton, { autoAlpha: 0, y: reducedMotion ? 0 : timing.ctaDistance })
    .set(homeNavigation, { autoAlpha: 0, y: reducedMotion ? 0 : 20 })
    .set(homeVisual, { autoAlpha: 0, y: reducedMotion ? 0 : 28 })
    .addLabel("intro")
    .to(kicker, {
      autoAlpha: 0.58,
      y: 0,
      duration: reducedMotion ? 0.2 : 0.34,
      ease: timing.textEase,
    }, "intro")
    .to(lineEls, {
      autoAlpha: 1,
      y: 0,
      duration: timing.textDuration,
      ease: timing.textEase,
      stagger: timing.textStagger,
    }, "intro+=0.08")
    .to(subtitle, {
      autoAlpha: 0.62,
      y: 0,
      duration: reducedMotion ? 0.18 : 0.36,
      ease: timing.textEase,
    }, "intro+=0.3")
    .to(enterButton, {
      autoAlpha: 1,
      y: 0,
      duration: timing.ctaDuration,
      ease: timing.textEase,
      onStart: () => {
        enterButton.disabled = false;
        enterButton.removeAttribute("aria-hidden");
        enterButton.classList.add("is-ready");
        enterButton.focus({ preventScroll: true });
      },
    }, `intro+=${0.08 + timing.textDuration + timing.textStagger + timing.ctaDelay}`)
    .addLabel("ready")
    .addPause("ready")
    .addLabel("exit")
    .to([kicker, ...lineEls, subtitle, enterButton], {
      autoAlpha: 0,
      y: reducedMotion ? -4 : -70,
      duration: timing.exitTextDuration,
      ease: "power3.in",
      stagger: reducedMotion ? 0 : 0.035,
    }, "exit")
    .to(intro, {
      yPercent: -100,
      duration: timing.exitOverlayDuration,
      ease: timing.exitEase,
    }, `exit+=${timing.exitOverlayDelay}`)
    .to(homeNavigation, {
      autoAlpha: 1,
      y: 0,
      duration: timing.homeNavDuration,
      ease: timing.textEase,
    }, `exit+=${timing.exitOverlayDelay + timing.exitOverlayDuration * 0.52}`)
    .to(homeVisual, {
      autoAlpha: 1,
      y: 0,
      duration: timing.homeVisualDuration,
      ease: timing.textEase,
    }, `exit+=${timing.exitOverlayDelay + timing.exitOverlayDuration * 0.68}`);

  function exitIntro() {
    if (isExiting) return;
    isExiting = true;
    enterButton.disabled = true;
    introTimeline.play("exit");
  }

  enterButton.addEventListener("click", handleButtonClick);
  document.addEventListener("keydown", handleKeyDown);
  introTimeline.play();

  // 暴露给宿主组件的卸载清理：停掉 timeline，并移除所有监听。
  return () => {
    introTimeline.kill();
    enterButton.removeEventListener("click", handleButtonClick);
    document.removeEventListener("keydown", handleKeyDown);
    document.documentElement.classList.remove("is-intro-active");
    home.removeAttribute("inert");
  };
}
