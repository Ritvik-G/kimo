# Source Code Architecture

This directory contains all application source code for the C3AN frontend.

## Directory Overview

```
src/
├── features/      # Feature modules (pages + feature logic)
├── components/    # Shared UI components
├── hooks/         # Custom React hooks
├── shared/        # Types, constants, utilities
├── styles/        # CSS styles
├── App.tsx        # Root component
└── main.tsx       # Application entry point
```

## Entry Points

| File | Purpose |
|------|---------|
| `main.tsx` | Bootstraps React and mounts the app |
| `App.tsx` | Root component with routing and global state |

## Module Responsibilities

### features/
Page-level components that represent distinct application views. Each feature is self-contained with its own components, hooks, and utilities when needed.

- **workflow/** — Main canvas editor for building agent workflows
- **planning/** — Task decomposition and plan import interface
- **evaluation/** — Metrics configuration and mapping UI
- **agent-gen/** — Agent generation and configuration

### components/
Reusable UI building blocks shared across features:

- **canvas/** — Visual nodes (AgentBlock, ToolNode, PlanningBlock)
- **modals/** — Detail views and configuration dialogs
- **ui/** — Sidebar, toolbar, and panel components
- **evaluation/** — Evaluation-specific UI components

### hooks/
Custom React hooks that encapsulate reusable logic:

- Canvas interactions (drag, drop, zoom, pan)
- Node linking and connection management
- Workspace state persistence
- Keyboard shortcuts

### shared/
Cross-cutting concerns used throughout the app:

- **types/** — TypeScript type definitions
- **constants/** — Configuration values and registries
- **utils/** — Helper functions
- **planning/** — Plan parsing and operations
- **assets/** — Icons and static resources

## Data Flow

```
User Input → Hooks (state/handlers) → Components (render) → Canvas (visual output)
                    ↓
              shared/types (contracts)
                    ↓
              localStorage (persistence)
```

## Key Patterns

1. **Feature isolation** — Each feature owns its page component and can have local utilities
2. **Shared components** — Canvas nodes and UI elements are reusable across views
3. **Hook composition** — Complex behavior is built by composing smaller hooks
4. **Type safety** — All data structures have TypeScript definitions in `shared/types/`
