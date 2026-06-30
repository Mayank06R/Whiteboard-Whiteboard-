# E1 Canvas Studio — PRD

## Original problem statement
"Now i wanted to build a interactive whiteboard thing like a excalidraw it should be frontend only where a user and draw shapes and write and you know how a exclidraw work i want that functionality"

## Architecture
- Frontend-only React (CRA + craco). No backend usage.
- HTML5 Canvas 2D for rendering, `roughjs` for sketchy shapes, `perfect-freehand` for pen strokes.
- Persistence via `localStorage` (`e1-canvas-studio-scene-v1`, `e1-canvas-studio-theme`).
- Icons via `lucide-react`. Brutalist UI with custom CSS utilities (`.brut-panel`, `.brut-btn`).

## User personas
- Designer / engineer / educator who needs a quick visual sketchpad in the browser.
- Anyone wanting an Excalidraw-style hand-drawn whiteboard with no signup.

## Core requirements (static)
- Drawing tools: select, pen, rectangle, ellipse, diamond, line, arrow, text, eraser, pan.
- Properties: stroke color (palette + custom), fill color, fill style (hachure/solid/cross-hatch), stroke width, roughness, font size.
- Selection: click to select, drag to move, 4-corner resize, delete via Del/Backspace or panel button.
- Undo / redo with history cap of 100.
- Save (autosave + manual) to `localStorage`. Import / export JSON. Export PNG.
- Light / dark theme with persistence.
- Pan (Hand tool or wheel-drag) and zoom (wheel + Cmd/Ctrl, or buttons). Reset view.
- Keyboard shortcuts: 1–9 for tools, Cmd/Ctrl+Z undo, Cmd/Ctrl+Shift+Z redo, Cmd/Ctrl+S save, Del to remove.

## What's been implemented (2026-02)
- Full interactive whiteboard with all tools above (date: 2026-02).
- Brutalist "Architectural Draftsman" theme using IBM Plex Mono + Shantell Sans fonts.
- 100% pass on frontend testing agent (iteration_1).
- `data-testid` on every interactive control.

## Prioritized backlog
- P1: Edge-midpoint resize handles + free rotation.
- P1: Edit text by double-clicking existing text element.
- P2: Group/multi-select with drag-rectangle marquee.
- P2: Library of preset shapes / sticky notes / icons.
- P2: Collaborative session via WebRTC or a backend sync service.
- P3: SVG export (currently PNG + JSON only).
- P3: Image paste / drag-and-drop into canvas.

## Next tasks
- Add multi-select + grouping.
- Add SVG export.
- Add inline text editing for existing text elements.
