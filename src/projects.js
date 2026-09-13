// Real entries may keep the small { cover, title, link } shape. The gallery
// normalizes the optional composition fields before it creates a card.
export const projects = [];

export const CARD_DEFAULTS = Object.freeze({
  aspect: 1.6,
  size: 1,
  tiltX: 0,
  tiltY: 0,
  tiltZ: 0,
  radialOffset: 0,
});

// Deliberately fixed: empty portfolios should still have a recognizable,
// repeatable rhythm after every refresh.
export const PLACEHOLDER_CONFIGS = Object.freeze([
  { aspect: 1.78, size: 1.08, tiltX: -0.018, tiltY: 0.018, tiltZ: -0.018, radialOffset: -0.12 },
  { aspect: 1.48, size: 0.95, tiltX: 0.012, tiltY: -0.028, tiltZ: 0.022, radialOffset: 0.08 },
  { aspect: 1.04, size: 0.86, tiltX: -0.03, tiltY: 0.014, tiltZ: 0.03, radialOffset: -0.16 },
  { aspect: 0.86, size: 1, tiltX: 0.018, tiltY: -0.04, tiltZ: -0.025, radialOffset: 0.12 },
  { aspect: 1.34, size: 0.92, tiltX: 0.034, tiltY: 0.022, tiltZ: 0.01, radialOffset: -0.04 },
  { aspect: 0.8, size: 1.04, tiltX: -0.014, tiltY: 0.045, tiltZ: -0.035, radialOffset: 0.18 },
]);

const finiteOr = (value, fallback) => Number.isFinite(value) ? value : fallback;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function normalizeProject(entry = {}, index = 0) {
  const source = entry && typeof entry === 'object' ? entry : {};
  const variant = source.placeholder ? PLACEHOLDER_CONFIGS[index % PLACEHOLDER_CONFIGS.length] : {};
  const composition = { ...CARD_DEFAULTS, ...variant, ...source };
  return {
    ...source,
    cover: typeof source.cover === 'string' ? source.cover : '',
    title: typeof source.title === 'string' && source.title.trim() ? source.title : `Project ${index + 1}`,
    link: typeof source.link === 'string' ? source.link : '',
    aspect: clamp(finiteOr(composition.aspect, CARD_DEFAULTS.aspect), 0.72, 2),
    size: clamp(finiteOr(composition.size, CARD_DEFAULTS.size), 0.72, 1.2),
    tiltX: clamp(finiteOr(composition.tiltX, CARD_DEFAULTS.tiltX), -0.08, 0.08),
    tiltY: clamp(finiteOr(composition.tiltY, CARD_DEFAULTS.tiltY), -0.08, 0.08),
    tiltZ: clamp(finiteOr(composition.tiltZ, CARD_DEFAULTS.tiltZ), -0.08, 0.08),
    radialOffset: clamp(finiteOr(composition.radialOffset, CARD_DEFAULTS.radialOffset), -0.35, 0.35),
  };
}

export const gallerySlots = count => {
  const safeCount = Math.max(0, Math.floor(finiteOr(count, 0)));
  if (projects.length) {
    return Array.from({ length: Math.max(safeCount, projects.length) }, (_, i) => ({
      ...normalizeProject(projects[i % projects.length], i),
      placeholder: false,
    }));
  }
  return Array.from({ length: safeCount }, (_, i) => ({
    ...normalizeProject({ placeholder: true, study: i % 6 }, i),
    placeholder: true,
    study: i % 6,
  }));
};
