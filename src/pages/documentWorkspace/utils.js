import { WORKSPACE_LEFT_STACK_SPREAD, WORKSPACE_LEFT_STACK_X } from './constants';

export const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export const createWorkspaceItemId = () => `ws-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

export const createAnnotationId = (() => {
  let counter = 0;
  return () => `ann-${Date.now()}-${++counter}`;
})();

export const createClippingId = (() => {
  let counter = 0;
  return () => `clip-${Date.now()}-${++counter}`;
})();

export const createBookmarkId = (() => {
  let counter = 0;
  return () => `bm-${Date.now()}-${++counter}`;
})();

export const getWorkspaceItemType = (item) => item?.type || 'clip';

export const getWorkspaceItemSourceId = (item) => item?.sourceId || item?.clippingId;

export const getBoundingRectFromPoints = (points = []) => {
  if (!points.length) return null;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = Math.max(maxX - minX, 0.005);
  const height = Math.max(maxY - minY, 0.005);
  return { x: clamp(minX, 0, 1 - width), y: clamp(minY, 0, 1 - height), width, height };
};

export const getPrimaryPageFromSource = (source) => {
  const [first] = String(source).split(',');
  const parsed = parseInt(first, 10);
  return Number.isFinite(parsed) ? parsed : 1;
};

export const getNormalizedPoint = (event, element) => {
  const rect = element.getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width;
  const y = (event.clientY - rect.top) / rect.height;
  return { x, y };
};

export const getPointerPressure = (event, enabled) => {
  if (!enabled) return 1;
  if (!event || typeof event.pressure !== 'number') return 1;
  const raw = event.pressure > 0 ? event.pressure : 1;
  return clamp(raw, 0.25, 1.35);
};

export const getWorkspaceStackPosition = (count, maxSpread = WORKSPACE_LEFT_STACK_SPREAD) => {
  const baseY = 0.18 + ((count * 0.14) % 0.6);
  const leftOffset =
    WORKSPACE_LEFT_STACK_X + (count % 3) * (maxSpread / 2) + Math.random() * 0.01;
  return { baseY, leftOffset };
};

export const getVisibleWorkspaceCenter = (pan, zoom) => {
  const centerX = 0.5;
  const centerY = 0.5;
  const x = centerX - (pan?.x || 0) / ((zoom || 1) * 6000);
  const y = centerY - (pan?.y || 0) / ((zoom || 1) * 6000);

  return {
    x: clamp(x, 0.05, 0.95),
    y: clamp(y, 0.05, 0.95)
  };
};

export const findSmartPosition = (center, existingItems, zoom = 1, preferredPosition = null) => {
  // Use preferred position as the starting point if provided, otherwise use the visible center
  const startX = preferredPosition?.x ?? center.x;
  const startY = preferredPosition?.y ?? center.y;

  // Try central/preferred position first
  let candidates = [{ x: startX, y: startY }];

  // Spiral out
  const steps = 8;
  const radiusStep = 0.04; // 4% of canvas 
  for (let r = 1; r <= 3; r++) {
    for (let i = 0; i < steps; i++) {
      const angle = (i / steps) * Math.PI * 2;
      candidates.push({
        x: clamp(startX + Math.cos(angle) * (r * radiusStep), 0.05, 0.95),
        y: clamp(startY + Math.sin(angle) * (r * radiusStep), 0.05, 0.95)
      });
    }
  }

  // Find first candidate that isn't too close to an existing item
  const THRESHOLD = 0.05; // 300px at 1x zoom

  for (const cand of candidates) {
    const collision = existingItems.some(item => {
      const dx = item.x - cand.x;
      const dy = item.y - cand.y;
      return (dx * dx + dy * dy) < (THRESHOLD * THRESHOLD);
    });
    if (!collision) {
      // Add a tiny jitter to look organic
      return {
        x: cand.x + (Math.random() - 0.5) * 0.01,
        y: cand.y + (Math.random() - 0.5) * 0.01
      };
    }
  }

  // Fallback: center + random large offset if everything is full
  return {
    x: clamp(startX + (Math.random() - 0.5) * 0.1, 0.05, 0.95),
    y: clamp(startY + (Math.random() - 0.5) * 0.1, 0.05, 0.95)
  };
};
