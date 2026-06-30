# E1 Canvas Studio

A fast, hand‑drawn, **Excalidraw‑style interactive whiteboard** that runs entirely in your browser. Sketch shapes, scribble freehand, write text, organize ideas — no signup, no backend, everything saved locally.

![status](https://img.shields.io/badge/status-MVP%20ready-FF4500?style=flat-square)
![stack](https://img.shields.io/badge/stack-React%2019%20%2B%20Rough.js-1A1A1A?style=flat-square)
![license](https://img.shields.io/badge/license-MIT-1A1A1A?style=flat-square)

---

## Features

### Drawing tools (10)
- **Select** — click to select, drag to move, 4 corner handles to resize
- **Pen** — pressure‑aware freehand with `perfect-freehand`
- **Rectangle, Ellipse, Diamond** — sketched via `rough.js`
- **Line, Arrow** — with arrowhead
- **Text** — Shantell Sans hand‑lettering, Enter to commit, Shift+Enter for newline
- **Eraser** — drag over elements to remove
- **Pan** — grab and drag the canvas

### Properties panel
- Stroke color (preset palette + custom color picker)
- Fill color & fill style (`hachure` / `solid` / `cross-hatch`)
- Stroke width (1 / 2 / 4 / 6)
- Roughness (`Sharp` / `Hand` / `Wild`)
- Font size (16 / 24 / 36 / 56)
- Selecting an element edits its properties live; with nothing selected, the panel sets defaults for the next shape

### Canvas controls
- Infinite canvas with a subtle dot grid
- Pan with wheel‑drag or the Hand tool
- Zoom with `Ctrl/Cmd + wheel` or the zoom controls (`-` / `+` / `% reset`)
- **Autosave** to `localStorage` (debounced 400 ms)
- **Save**, **Import JSON**, **Export JSON**, **Export PNG**
- **Undo / Redo** (history depth 100)
- **Light / Dark** theme toggle, persisted per‑browser

### Keyboard shortcuts

| Key | Action |
|-----|--------|
| `1` | Select tool |
| `2` | Pen |
| `3` | Rectangle |
| `4` | Ellipse |
| `5` | Diamond |
| `6` | Line |
| `7` | Arrow |
| `8` | Text |
| `9` | Eraser |
| `0` | Pan |
| `Ctrl/Cmd + Z` | Undo |
| `Ctrl/Cmd + Shift + Z` | Redo |
| `Ctrl/Cmd + S` | Save to browser |
| `Delete` / `Backspace` | Delete the selected element |
| `Shift` while drawing | Constrain rectangle/ellipse/diamond to a square |
| `Enter` (in text editor) | Commit text |
| `Shift + Enter` (in text editor) | Newline |
| `Escape` (in text editor) | Cancel |

---

## Tech stack

- **React 19** + **Create React App (craco)**
- **Canvas 2D** rendering
- **[rough.js](https://github.com/rough-stuff/rough)** — sketchy hand‑drawn shapes
- **[perfect-freehand](https://github.com/steveruizok/perfect-freehand)** — pressure‑aware pen strokes
- **[lucide-react](https://lucide.dev/)** — icons
- **Tailwind CSS** + brutalist utility classes for the UI chrome
- **Google Fonts**: *IBM Plex Mono* (UI) and *Shantell Sans* (canvas text)

The app is **frontend only** — there is no backend service. Scene state lives in React + `localStorage`.

---

## Project structure

```
/app
├── frontend/
│   ├── public/
│   │   └── index.html          # Google fonts + base HTML
│   ├── src/
│   │   ├── App.js              # mounts <Whiteboard/>
│   │   ├── index.js            # React 19 entry
│   │   ├── index.css           # design tokens, brutalist UI utilities
│   │   ├── Whiteboard.jsx      # main component — canvas, tools, history, I/O
│   │   └── whiteboardUtils.js  # geometry, hit-testing, transforms
│   ├── craco.config.js         # webpack alias `@` -> `src`
│   ├── tailwind.config.js
│   └── package.json
├── design_guidelines.json      # design system blueprint
├── memory/
│   └── PRD.md                  # product requirements / backlog
└── README.md                   # you are here
```

---

## Getting started

> Requirements: **Node 18+** and **Yarn 1.x**.

```bash
# 1. Install dependencies
cd frontend
yarn install

# 2. Start the dev server (default: http://localhost:3000)
yarn start

# 3. Build a production bundle
yarn build
```

There are no environment variables required by the whiteboard itself. The repo ships with a generic `frontend/.env` (`REACT_APP_BACKEND_URL`) used by the platform template — you can ignore it for this app.

---

## Data format (`.json` scene file)

Exported JSON looks like:

```json
{
  "type": "e1canvas/v1",
  "elements": [
    {
      "id": "abc123",
      "type": "rectangle",
      "x": 120, "y": 80, "x2": 320, "y2": 220,
      "strokeColor": "#1A1A1A",
      "fillColor": "transparent",
      "strokeWidth": 2,
      "roughness": 1.2,
      "fillStyle": "hachure",
      "seed": 482910
    },
    {
      "id": "def456",
      "type": "pen",
      "points": [{ "x": 410, "y": 100 }, { "x": 420, "y": 112 }],
      "strokeColor": "#FF4500",
      "strokeWidth": 4,
      "roughness": 1.2,
      "seed": 113922
    },
    {
      "id": "ghi789",
      "type": "text",
      "x": 200, "y": 300,
      "text": "Hello canvas!",
      "fontSize": 24,
      "strokeColor": "#1A1A1A",
      "width": 180, "height": 30
    }
  ]
}
```

Drop this file via **Import JSON** to restore a scene.

---

## Design system

Defined in [`design_guidelines.json`](./design_guidelines.json) and implemented in `index.css`.

| Token | Light | Dark |
|-------|-------|------|
| Canvas background | `#F4F4F0` | `#121212` |
| Grid dots | `#E4E4E0` | `#222222` |
| Panel surface | `#FFFFFF` | `#1E1E1E` |
| Border (hard) | `#1A1A1A` | `#3A3A3A` |
| Accent | `#FF4500` | `#FF5722` |

UI uses **brutalist** elements — sharp 1 px borders, solid offset shadows, no rounded corners — to feel like a drafting table rather than a generic SaaS dashboard.

---

## Roadmap

- [ ] Double‑click an existing text element to edit it inline
- [ ] Multi‑select via marquee (drag in empty space)
- [ ] Free rotation handle
- [ ] Edge‑midpoint resize handles
- [ ] SVG export
- [ ] Image paste / drag‑and‑drop into canvas
- [ ] Shareable read‑only link via URL hash (no backend required)

---

## Contributing

PRs welcome. Please keep:

- The bundle frontend‑only (no servers/services)
- Components small and focused
- `data-testid` attributes on every interactive element
- The brutalist aesthetic — no purple/violet gradients, no glassmorphism, no soft pastels

---

## License

MIT © 2026 — built with [Emergent](https://app.emergent.sh).
