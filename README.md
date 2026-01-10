# Developer README

## Overview

This repository contains a React-based frontend application with a backend execution layer that powers the **Generate Plan** workflow.

From a developer perspective, the system is structured so that:
- The frontend owns all UX, validation, and state transitions.
- Plan generation is performed via a single backend API endpoint.
- The frontend does not contain model logic or execution branching.
- All execution paths return a normalized plan payload consumed by the workflow editor.

This design allows the UI to remain stable while the backend execution logic evolves independently.

---

## Architecture

```
Frontend (React + Vite)
  |
  |  POST /api/generate-plan
  |
Backend (Node.js)
  |
  |-- Python execution layer (ML / logic)
``

The frontend always interacts with the backend through a single API contract.

---

## Key Frontend Integration Point

### Generate Plan Flow

**File**
```
kimo-aamas/src/features/planning/PlanningPage.tsx
```

**Trigger**
- "Generate Plan" button under **Task Description**
- Generates a normalized plan payload

**Flow**
1. User enters a task description
2. Frontend sends request to backend
3. Backend returns a finalized plan payload
4. Frontend applies the plan and navigates to the workflow editor

All downstream behavior is driven entirely by the returned plan structure.

---

## Backend API

### Endpoint
```
POST /api/generate-plan
```

### Response Shape
```json
{
  "plan": { }
}
```

The frontend expects the response to always conform to this structure.

---

## Backend Server

**Location**
```
server/server.js
```

Responsibilities:
- Accept API requests from the frontend
- Invoke the execution layer
- Return a normalized plan payload

This server is intentionally lightweight and dependency-minimal.

---

## Python Execution Layer

**Location**
```
server/python/plan_from_mlx.py
```

Responsibilities:
- Accept a text prompt
- Invoke the model or execution logic
- Emit strict JSON output

The Python layer must always output valid JSON to stdout in the expected format.

---

## Local Development

### Start Backend
From the repository root:
```bash
node server/server.js
```

### Start Frontend
```bash
cd kimo-aamas
npm install
npm run dev
```

Open (or whatever port is shown in the terminal):
```
http://localhost:5173
```

---

## Design Constraints (Do Not Violate)

- Do not add execution logic to the frontend
- Do not expose backend configuration to the UI
- Do not change the plan payload shape without updating the workflow editor
- Keep API surface minimal and stable

---

## Extending the System

- Replace Python execution logic without touching frontend code
- Add logging/telemetry in the backend only
- Keep all experimental logic server-side

---

## Notes for Contributors

This codebase intentionally prioritizes:
- Stability of the user experience
- Isolation of execution logic
- Minimal coupling between UI and model code

Changes that increase frontend complexity or leak backend behavior into the UI should be avoided.
