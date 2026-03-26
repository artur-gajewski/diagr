# Diagr — UML Diagram Designer

A modern, lightweight web-based UML diagram editor built with React, TypeScript, and Tailwind CSS. Create, edit, and export professional UML diagrams with an intuitive interface and dark mode support.

![Diagr Screenshot](./diagr.svg)

## Features

✨ **Core Capabilities**
- 🎨 **Intuitive Canvas** — Drag and drop UML elements with real-time rendering
- 📦 **Element Types** — Server, Database, Service, Object, Note, and Text elements
- 🔗 **Relationship Types** — Association, Inheritance, Composition, Aggregation, Dependency, and Realization
- 📝 **UML Members** — Add properties and methods with visibility modifiers (+, -, #, ~)
- 🎭 **Dark Mode** — Seamless light/dark theme switching with persistent preferences
- 📤 **Export Options** — PNG, SVG, PDF, and JSON formats with custom filenames
- 📥 **Import Diagrams** — Load saved JSON diagram files
- 🔄 **State Persistence** — Auto-save diagrams to browser storage
- 🎯 **Keyboard Shortcuts** — Efficient workflow with V (select), C (connect), Space (pan)
- 📐 **Grid Snapping** — Toggle snap-to-grid for precise alignment
- 🔍 **Zoom & Pan** — Zoom (0.2x to 3x), pan, and fit-to-content controls
- 🎬 **Smooth Animations** — Framer Motion powered UI animations

## Tech Stack

### Frontend
- **React 18** — UI library for building interactive components
- **TypeScript** — Type-safe JavaScript development
- **Vite** — Fast build tool and development server
- **Tailwind CSS** — Utility-first CSS framework
- **Framer Motion** — Animation library for smooth transitions

### State Management & UI
- **Zustand** — Lightweight state management with persistence
- **Radix UI** — Unstyled, accessible component primitives
- **Lucide React** — Beautiful, consistent icon library
- **clsx & tailwind-merge** — Utility functions for conditional styling

### Export & Import
- **html-to-image** — Client-side PNG and SVG export rendering
- **jsPDF** — PDF generation with embedded diagram images
- **UUID** — Unique identifier generation for elements and relationships

### Infrastructure
- **AWS CDK** — Infrastructure-as-Code for cloud deployment (TypeScript)

## Project Structure

```
diagr/
├── src/
│   ├── components/
│   │   ├── TopBar.tsx                 # Top navigation bar with export/import/theme
│   │   ├── Canvas/
│   │   │   ├── DiagramCanvas.tsx      # Main drawing canvas and drag/drop logic
│   │   │   ├── UMLBox.tsx             # UML element rendering component
│   │   │   ├── RelationshipArrow.tsx  # Bezier curve arrow rendering
│   │   │   └── SvgDefs.tsx            # SVG marker definitions for arrows
│   │   └── Panels/
│   │       ├── Toolbar.tsx             # Left sidebar with element/tool buttons
│   │       └── PropertiesPanel.tsx     # Right sidebar for editing element properties
│   ├── hooks/
│   │   └── useKeyboard.ts              # Global keyboard shortcut handling (V, C, Space)
│   ├── store/
│   │   ├── diagramStore.ts             # Zustand store for diagram state + persistence
│   │   └── uiStore.ts                  # Zustand store for UI state (selection, tools, zoom)
│   ├── types/
│   │   └── index.ts                    # TypeScript interfaces (UMLElement, Relationship, etc.)
│   ├── utils/
│   │   ├── export.ts                   # Export functions (PNG, SVG, PDF, JSON)
│   │   └── geometry.ts                 # Canvas math utilities (rect, anchors, bezier curves)
│   ├── lib/
│   │   └── utils.ts                    # Helper functions (cn for className merging)
│   ├── App.tsx                         # Root component with layout
│   ├── main.tsx                        # React DOM entry point
│   └── index.css                       # Global styles and Tailwind imports
├── infra/
│   ├── bin/diagr.ts                    # CDK app entry point
│   ├── lib/diagr-stack.ts              # CDK stack definition
│   └── package.json                    # Infrastructure dependencies
├── public/
│   └── diagr.svg                       # App logo/icon
├── index.html                          # HTML entry point
├── package.json                        # Project dependencies
├── tsconfig.json                       # TypeScript configuration
├── tsconfig.app.json                   # App-specific TypeScript config
├── tsconfig.node.json                  # Node-specific TypeScript config
├── vite.config.ts                      # Vite build configuration
├── tailwind.config.ts                  # Tailwind CSS configuration
├── postcss.config.js                   # PostCSS configuration
└── README.md                           # This file
```

## Installation

### Prerequisites
- Node.js 16+ 
- npm 8+ or yarn/pnpm

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/diagr.git
   cd diagr
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```
   The app will be available at `http://localhost:5173`

## Usage

### Creating Diagrams

1. **Add Elements**
   - Use the left toolbar to add UML elements (Server, Database, Service, Object, Note, Text)
   - Elements are created at a default position and can be dragged

2. **Edit Element Properties**
   - Select an element by clicking on it
   - Edit name, properties, and methods in the right panel
   - Use visibility modifiers: `+` (public), `-` (private), `#` (protected), `~` (package)

3. **Create Relationships**
   - Click the "Connect" tool (C) in the left toolbar
   - Click source element, then target element
   - Choose relationship type (Association, Inheritance, Composition, etc.)

4. **Navigate Canvas**
   - **Zoom**: Scroll wheel or zoom controls in top bar
   - **Pan**: Hold Space and drag, or use Pan tool
   - **Fit Content**: Click "Fit" button to auto-zoom to all elements

### Exporting Diagrams

Click the **Export** button in the top bar and choose a format:
- **PNG** — Raster image (2x resolution for high quality)
- **SVG** — Scalable vector (native generated)
- **PDF** — Portable document format
- **JSON** — Save as editable diagram file

A dialog will appear to enter a custom filename. Extensions are added automatically.

### Importing Diagrams

Click the **Import** button and select a previously exported `.json` file to load your diagram.

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `V` | Select tool |
| `C` | Connect tool |
| `A` | Fit all elements to viewport (zoom to fit) |
| `Z` | Zoom in (+10%) |
| `X` | Zoom out (-10%) |
| `H` | Show keyboard shortcuts and help |
| `Space` | Pan tool (hold while dragging) |
| `Delete/Backspace` | Delete selected element or relationship |
| `Enter` | Confirm in dialogs |
| `Esc` | Cancel dialogs, deselect |

### Help & Documentation

Access the built-in help dialog by:
- **Pressing `H`** keyboard shortcut
- **Clicking the help icon (?)** in the top right (next to theme toggle)

The help dialog displays:
- All keyboard shortcuts organized by category (Tools, Navigation, Editing)
- Quick tips for using the application
- Information about features like grid snapping, exporting, and dark mode

### Theme

Toggle between light and dark modes using the sun/moon icon in the top right. Your preference is saved locally.

## Development

### Available Scripts

```bash
# Development server with hot reload
npm run dev

# Build for production
npm run build

# Preview production build locally
npm run preview

# Deploy infrastructure (AWS CDK)
npm run infra:deploy

# Synthesize CloudFormation template
npm run infra:synth
```

### Project Configuration

- **Vite** (`vite.config.ts`) — Build tool configuration with React plugin and path alias
- **TypeScript** (`tsconfig.json`) — Strict type checking enabled
- **Tailwind** (`tailwind.config.ts`) — Utility-first CSS with dark mode support
- **PostCSS** (`postcss.config.js`) — CSS preprocessing with autoprefixer

### Architecture

**State Management**
- `diagramStore.ts` — Diagram elements and relationships (persisted)
- `uiStore.ts` — UI state: selection, tools, zoom/pan, theme

**Rendering Pipeline**
1. Canvas receives mouse events → DiagramCanvas component
2. Updates stored in Zustand stores
3. Components re-render with new state
4. SVG/Canvas elements drawn based on stored geometry

**Export System**
- PNG/PDF: Canvas → html-to-image library → PNG → (PDF: jsPDF)
- SVG: Generated from stored data (no DOM dependency)
- JSON: Direct serialization of diagram model

## Browser Support

- Chrome/Chromium 90+
- Firefox 88+
- Safari 14+
- Edge 90+

Modern browser with ES2020+ support required.

## Performance

- Optimized for diagrams with 100+ elements
- Efficient re-rendering with Zustand selectors
- SVG-based rendering for crisp output at any zoom level
- Debounced drag operations for smooth interactions

## Limitations & Future Work

- ⚠️ Single-page diagrams (no multi-page support yet)
- ⚠️ Real-time collaboration not yet implemented
- 🔜 Undo/redo history
- 🔜 Copy/paste elements
- 🔜 Diagram templates
- 🔜 Collaborative editing

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Author

Built with ❤️ by Artur Gajewski and contributors.

---

**Questions or Issues?** Open an issue on GitHub or check the documentation above.

