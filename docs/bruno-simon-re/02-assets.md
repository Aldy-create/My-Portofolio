# 02 — 3D Assets, Audio & Compression Pipeline
**Adaptasi Blueprint & Dokumentasi Reverse Engineering: Aldy Alfaisal Pasaribu**  
*(Target Referensi: `bruno-simon.com` / `folio-2025` $\rightarrow$ Portofolio 3D WebGPU Aldy Alfaisal Pasaribu)*

## 1. Ringkasan Arsitektur Aset & Bukti REA

Dokumen ini disusun untuk **Aldy Alfaisal Pasaribu** guna memetakan seluruh aset jaringan (`.glb`, `.ktx`/KTX2, `.webp`, `.mp3`, `.wasm`, `.js` decoder), parameter kompresi build-time, serta mekanisme pemuatan bertahap (*staged loading*), pelacakan progres, *lazy loading*, dan *in-memory caching* sebagai acuan pipeline aset pada portofolio 3D **Aldy Alfaisal Pasaribu**.

### REA Evidence References
- **`ev_beffdd032c87e7033517ae367143938b85f42cb954b9411dbd8f8ad919e82980`**: `inspect_analysis_view` pada `Game/ResourcesLoader.js` (`jag_node_038ae1f54b973446ae7d89aad8b473e644095f85c80b79f813baa80072858aae`, `sha256: cf2280fbdb708337699c97c2458dbf0dfae23cc69ec362cf3ee16e416fe26433`).
- **`ev_ed51cfd63d5ab443261ca431f2d86508c37aee04d4fbc0bca3e831845f0aa163`**: `inspect_analysis_view` pada `Game/Game.js` (`jag_node_05739bb00b5c75d7c155afe14d69766af381470d86f7ae5f37b847dd71f92065`, `sha256: 8989b7eaf128a7a3ace90d568accca0c186d70c86c047990d85635dcbd27ad60`).

### Statistik Distribusi Aset Statis (`static/`)

| Format Ekstensi | Jumlah File | Ukuran Total (Bytes) | Ukuran Total (MB) | Peran dalam Pipeline |
| :--- | :---: | :---: | :---: | :--- |
| **`.glb`** (Total: Mentah + Compressed) | 64 (32 pasang) | 6.283.664 | 5,99 MB | Model 3D dunia, kendaraan, pohon, fisika, dan referensi instancing (di produksi hanya 32 file `*-compressed.glb` berukuran **~993 KB** yang dimuat). |
| **`.ktx`** (KTX2 Basis Universal) | 88 | 3.248.393 | 3,10 MB | Tekstur GPU terkompresi (ETC1S & UASTC) untuk palet warna, SDF dedaunan, data terrain, ikon 3D, serta slide galeri *Projects* & *Lab*. |
| **`.mp3`** | 88 | 22.193.164 | 21,17 MB | Efek suara spasial/interaksi (85 file, ~3,3 MB) + 3 trek musik latar Jukebox (~18,88 MB, *lazy-loaded* `preload: false`). |
| **`.webp`** | 283 | 633.024 | 0,60 MB | Aset UI DOM 2D: 259 bendera negara (`ui/flags/`), 8 gambar preview menu, 6 ikon hadiah achievement, 3 tekstur peta (`map-day`, `map-night`, `player`), dan ikon kontrol. |
| **`.wasm`** & **`.js`** (Transcoders/Decoders) | 10 (3 WASM + 7 JS) | 4.295.590 | 4,10 MB | Binary WebAssembly dan wrapper Web Worker untuk `basis_transcoder` (KTX2) dan `draco_decoder` (Draco mesh). |
| **`.woff2` / `.woff` / `.ttf` / `.eot`** | 16 (4 font x 4) | 768.818 | 0,73 MB | Font kustom (termasuk `"Amatic SC"` untuk label 3D Canvas dan tipografi UI). |
| **`.png` / `.wav`** (Source Assets) | 379 | 165.162.414 | 157,51 MB | File sumber tak terkompresi di direktori `static/` yang digunakan sebagai input oleh `scripts/compress.js` (tidak dimuat oleh runtime produksi ketika `VITE_COMPRESSED=true`). |

---

## 2. Pipeline Kompresi Aset (`scripts/compress.js`)

Saat perintah `npm run compress` (`node scripts/compress.js static/`) dijalankan, tiga pipeline kompresi terpisah mengekstrak aset produksi yang sangat ringan:

### 2.1 Kompresi Geometri & Tekstur Model 3D (`.glb` $\rightarrow$ `*-compressed.glb`)
Menggunakan CLI **`gltf-transform`** dalam dua tahap berantai pada setiap file `.glb`:
1. **Tahap 1 — KTX2 ETC1S Embedded Textures**:
   ```bash
   gltf-transform etc1s <input.glb> <output-compressed.glb> --quality 255 --verbose
   ```
2. **Tahap 2 — Draco Mesh Compression (`KHR_draco_mesh_compression`)**:
   ```bash
   gltf-transform draco <output-compressed.glb> <output-compressed.glb> \
     --method edgebreaker \
     --quantization-volume mesh \
     --quantize-position 12 \
     --quantize-normal 6 \
     --quantize-texcoord 6 \
     --quantize-color 2 \
     --quantize-generic 2
   ```
   - **Analisis Bit Kuantisasi**:
     - `position`: **12-bit** (presisi $1/4096$ dari bounding box per-mesh, sangat memadai untuk skala objek low-poly stylized).
     - `normal` & `texcoord`: **6-bit** (karena sebagian besar objek menggunakan *flat/stylized shading* atau UV palet warna sederhana).
     - `color` & `generic`: **2-bit** (memangkas drastis ukuran *vertex color* yang hanya menyimpan mask biner/4-level seperti *ambient occlusion* atau atribut efek).

### 2.2 Kompresi Tekstur GPU (`.png`/`.jpg` $\rightarrow$ `.ktx` / KTX2 Container)
Menggunakan CLI **`toktx`** (dari Khronos KTX-Software) dengan flag `--t2` (**KTX2 container** dengan superkompresi Basis Universal). Perhatikan bahwa meskipun file berekstensi `.ktx`, flag `--t2` menghasilkan format **KTX2** yang didekode oleh `THREE.KTX2Loader`.

`scripts/compress.js` menerapkan **profil encoding selektif** berdasarkan fungsi matematis tekstur di dalam shader:

| Kategori / Pola File | Parameter `toktx` | Format Basis | OETF (Color Space) | Target Channel & Swizzle | Alasan Teknis / Penggunaan Shader |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **Default (Galeri Projects & Lab, Stars)** | `--nowarn --2d --t2 --encode etc1s --qlevel 255 --assign_oetf srgb --target_type RGB` | **ETC1S** | `sRGB` | `RGB` | Rasio kompresi tertinggi untuk gambar fotografi/screenshot proyek di dalam dunia 3D. |
| **Color Palette (`palette.png`)** | `--nowarn --2d --t2 --encode uastc --genmipmap --assign_oetf srgb --target_type RGB` | **UASTC** + Mipmaps | `sRGB` | `RGB` | Tekstur palet utama tempat seluruh model 3D mengambil sampel warna; wajib menggunakan **UASTC** bebas artefak blok agar gradasi warna tidak rusak. |
| **Terrain Data (`terrain/terrain.png`)** | `--nowarn --2d --t2 --encode uastc --genmipmap --assign_oetf linear --target_type RGB` | **UASTC** + Mipmaps | `Linear` | `RGB` | Menyimpan data non-warna (R/G/B mewakili mask rumput, elevasi/kedalaman air & tanah); wajib `Linear` dan `UASTC` agar tidak terjadi distorsi gamma atau artefak interpolasi. |
| **Career Banners (`career/*.png`)** | `--nowarn --2d --t2 --encode uastc --assign_oetf srgb --target_type RG` | **UASTC** | `sRGB` | `RG` (2-channel) | Hanya menyimpan 2 kanal mask untuk diwarnai secara prosedural di shader `CareerArea`. |
| **Overlay Pattern (`overlay/overlayPattern.png`)** | `--nowarn --2d --t2 --encode uastc --assign_oetf linear` | **UASTC** | `Linear` | Default | Pola transisi layar penuh saat respawn; membutuhkan ketajaman tepi tinggi (NearestFilter). |
| **Single-Channel SDF / Alpha Masks** (`foliageSDF`, `glyphs`, `satanStar`, `slabs`, `interactivePoints/*`, `intro/*`, `jukeboxMusicNotes`, `whisperFlame`) | `--nowarn --2d --t2 --encode etc1s --qlevel 255 --assign_oetf linear --target_type R --swizzle r001` | **ETC1S** | `Linear` | `R` (`r001`) | Hanya membutuhkan 1 kanal *grayscale/SDF* (dibaca via `.r` di TSL); swizzle `r001` meminimalkan ukuran payload hingga **0,6 KB – 12 KB** per tekstur! |

### 2.3 Kompresi Gambar UI DOM (`static/ui/**/*.{png,jpg}` $\rightarrow$ `.webp`)
Menggunakan library Node.js **`sharp`**:
```javascript
await sharp(inputFile).webp({ quality: 80 }).toFile(webpFile)
```
Seluruh gambar antarmuka HTML/CSS (minimap, preview menu, 259 bendera negara) dikompresi ke `.webp` kualitas 80 dengan total ukuran keseluruhan hanya **633 KB**.

---

## 3. Arsitektur `ResourcesLoader` (`Game/ResourcesLoader.js`)

Berdasarkan bukti `ev_beffdd032c87e7033517ae367143938b85f42cb954b9411dbd8f8ad919e82980`, `ResourcesLoader` mengelola siklus hidup loader, *caching*, dan *progress callback*:

### 3.1 Lazy-Instantiated Loader Singleton Map (`this.loaders`)
`ResourcesLoader.getLoader(_type)` membuat dan menyimpan instance loader di dalam `this.loaders = new Map()` agar konfigurasi Web Worker decoder tidak diinisialisasi ulang:
- **`'texture'`**: `new THREE.TextureLoader()` (digunakan saat mode development `VITE_COMPRESSED` tidak aktif).
- **`'textureKtx'`**:
  ```javascript
  loader = new KTX2Loader()
  loader.setTranscoderPath('./basis/')
  loader.detectSupport(this.game.rendering.renderer)
  ```
  Menggunakan `./basis/basis_transcoder.js` (56,2 KB) dan `./basis/basis_transcoder.wasm` (514,97 KB) untuk mentranskode Basis Universal (ETC1S/UASTC) di Web Worker ke format tekstur native GPU perangkat (BC7/BC1/ETC2/ASTC).
- **`'draco'`**:
  ```javascript
  loader = new DRACOLoader()
  loader.setDecoderPath('./draco/')
  loader.preload()
  ```
  Memuat `./draco/draco_decoder.js` (702,58 KB), `./draco/draco_wasm_wrapper.js` (57,5 KB), dan `./draco/draco_decoder.wasm` (279,05 KB) lebih awal (`preload()`).
- **`'gltf'`**:
  Menginstansiasi `new GLTFLoader()` yang langsung dipasangi `dracoLoader` (`setDRACOLoader`) dan `ktx2Loader` (`setKTX2Loader`).

### 3.2 Mekanisme In-Memory Caching, Post-Load Modifier, dan Progress Tracking
Setiap entri file pada `resourcesLoader.load(_files, _progressCallback)` didefinisikan sebagai tuple 4 elemen:
`[ resourceKey, urlPathWithCacheBuster, loaderType, modifierCallback ]`

1. **Deduplikasi Cache (`this.cache = new Map()`)**:
   - Kunci cache adalah string URL lengkap (`_file[1]`, misalnya `'palette.ktx?cb=1'`).
   - Sebelum memanggil `loader.load()`, `ResourcesLoader` memeriksa `if(this.cache.has(_file[1]))`. Jika sudah ada di memori, objek resource diambil langsung dari `this.cache.get(_file[1])` dan fungsi `progress()` dipanggil secara sinkron.
2. **Inline Texture Configuration (`modifierCallback` / `_file[3]`)**:
   - Begitu aset selesai dimuat, fungsi `_file[3](_resource)` segera dieksekusi sebelum aset disimpan ke `loadedResources` dan `this.cache`.
   - Pendekatan ini memungkinkan konfigurasi parameter sampler GPU (`colorSpace = THREE.SRGBColorSpace`, `minFilter = THREE.NearestFilter`, `flipY = false`, `wrapS = THREE.RepeatWrapping`, `generateMipmaps = false`) dideklarasikan langsung di tabel manifes `Game.js`.
3. **Pelacakan Progres ke Shader Intro (`Intro.updateProgress`)**:
   - Variabel `let toLoad = _files.length` didekremen (`toLoad--`) setiap kali satu aset selesai dimuat.
   - Pada Batch 2 (`Game.js:175-178`), callback progres meneruskan rasio `1 - toLoad / total` ke `this.world.intro.updateProgress(...)`:
     ```javascript
     (toLoad, total) => {
         this.world.intro.updateProgress(1 - toLoad / total)
     }
     ```
   - Di dalam `Intro.js`, nilai `this.circle.progress` dihaluskan setiap frame menggunakan exponential damping (`smoothedProgress += (progress - smoothedProgress) * delta * 10`) dan diumpankan ke node shader TSL cincin radial (`RingGeometry`) yang memotong fragmen berdasarkan sudut polar `atan(positionGeometry.y, positionGeometry.x)`.

---

## 4. Katalog Lengkap Aset 3D (`.glb`) & Tekstur (`.ktx`) menurut Tahap Pemuatan

Ketika `VITE_COMPRESSED` aktif di produksi, suffix `-compressed.glb` dan ekstensi `.ktx` (`textureKtx`) digunakan bersama *cache-buster* `?cb=1`.

### 4.1 Batch 1 — Critical Intro Bootstrap (`Game.js:103-109`)
Dimuat paling pertama secara `await` sebelum `Rendering.start()` dan `World.step(0)` dijalankan, agar layar loading 3D interaktif dapat segera tampil:

| Resource Key | Path Produksi (`static/`) | Tipe | Ukuran Mentah $\rightarrow$ Produksi | Konfigurasi Sampler / Penggunaan |
| :--- | :--- | :---: | :---: | :--- |
| `respawnsReferencesModel` | `respawns/respawnsReferences-compressed.glb?cb=1` | `gltf` | 2,78 KB $\rightarrow$ **2,77 KB** | Posisi & rotasi titik spawn awal (`landing` dll.) untuk meletakkan kamera dan cincin loading intro. |
| `behindTheSceneStarsTexture` | `behindTheScene/stars.ktx?cb=1` | `textureKtx` | 17,60 KB (`.ktx`) | `SRGBColorSpace`, `NearestFilter`, `RepeatWrapping`, `generateMipmaps: false`. |
| `soundTexture` | `intro/sound.ktx?cb=1` | `textureKtx` | 0,92 KB (`.ktx`) | `LinearFilter`, `repeat.x = 0.5` (sprite sheet 2 frame: ikon suara aktif & mute di layar intro). |
| `paletteTexture` | `palette.ktx?cb=1` | `textureKtx` | 1,47 KB (`.ktx`, UASTC) | `SRGBColorSpace`, `NearestFilter`, `generateMipmaps: false`. Tekstur lookup warna global (`MeshDefaultMaterial`). |

### 4.2 Batch 2 — Main World & Physics Assets (`Game.js:132-174`)
Dimuat secara paralel bersama `import('@dimforge/rapier3d')` melalui `Promise.all([resourcesPromise, rapierPromise])`:

#### A. Model 3D (`.glb` — 18 File di Batch 2 + 14 File Event/Easter Egg)

| Resource Key / Kategori | Path Produksi (`static/`) | Ukuran `.glb` Asli | Ukuran `-compressed.glb` | Rasio Reduksi | Fungsi di dalam Engine |
| :--- | :--- | :---: | :---: | :---: | :--- |
| `areasModel` | `areas/areas-compressed.glb` | 3.209,20 KB | **624,33 KB** | **-80,55%** | Geometri visual, collider fisik (`trimesh`/`cuboid`/`hull`/`tube`), dan titik `reference*` untuk ke-13 Area utama. |
| `terrainModel` | `terrain/terrain-compressed.glb` | 713,01 KB | **25,59 KB** | **-96,41%** | Mesh permukaan tanah & collider `trimesh` kontur dunia (`192x192` unit). |
| `sceneryModel` | `scenery/scenery-compressed.glb` | 259,95 KB | **46,77 KB** | **-82,01%** | Jalan raya beraspal, batu tepi, dan struktur dekorasi statis dunia. |
| `vehicle` | `vehicle/default-compressed.glb` | 232,05 KB | **34,01 KB** | **-85,34%** | Sasis mobil utama, 4 roda, suspensi, antena, dan lampu rem/mundur. |
| `playgroundVisual` | `playground/playgroundVisual-compressed.glb` | 93,89 KB | **26,89 KB** | **-71,36%** | Ramp, loop, dan rintangan visual area playground. |
| `playgroundPhysical` | `playground/playgroundPhysical-compressed.glb` | 6,13 KB | **1,86 KB** | **-69,66%** | Mesh collider khusus fisika untuk area playground. |
| `poleLightsModel` | `poleLights/poleLights-compressed.glb` | 43,01 KB | **42,19 KB** | -1,91% | Tiang lampu jalan beserta collider dan kaca emisif. |
| `lanternsModel` | `lanterns/lanterns-compressed.glb` | 28,28 KB | **11,12 KB** | **-60,68%** | Lentera fisik dinamis yang dapat ditabrak (`InstancedGroup`). |
| `explosiveCratesModel` | `explosiveCrates/explosiveCrates-compressed.glb` | 27,07 KB | **8,39 KB** | **-69,01%** | Kotak peledak interaktif yang memicu `Explosions` & *bullet time*. |
| `bushesReferences` | `bushes/bushesReferences-compressed.glb` | 25,04 KB | **24,99 KB** | -0,20% | Transform referensi penempatan dedaunan semak (`Bushes.js`). |
| `birchTreesReferencesModel` | `birchTrees/birchTreesReferences-compressed.glb` | 21,06 KB | **23,42 KB** | +11,21%* | Transform instancing & collider batang pohon Birch. |
| `birchTreesVisualModel` | `birchTrees/birchTreesVisual-compressed.glb` | 4,38 KB | **4,96 KB** | +13,24%* | Mesh prototipe tunggal pohon Birch untuk `InstancedGroup`. |
| `oakTreesReferencesModel` | `oakTrees/oakTreesReferences-compressed.glb` | 18,97 KB | **21,07 KB** | +11,07%* | Transform instancing & collider batang pohon Oak. |
| `oakTreesVisualModel` | `oakTrees/oakTreesVisual-compressed.glb` | 4,41 KB | **5,07 KB** | +14,97%* | Mesh prototipe tunggal pohon Oak untuk `InstancedGroup`. |
| `cherryTreesReferencesModel` | `cherryTrees/cherryTreesReferences-compressed.glb` | 16,62 KB | **19,16 KB** | +15,28%* | Transform instancing & collider batang pohon Cherry. |
| `cherryTreesVisualModel` | `cherryTrees/cherryTreesVisual-compressed.glb` | 4,44 KB | **5,11 KB** | +15,09%* | Mesh prototipe tunggal pohon Cherry untuk `InstancedGroup`. |
| `flowersReferencesModel` | `flowers/flowersReferences-compressed.glb` | 18,95 KB | **18,96 KB** | +0,05%* | Titik referensi distribusi bunga (`Flowers.js`). |
| `benchesModel` | `benches/benches-compressed.glb` | 14,15 KB | **6,91 KB** | **-51,17%** | Bangku taman fisik dinamis (`InstancedGroup`). |
| `fencesModel` | `fences/fences-compressed.glb` | 7,96 KB | **8,49 KB** | +6,66%* | Pagar kayu fisik dinamis (`InstancedGroup`). |
| `bricksModel` | `bricks/bricks-compressed.glb` | 6,65 KB | **7,28 KB** | +9,47%* | Batu bata fisik dinamis yang dapat dihancurkan (`InstancedGroup`). |
| `tornadoPathReferencesModel` | `tornado/tornadoPathReferences-compressed.glb` | 1,78 KB | **1,77 KB** | -0,56% | Titik-titik waypoint lintasan pergerakan `Tornado`. |
| **On-Demand / Seasonal GLBs** | `vehicle/oldSchool-compressed.glb` | 171,29 KB | **14,96 KB** | **-91,27%** | Dimuat secara *lazy* oleh `KonamiCode.js` saat kode Konami dimasukkan! |
| *(Seasonal / Unused in base init)* | `vehicle/defaultAntenna-compressed.glb`, `blackFriday/*`, `christmas/*`, `easter/*` | 137,29 KB | **76,20 KB** | **-44,50%** | Aset event musiman (Black Friday fragments, pohon/kado Natal, telur Paskah). |

*\*Catatan: Pada file referensi transformasi murni atau mesh mikro (< 20 KB), header metadata ekstensi Draco menambah ~0,5–2,5 KB dibanding buffer mentah.*

#### B. Tekstur GPU (`.ktx` / KTX2 — 22 File di Batch 2)

| Resource Key | Path Produksi (`static/`) | Ukuran `.ktx` | Encoding Basis | Filter & Wrapping | Penggunaan Visual / Shader |
| :--- | :--- | :---: | :---: | :--- | :--- |
| `terrainTexture` | `terrain/terrain.ktx` | **341,86 KB** | UASTC (Linear, Mipmaps) | `flipY: false`, Default Linear | Peta data 3-kanal (`192x192` world UV): kanal G = mask rumput (dikurangi jejak ban `tracks`), kanal B = gradien tanah/air. |
| `careerOnlineTeacherTexture` | `career/careerOnlineTeacher.ktx` | **30,11 KB** | UASTC (sRGB, RG) | `LinearFilter`, `ClampToEdge`, `flipY: false` | Tekstur monumen karir *Online Teacher* (`CareerArea`). |
| `careerIRLTeacherTexture` | `career/careerIRLTeacher.ktx` | **24,36 KB** | UASTC (sRGB, RG) | `LinearFilter`, `ClampToEdge`, `flipY: false` | Tekstur monumen karir *IRL Teacher* (`CareerArea`). |
| `careerImmersiveGardenTexture` | `career/careerImmersiveGarden.ktx` | **20,20 KB** | UASTC (sRGB, RG) | `LinearFilter`, `ClampToEdge`, `flipY: false` | Tekstur monumen karir *Immersive Garden* (`CareerArea`). |
| `careerHeticTexture` | `career/careerHetic.ktx` | **18,80 KB** | UASTC (sRGB, RG) | `LinearFilter`, `ClampToEdge`, `flipY: false` | Tekstur monumen karir *HETIC* (`CareerArea`). |
| `overlayPatternTexture` | `overlay/overlayPattern.ktx` | **16,28 KB** | UASTC (Linear) | `NearestFilter`, `RepeatWrapping` | Pola wipe transisi diagonal saat kendaraan di-respawn (`Overlay.js`). |
| `careerFreelancerTexture` | `career/careerFreelancer.ktx` | **14,34 KB** | UASTC (sRGB, RG) | `LinearFilter`, `ClampToEdge`, `flipY: false` | Tekstur monumen karir *Freelancer* (`CareerArea`). |
| `floorSlabsTexture` | `floor/slabs.ktx` | **12,42 KB** | ETC1S (Linear, R) | `LinearFilter`, `RepeatWrapping` | Pola ubin batu (`slabs`) pada lantai dunia (`Floor.js`). |
| `careerUzikTexture` | `career/careerUzik.ktx` | **10,12 KB** | UASTC (sRGB, RG) | `LinearFilter`, `ClampToEdge`, `flipY: false` | Tekstur monumen karir *Uzik* (`CareerArea`). |
| `whisperFlameTexture` | `whispers/whisperFlame.ktx` | **8,31 KB** | ETC1S (Linear, R) | `LinearFilter`, No Mipmaps | Mask kobaran api untuk entitas pesan *Whispers*. |
| `timeMachineScreenMGSTexture` | `timeMachine/timeMachineScreenMGS.ktx` | **5,25 KB** | ETC1S (sRGB, RGB) | `NearestFilter`, `ClampToEdge` | Layar TV retro Metal Gear Solid di `TimeMachineArea`. |
| `timeMachineScreenFolioTexture` | `timeMachine/timeMachineScreenFolio.ktx` | **3,14 KB** | ETC1S (sRGB, RGB) | `NearestFilter`, `ClampToEdge` | Layar TV retro Folio 2019 di `TimeMachineArea`. |
| `foliageTexture` | `foliage/foliageSDF.ktx` | **3,00 KB** | ETC1S (Linear, R) | `NearestFilter`, No Mipmaps | *Signed Distance Field* (SDF) dedaunan untuk alpha-cutout tajam pada pohon & semak (`Foliage.js`). |
| `achievementsGlyphsTexture` | `achievements/glyphs.ktx` | **2,86 KB** | ETC1S (Linear, R) | `LinearFilter`, `RepeatWrapping (S)` | Atlas simbol/glyph pencapaian di `AchievementsArea`. |
| `satanStarTexture` | `areas/satanStar.ktx` | **1,87 KB** | ETC1S (Linear, R) | `LinearFilter`, No Mipmaps | Simbol pentagram menyala di `AltarArea`. |
| `interactivePointsKeyIconEnterTexture` | `interactivePoints/interactivePointsKeyIconEnter.ktx` | **0,79 KB** | ETC1S (Linear, R) | `NearestFilter`, No Mipmaps | Ikon tombol `Enter` pada `InteractivePoints` (mode Mouse/Keyboard). |
| `interactivePointsKeyIconATexture` | `interactivePoints/interactivePointsKeyIconA.ktx` | **0,80 KB** | ETC1S (Linear, R) | `NearestFilter`, No Mipmaps | Ikon tombol `A` pada `InteractivePoints` (mode Gamepad Xbox). |
| `interactivePointsKeyIconCrossTexture` | `interactivePoints/interactivePointsKeyIconCross.ktx` | **0,75 KB** | ETC1S (Linear, R) | `NearestFilter`, No Mipmaps | Ikon tombol `Cross (X)` pada `InteractivePoints` (mode Gamepad PlayStation). |
| `jukeboxMusicNotes` | `jukebox/jukeboxMusicNotes.ktx` | **0,61 KB** | ETC1S (Linear, R) | `LinearFilter`, No Mipmaps | Partikel not balok musik yang melayang dari Jukebox (`LandingArea`). |

### 4.3 On-Demand / Lazy-Loaded Textures (`.ktx` & `.webp`)
Untuk menjaga waktu muat awal (*Initial Load Time*) tetap di bawah ~1,8 MB total payload 3D, **62 tekstur `.ktx` lainnya tidak dimuat saat startup**, melainkan dimuat berdasarkan interaksi pemain (*on-demand*) dan disimpan di cache lokal masing-masing komponen:

1. **Intro Input Label (`Game/World/Intro.js:151-169`) — 4 file `.ktx`**:
   - Hanya memuat **1 dari 4** file sesuai perangkat input aktif pengguna saat ini:
     - `intro/mouseKeyboardLabel.ktx` (2,27 KB)
     - `intro/gamepadXboxLabel.ktx` (2,63 KB)
     - `intro/gamepadPlaystationLabel.ktx` (2,62 KB)
     - `intro/touchLabel.ktx` (2,01 KB)
   - Disimpan di `this.text.textures = new Map()` dan di-*dispose* sepenuhnya (`Intro.destroy()`) begitu pemain melewati layar intro!
2. **Projects Area Slide Textures (`Game/World/Areas/ProjectsArea.js:470-525`) — 31 file `.ktx` (~1,79 MB total)**:
   - Terletak di `static/projects/images/` (`threejs-journey-1..5.ktx`, `chartogne-taillet-1..3.ktx`, `bonhomme-10-ans-1..4.ktx`, `madbox-1..3.ktx`, `luni-1..4.ktx`, `scout-1..3.ktx`, `prior-1..3.ktx`, `orano-1..3.ktx`, `citrix-redbull-1..3.ktx`).
   - Hanya dimuat saat pemain membuka proyek terkait di `ProjectsArea` (`this.images.getResourceAndLoad(key)`), ditambah *pre-fetching* gambar slide sebelahnya (`this.images.loadSibling()`). Disimpan di `this.images.resources = new Map()`.
3. **Lab Area Thumbnails & Full Previews (`Game/World/Areas/LabArea.js:455-500, 835-875`) — 28 file `.ktx` (~1,01 MB total)**:
   - Terletak di `static/lab/images/`: terdiri dari 14 pasang tekstur `*-mini.ktx` (2,8 KB – 10,8 KB untuk papan daftar eksperimen) dan `*.ktx` penuh (12,3 KB – 102,1 KB saat eksperimen dipilih).
4. **Minimap Siang/Malam (`Game/Map.js:111`) & Bendera Negara (`Game/InputFlag.js:85`)**:
   - Memuat `ui/map/map-day.webp` (103,6 KB) atau `ui/map/map-night.webp` (66,6 KB) hanya ketika minimap dibuka.
   - Memuat bendera `ui/flags/${countryCode}.webp` (rata-rata ~420 bytes per bendera) saat daftar negara dibuka pada input leaderboard Circuit atau Whispers.

---

## 5. Inventaris & Arsitektur Streaming Audio (`Game/Audio.js`)

Seluruh 88 file `.mp3` di `static/sounds/` dikelola oleh `Howler.js` dengan kebijakan pemuatan yang memisahkan **efek suara pendek** dari **musik latar berukuran besar**:

### 5.1 Kebijakan Pemuatan Audio
- **Deferred Initialization (`this.initiated = false`)**: `Audio.init()` baru dipanggil pada `Reveal.updateStep(1)` (setelah pengguna mengklik atau menekan tombol untuk memulai game), mematuhi kebijakan *Web Audio API Autoplay Policy* browser modern.
- **Lazy-Loaded Music Playlist (`preload: false`, `pool: 0`)**:
  Ketiga file musik latar di `static/sounds/musics/` berukuran total **18,88 MB** (`Sudo.mp3`: 6,03 MB, `Boy.mp3`: 6,36 MB, `Baguira.mp3`: 6,06 MB). Ketiganya dikonfigurasi dengan **`preload: false`**, sehingga **0 byte** musik diunduh saat halaman dimuat! Lagu pertama hanya diunduh (`song.sound.load()`) jika pengguna menyalakan Jukebox atau variabel `VITE_MUSIC` aktif. Indeks lagu awal dipilih secara deterministik berdasarkan waktu (`Math.floor(Date.now() / 1000 / 60 / 3) % 3`).

### 5.2 Tabel Kelompok Audio (`Audio.groups`)

| Kategori | Nama Grup / Komponen | File `.mp3` (`static/sounds/`) | Ukuran Total | Mode & Parameter Spatial / Dinamis |
| :--- | :--- | :--- | :---: | :--- |
| **Music Playlist** | `playlist.songs` | `musics/Sudo.mp3`, `Boy.mp3`, `Baguira.mp3` | 18.885,12 KB | `preload: false`, `volume: 0.2`, otomatis lanjut ke lagu berikutnya (`onend -> playlist.next()`) dengan jeda efek `discChange` 3 detik. |
| **Vehicle Dynamics** (`Player.js`) | `engine`, `spin`, `energy` (boost), `wheelsOnFloor` (pebbles & brake), `suspensions`, `spring1/2`, `honk` | 9 file di `sounds/vehicle/*` (`muscle car engine loop idle.mp3`, `wheels-on-pebbles-road.mp3`, `Energy_-_force_field_8_loop.mp3`, dll.) | 525,21 KB | Loop kontinu dengan modulasi `volume` dan `rate` per-tick berdasarkan `accelerating`, `boosting`, `xzSpeed`, `forwardRatio`, dan `wheels.inContactCount`. |
| **Weather & Time Ambiants** (`Audio.js`) | `birdTweet` (6), `owl`, `rooster`, `wolf`, `crickets`, `jingleBells`, `rain`, `wind`, `waves` | 14 file di `birdTweets/`, `owl/`, `rooster/`, `wolf/`, `crickets/`, `jingleBells/`, `rain/`, `wind/`, `waves/` | 892,69 KB | Dikendalikan oleh `DayCycles` (siang vs `night`/`deepNight`), `Weather` (`snow.value`, `rain.value`, `wind.value`), dan jarak pemain ke tepi pulau (`waves`). |
| **Spatial World Loops** | `ovenFire`, `campfire`, `achievements` chimes, `altar` whisper, `behindTheScene` glassy loop, `lab` cart, `bowling` rolling ball | 7 file di `fire/`, `magic/`, `mecanism/`, `rolling/` | 846,85 KB | Spatial 3D penuh (`positions: [...]`, `distanceFade: 13..20`); diproyeksikan ke ruang kamera via `camera.matrixWorldInverse` dan di-*mute* otomatis jika `volume < 0.01`. |
| **Physics Collision Hits** | `hitDefault` (7), `hitBrick` (4), `hitMetal` (3), `pins` (1) | 15 file di `sounds/hits/{defaults,bricks,metal,pins}/*` | 57,56 KB | Dipicu oleh `Physics.eventQueue.drainContactForceEvents`; `antiSpam: 0.1s`, `distanceFade: 20m`, volume diskalakan oleh gaya benturan `remapClamp(force, ...)`. |
| **Area & UI One-Offs** | `reveal`, `swoosh` (overlay), `paper` (interactive points), `click`, `slide`, `assemble`, `discChange`, `thunder` (5), `explosions` (2), `bell` (2), `circuit` (5), `anvil`, `ding`, `stoneSlides` (2), `tv/alert`, `paint` | 29 file di `reveal/`, `swoosh/`, `paper/`, `mecanism/`, `thunder/`, `explosions/`, `bell/`, `circuit/`, dll. | 786,45 KB | Efek *one-shot* untuk interaksi UI, petir dekat/jauh, ledakan kotak, hitung mundur balapan, dan pembukaan area. |
