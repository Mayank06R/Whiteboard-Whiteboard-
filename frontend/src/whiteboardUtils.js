// Helpers for the whiteboard: id generation, geometry, hit-testing, normalization

export const uid = () =>
  Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export const seedFor = () => Math.floor(Math.random() * 2 ** 31);

// Normalize a shape so width/height are positive
export const normalizeBounds = (el) => {
  const x = Math.min(el.x, el.x2);
  const y = Math.min(el.y, el.y2);
  const w = Math.abs(el.x2 - el.x);
  const h = Math.abs(el.y2 - el.y);
  return { x, y, w, h };
};

// Compute bounding box of any element
export const getElementBounds = (el) => {
  if (el.type === "pen") {
    if (!el.points || el.points.length === 0)
      return { x: el.x || 0, y: el.y || 0, w: 0, h: 0 };
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const p of el.points) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }
  if (el.type === "text") {
    return { x: el.x, y: el.y, w: el.width || 100, h: el.height || el.fontSize || 24 };
  }
  return normalizeBounds(el);
};

const distToSegment = (px, py, x1, y1, x2, y2) => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + t * dx;
  const cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
};

// Hit-test a point against an element (in world coords). Tolerance in pixels.
export const hitTest = (el, px, py, tol = 8) => {
  if (el.type === "rectangle" || el.type === "diamond" || el.type === "ellipse") {
    const { x, y, w, h } = normalizeBounds(el);
    // Inside or near edge
    const inside =
      px >= x - tol && px <= x + w + tol && py >= y - tol && py <= y + h + tol;
    if (!inside) return false;
    if (el.fillStyle && el.fillStyle !== "none") {
      // Filled: hit if inside
      return px >= x && px <= x + w && py >= y && py <= y + h;
    }
    // Hollow: hit only near border
    const nearTop = Math.abs(py - y) <= tol && px >= x - tol && px <= x + w + tol;
    const nearBot =
      Math.abs(py - (y + h)) <= tol && px >= x - tol && px <= x + w + tol;
    const nearL = Math.abs(px - x) <= tol && py >= y - tol && py <= y + h + tol;
    const nearR =
      Math.abs(px - (x + w)) <= tol && py >= y - tol && py <= y + h + tol;
    return nearTop || nearBot || nearL || nearR;
  }
  if (el.type === "line" || el.type === "arrow") {
    return distToSegment(px, py, el.x, el.y, el.x2, el.y2) <= tol;
  }
  if (el.type === "pen") {
    if (!el.points || el.points.length < 2) return false;
    for (let i = 1; i < el.points.length; i++) {
      const a = el.points[i - 1];
      const b = el.points[i];
      if (distToSegment(px, py, a.x, a.y, b.x, b.y) <= tol) return true;
    }
    return false;
  }
  if (el.type === "text") {
    const { x, y, w, h } = getElementBounds(el);
    return px >= x && px <= x + w && py >= y && py <= y + h;
  }
  return false;
};

// Translate an element by (dx, dy)
export const translateElement = (el, dx, dy) => {
  if (el.type === "pen") {
    return {
      ...el,
      points: el.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
    };
  }
  if (el.type === "text") {
    return { ...el, x: el.x + dx, y: el.y + dy };
  }
  return {
    ...el,
    x: el.x + dx,
    y: el.y + dy,
    x2: el.x2 + dx,
    y2: el.y2 + dy,
  };
};

// Resize an element by dragging a corner handle
// handle: 'nw' | 'ne' | 'sw' | 'se'
export const resizeElement = (el, handle, worldX, worldY) => {
  if (el.type === "pen" || el.type === "text") {
    // Simple scale-by-bounds for pen; for text we just move bottom-right corner
    if (el.type === "text") {
      return { ...el, width: Math.max(20, worldX - el.x), height: Math.max(16, worldY - el.y) };
    }
    return el;
  }
  const x1 = el.x;
  const y1 = el.y;
  const x2 = el.x2;
  const y2 = el.y2;
  let nx1 = x1,
    ny1 = y1,
    nx2 = x2,
    ny2 = y2;
  if (handle === "nw") {
    nx1 = worldX;
    ny1 = worldY;
  } else if (handle === "ne") {
    nx2 = worldX;
    ny1 = worldY;
  } else if (handle === "sw") {
    nx1 = worldX;
    ny2 = worldY;
  } else if (handle === "se") {
    nx2 = worldX;
    ny2 = worldY;
  }
  return { ...el, x: nx1, y: ny1, x2: nx2, y2: ny2 };
};

export const screenToWorld = (sx, sy, pan, zoom) => ({
  x: (sx - pan.x) / zoom,
  y: (sy - pan.y) / zoom,
});

export const worldToScreen = (wx, wy, pan, zoom) => ({
  x: wx * zoom + pan.x,
  y: wy * zoom + pan.y,
});
