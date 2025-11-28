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

