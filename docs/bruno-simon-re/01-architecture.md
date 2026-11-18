# 01 — Recon & Tech Stack Architecture
**Adaptasi Blueprint & Dokumentasi Reverse Engineering: Aldy Alfaisal Pasaribu**  
*(Target Referensi: `bruno-simon.com` / `folio-2025` $\rightarrow$ Portofolio 3D WebGPU Aldy Alfaisal Pasaribu)*

## 1. Executive Summary & REA Provenance Ledger

Dokumen ini disusun untuk **Aldy Alfaisal Pasaribu** sebagai hasil reverse engineering tahap pertama pada arsitektur engine 3D `https://bruno-simon.com/` (rilis generasi kedua / `folio-2025`). Berbeda dengan versi tahun 2019 (`folio-2019`) yang berbasis Three.js WebGL1/WebGL2 klasik, shader GLSL manual, dan `cannon.js`, arsitektur terbaru ini dibangun di atas **`three/webgpu` (Three.js r187)**, **TSL (Three.js Shading Language)**, dan **`@dimforge/rapier3d` (WebAssembly SIMD physics)**—yang menjadi fondasi utama untuk implementasi portofolio 3D interaktif **Aldy Alfaisal Pasaribu**.

### REA Evidence & Artifact Ledger

| Evidence / Artifact ID | Operasi REA / Sumber | Subjek / Digest SHA-256 | Cakupan & Status |
| :--- | :--- | :--- | :--- |
| `ev_28d294990a246e048997eaa6e0afe4ce1cf9aaf5ff008aea44d5984976ef7f17` | `capture_browser_scenario` | `https://github.com/brunosimon/folio-2025` (`scenario_sha256: 5c91e80e...`) | **Observed** (396 network events; verifikasi repositori sumber resmi saat host `bruno-simon.com` mengalami `net::ERR_CONNECTION_TIMED_OUT` pada koneksi lokal). |
| `ev_df8a3b5b1285824a498f773a9e359eb2afef88e481a03de4d2084a2d767982a1` | `analyze_javascript_application` (Parent) | `sources/` (`sha256: ea2494caaeaf52f5558f569c25645dca4407704b7ed4d463f1b055264d5b0637`) | **Derived / Shipped-Artifact** (127 file relevan, 126 modul JS terurai tanpa galat sintaks, 145.261 node AST, 2.268 temuan statis). |
| `ev_7d7feef4c73604abb6fc600a0842cab680b3980ae99143cc16ac07fbfbc24428` | `inspect_analysis_view` (`summary`) | `sources/` (`view_digest: 75ceed70...`) | **Derived** (Ringkasan metrik graf semantik: 26.017 relasi `data-flow`, 5.399 `object-flow`, 3.698 `closure`, 254 `event`). |
| `ev_f793924d3b63a44e1e0cd1789e51852cea8fcc4e4daf0854d98a3c8f5f464c22` | `inspect_analysis_view` (`page: modules`) | `sources/` (`view_digest: 752fdc3c...`) | **Observed** (Inventaris node modul `jag_node_*` pada graf aplikasi). |
| `ev_ead52915e2932939db41736f471c7e417adfbb07392e2a709f7bdaea74e75a77` | `inspect_analysis_view` (`item: index.js`) | `index.js` (`sha256: 8ac709ab3ebbf128aebccc3a7e285682dd3c68a5ac96a4780cf6e9e2e39417c1`) | **Observed** (Entry point bootstrap, override prototipe Three.js, dan instansiasi singleton `Game`). |
| `ev_ed51cfd63d5ab443261ca431f2d86508c37aee04d4fbc0bca3e831845f0aa163` | `inspect_analysis_view` (`item: Game/Game.js`) | `Game/Game.js` (`sha256: 8989b7eaf128a7a3ace90d568accca0c186d70c86c047990d85635dcbd27ad60`) | **Observed** (Orchestrator utama & dynamic import `@dimforge/rapier3d` pada baris 129). |
| `ev_da0125f39bcd9a2206c3030002d621d6a5a2d8ce2e1209b4aaea8933c0ebab08` | `inspect_analysis_view` (`item: Game/Physics/Physics.js`) | `Game/Physics/Physics.js` (`sha256: 64e32f6ff9bf77c957dfd8db9fb14fd10465a32fbfa4be68f8762195e7ce9030`) | **Observed** (Wrapper dunia fisika Rapier3D, collision groups bitmask, dan sinkronisasi timestep). |

> **Catatan Batasan Analisis (REA Limitations):** Analisis graf aplikasi (`ev_df8a3b5b1285824a498f773a9e359eb2afef88e481a03de4d2084a2d767982a1`) memindai seluruh 126 file JavaScript sebagai AST statis. Sebagian ekspansi relasi semantik lintas-file pada modul berukuran besar (`Game/World/VisualVehicle.js`, `Game/World/World.js`, `Game/Zones.js`) dibatasi oleh *result budget* memori parent analyzer (`964.55 MB`), namun seluruh fakta statis per-file dan kode sumber telah diverifikasi secara langsung.

---

## 2. Identifikasi Tech Stack & Dependensi Utama

Berdasarkan inspeksi `package.json`, `vite.config.js`, dan graf impor statis/dinamis (`ev_df8a3b5b1285824a498f773a9e359eb2afef88e481a03de4d2084a2d767982a1`), berikut adalah komponen teknologi inti yang digunakan:

| Lapisan Sistem | Teknologi / Library | Versi Spesifik | Peran Arsitektural & Konfigurasi |
| :--- | :--- | :--- | :--- |
| **3D Engine & Shading** | `three` (`three/webgpu` & `three/tsl`) | `^0.187.0` | Menggunakan `THREE.WebGPURenderer` sebagai renderer utama dan node system **TSL** (`Fn`, `uniform`, `texture`, `pass`, `renderOutput`) untuk seluruh material dan post-processing. |
| **Physics Engine** | `@dimforge/rapier3d` | `^0.19.3` | Engine fisika 3D berbasis Rust/WASM. Dimuat secara *asynchronous dynamic import* (`import('@dimforge/rapier3d')`) paralel dengan pemuatan aset tahap kedua. |
| **Audio Engine** | `howler` (`Howl`, `Howler`) | `^2.2.4` | Mengelola musik latar (playlist), *spatial/positional audio* 3D berbasis matriks kamera (`howl.pos(...)`), *anti-spam* throttling, dan modulasi *playback rate* selaras dengan *time scale* game. |
| **Tweening & Timeline** | `gsap` | `^3.15.1` | Menggerakkan transisi UI/3D, animasi kamera/reveal, serta terikat langsung dengan `Time.scale` melalui `gsap.globalTimeline.timeScale(value)`. |
| **Network Serialization** | `msgpack-lite` & `uuid` | `^0.2.2` / `^14.0.3` | Serialisasi pesan biner `Uint8Array` melalui `WebSocket` (`binaryType = 'arraybuffer'`) untuk fitur sinkronisasi *multiplayer/whispers* dan leaderboard sirkuit. |
| **Asset Compression Pipeline** | `@gltf-transform/*`, `toktx` (KTX-Software), `sharp` | `^4.2.1` / `^0.34.5` | Pipeline kompresi build-time (`scripts/compress.js`): mesh dikompresi dengan **Draco** (`edgebreaker`), tekstur 3D dikompresi ke **KTX2** (**ETC1S** & **UASTC**), dan aset UI dikonversi ke **WebP**. |
| **Bundler & Build Tool** | `vite` + `vite-plugin-wasm` | `^8.3.5` / `^3.6.0` | Bundler ESM modern dengan dukungan top-level WASM untuk integrasi modul `@dimforge/rapier3d`. |
| **Debugging & Profiling** | `tweakpane`, `stats-gl`, `three/addons/inspector` | `^4.0.5` / `^4.2.3` | Panel parameter *real-time* (aktif via URL hash `#debug`), *WebGPU timestamp query* (`#stats`), dan `THREE.Inspector` (`#inspector`). |

---

## 3.Renderer: WebGPU vs WebGL Fallback & Anti-Stutter Pre-Rendering

### 3.1 Konfigurasi `THREE.WebGPURenderer` (`Game/Rendering.js`)
Semua modul mengimpor Three.js dari entry point modern `import * as THREE from 'three/webgpu'`. Pada `Rendering.setRenderer()` (`Game/Rendering.js:38-72`), renderer diinisialisasi dengan parameter berikut:

```javascript
this.renderer = new THREE.WebGPURenderer({
    canvas: this.game.canvasElement,
    powerPreference: 'high-performance',
    forceWebGL: false,
    antialias: this.game.viewport.pixelRatio < 2
})
```

- **WebGPU Primary dengan Auto-Fallback ke WebGL2**: Karena `forceWebGL: false`, `THREE.WebGPURenderer` secara otomatis meminta adapter `navigator.gpu` (WebGPUBackend). Apabila browser atau perangkat tidak mendukung WebGPU, Three.js r187 secara transparan melakukan *fallback* ke `WebGLBackend` (WebGL2) dan mengompilasi grafik node **TSL (Three.js Shading Language)** menjadi GLSL alih-alih WGSL.
- **Conditional MSAA (`antialias`)**: *Multisample Anti-Aliasing* hanya diaktifkan apabila `pixelRatio < 2` (layar non-Retina/DPI standar). Pada layar HiDPI (`pixelRatio >= 2`, dibatasi maksimum `2` di `Viewport.js`), MSAA dimatikan demi menghemat bandwidth GPU.
- **Manual Render Sorting**: `this.renderer.sortObjects = false`, namun urutan render diatur eksplisit menggunakan `setOpaqueSort` dan `setTransparentSort` yang hanya membandingkan `a.renderOrder - b.renderOrder`.
- **Prototype Override untuk Instancing/Cloning Cepat (`threejs-override.js`)**: Sebelum `Game` dimuat, `index.js` mengeksekusi `threejs-override.js` (`ev_ead52915e2932939db41736f471c7e417adfbb07392e2a709f7bdaea74e75a77`) yang memodifikasi `THREE.Object3D.prototype.copy` dengan menonaktifkan `this.userData = JSON.parse(JSON.stringify(source.userData))`. Ini menghilangkan bottleneck serialisasi JSON saat melakukan *cloning* ratusan mesh pohon, semak, dan properti dunia dari file GLB.

### 3.2 Kompilasi Pipeline Shader Lebih Awal (`Game/PreRenderer.js`)
Salah satu masalah klasik pada aplikasi 3D kompleks adalah *shader compilation stutter* saat objek pertama kali masuk ke frustum kamera. Pada `Game.init()` (`Game/Game.js:203-204`), engine memeriksa:

```javascript
if(this.quality.level === 0 && this.rendering.renderer.backend.isWebGPUBackend)
    PreRenderer.render()
```

`PreRenderer.render()` melakukan trik arsitektural berikut:
1. Membuat `CubeRenderTarget(32)` beresolusi sangat kecil (`32x32` piksel) beserta `THREE.CubeCamera(1, 100000, renderTarget)`.
2. Menelusuri seluruh `game.scene` (`scene.traverse`) dan memaksa semua objek yang sedang `visible === false` (kecuali yang memiliki flag `userData.preventPreRender = true` seperti *debug wireframe* atau *zone helpers*) menjadi `visible = true`.
3. Memanggil `cubeCamera.update(game.rendering.renderer, game.scene)` untuk merender 6 arah mata angin sekaligus dalam satu frame sebelum layar *intro* dibuka.
4. Mengembalikan status `visible = false` pada objek-objek yang tadi disembunyikan. Hasilnya, seluruh render pipeline WebGPU telah terkompilasi di GPU sebelum pemain mulai mengemudi.

---

## 4. Arsitektur Modul & Fase Bootstrapping (`Game/Game.js`)

Aplikasi menggunakan pola **Centralized Service Locator / Singleton** melalui `Game.getInstance()`. Seluruh subsistem menyimpan referensi `this.game = Game.getInstance()` dan berkomunikasi melalui properti instance atau sistem pub/sub `Events` (`Game/Events.js`).

```
index.js
 ├── threejs-override.js (Patch Object3D.prototype.copy)
 └── Game (Singleton Orchestrator)
      ├── Phase 1: Core & Intro Bootstrap (Synchronous + Batch 1 Assets)
      │    ├── THREE.Scene, Debug, ResourcesLoader, Quality, Server (WebSocket/msgpack)
      │    ├── Ticker (Prioritized Event Loop) & Time (TimeScale = 2.0 + BulletTime)
      │    ├── DayCycles & YearCycles (Keyframe Environment Interpolators)
      │    ├── Inputs (Keyboard, Gamepad, Pointer, Nipple, Wheel, InteractiveButtons)
      │    ├── Audio (Howler.js Manager), Notifications, RayCursor, Viewport
      │    ├── Modals, Menu, Rendering (WebGPURenderer.init())
      │    ├── ResourcesLoader.load(Batch 1: respawns, stars, sound icon, palette)
      │    └── Options, Respawns, View (Camera), PostProcessing, Reveal, Weather, Wind, Tracks, Lighting, Fog, Water, Materials, Objects, Explosions, World.step(0) [Grid + Intro]
      │
      ├── Phase 2: Parallel Heavy Loading (Promise.all)
      │    ├── Dynamic Import: import('@dimforge/rapier3d')
      │    └── ResourcesLoader.load(Batch 2: 40 GLB & KTX2 assets -> updates Intro circle progress)
      │
      └── Phase 3: Physics, World Population & Reveal
           ├── Terrain, Physics (Rapier World), PhysicsWireframe, PhysicsVehicle
           ├── Zones, Player, ClosingManager, InteractivePoints, KonamiCode
           ├── Achievements, Tornado, Map, Title, World.step(1) [All Visual/Physical Entities & 13 Areas]
           ├── Overlay, PreRenderer.render() (WebGPU shader warm-up)
           └── Reveal.updateStep(0 -> 1 -> 2) [World.step(2): Whispers + Server.start()]
```

---

## 5. Pemetaan Game Loop: VariableScaled Timestep vs Render Loop

Tidak seperti engine yang memisahkan *fixed physics loop* dengan `setInterval` atau akumulator sub-stepping, `folio-2025` menggunakan **Single Prioritized Animation Loop** yang dikendalikan langsung oleh `WebGPURenderer.setAnimationLoop` (`Game/Rendering.js:68`):

```javascript
this.renderer.setAnimationLoop((elapsedTime) => { this.game.ticker.update(elapsedTime) })
```

### 5.1 Perhitungan Waktu & Skala Waktu (`Ticker.js` & `Time.js`)
Di setiap frame, `Ticker.update(elapsed)` menghitung delta waktu dengan pembatas (*clamping*) agar simulasi fisika tidak meledak saat tab tidak aktif atau terjadi *frame drop*:
- **`delta`**: `Math.min(elapsedSeconds - this.elapsed, this.maxDelta)` di mana `maxDelta = 1 / 30` detik (`33.33 ms`, setara minimum 30 FPS).
- **`scale`**: Secara *default*, **`Time.defaultScale = 2`** (`Time.js:12`). Artinya, seluruh waktu internal game (`deltaScaled` dan `elapsedScaled`) serta timeline GSAP (`gsap.globalTimeline.timeScale(2)`) berjalan pada kecepatan **2x waktu nyata** agar dinamika gravitasi `-9.81 m/s²` pada Rapier terasa responsif dan *arcade-like* tanpa perlu mengubah konstanta gravitasi dunia.
- **Bullet Time**: Saat *bullet time* aktif (`Time.bulletTime.activate()`), `this.scale` diinterpolasi menuju `0.5` (4x lebih lambat dari kecepatan normal `2.0`) dengan kecepatan transisi masuk `inSpeed = 3` dan keluar `outSpeed = 0.3`.
- **Sinkronisasi Timestep Fisika (`Physics.js:243`)**:
  ```javascript
  this.world.timestep = this.game.ticker.deltaScaled
  this.world.step(this.eventQueue)
  ```
  Rapier tidak dijalankan dengan `dt = 1/60` statis, melainkan mengikuti `ticker.deltaScaled` setiap frame (maksimum `2 * (1/30) = 1/15` detik per step).
- **TSL Shader Uniforms**: `Ticker` menyediakan 4 node uniform TSL global yang otomatis diperbarui setiap frame untuk digunakan oleh seluruh shader GPU tanpa membuat uniform duplikat:
  - `this.elapsedUniform`
  - `this.deltaUniform`
  - `this.elapsedScaledUniform`
  - `this.deltaScaledUniform`

### 5.2 Tabel Urutan Eksekusi Deterministik per Frame (`Events.on('tick', cb, order)`)
`Events.js` menyimpan *listener* di dalam array 2 dimensi `this.callbacks['tick'][order]`. Saat `this.events.trigger('tick')` dipanggil di akhir `Ticker.update()`, JavaScript mengiterasi kunci numerik `_order` secara berurutan dari `0` hingga `999`:

| Prioritas (`_order`) | Modul / Subsistem | Operasi yang Dieksekusi pada Fase Ini |
| :---: | :--- | :--- |
| **`0`** | `Time.js`, `Inputs.js` | Memperbarui interpolasi *Bullet Time* (`Time.scale`) dan memproses *polling* `navigator.getGamepads()` serta *decay* input roda (wheel). |
| **`1`** (Default) | `Player.updatePrePhysics()`, `Intro.js`, `Reveal.js`, `VisualVehicle.js`, `Scenery.js` | Membaca state `Inputs` (akselerasi, kemudi, rem, boost, joystick virtual `Nipple`) menjadi vektor kontrol `Player` sebelum fisika dihitung; memperbarui visual mobil & animasi intro. |
| **`2`** | `PhysicsVehicle.updatePrePhysics()` | Menghitung sudut kemudi roda depan, mengaplikasikan `setWheelSteering`, `setWheelSuspensionRestLength`, `setWheelEngineForce`, `setWheelBrake`, gaya dorong *boost*, dan menjalankan `vehicleController.updateVehicle(deltaScaled)`. |
| **`3`** | `Physics.update()` | Mengatur `world.timestep = ticker.deltaScaled`, menerapkan *hydrodynamic damping* (`linearDamping = 1, angularDamping = 1`) untuk objek di bawah permukaan air, mengeksekusi **`world.step(eventQueue)`**, dan menguras `drainContactForceEvents` untuk memicu callback benturan (`force = maxForceMagnitude / (mass1 + mass2)`). |
| **`4`** | `Objects.update()`, `PhysicsWireframe.js` | Menyalin posisi & kuaternion dari rigid body Rapier yang aktif (`!isSleeping() && isEnabled()`) ke `THREE.Object3D` visual; me-reset objek yang jatuh di bawah `water.depthElevation`; dan menidurkan (`body.sleep()`) objek dinamis yang berada di luar radius `view.optimalArea.radius`. |
| **`5`** | `PhysicsVehicle.updatePostPhysics()` | Membaca hasil step fisika kendaraan: posisi sasis, vektor `forward`, `speed`, `xzSpeed`, status kontak tiap roda, deteksi `upsideDown`, `stuck`, dan *back/front flip*. |
| **`6`** | `Player.updatePostPhysics()` | Menyalin posisi kendaraan ke `Player.position`, memperbarui target kamera (`view.focusPoint.trackedPosition`), efek `speedLines`, koordinat `tracks.focusPoint`, orientasi `Nipple`, pemicu suara pegas roda (`justTouchedCount > 1`), statistik jarak tempuh (`localStorage.distanceDriven`), dan waktu bermain. |
| **`7`** | `View.update()` | Memperbarui kamera (interpolasi *focus point* dengan magnet, sudut spherical, zoom, *speed lines*, proyeksi kuadran `optimalArea` di atas bidang tanah, serta matriks shadow camera). |
| **`8`** | `Cycles.js` (`DayCycles`, `YearCycles`), `Weather.js`, `Zones.update()` | Menginterpolasi siklus siang-malam & musim, parameter cuaca (salju, hujan, angin, awan), dan menguji jarak Euclidean 2D/3D pemain terhadap semua bola/silinder `Zones` (`enter` / `leave`). |
| **`9`** | `Wind.js`, `Tracks.js`, `Lighting.js`, `Tornado.js`, `InteractivePoints.update()` | Merender *render target* jejak ban (`Tracks`), memperbarui arah/warna cahaya matahari dan bayangan, menggerakkan jalur tornado, dan mengevaluasi jarak pemain (`< 2.5m`) terhadap titik-titik `InteractivePoints`. |
| **`10`** | `Terrain.js`, `Fog.js`, `Trails.js`, `Area.js` (x13), `Floor.js`, `WaterSurface.js`, `Grass.js`, `Foliage.js`, `Leaves.js`, `RainLines.js`, `Snow.js`, `Lightnings.js`, `Whispers.js`, `ExplosiveCrates.js`, dsb. | Menguji visibilitas frustum tiap Area (`circleIntersectsPolygon` terhadap `view.optimalArea.quad2`) dan hanya menjalankan `area.update()` jika area tersebut terlihat di layar (`frustum.isIn === true`); memperbarui uniform shader lingkungan & partikel. |
| **`13`** | `InstancedGroup.update()` | Menyinkronkan matriks transformasi (`InstancedMesh.setMatrixAt`) untuk grup objek terinstansiasi (bangku, pagar, batu bata, lentera, kue, kipas) yang mengalami perubahan fisik. |
| **`14`** | `Audio.update()`, `Map.js`, `Notifications.js`, `Title.js` | Menghitung *spatial panning* 3D (`camera.matrixWorldInverse`) dan *distance attenuation* untuk semua `Howl` aktif, menyesuaikan *playback rate* audio dengan `Time.scale`, serta memperbarui minimap/judul tab browser. |
| **`998`** | `Rendering.render()` | Mengeksekusi `this.postProcessing.render()` (`THREE.RenderPipeline` dengan `cheapDOFPass` + `bloomPass`) dan memperbarui penghitung `renderer.info` (`drawCalls`, `triangles`, `geometries`, `textures`). |
| **`999`** | `Monitoring.js` | (Opsional) Menyelesaikan pembacaan GPU `resolveTimestampsAsync(THREE.TimestampQuery.RENDER)` untuk `stats-gl`. |

---

## 6. State Management & Sistem Filter Input Kontekstual

Engine tidak menggunakan library state eksternal (seperti Redux/Zustand), melainkan mengandalkan kombinasi:
1. **Input Filter Categories (`Game/Inputs/Inputs.js`)**:
   - `this.game.inputs.filters` adalah sebuah `Set` yang menentukan konteks state aktif permainan saat ini:
     - `'intro'`: Saat layar awal sebelum dunia dibuka.
     - `'wandering'`: State mengemudi bebas di dunia 3D.
     - `'racing'`: Saat berada dalam mode balapan di `CircuitArea`.
     - `'cinematic'`: Saat kamera dikunci pada transisi sinematik area.
     - `'modal'` / `'menu'`: Saat overlay DOM modal atau menu sedang terbuka.
   - Setiap aksi input didaftarkan beserta daftar kategori yang diizinkan (misalnya `boost` hanya aktif pada `['wandering', 'racing']`, sedangkan `respawn` hanya aktif pada `['wandering']`). Saat `Modals.open()` atau `Menu.open()` dipanggil, `inputs.filters.clear()` dijalankan lalu diganti menjadi `'modal'` atau `'menu'`, sehingga input mengemudi otomatis terkunci tanpa *branching* `if` yang rumit di kelas kendaraan.
2. **Hierarchical Escape/Close Stack (`Game/ClosingManager.js`)**:
   - Menangani aksi `close` (`Escape` / `Gamepad.cross`) dengan rantai prioritas bertingkat:
     `Whispers Flag Select` $\rightarrow$ `Circuit Flag Select` $\rightarrow$ `Modals` $\rightarrow$ `Menu` $\rightarrow$ `Circuit Running (buka menu circuit)` $\rightarrow$ `ProjectsArea Zoom` $\rightarrow$ `LabArea Zoom` $\rightarrow$ `Buka Menu Default`.
3. **Reactive Collections (`ObservableMap.js`, `ObservableSet.js`) & `localStorage` Persistence**:
   - Data progres pemain disimpan di `localStorage` meliputi:
     - `uuid`: ID sesi unik pemain untuk koneksi WebSocket (`Server.js`).
     - `achievements`: JSON progres pencapaian (`Achievements.js`).
     - `distanceDriven`: Total jarak tempuh kendaraan dalam meter (`Player.js`).
     - `timePlayed`: Total durasi bermain dalam detik (`Player.js`).
     - `soundToggle`: Status mute audio (`'0'` atau `'1'`).
     - `whispers`: Riwayat pesan whisper yang dikirim pemain.

---

## 7. Sistem Deteksi Zona, Frustum Culling & Trigger Interaktif

Karena seluruh dunia berada dalam satu `THREE.Scene` kontinu berukuran `192 x 192` unit (`Terrain.size = 192`), engine menerapkan **4 mekanisme spasial berbeda** untuk mendeteksi interaksi dan mengoptimalkan performa:

### 7.1 Proximity Zones (`Game/Zones.js` — Order `8`)
- Digunakan untuk mendeteksi kapan pemain masuk/keluar dari suatu wilayah (`Area.setBounding()`, `CircuitArea`, `AltarArea`, dll.).
- Mendukung 2 bentuk geometri matematis murni (tanpa overhead physics collider Rapier):
  - `'sphere'`: Jarak Euclidean 3D (`player.position.distanceTo(zone.position) < zone.radius`).
  - `'cylinder'`: Jarak Euclidean 2D pada bidang XZ (`Vector2(player.x, player.z).distanceTo(Vector2(zone.x, zone.z)) < zone.radius`).
- Posisi dan radius zona diambil langsung dari objek dummy di dalam file `areas.glb` yang bernama `referenceZoneBounding*` (melalui parser regex `References.js`: `/^ref(?:erence)?([^0-9]+)([0-9]+)?$/`), di mana `scale.x` mesh dummy menentukan `radius` zona.
- Memancarkan event `enter` dan `leave` saat status boolean `zone.isIn` berubah.

### 7.2 2D Polygon-Circle Frustum & Physics Culling (`Area.js` & `Objects.js`)
- **Custom 2D Frustum Culling per Area (`Area.setFrustum()`)**:
  - `View.js` memproyeksikan keempat sudut viewport kamera ke bidang tanah XZ untuk membentuk poligon 4 titik (`this.game.view.optimalArea.quad2`) beserta lingkaran pembatas (`optimalArea.radius`).
  - Setiap `Area` memiliki titik referensi `zoneFrustum` (posisi XZ dan radius `scale.x` dari Blender).
  - Pada setiap tick (prioritas `10`), `Area` memanggil fungsi geometris `circleIntersectsPolygon(frustum.position, frustum.radius, optimalArea.quad2)`.
  - Jika lingkaran area **tidak berpotongan** dengan kuadran pandang kamera (`isVisible === false`), seluruh mesh statis area tersebut (`this.objects.hideable`) disembunyikan (`object3D.visible = false`), event `frustumOut` dipancarkan, dan metode `area.update()` **dilewati seluruhnya**.
- **Distance-Based Physics Auto-Sleeping (`Objects.update()`)**:
  - Setiap kali posisi fokus kamera berpindah minimal 1 meter (`Math.round(focusPoint.x / z)`), `Objects.update()` menghitung jarak tiap rigid body dinamis ke pusat pandangan.
  - Jika `distanceToView > this.game.view.optimalArea.radius`, rigid body tersebut langsung dipaksa tidur (`_object.physical.body.sleep()`) agar tidak membebani solver Rapier.

### 7.3 Interactive Points (`Game/InteractivePoints.js` — Order `9`)
- Merupakan tombol pemicu berbentuk belah ketupat (*diamond*) mengambang di dunia 3D (seperti tombol untuk membuka *Projects*, *Lab*, *Jukebox*, *Bowling*, *Circuit*, dll.) dengan 3 state: `STATE_HIDDEN (3)`, `STATE_OPEN (4)`, dan `STATE_CONCEALED (5)`.
- **Dual-Activation Mechanism (Proximity + Cursor Raycast)**:
  1. **Vehicle Proximity Trigger**: Demi penghematan CPU, `InteractivePoints.update()` hanya mengevaluasi jarak apabila kendaraan telah berpindah `> 0.2` meter sejak pengecekan terakhir (`distanceTraveled > 0.2 || this.needsTest`). Titik interaktif terdekat dalam radius **`itemDistance < 2.5` meter** otomatis bertransisi ke `STATE_OPEN` (`item.reveal()`), menampilkan label teks Canvas 2D (`700 64px "Amatic SC"`) dan ikon tombol yang sesuai dengan mode input aktif (`Enter` untuk keyboard, `Cross` untuk gamepad PlayStation, `A` untuk gamepad Xbox, atau disembunyikan pada mode sentuh).
  2. **Pointer Raycasting (`Game/RayCursor.js`)**: Setiap titik interaktif juga mendaftarkan `THREE.Sphere(newPosition, 0.75)` ke `RayCursor`. Saat kursor mouse bergerak atau mengklik di dalam radius `view.optimalArea.radius` (dengan toleransi drag klik `< 25px`), `THREE.Raycaster` melakukan uji `ray.intersectsSphere(intersect.shape)` sehingga pengguna desktop juga dapat membuka dan mengklik titik interaktif langsung dengan mouse tanpa harus mengarahkan mobil tepat ke titik tersebut.
