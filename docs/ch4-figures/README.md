# Chapter 4 Figures (TestFlowAI)

This folder contains ready-to-export diagram sources for your report.

## Files

- `ER.mmd` — ER diagram (Mermaid, logical)
- `ER-visual.mmd` — ER-style visual (Mermaid flowchart with ovals/diamonds like the sample image)
- `DFD-0.mmd` — DFD-0 Context (Mermaid)
- `DFD-1.mmd` — DFD-1 Top-level Flow (Mermaid)
- `UseCase.puml` — Use-Case diagram (PlantUML)

## How to export

### Option A: VS Code extensions

- Install “Markdown Preview Mermaid Support” or “Mermaid Markdown Syntax Highlighting”.
- Open `.mmd` files, use the Mermaid preview, then export as PNG/SVG.
- Install “PlantUML” extension for `.puml`; set Graphviz if asked, then export as PNG/SVG.

### Option B: CLI (optional)

- Mermaid CLI (Node): `npm i -g @mermaid-js/mermaid-cli`
  - Example: `mmdc -i docs/ch4-figures/DFD-0.mmd -o docs/ch4-figures/DFD-0.png`
- PlantUML (Java): `plantuml docs/ch4-figures/UseCase.puml`

## Captions for the report

- Figure 4.1: Use-Case Diagram of TestFlowAI
- Figure 4.2: DFD-0 — Context of TestFlowAI
- Figure 4.3: DFD-1 — Core processes and data stores
- Figure 4.4: ER Diagram — Core entities and relationships

Tip: Keep labels short and legible; ensure ER cardinalities (1..N) are visible.
