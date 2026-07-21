(function () {
  const components = (window.sapdComponents = window.sapdComponents || {});
  const MIN_READABLE_SCALE = 1;
  const MAX_SCALE = 1.6;
  const BASE_VIEWPORT_WIDTH = 1920;
  const COMPACT_VIEWPORT_WIDTH = 1180;
  const WIDE_LAYOUT_WIDTH = 1800;
  const MIN_LOGICAL_HEIGHT = 700;
  let frameId = 0;
  let mounted = false;

  const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
  const rounded = (value, precision = 3) => Number(value.toFixed(precision));

  function scaleForViewport(width = window.innerWidth, height = window.innerHeight) {
    const safeWidth = Number.isFinite(Number(width)) ? Number(width) : BASE_VIEWPORT_WIDTH;
    const safeHeight = Number.isFinite(Number(height)) ? Number(height) : MIN_LOGICAL_HEIGHT;
    const widthScale = safeWidth <= BASE_VIEWPORT_WIDTH
      ? MIN_READABLE_SCALE
      : safeWidth / BASE_VIEWPORT_WIDTH;
    const heightCap = clamp(safeHeight / MIN_LOGICAL_HEIGHT, MIN_READABLE_SCALE, MAX_SCALE);
    return rounded(clamp(Math.min(widthScale, heightCap), MIN_READABLE_SCALE, MAX_SCALE));
  }

  function layoutForViewport(width = window.innerWidth) {
    const safeWidth = Number.isFinite(Number(width)) ? Number(width) : BASE_VIEWPORT_WIDTH;
    if (safeWidth <= COMPACT_VIEWPORT_WIDTH) return "compact";
    if (safeWidth >= WIDE_LAYOUT_WIDTH) return "wide";
    return "desktop";
  }

  function apply() {
    const root = document.documentElement;
    const viewportWidth = Number(window.innerWidth) || BASE_VIEWPORT_WIDTH;
    const viewportHeight = Number(window.innerHeight) || MIN_LOGICAL_HEIGHT;
    const scale = scaleForViewport(viewportWidth, viewportHeight);
    const inverse = rounded(1 / scale, 6);
    const logicalWidth = rounded(viewportWidth / scale, 3);
    const logicalHeight = rounded(viewportHeight / scale, 3);
    root.style.setProperty("--sapd-ui-scale", String(scale));
    root.style.setProperty("--sapd-ui-scale-inverse", String(inverse));
    root.style.setProperty("--sapd-ui-logical-viewport-width", `${logicalWidth}px`);
    root.style.setProperty("--sapd-ui-logical-viewport-height", `${logicalHeight}px`);
    root.dataset.sapdUiScale = String(scale);
    root.dataset.sapdUiLayout = layoutForViewport(viewportWidth);
    return scale;
  }

  function scheduleApply() {
    if (frameId) window.cancelAnimationFrame(frameId);
    frameId = window.requestAnimationFrame(() => {
      frameId = 0;
      apply();
    });
  }

  function mount() {
    if (mounted) return apply();
    mounted = true;
    window.addEventListener("resize", scheduleApply, { passive: true });
    window.visualViewport?.addEventListener("resize", scheduleApply, { passive: true });
    return apply();
  }

  components.AdaptiveUiScale = {
    apply,
    mount,
    layoutForViewport,
    scaleForViewport,
  };

  mount();
})();
