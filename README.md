# Test Portfolio *(Test Prototype)*

> [!NOTE]
> **Status:** This is an **experimental test build / prototype only**, not the final or actual portfolio version. Layout, 3D assets, and content are currently being tested and iterated on.

**Live Test Preview:** https://my-portofolio-liard-tau.vercel.app/

An interactive 3D driving portfolio

---

## Tech Stack

- **3D Engine & Shaders:** `three` (`three/webgpu` & `three/tsl` — Node-based TSL materials, custom shadow/ground bounce, HDR Bloom & CheapDOF)
- **Physics:** `@dimforge/rapier3d` (WASM raycast vehicle controller, composite colliders, collision bitmasks, destructible props)
- **Animation & Build:** `gsap`, `vite`, `vite-plugin-wasm`

## Interactive Features

- **Canvas-First HUD:** Minimal floating navigation capsule (`Projects`, `Experience`, `Skills`, `Education`) with dark glassmorphism slide-over drawers and auto-hiding control hints.
- **3D Contact Pads:** Interactive pedestals (`GitHub`, `LinkedIn`, `Email`) positioned near the spawn monolith.
- **Procedural AI & Robotics Landmarks:**
  - **WiFi-Controlled Mobile Robot:** Mini ESP32 rover with rotating radar and pulsing WiFi signal rings.
  - **Client-Server Music Stream App:** Audio deck with 5 animated 3D equalizer bars.
  - **Car Roadworthiness Classifier:** Floating 3-layer 3D neural network graph.
  - **Experience & Skills Tower:** Circuit monolith with orbiting gyro rings.
- **Academic Vault Gimmick:** Permanently classified GPA checkpoint (`GPA: [ CLASSIFIED 🔒 ]`) with an interactive 3D barrier that reacts when forced open.

## Controls

| Input | Action |
| :--- | :--- |
| `W A S D` / `Arrow Keys` | Drive & Steer |
| `Shift` | Turbo Boost |
| `Space` / `1`–`4` | Hydraulic Jump & Suspension |
| `B` | Brake |
| `T` | Bullet Time (Slow-Motion) |
| `R` | Respawn Vehicle |
| `E` / `Enter` / `Click` | Inspect 3D Landmark / Contact Pad |
| `Esc` | Close Active Drawer / Modal |

## Run Locally

```bash
npm install
npm run dev
```

Build for production:

```bash
npm run build
npm run preview
```
