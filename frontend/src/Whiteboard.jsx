import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import rough from "roughjs/bundled/rough.esm.js";
import { getStroke } from "perfect-freehand";
import {
  MousePointer2,
  Square,
  Circle,
  Diamond,
  Minus,
  ArrowRight,
  Pencil,
  Type,
  Eraser,
  Undo2,
  Redo2,
  Trash2,
  Download,
  Upload,
  Save,
  Image as ImageIcon,
  Sun,
  Moon,
  Plus,
  Hand,
} from "lucide-react";
import {
  uid,
  seedFor,
  normalizeBounds,
  getElementBounds,
  hitTest,
  translateElement,
  resizeElement,
  screenToWorld,
} from "@/whiteboardUtils";

const STORAGE_KEY = "e1-canvas-studio-scene-v1";
const THEME_KEY = "e1-canvas-studio-theme";

const PALETTE = [
  "#1A1A1A",
  "#FF4500",
  "#0055FF",
  "#00A650",
  "#FFB300",
  "#8A2BE2",
];
const PALETTE_DARK = [
  "#EDEDED",
  "#FF5722",
  "#4DA3FF",
  "#3DD68C",
  "#FFCC4D",
  "#B26BFF",
];
const FILLS = ["transparent", "#FFB30033", "#0055FF22", "#00A65022", "#FF450022"];

const TOOLS = [
  { id: "select", label: "Select", icon: MousePointer2, key: "1" },
  { id: "pen", label: "Pen", icon: Pencil, key: "2" },
  { id: "rectangle", label: "Rectangle", icon: Square, key: "3" },
  { id: "ellipse", label: "Ellipse", icon: Circle, key: "4" },
  { id: "diamond", label: "Diamond", icon: Diamond, key: "5" },
  { id: "line", label: "Line", icon: Minus, key: "6" },
  { id: "arrow", label: "Arrow", icon: ArrowRight, key: "7" },
  { id: "text", label: "Text", icon: Type, key: "8" },
  { id: "eraser", label: "Eraser", icon: Eraser, key: "9" },
  { id: "pan", label: "Pan", icon: Hand, key: "0" },
];

const HANDLE = 8; // resize handle screen-size

const defaultProps = {
  strokeColor: "#1A1A1A",
  fillColor: "transparent",
  strokeWidth: 2,
  roughness: 1.2,
  fillStyle: "hachure",
  fontSize: 24,
};

const Whiteboard = () => {
  // ---- core state ----
  const [elements, setElements] = useState([]);
  const [history, setHistory] = useState([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [tool, setTool] = useState("select");
  const [props, setProps] = useState(defaultProps);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [theme, setTheme] = useState("light");
  const [selectedId, setSelectedId] = useState(null);
  const [editingText, setEditingText] = useState(null); // {id, x, y, value}
  const [draft, setDraft] = useState(null);

  // ---- refs ----
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const roughCanvasRef = useRef(null);
  const drawingRef = useRef(null); // {kind: 'create'|'move'|'resize'|'pan', ...}
  const fileInputRef = useRef(null);
  const textInputRef = useRef(null);

  // ---- theme ----
  useEffect(() => {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "dark" || saved === "light") setTheme(saved);
  }, []);
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_KEY, theme);
    // Update default stroke color when switching theme if it's the default black/white
    setProps((p) => {
      if (theme === "dark" && p.strokeColor === "#1A1A1A")
        return { ...p, strokeColor: "#EDEDED" };
      if (theme === "light" && p.strokeColor === "#EDEDED")
        return { ...p, strokeColor: "#1A1A1A" };
      return p;
    });
  }, [theme]);

  // ---- load from storage on mount ----
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (Array.isArray(data.elements)) {
          setElements(data.elements);
          setHistory([data.elements]);
          setHistoryIndex(0);
        }
      }
    } catch (e) {
      console.warn("Failed to load scene", e);
    }
  }, []);

  // ---- autosave ----
  useEffect(() => {
    const id = setTimeout(() => {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ elements, savedAt: Date.now() }),
        );
      } catch (e) {
        /* ignore */
      }
    }, 400);
    return () => clearTimeout(id);
  }, [elements]);

  // ---- history push ----
  const pushHistory = useCallback(
    (next) => {
      setHistory((h) => {
        const trimmed = h.slice(0, historyIndex + 1);
        const newHist = [...trimmed, next];
        // cap to 100
        const sliced = newHist.length > 100 ? newHist.slice(newHist.length - 100) : newHist;
        setHistoryIndex(sliced.length - 1);
        return sliced;
      });
    },
    [historyIndex],
  );

  const undo = useCallback(() => {
    setHistoryIndex((idx) => {
      const newIdx = Math.max(0, idx - 1);
      setElements(history[newIdx] || []);
      return newIdx;
    });
  }, [history]);

  const redo = useCallback(() => {
    setHistoryIndex((idx) => {
      const newIdx = Math.min(history.length - 1, idx + 1);
      setElements(history[newIdx] || []);
      return newIdx;
    });
  }, [history]);

  // ---- canvas sizing ----
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      const ctx = canvas.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      requestAnimationFrame(redraw);
    };
    resize();
    roughCanvasRef.current = rough.canvas(canvas);
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- draw element ----
  const drawElement = useCallback(
    (rc, ctx, el) => {
      const seed = el.seed || 1;
      const fillObj =
        el.fillColor && el.fillColor !== "transparent"
          ? {
              fill: el.fillColor,
              fillStyle: el.fillStyle || "hachure",
              fillWeight: 1,
              hachureGap: 8,
            }
          : {};
      const opts = {
        stroke: el.strokeColor,
        strokeWidth: el.strokeWidth,
        roughness: el.roughness,
        seed,
        ...fillObj,
      };

      if (el.type === "rectangle") {
        const { x, y, w, h } = normalizeBounds(el);
        if (w === 0 || h === 0) return;
        rc.rectangle(x, y, w, h, opts);
      } else if (el.type === "ellipse") {
        const { x, y, w, h } = normalizeBounds(el);
        if (w === 0 || h === 0) return;
        rc.ellipse(x + w / 2, y + h / 2, w, h, opts);
      } else if (el.type === "diamond") {
        const { x, y, w, h } = normalizeBounds(el);
        if (w === 0 || h === 0) return;
        const cx = x + w / 2;
        const cy = y + h / 2;
        rc.polygon(
          [
            [cx, y],
            [x + w, cy],
            [cx, y + h],
            [x, cy],
          ],
          opts,
        );
      } else if (el.type === "line") {
        rc.line(el.x, el.y, el.x2, el.y2, opts);
      } else if (el.type === "arrow") {
        rc.line(el.x, el.y, el.x2, el.y2, opts);
        // arrow head
        const angle = Math.atan2(el.y2 - el.y, el.x2 - el.x);
        const len = 14;
        const a1x = el.x2 - len * Math.cos(angle - Math.PI / 7);
        const a1y = el.y2 - len * Math.sin(angle - Math.PI / 7);
        const a2x = el.x2 - len * Math.cos(angle + Math.PI / 7);
        const a2y = el.y2 - len * Math.sin(angle + Math.PI / 7);
        rc.line(el.x2, el.y2, a1x, a1y, opts);
        rc.line(el.x2, el.y2, a2x, a2y, opts);
      } else if (el.type === "pen") {
        if (!el.points || el.points.length < 2) return;
        const stroke = getStroke(el.points, {
          size: (el.strokeWidth || 2) * 2.4,
          thinning: 0.55,
          smoothing: 0.5,
          streamline: 0.5,
          easing: (t) => t,
        });
        if (!stroke.length) return;
        ctx.fillStyle = el.strokeColor;
        ctx.beginPath();
        const [x0, y0] = stroke[0];
        ctx.moveTo(x0, y0);
        for (let i = 1; i < stroke.length; i++) {
          const [px, py] = stroke[i];
          ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
      } else if (el.type === "text") {
        ctx.fillStyle = el.strokeColor;
        ctx.font = `${el.fontSize || 24}px 'Shantell Sans', cursive`;
        ctx.textBaseline = "top";
        const lines = (el.text || "").split("\n");
        const lineHeight = (el.fontSize || 24) * 1.25;
        lines.forEach((line, i) => {
          ctx.fillText(line, el.x, el.y + i * lineHeight);
        });
      }
    },
    [],
  );

  // ---- draw selection box & handles ----
  const drawSelection = useCallback(
    (ctx, el) => {
      const b = getElementBounds(el);
      ctx.save();
      const themeColor = getComputedStyle(document.documentElement)
        .getPropertyValue("--accent")
        .trim();
      ctx.strokeStyle = themeColor || "#FF4500";
      ctx.setLineDash([4 / zoom, 4 / zoom]);
      ctx.lineWidth = 1 / zoom;
      const pad = 6 / zoom;
      ctx.strokeRect(b.x - pad, b.y - pad, b.w + pad * 2, b.h + pad * 2);
      ctx.setLineDash([]);
      // 4 corner handles
      const hs = HANDLE / zoom;
      const corners = [
        [b.x - pad, b.y - pad, "nw"],
        [b.x + b.w + pad, b.y - pad, "ne"],
        [b.x - pad, b.y + b.h + pad, "sw"],
        [b.x + b.w + pad, b.y + b.h + pad, "se"],
      ];
      ctx.fillStyle = "#fff";
      corners.forEach(([cx, cy]) => {
        ctx.fillRect(cx - hs / 2, cy - hs / 2, hs, hs);
        ctx.strokeRect(cx - hs / 2, cy - hs / 2, hs, hs);
      });
      ctx.restore();
    },
    [zoom],
  );

  // ---- main redraw ----
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const rc = roughCanvasRef.current;
    if (!rc) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    // clear
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const bg = getComputedStyle(document.documentElement)
      .getPropertyValue("--bg-canvas")
      .trim();
    ctx.fillStyle = bg || "#F4F4F0";
    ctx.fillRect(0, 0, w, h);

    // draw grid (dots)
    const gridColor = getComputedStyle(document.documentElement)
      .getPropertyValue("--bg-grid")
      .trim();
    const gridSize = 24 * zoom;
    if (gridSize > 6) {
      ctx.fillStyle = gridColor || "#E4E4E0";
      const offX = pan.x % gridSize;
      const offY = pan.y % gridSize;
      for (let x = offX; x < w; x += gridSize) {
        for (let y = offY; y < h; y += gridSize) {
          ctx.fillRect(x, y, 1.5, 1.5);
        }
      }
    }

    // apply world transform
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // draw all elements
    elements.forEach((el) => drawElement(rc, ctx, el));

    // draw draft
    if (draft) drawElement(rc, ctx, draft);

    // draw selection
    if (selectedId) {
      const sel = elements.find((e) => e.id === selectedId);
      if (sel) drawSelection(ctx, sel);
    }

    ctx.restore();
  }, [elements, draft, pan, zoom, selectedId, drawElement, drawSelection]);

  useEffect(() => {
    redraw();
  }, [redraw, theme]);

  // ---- pointer logic ----
  const getMouse = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const getResizeHandleAt = (el, world) => {
    if (!el) return null;
    const b = getElementBounds(el);
    const pad = 6 / zoom;
    const hs = HANDLE / zoom;
    const corners = [
      { x: b.x - pad, y: b.y - pad, h: "nw" },
      { x: b.x + b.w + pad, y: b.y - pad, h: "ne" },
      { x: b.x - pad, y: b.y + b.h + pad, h: "sw" },
      { x: b.x + b.w + pad, y: b.y + b.h + pad, h: "se" },
    ];
    for (const c of corners) {
      if (
        world.x >= c.x - hs &&
        world.x <= c.x + hs &&
        world.y >= c.y - hs &&
        world.y <= c.y + hs
      )
        return c.h;
    }
    return null;
  };

  const handlePointerDown = (e) => {
    if (editingText) return; // ignore canvas clicks while text editor is open
    const screen = getMouse(e);
    const world = screenToWorld(screen.x, screen.y, pan, zoom);

    // Text tool: open editor immediately, no pointer capture needed
    if (tool === "text") {
      e.preventDefault();
      const id = uid();
      setEditingText({
        id,
        worldX: world.x,
        worldY: world.y,
        value: "",
        openedAt: Date.now(),
      });
      return;
    }

    canvasRef.current.setPointerCapture?.(e.pointerId);

    // panning override (middle mouse or space drag)
    if (e.button === 1 || tool === "pan" || e.spaceDown) {
      drawingRef.current = {
        kind: "pan",
        startX: screen.x,
        startY: screen.y,
        startPan: { ...pan },
      };
      return;
    }

    if (tool === "select") {
      // check resize handle of selected
      const selEl = elements.find((el) => el.id === selectedId);
      const hh = getResizeHandleAt(selEl, world);
      if (hh) {
        drawingRef.current = { kind: "resize", handle: hh, id: selectedId };
        return;
      }
      // hit-test top-most element
      let hit = null;
      for (let i = elements.length - 1; i >= 0; i--) {
        if (hitTest(elements[i], world.x, world.y, 8 / zoom)) {
          hit = elements[i];
          break;
        }
      }
      if (hit) {
        setSelectedId(hit.id);
        drawingRef.current = {
          kind: "move",
          id: hit.id,
          startWorld: world,
          original: hit,
        };
      } else {
        setSelectedId(null);
      }
      return;
    }

    if (tool === "eraser") {
      // delete hit element
      let hitIdx = -1;
      for (let i = elements.length - 1; i >= 0; i--) {
        if (hitTest(elements[i], world.x, world.y, 8 / zoom)) {
          hitIdx = i;
          break;
        }
      }
      if (hitIdx >= 0) {
        const next = elements.filter((_, idx) => idx !== hitIdx);
        setElements(next);
        pushHistory(next);
      }
      drawingRef.current = { kind: "erase" };
      return;
    }

    if (tool === "pen") {
      const newEl = {
        id: uid(),
        type: "pen",
        points: [{ x: world.x, y: world.y }],
        strokeColor: props.strokeColor,
        strokeWidth: props.strokeWidth,
        roughness: props.roughness,
        seed: seedFor(),
      };
      setDraft(newEl);
      drawingRef.current = { kind: "create", id: newEl.id };
      return;
    }

    // shapes: rectangle, ellipse, diamond, line, arrow
    const newEl = {
      id: uid(),
      type: tool,
      x: world.x,
      y: world.y,
      x2: world.x,
      y2: world.y,
      strokeColor: props.strokeColor,
      fillColor: tool === "line" || tool === "arrow" ? "transparent" : props.fillColor,
      strokeWidth: props.strokeWidth,
      roughness: props.roughness,
      fillStyle: props.fillStyle,
      seed: seedFor(),
    };
    setDraft(newEl);
    drawingRef.current = { kind: "create", id: newEl.id };
  };

  const handlePointerMove = (e) => {
    if (!drawingRef.current) {
      // Update cursor hint for select tool
      return;
    }
    const screen = getMouse(e);
    const world = screenToWorld(screen.x, screen.y, pan, zoom);
    const op = drawingRef.current;

    if (op.kind === "pan") {
      setPan({
        x: op.startPan.x + (screen.x - op.startX),
        y: op.startPan.y + (screen.y - op.startY),
      });
      return;
    }
    if (op.kind === "move") {
      const dx = world.x - op.startWorld.x;
      const dy = world.y - op.startWorld.y;
      setElements((els) =>
        els.map((el) =>
          el.id === op.id ? translateElement(op.original, dx, dy) : el,
        ),
      );
      return;
    }
    if (op.kind === "resize") {
      setElements((els) =>
        els.map((el) =>
          el.id === op.id ? resizeElement(el, op.handle, world.x, world.y) : el,
        ),
      );
      return;
    }
    if (op.kind === "create") {
      setDraft((d) => {
        if (!d) return d;
        if (d.type === "pen") {
          return { ...d, points: [...d.points, { x: world.x, y: world.y }] };
        }
        // shift to keep square / equal
        let nx2 = world.x;
        let ny2 = world.y;
        if (e.shiftKey && (d.type === "rectangle" || d.type === "ellipse" || d.type === "diamond")) {
          const dx = nx2 - d.x;
          const dy = ny2 - d.y;
          const m = Math.max(Math.abs(dx), Math.abs(dy));
          nx2 = d.x + Math.sign(dx || 1) * m;
          ny2 = d.y + Math.sign(dy || 1) * m;
        }
        return { ...d, x2: nx2, y2: ny2 };
      });
      return;
    }
    if (op.kind === "erase") {
      // continuous erase while dragging
      for (let i = elements.length - 1; i >= 0; i--) {
        if (hitTest(elements[i], world.x, world.y, 8 / zoom)) {
          const next = elements.filter((_, idx) => idx !== i);
          setElements(next);
          pushHistory(next);
          break;
        }
      }
    }
  };

  const handlePointerUp = () => {
    const op = drawingRef.current;
    drawingRef.current = null;
    if (!op) return;
    if (op.kind === "create" && draft) {
      // commit draft if meaningful size
      const meaningful =
        draft.type === "pen"
          ? draft.points.length > 1
          : Math.abs(draft.x2 - draft.x) > 2 || Math.abs(draft.y2 - draft.y) > 2;
      if (meaningful) {
        const next = [...elements, draft];
        setElements(next);
        pushHistory(next);
        // After creating, switch back to select for non-pen tools (Excalidraw-like behavior optional)
        if (draft.type !== "pen") {
          setSelectedId(draft.id);
        }
      }
      setDraft(null);
    } else if (op.kind === "move" || op.kind === "resize") {
      pushHistory(elements);
    }
  };

  // ---- text editor commit ----
  const commitText = () => {
    if (!editingText) return;
    const value = editingText.value.trim();
    if (value.length === 0) {
      setEditingText(null);
      return;
    }
    // measure
    const ctx = canvasRef.current.getContext("2d");
    ctx.font = `${props.fontSize}px 'Shantell Sans', cursive`;
    const lines = value.split("\n");
    const width = Math.max(...lines.map((l) => ctx.measureText(l).width));
    const height = lines.length * props.fontSize * 1.25;
    const newEl = {
      id: editingText.id,
      type: "text",
      x: editingText.worldX,
      y: editingText.worldY,
      text: value,
      width,
      height,
      strokeColor: props.strokeColor,
      fontSize: props.fontSize,
    };
    const next = [...elements, newEl];
    setElements(next);
    pushHistory(next);
    setEditingText(null);
    setTool("select");
    setSelectedId(newEl.id);
  };

  // ---- wheel: zoom ----
  const handleWheel = (e) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const delta = -e.deltaY * 0.002;
      zoomAt(getMouse(e), zoom * (1 + delta));
    } else {
      // pan
      setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
    }
  };

  const zoomAt = (screen, newZoom) => {
    const z = Math.min(5, Math.max(0.1, newZoom));
    // keep mouse position stable
    const wx = (screen.x - pan.x) / zoom;
    const wy = (screen.y - pan.y) / zoom;
    setPan({ x: screen.x - wx * z, y: screen.y - wy * z });
    setZoom(z);
  };

  // ---- keyboard shortcuts ----
  useEffect(() => {
    const onKey = (e) => {
      if (editingText) return;
      const target = e.target;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA"))
        return;
      // tool keys
      const found = TOOLS.find((t) => t.key === e.key);
      if (found) {
        setTool(found.id);
        return;
      }
      const meta = e.ctrlKey || e.metaKey;
      if (meta && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
      if (meta && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) {
        e.preventDefault();
        redo();
        return;
      }
      if (meta && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveLocal();
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        e.preventDefault();
        const next = elements.filter((el) => el.id !== selectedId);
        setElements(next);
        pushHistory(next);
        setSelectedId(null);
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, selectedId, elements, editingText, pushHistory]);

  // ---- file actions ----
  const saveLocal = () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ elements, savedAt: Date.now() }),
    );
    toast("Scene saved to this browser.");
  };

  const newScene = () => {
    if (!window.confirm("Clear the canvas? This cannot be undone (other than via Undo).")) return;
    setElements([]);
    setSelectedId(null);
    pushHistory([]);
  };

  const exportJSON = () => {
    const blob = new Blob(
      [JSON.stringify({ type: "e1canvas/v1", elements }, null, 2)],
      { type: "application/json" },
    );
    downloadBlob(blob, "canvas-scene.json");
  };

  const importJSON = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (Array.isArray(data.elements)) {
          setElements(data.elements);
          setSelectedId(null);
          pushHistory(data.elements);
          toast("Scene loaded.");
        } else throw new Error("invalid");
      } catch (err) {
        toast("Could not parse scene file.");
      }
    };
    reader.readAsText(file);
  };

  const exportPNG = () => {
    // Render to an offscreen canvas at world bounds with padding (transparent bg)
    if (elements.length === 0) {
      toast("Nothing to export yet.");
      return;
    }
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    elements.forEach((el) => {
      const b = getElementBounds(el);
      if (b.x < minX) minX = b.x;
      if (b.y < minY) minY = b.y;
      if (b.x + b.w > maxX) maxX = b.x + b.w;
      if (b.y + b.h > maxY) maxY = b.y + b.h;
    });
    const pad = 32;
    const w = Math.ceil(maxX - minX + pad * 2);
    const h = Math.ceil(maxY - minY + pad * 2);
    const off = document.createElement("canvas");
    off.width = w;
    off.height = h;
    const ctx = off.getContext("2d");
    const bg = getComputedStyle(document.documentElement)
      .getPropertyValue("--bg-canvas")
      .trim();
    ctx.fillStyle = bg || "#F4F4F0";
    ctx.fillRect(0, 0, w, h);
    ctx.translate(-minX + pad, -minY + pad);
    const rc = rough.canvas(off);
    elements.forEach((el) => drawElement(rc, ctx, el));
    off.toBlob((blob) => {
      if (blob) downloadBlob(blob, "canvas-scene.png");
    }, "image/png");
  };

  const downloadBlob = (blob, name) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // ---- tiny toast ----
  const [toastMsg, setToastMsg] = useState("");
  const toast = (msg) => {
    setToastMsg(msg);
    clearTimeout(toast._t);
    toast._t = setTimeout(() => setToastMsg(""), 1800);
  };

  // ---- selected element live edit for properties ----
  const selectedEl = useMemo(
    () => elements.find((e) => e.id === selectedId) || null,
    [elements, selectedId],
  );

  const updateSelected = (patch) => {
    if (!selectedId) return;
    setElements((els) =>
      els.map((el) => (el.id === selectedId ? { ...el, ...patch } : el)),
    );
  };

  // commit history after a property change on selection (debounced)
  const propCommitRef = useRef(null);
  useEffect(() => {
    if (!selectedEl) return;
    clearTimeout(propCommitRef.current);
    propCommitRef.current = setTimeout(() => {
      pushHistory(elements);
    }, 350);
    return () => clearTimeout(propCommitRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedEl?.strokeColor,
    selectedEl?.fillColor,
    selectedEl?.strokeWidth,
    selectedEl?.roughness,
    selectedEl?.fillStyle,
    selectedEl?.fontSize,
  ]);

  // current palette for color buttons
  const palette = theme === "dark" ? PALETTE_DARK : PALETTE;

  // active color/etc shown reflects selection if any, else current props
  const activeStroke = selectedEl?.strokeColor ?? props.strokeColor;
  const activeFill = selectedEl?.fillColor ?? props.fillColor;
  const activeStrokeWidth = selectedEl?.strokeWidth ?? props.strokeWidth;
  const activeRoughness = selectedEl?.roughness ?? props.roughness;
  const activeFillStyle = selectedEl?.fillStyle ?? props.fillStyle;
  const activeFontSize = selectedEl?.fontSize ?? props.fontSize;

  const applyProp = (key, value) => {
    if (selectedEl) updateSelected({ [key]: value });
    else setProps((p) => ({ ...p, [key]: value }));
  };

  // ---- focus text input when editing ----
  useEffect(() => {
    if (editingText && textInputRef.current) {
      // double-rAF to outlast pointer/click event focus shifts
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          textInputRef.current?.focus();
        });
      });
    }
  }, [editingText]);

  const showFill = !selectedEl
    ? tool === "rectangle" || tool === "ellipse" || tool === "diamond"
    : selectedEl.type === "rectangle" ||
      selectedEl.type === "ellipse" ||
      selectedEl.type === "diamond";
  const showFontSize = selectedEl?.type === "text" || tool === "text";

  return (
    <div
      ref={containerRef}
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--bg-canvas)",
        overflow: "hidden",
      }}
    >
      <canvas
        ref={canvasRef}
        data-testid="drawing-canvas"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
        onContextMenu={(e) => e.preventDefault()}
        style={{
          display: "block",
          cursor:
            tool === "pan"
              ? "grab"
              : tool === "select"
                ? "default"
                : "crosshair",
          touchAction: "none",
        }}
      />

      {/* Editing text overlay */}
      {editingText && (
        <textarea
          ref={textInputRef}
          data-testid="canvas-text-input"
          className="canvas-text-input"
          autoFocus
          value={editingText.value}
          rows={1}
          style={{
            left: editingText.worldX * zoom + pan.x,
            top: editingText.worldY * zoom + pan.y,
            fontSize: props.fontSize * zoom,
            lineHeight: 1.25,
            color: props.strokeColor,
          }}
          onChange={(e) =>
            setEditingText({ ...editingText, value: e.target.value })
          }
          onBlur={() => {
            // Ignore the spurious initial blur right after the textarea opens
            // (focus can briefly move during the click sequence that opened it).
            if (editingText && Date.now() - (editingText.openedAt || 0) < 250) {
              // Re-focus
              requestAnimationFrame(() => textInputRef.current?.focus());
              return;
            }
            commitText();
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setEditingText(null);
            }
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              commitText();
            }
          }}
        />
      )}

      {/* Top bar */}
      <TopBar
        theme={theme}
        setTheme={setTheme}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        onUndo={undo}
        onRedo={redo}
        onNew={newScene}
        onSave={saveLocal}
        onExportPNG={exportPNG}
        onExportJSON={exportJSON}
        onImportClick={() => fileInputRef.current?.click()}
        sceneCount={elements.length}
      />

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        style={{ display: "none" }}
        data-testid="file-import-input"
        onChange={(e) => {
          if (e.target.files?.[0]) importJSON(e.target.files[0]);
          e.target.value = "";
        }}
      />

      {/* Left toolbar */}
      <LeftToolbar tool={tool} setTool={setTool} />

      {/* Properties panel */}
      <PropertiesPanel
        palette={palette}
        fills={FILLS}
        activeStroke={activeStroke}
        activeFill={activeFill}
        activeStrokeWidth={activeStrokeWidth}
        activeRoughness={activeRoughness}
        activeFillStyle={activeFillStyle}
        activeFontSize={activeFontSize}
        showFill={showFill}
        showFontSize={showFontSize}
        onChange={applyProp}
        hasSelection={!!selectedEl}
        onDelete={() => {
          if (!selectedId) return;
          const next = elements.filter((el) => el.id !== selectedId);
          setElements(next);
          pushHistory(next);
          setSelectedId(null);
        }}
      />

      {/* Zoom controls */}
      <ZoomControls
        zoom={zoom}
        onZoomIn={() =>
          zoomAt(
            { x: window.innerWidth / 2, y: window.innerHeight / 2 },
            zoom * 1.2,
          )
        }
        onZoomOut={() =>
          zoomAt(
            { x: window.innerWidth / 2, y: window.innerHeight / 2 },
            zoom / 1.2,
          )
        }
        onReset={() => {
          setZoom(1);
          setPan({ x: 0, y: 0 });
        }}
      />

      {/* Toast */}
      {toastMsg && (
        <div
          data-testid="toast"
          className="brut-panel"
          style={{
            position: "fixed",
            bottom: 70,
            left: "50%",
            transform: "translateX(-50%)",
            padding: "10px 16px",
            fontSize: 12,
            zIndex: 200,
            fontFamily: "IBM Plex Mono, monospace",
          }}
        >
          {toastMsg}
        </div>
      )}
    </div>
  );
};

// ----- Subcomponents -----

const TopBar = ({
  theme,
  setTheme,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onNew,
  onSave,
  onExportPNG,
  onExportJSON,
  onImportClick,
  sceneCount,
}) => {
  return (
    <div
      className="brut-panel"
      style={{
        position: "fixed",
        top: 16,
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        alignItems: "center",
        gap: 4,
        padding: 6,
        zIndex: 50,
      }}
      data-testid="top-bar"
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "0 10px",
          fontWeight: 700,
          fontSize: 12,
          letterSpacing: "0.04em",
        }}
      >
        <span style={{ color: "var(--accent)" }}>◆</span>
        <span>E1·CANVAS·STUDIO</span>
      </div>
      <div className="tool-divider" />
      <button
        className="brut-btn"
        title="New scene"
        data-testid="action-new"
        onClick={onNew}
      >
        <Trash2 size={18} />
      </button>
      <button
        className="brut-btn"
        title="Save (Ctrl/Cmd+S)"
        data-testid="action-save"
        onClick={onSave}
      >
        <Save size={18} />
      </button>
      <button
        className="brut-btn"
        title="Import JSON"
        data-testid="action-import"
        onClick={onImportClick}
      >
        <Upload size={18} />
      </button>
      <button
        className="brut-btn"
        title="Export JSON"
        data-testid="action-export-json"
        onClick={onExportJSON}
      >
        <Download size={18} />
      </button>
      <button
        className="brut-btn"
        title="Export PNG"
        data-testid="action-export-png"
        onClick={onExportPNG}
      >
        <ImageIcon size={18} />
      </button>
      <div className="tool-divider" />
      <button
        className="brut-btn"
        title="Undo (Ctrl/Cmd+Z)"
        data-testid="action-undo"
        onClick={onUndo}
        disabled={!canUndo}
        style={{ opacity: canUndo ? 1 : 0.35 }}
      >
        <Undo2 size={18} />
      </button>
      <button
        className="brut-btn"
        title="Redo (Ctrl/Cmd+Shift+Z)"
        data-testid="action-redo"
        onClick={onRedo}
        disabled={!canRedo}
        style={{ opacity: canRedo ? 1 : 0.35 }}
      >
        <Redo2 size={18} />
      </button>
      <div className="tool-divider" />
      <button
        className="brut-btn"
        title="Toggle theme"
        data-testid="action-theme-toggle"
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      >
        {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
      </button>
      <div
        style={{
          padding: "0 10px",
          fontSize: 11,
          color: "var(--text-secondary)",
        }}
        data-testid="scene-count"
      >
        {sceneCount} obj
      </div>
    </div>
  );
};

const LeftToolbar = ({ tool, setTool }) => {
  return (
    <div
      className="brut-panel"
      data-testid="left-toolbar"
      style={{
        position: "fixed",
        top: "50%",
        left: 16,
        transform: "translateY(-50%)",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        padding: 6,
        zIndex: 50,
      }}
    >
      {TOOLS.map((t) => {
        const Icon = t.icon;
        return (
          <button
            key={t.id}
            className={`brut-btn ${tool === t.id ? "is-active" : ""}`}
            title={`${t.label} (${t.key})`}
            data-testid={`tool-${t.id}`}
            onClick={() => setTool(t.id)}
          >
            <Icon size={18} />
            <span className="kbd">{t.key}</span>
          </button>
        );
      })}
    </div>
  );
};

const PropertiesPanel = ({
  palette,
  fills,
  activeStroke,
  activeFill,
  activeStrokeWidth,
  activeRoughness,
  activeFillStyle,
  activeFontSize,
  showFill,
  showFontSize,
  onChange,
  hasSelection,
  onDelete,
}) => {
  return (
    <div
      className="brut-panel"
      data-testid="properties-panel"
      style={{
        position: "fixed",
        top: 80,
        right: 16,
        width: 220,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        padding: 14,
        zIndex: 50,
        fontSize: 12,
      }}
    >
      <div className="label-tiny" data-testid="prop-section-stroke">
        Stroke
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {palette.map((c) => (
          <button
            key={c}
            className={`swatch ${activeStroke?.toUpperCase() === c.toUpperCase() ? "is-selected" : ""}`}
            style={{ background: c }}
            title={c}
            data-testid={`stroke-${c.replace("#", "")}`}
            onClick={() => onChange("strokeColor", c)}
          />
        ))}
        <label
          className="swatch"
          style={{
            background: activeStroke || "#000",
            position: "relative",
            display: "inline-block",
          }}
          title="Custom color"
        >
          <input
            type="color"
            value={activeStroke || "#000000"}
            onChange={(e) => onChange("strokeColor", e.target.value)}
            style={{ opacity: 0, width: "100%", height: "100%", cursor: "pointer" }}
            data-testid="stroke-custom"
          />
        </label>
      </div>

      {showFill && (
        <>
          <div className="label-tiny">Fill</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {fills.map((c, i) => (
              <button
                key={c}
                className={`swatch ${
                  (activeFill || "transparent").toUpperCase() === c.toUpperCase()
                    ? "is-selected"
                    : ""
                }`}
                style={{
                  background:
                    c === "transparent"
                      ? "repeating-linear-gradient(45deg,#fff,#fff 4px,#ddd 4px,#ddd 8px)"
                      : c,
                }}
                data-testid={`fill-${i}`}
                title={c}
                onClick={() => onChange("fillColor", c)}
              />
            ))}
          </div>
          <div className="label-tiny">Fill style</div>
          <div style={{ display: "flex", gap: 6 }}>
            {["hachure", "solid", "cross-hatch"].map((fs) => (
              <button
                key={fs}
                className={`brut-btn brut-btn-sm ${activeFillStyle === fs ? "is-active" : ""}`}
                data-testid={`fillstyle-${fs}`}
                onClick={() => onChange("fillStyle", fs)}
                style={{ width: "auto", padding: "0 8px", fontSize: 10 }}
              >
                {fs}
              </button>
            ))}
          </div>
        </>
      )}

      <div className="label-tiny">Stroke width</div>
      <div style={{ display: "flex", gap: 6 }}>
        {[1, 2, 4, 6].map((w) => (
          <button
            key={w}
            className={`brut-btn brut-btn-sm ${activeStrokeWidth === w ? "is-active" : ""}`}
            data-testid={`stroke-width-${w}`}
            onClick={() => onChange("strokeWidth", w)}
          >
            <div
              style={{
                width: 18,
                height: w + 1,
                background: "currentColor",
                borderRadius: 99,
              }}
            />
          </button>
        ))}
      </div>

      <div className="label-tiny">Roughness</div>
      <div style={{ display: "flex", gap: 6 }}>
        {[0, 1.2, 2.5].map((r, i) => (
          <button
            key={r}
            className={`brut-btn brut-btn-sm ${Math.abs((activeRoughness || 0) - r) < 0.1 ? "is-active" : ""}`}
            data-testid={`rough-${i}`}
            onClick={() => onChange("roughness", r)}
            style={{ width: "auto", padding: "0 10px", fontSize: 10 }}
          >
            {["Sharp", "Hand", "Wild"][i]}
          </button>
        ))}
      </div>

      {showFontSize && (
        <>
          <div className="label-tiny">Font size</div>
          <div style={{ display: "flex", gap: 6 }}>
            {[16, 24, 36, 56].map((s) => (
              <button
                key={s}
                className={`brut-btn brut-btn-sm ${activeFontSize === s ? "is-active" : ""}`}
                data-testid={`font-${s}`}
                onClick={() => onChange("fontSize", s)}
                style={{ width: "auto", padding: "0 8px", fontSize: 10 }}
              >
                {s}
              </button>
            ))}
          </div>
        </>
      )}

      {hasSelection && (
        <button
          className="brut-btn"
          data-testid="action-delete-selected"
          onClick={onDelete}
          style={{
            width: "100%",
            background: "var(--accent)",
            color: "#fff",
            borderColor: "var(--accent)",
            fontSize: 11,
            letterSpacing: "0.06em",
            gap: 8,
          }}
        >
          <Trash2 size={14} />
          <span style={{ marginLeft: 6 }}>DELETE</span>
        </button>
      )}

      <div
        style={{
          fontSize: 10,
          color: "var(--text-secondary)",
          lineHeight: 1.5,
          paddingTop: 4,
          borderTop: "1px dashed var(--border-hard)",
        }}
      >
        Tips · Drag wheel to pan · Cmd/Ctrl + wheel to zoom · Del to remove · Shift to constrain
      </div>
    </div>
  );
};

const ZoomControls = ({ zoom, onZoomIn, onZoomOut, onReset }) => {
  return (
    <div
      className="brut-panel"
      data-testid="zoom-controls"
      style={{
        position: "fixed",
        bottom: 16,
        left: 16,
        display: "flex",
        alignItems: "center",
        gap: 4,
        padding: 6,
        zIndex: 50,
      }}
    >
      <button
        className="brut-btn brut-btn-sm"
        data-testid="zoom-out"
        onClick={onZoomOut}
        title="Zoom out"
      >
        <Minus size={14} />
      </button>
      <button
        className="brut-btn brut-btn-sm"
        data-testid="zoom-reset"
        onClick={onReset}
        title="Reset view"
        style={{ width: "auto", padding: "0 10px", fontSize: 11 }}
      >
        {Math.round(zoom * 100)}%
      </button>
      <button
        className="brut-btn brut-btn-sm"
        data-testid="zoom-in"
        onClick={onZoomIn}
        title="Zoom in"
      >
        <Plus size={14} />
      </button>
    </div>
  );
};

export default Whiteboard;
