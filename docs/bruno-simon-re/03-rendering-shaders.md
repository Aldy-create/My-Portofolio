# 03 — Rendering, Lighting, Camera & TSL Shaders
**Adaptasi Blueprint & Dokumentasi Reverse Engineering: Aldy Alfaisal Pasaribu**  
*(Target Referensi: `bruno-simon.com` / `folio-2025` $\rightarrow$ Portofolio 3D WebGPU Aldy Alfaisal Pasaribu)*

## 1. Ringkasan Eksekutif & Bukti REA

Dokumen ini disusun untuk **Aldy Alfaisal Pasaribu** sebagai spesifikasi teknis sistem kamera, pencahayaan hibrida (*real-time directional shadow* + *procedural core/bounce lighting*), arsitektur shader **TSL (Three.js Shading Language)**, simulasi partikel berbasis **WebGPU Compute Shader**, sistem jejak ban (*offscreen render target*), serta *post-processing* (`THREE.RenderPipeline`).

### REA Evidence References
- **`ev_7a3a607f4fddacbb5d68777582da87d5bcd9f23c7ccff40db780ce70b5af67d5`**: `inspect_analysis_view` pada `Game/Materials/MeshDefaultMaterial.js` (`jag_node_2fe3071686eb28c02a95a7ad0a9d9a35bfa57ffce31a829b761270e57c40967d`, `sha256: 49589e6af80c1f95d334697aa8d15259dec7ca1d233eb010c1fd0eb0a1fc05d0`).
- **`ev_df8a3b5b1285824a498f773a9e359eb2afef88e481a03de4d2084a2d767982a1`**: Parent Evidence `analyze_javascript_application` pada `sources/` (`Game/View.js`, `Game/Ligthing.js`, `Game/Fog.js`, `Game/Tracks.js`, `Game/Trails.js`, `Game/Noises.js`, `Game/Passes/cheapDOF.js`, `Game/World/*`).

---

## 2. Konfigurasi Kamera, Follow-Damping & Proyeksi `optimalArea` (`Game/View.js`)

Alih-alih menggunakan kamera ortografis murni, situs ini menggunakan **kamera perspektif dengan FOV sempit (`25°`) dari jarak menengah-jauh (`15m – 30m`)** sehingga menghasilkan tampilan **semi-isometrik (telephoto perspective)** yang tetap mempertahankan efek paralaks kedalaman.

### 2.1 Parameter Dasar Kamera & Koordinat Spherical
| Parameter | Nilai / Rumus | Deskripsi Teknis |
| :--- | :--- | :--- |
| **Tipe Kamera** | `THREE.PerspectiveCamera(25, ratio, 0.1, 200)` | FOV vertikal **`25°`**, `near = 0.1`, `far = 200`. |
| **Sudut Polar (`spherical.phi`)** | `Math.PI * 0.31` ($\approx 55,8^\circ$, High Quality) / `Math.PI * 0.27` ($\approx 48,6^\circ$, Mobile/Low) | Kemiringan kamera dari sumbu vertikal $+Y$. Pada perangkat mobile, sudut dibuat sedikit lebih tegak agar area sekitar mobil lebih jelas. |
| **Sudut Azimuth (`spherical.theta`)** | `Math.PI * 0.25` ($45^\circ$) | Orientasi diagonal isometrik klasik pada kuadran $+X, +Z$. |
| **Rentang Radius (`spherical.radius.edges`)** | `min: 15`, `max: 30` | Jarak kamera dari `focusPoint.smoothedPosition`. |
| **Kompensasi Layar Sempit (`ratioOverflow`)** | `Math.max(1, (1920/1080) / viewport.ratio) - 1` | Jika rasio layar lebih sempit dari `16:9` (mis. layar potret mobile), `radiusMax` ditambah sebesar `ratioOverflow * 9` (`nonIdealRatioOffset = 9`, atau `* 10` saat mode sinematik) agar lebar area dunia tetap muat di layar. |

### 2.2 Logika Follow-Camera, Magnet, Dynamic Speed Zoom & Camera Roll
1. **Tracking, Map Drag & Magnet Pull (`View.update()`)**:
   - Selama pemain mengemudi (`focusPoint.isTracking = true`), `focusPoint.position` menyalin koordinat XZ kendaraan (`trackedPosition`).
   - Jika pemain menggeser peta dengan mouse drag, sentuhan 2 jari (`touches.length >= 2`), atau stik analog kanan gamepad (`joysticks.right`), `isTracking` menjadi `false` dan vektor geseran diputar sebesar `-spherical.theta` ($-45^\circ$) agar arah geser layar sejajar dengan sumbu dunia XZ.
   - **Magnet Pull**: Saat `focusPoint.magnet.active = true` (`multiplier = 0.25`), titik fokus ditarik perlahan kembali ke posisi mobil dengan gaya proporsional jarak kuadrat:
     $$\Delta_{\text{magnet}} = \mathbf{p}_{\text{tracked}} - \mathbf{p}_{\text{focus}}, \quad \mathbf{p}_{\text{focus}} \mathrel{+}= \left(\|\Delta_{\text{magnet}}\| \cdot 0.25\right) \cdot \Delta_{\text{magnet}} \cdot \Delta t$$
   - **Exponential Focus Smoothing**:
     $$\mathbf{p}_{\text{smoothed}} = \text{lerp}\left(\mathbf{p}_{\text{smoothed}}, \mathbf{p}_{\text{focus}}, \Delta t \cdot 10\right)$$
2. **Dynamic Speed-Based Zoom (`setZoom()`)**:
   - `zoom.baseRatio` bernilai awal `0.6` saat intro dan turun ke `0.0` setelah *reveal* selesai (dapat diubah via scroll wheel dengan sensitivitas `0.05`, pinch gesture `0.005`, atau tombol `R3` gamepad).
   - Pada kualitas tinggi (`quality.level === 0`), kamera **melakukan zoom-out otomatis saat mobil melaju cepat**:
     $$\text{zoomSpeedRatio} = \text{smoothstep}(\text{focusPointSpeed}, 5, 40)$$
     $$\text{zoom.ratio} = \text{zoom.baseRatio} + (-0.4) \cdot \text{zoomSpeedRatio}$$
     $$\text{zoom.smoothedRatio} = \text{lerp}(\text{zoom.smoothedRatio}, \text{zoom.ratio}, \Delta t \cdot 10)$$
     $$\text{radius} = \text{lerp}(15, \text{radiusMax}, 1 - \text{zoom.smoothedRatio})$$
     Saat `focusPointSpeed` meningkat dari `5` ke `40`, `zoom.ratio` menjadi negatif (hingga `-0.4`), sehingga faktor interpolasi `1 - smoothedRatio` mencapai `1.4` dan menarik kamera menjauh melewati `radiusMax` (`30m` $\rightarrow$ `36m`) untuk memperluas jarak pandang pengemudi!
3. **Spring-Damper Camera Roll (`setRoll()`)**:
   - Saat terjadi ledakan atau benturan keras, `view.roll.kick(strength)` memberikan impuls kecepatan sudut acak $\pm\text{strength} \cdot 1$.
   - Di setiap frame, osilator pegas teredam (`pullStrength = 100`, `damping = 4`) memperbarui rotasi sumbu Z kamera:
     $$v_{\text{roll}} = -\theta_{\text{roll}} \cdot 100 \cdot \Delta t_{\text{scaled}}, \quad \omega_{\text{roll}} \mathrel{+}= v_{\text{roll}}, \quad \theta_{\text{roll}} \mathrel{+}= \omega_{\text{roll}} \cdot \Delta t_{\text{scaled}}, \quad \omega_{\text{roll}} \mathrel{*}= (1 - 4 \cdot \Delta t_{\text{scaled}})$$
4. **Cinematic Camera Transitions (`setCinematic()`)**:
   - Saat pemain membuka area interaktif (seperti *Projects* atau *Lab*), `view.cinematic.start(position, target)` menganimasikan `cinematic.progress` dari `0` $\rightarrow$ `1` selama `1.5s` (`power2.inOut`), melakukan `lerp` posisi kamera dan `slerp` kuaternion rotasi menuju kamera target, sekaligus mematikan blur Depth-of-Field (`cheapDOFPass.strength` $\rightarrow$ `0`).
5. **Ground-Projected Viewing Frustum (`optimalArea`)**:
   - `optimalArea.update()` menembakkan 4 sinar `Raycaster` dari keempat sudut NDC viewport (`(1,-1)`, `(-1,1)`, `(-1,-1)`, `(1,1)`) pada jarak `radiusMax` ke bidang horizontal lantai $Y = 0$.
   - Titik potongnya membentuk trapesium 2D (`optimalArea.quad2[0..3]`), titik tengah (`optimalArea.basePosition`), radius pembatas (`optimalArea.radius`), serta jarak `nearDistance` dan `farDistance`.
   - Kuadran `optimalArea` inilah yang mengendalikan: **(a)** ukuran & posisi mesh `Floor`, `Grass`, `WaterSurface`, `Snow`, `RainLines`; **(b)** batas frustum kamera bayangan (`DirectionalLight.shadow.camera`); **(c)** jarak `near`/`far` kabut (`Fog.js`); dan **(d)** frustum culling 2D tiap `Area`!

---

## 3. Pendekatan Visual: Palette/Procedural Shading vs Real-Time Lighting

Berbeda dengan portfolio 2019 yang bergantung penuh pada tekstur *Matcap* dan *baked drop-shadow PNG*, versi WebGPU ini menggunakan **Hybrid Stylized Node Shading (`MeshDefaultMaterial`)** yang memadukan **1 Directional Light real-time berbayangan** dengan **3 komponen pencahayaan prosedural di TSL**:

### 3.1 Konfigurasi Pencahayaan Real-Time & Siklus Siang-Malam (`Lighting.js` & `DayCycles.js`)
- **Single Sun/Moon DirectionalLight**:
  - `new THREE.DirectionalLight(0xffffff, 5)` dengan `castShadow = true`.
  - Posisi lampu dan `light.target` bergerak mengikuti `this.game.view.optimalArea.position` setiap frame, sehingga peta bayangan (*shadow map*) hanya merender area yang sedang terlihat di layar!
  - **Konfigurasi Shadow Map**:
    - Resolusi (`mapSize`): **`2048 x 2048`** pada High Quality (`quality.level === 0`) dan **`512 x 512`** pada Low/Mobile (`quality.level === 1`).
    - Ukuran kotak ortografis (`top`, `right`, `-bottom`, `-left`): `shadowAmplitude = view.optimalArea.radius`, dengan `near = 1`, `far = 1 + optimalArea.radius * 2`.
    - Parameter artefak: `shadowBias = -0.001`, `shadowNormalBias = 0.1`, `shadowRadius = 3` (High) / `2` (Low).
- **Orbit Matahari & Keyframe `DayCycles` (Durasi 1 Siklus = `240` detik / 4 menit)**:
  - Sudut arah cahaya dihitung secara sinusoidal terhadap `dayCycles.progress` ($\in [0, 1]$) dengan offset `9/16`:
    $$\theta_{\text{light}} = 0.72 + \sin\left(-\left(\text{progress} + \frac{9}{16}\right) \cdot 2\pi\right) \cdot 1.25$$
    $$\phi_{\text{light}} = 0.63 + 0.5 \cdot \cos\left(-\left(\text{progress} + \frac{9}{16}\right) \cdot 2\pi\right) \cdot 0.62$$
  - Empat preset waktu (`DayCycles.js:4-9`) diinterpolasi secara kontinu pada stop `0.0..0.15` (Day), `0.25` (Dusk), `0.35..0.60` (Night), `0.80` (Dawn), `0.90` (Day):

| Preset Waktu | `lightColor` | `lightIntensity` | `shadowColor` | `fogColorA` (Center) | `fogColorB` (Edge) | `fogNearRatio` / `fogFarRatio` | `temperature` | `electricField` |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Day** | `#ffd2c2` | `1.2` | `#6d3fff` | `#00ffff` | `#9b89ff` | `0.315` / `1.25` | `5°C` | `0.00` |
| **Dusk** | `#ff8181` | `1.2` | `#4e009c` | `#3e53ff` | `#ff4ce4` | `0.000` / `1.25` | `0°C` | `0.25` |
| **Night** | `#3240ff` | `3.8` | `#2f00db` | `#10266f` | `#490a42` | `-0.850` / `1.00` | `-7.5°C` | `1.00` |
| **Dawn** | `#ffa882` | `1.2` | `#db004f` | `#f885ff` | `#ff7d24` | `0.300` / `1.25` | `0°C` | `0.25` |

---

## 4. Bedah Arsitektur Shader TSL (`MeshDefaultMaterial.js` & Custom Shaders)

Seluruh material objek dunia mewarisi **`MeshDefaultMaterial`** (subclass dari `THREE.MeshLambertNodeMaterial`, `ev_7a3a607f4fddacbb5d68777582da87d5bcd9f23c7ccff40db780ce70b5af67d5`).

### 4.1 Pipeline `MeshDefaultMaterial` (Shadow Catcher + Custom Output Node)
Daripada membiarkan `MeshLambertNodeMaterial` menghitung pencahayaan Lambertian standar Three.js, `MeshDefaultMaterial` **membajak pipeline bayangan** menggunakan `receivedShadowNode` dan mengganti `outputNode` sepenuhnya:

1. **Shadow Catcher Hijack (`lines 53-62`)**:
   ```javascript
   const catchedShadow = float(1).toVar()
   this.receivedShadowNode = Fn(([ shadow ]) => {
       catchedShadow.mulAssign(shadow.r)
       return float(1) // Mencegah Three.js menggelapkan material secara bawaan
   })
   ```
   Dengan mengembalikan `float(1)`, shadow map ditangkap ke variabel TSL `catchedShadow` tanpa merusak warna dasar, sehingga warna bayangan dapat dikontrol secara artistik di `outputNode`!
2. **Tahapan Perhitungan Fragmen di `this.outputNode` (`lines 67-134`)**:
   - **Normal Reorientation**: Jika material `DoubleSide`/`BackSide` dan `!frontFacing`, `reorientedNormal` dikali `-1`.
   - **Procedural Ground Light Bounce (`hasLightBounce`)**:
     Permukaan objek yang menghadap ke bawah (`dot(N, (0,-1,0))` di-smoothstep dari `-1` ke `1`) dan berada dekat tanah ($Y \in [0, 1.5\text{m}]$, atenuasi kuadratik `((1.5 - max(0, y)) / 1.5)^2`) menerima pantulan warna tanah tepat di bawahnya (`terrain.colorNode(terrain.terrainNode(positionWorld.xz))`)! Ini menciptakan efek *Global Illumination (GI) bounce* waktu nyata dengan biaya hampir nol.
   - **Water Foam Intersection Line (`hasWater`)**:
     Setiap objek yang memotong ketinggian permukaan air (`|positionWorld.y - (-0.3)| <= 0.013`) otomatis diganti warnanya menjadi putih murni (`#ffffff`), menghasilkan garis buih air di sekeliling ban mobil, batu, atau objek yang tercebur tanpa memerlukan pembacaan depth buffer.
   - **Direct Light Color Multiplication**:
     `outputColor.mulAssign(lighting.colorUniform.mul(lighting.intensityUniform))`
   - **Unified Core Shadow + Drop Shadow + Custom Shadow (`lines 102-119`)**:
     - `coreShadowMix`: `smoothstep(1.0, -0.25, dot(N, lightDirection))` (bagian objek yang membelakangi matahari).
     - `dropShadowMix`: `1.0 - catchedShadow` (bayangan jatuh dari shadow map).
     - Ketiganya digabung dengan operator **`max(coreShadowMix, dropShadowMix, _shadowNode)`** (bukan dikalikan!), sehingga bayangan jatuh dan bayangan inti menyatu mulus tanpa artefak *double-darkening*, lalu diinterpolasi menuju `baseColor.rgb * lighting.shadowColor`.
   - **Radial Screen-Space Range Fog (`Fog.js`)**:
     Warna kabut bukan warna tunggal, melainkan gradien radial di ruang layar (`viewportUV`) dari `fogColorA` ke `fogColorB`, lalu dicampur berdasarkan jarak dunia `rangeFogFactor(near, far)`.
   - **Expanding Ring Reveal Discard (`revealDiscardNodeBuilder`)**:
     Saat animasi pembukaan awal (`Reveal.js`), fragmen dengan jarak XZ dari titik spawn `distanceToCenter > reveal.distance` dibuang (`discard()`), sementara tepi cincin selebar `thickness = 0.05m` diberi warna berpijar HDR (`reveal.color * reveal.intensity`, `#e88eff * 5.5` hingga `12.0`) yang memicu efek *Bloom*.

### 4.2 Pre-Baked GPU Procedural Noise Textures (`Game/Noises.js`)
Saat startup, `Noises.js` menggunakan `THREE.QuadMesh` untuk merender 3 tekstur noise prosedural *tileable* (`RepeatWrapping`, resolusi **`128 x 128`**, `THREE.HalfFloatType`) satu kali saja di GPU:
1. **`noises.voronoi` (`RGBA HalfFloat`)**: `voronoiNode(uv(), 8)` dengan loop tetangga $3\times 3$ yang menghasilkan `vec3(minDist, minEdge - minDist, cellHash)`. Digunakan untuk pecahan es (`WaterSurface`), riak cipratan hujan, dan cat mobil *Flames*.
2. **`noises.perlin` (`RedFormat HalfFloat`)**: `perlinNode(uv(), 6.0, 6.0)` periodik. Digunakan oleh `Wind`, `Grass`, `Floor`, `Snow`, `Leaves`, dan `WaterSurface`.
3. **`noises.hash` (`RedFormat HalfFloat`, `NearestFilter`)**: White noise `hash(viewportUV).x` untuk kilauan butiran salju (`Snow.js` glitter).

### 4.3 Shader Lingkungan & Trik Rendering Kustom Lainnya
- **Infinite Scrolling Grass (`Game/World/Grass.js`)**:
  - Menggunakan **satu `THREE.Mesh` tunggal** berisi $280 \times 280 = \mathbf{78.400}$ helai rumput segitiga (`235.200` verteks) tanpa `InstancedMesh` (bentuk segitiga `[0,1], [1,0], [-1,0]` diambil dari `uniformArray` menggunakan `vertexIndex % 3`).
  - Posisi XZ setiap helai di-*wrap* secara toroidal di sekitar kamera menggunakan operasi modulo di vertex shader:
    $$\mathbf{p}_{\text{loop}} = \text{mod}\left(\mathbf{p} - \mathbf{c} + \frac{S}{2}, S\right) - \frac{S}{2} + \mathbf{c}$$
  - Setiap helai diputar menghadap kamera (`rotateUV` dengan `atan(z - cam.z, x - cam.x)`), digoyangkan oleh `wind.offsetNode`, diskalakan tingginya oleh kanal hijau `terrainData.g` (yang otomatis menjadi `0` saat dilindas jejak ban!), dan jika `terrainData.g < 0.5` helai rumput disembunyikan dengan melemparnya ke atas kamera (`vertexPosition.y += hidden * 100`).
- **Camera-Facing SDF Foliage dengan Vehicle See-Through (`Game/World/Foliage.js`)**:
  - Setiap semak/tajuk pohon terdiri dari gabungan 80 quad (`PlaneGeometry(0.8, 0.8)`) yang normalnya diinterpolasi `85%` menuju normal bola (`position.lerp(normal, 0.85)`).
  - Saat dibuat (`setFromReferences`), orientasi setiap instance pohon/semak diarahkan menghadap sudut default kamera (`object.lookAt(towardCamera)`).
  - **See-Through Mask**: Untuk pohon Cherry (`seeThrough = true`), shader menghitung jarak `screenUV` fragmen daun ke posisi layar mobil (`visualVehicle.screenPosition`). Saat mobil berada di balik pepohonan, nilai ambang SDF `foliageSDF` dikurangi secara halus (`smoothstep(edgeMin, edgeMax, distanceToVehicle)`) sehingga dedaunan memudar dengan efek *dissolve* organik agar mobil selalu terlihat!
- **Water Surface & Dynamic Ice/Ripples/Splashes (`Game/World/WaterSurface.js`)**:
  - Menggabungkan 4 mask prosedural: `shoreNode` (tepi pantai `step(0.17, terrainData.b)`), `ripplesNode` (gelombang pantai bergerak), `splashesNode` (cincin air hujan berbasis Voronoi + hash waktu), dan `iceNode` (pembekuan air berbasis Voronoi saat suhu `< 0°C`).
  - Pada kualitas tinggi (`quality.level === 0`), bagian air yang transparan (`surfaceAlpha < 0.5`) membiaskan dasar danau menggunakan **`hashBlur(viewportSharedTexture(screenUV), 0.01, { repeats: 25 })`**.
- **Adaptive Quad-Flipping Snow & Glitter (`Game/World/Snow.js`)**:
  - Merender peta ketinggian salju ke `RenderTarget(257, 257, HalfFloatType, RedFormat)` yang menggabungkan akumulasi salju cuaca, 2 oktaf Perlin noise, dan **penggerusan jejak ban + sasis mobil (`tracks.renderTarget.texture`)**.
  - Di vertex shader grid salju ($256 \times 256$ quad), shader memeriksa selisih ketinggian keempat sudut tiap quad (`|A.y - C.y|` vs `|B.y - D.y|`) dan **memutar quad sebesar $90^\circ$ secara dinamis** agar garis diagonal segitiga selalu sejajar dengan kontur jejak ban (mencegah artefak *jagged triangulation*)!
  - Di fragment shader, efek kilau berlian salju (*snow glitter*) dihitung dari `(hash + glitterVariation)^1000 * 2` yang berubah saat kamera bergerak (`view.delta.length() * 0.0004`).

---

## 5. Efek Partikel, Jejak Ban (`Tracks.js`) & Pita Boost (`Trails.js`)

### 5.1 WebGPU Compute Shader Leaf Simulation (`Game/World/Leaves.js`)
Dedaunan gugur ($2^7 = 128$ hingga $2^{11} = 2.048$ helai tergantung musim di `YearCycles`) disimulasikan **100% di GPU menggunakan WebGPU Compute Shaders**:
- Menyimpan state di dalam dua Storage Buffer TSL: `this.positionBuffer = instancedArray(this.count, 'vec3')` dan `this.velocityBuffer = instancedArray(this.count, 'vec3')`.
- Setiap frame (`Leaves.update()`), CPU hanya memperbarui uniform `focusPoint`, `vehiclePosition`, dan `vehicleVelocity`, lalu mengeksekusi **`renderer.computeAsync(this.updateCompute)`**.
- Kernel compute `update` menghitung:
  1. **Dorongan aerodinamis mobil**: Daun dalam radius `0.5m – 2.0m` dari mobil terdorong ke depan (`vehicleVelocity * 100`) dan terlempar ke samping (`normalize(deltaXZ) * 20`) sekaligus terangkat ke udara (`velocity.y = min(length(velocity.xz), 2) * upwardDim`).
  2. **Turbulensi angin Perlin**, **gelombang kejut ledakan (`explosion`)**, **gravitasi (`9.807 * weight`)**, **redaman udara vs air (`defaultDamping = 1.5`, `waterDamping = 0.75`)**, serta **wrapping toroidal** di sekitar kamera.

### 5.2 Sistem Jejak Ban & Sasis (`Game/Tracks.js`)
- **Offscreen Orthographic RenderTarget**:
  - `Tracks` memiliki `THREE.Scene` terpisah dengan `THREE.OrthographicCamera(-20, 20, 20, -20, 0.1, 10)` (mencakup area $40\times 40$ meter di sekitar mobil) yang merender ke `THREE.RenderTarget(512, 512)` setiap frame.
- **Ring-Buffer `DataTexture` per Jejak (`Track` class)**:
  - Terdapat **5 instance `Track`** pada kendaraan (`VisualVehicle.js`):
    - **4 Roda**: `new Track(0.5, 'r')` — lebar `0.5m`, menulis ke **kanal Merah (`R`)** saat ban menyentuh tanah (`physicalWheel.inContact`).
    - **1 Sasis Utama**: `new Track(1.5, 'g')` — lebar `1.5m`, menulis ke **kanal Hijau (`G`)** saat bodi mobil menyentuh tanah/salju (`position.y < 1.5`).
  - Setiap `Track` memiliki `THREE.DataTexture` berukuran **`128 x 1` (`RGBAFormat`, `FloatType`)** yang berfungsi sebagai *shift register* riwayat posisi `(x, y, z, touching)`: setiap `1/30` detik dan perpindahan `> 0.2m`, seluruh piksel digeser 1 indeks ke kanan di CPU (`data[i4] = data[i4 - 4]`) dan posisi terbaru ditulis ke indeks `0`.
  - Vertex shader pita `PlaneGeometry(1, 1, 128, 1)` membaca posisi saat ini (`trackUV`) dan posisi sebelumnya (`trackUVPrev`) dari `dataTexture`, menghitung sudut tangen lintasan $\text{atan2}(\Delta z, \Delta x)$, lalu melebarkan verteks kiri/kanan tegak lurus lintasan (`AdditiveBlending`).
  - Tekstur `tracks.renderTarget.texture` ini kemudian dibaca oleh **`Terrain.js`** (meratakan rumput & menggelapkan tanah pada kanal `R`) dan **`Snow.js`** (mengukir cekungan salju 3D pada kanal `R` untuk roda dan kanal `G` untuk sasis).

### 5.3 Pita Cahaya Knalpot Boost (`Game/Trails.js`) & Speed Lines (`View.js`)
- **3D Tubular Boost Trails (`Trails.js`)**:
  - Dua titik referensi di belakang sasis mobil (`(-1.28, 0.1, -0.55)` dan `(-1.28, 0.1, +0.55)`) masing-masing menggerakkan silinder 32-segmen (`CylinderGeometry(0.1, 0.1, 1, 4, 32, true)`) yang riwayat posisinya disimpan dalam `DataTexture(32, 1, RGBAFormat, FloatType)` dengan laju peluruhan alpha `decay = 0.2`.
  - Di vertex shader TSL, fungsi **`getRotationMatrix(direction, vec3(0, 0, -1))`** membangun matriks rotasi $3\times 3$ Rodrigues (`cross` dan `dot`) secara analitik untuk memutar penampang tabung mengikuti belokan mobil, lalu fragment shader memberi warna gradien HDR (`gradientTexture * 5.0`) dengan efek tepi Fresnel.
- **Clip-Space Speed Lines (`View.setSpeedLines()`)**:
  - Saat `boosting && accelerating && speed > 15`, 30 segitiga radial di *clip-space* (`depthTest: false`, `renderOrder: 10`) berosilasi menuju proyeksi posisi mobil di layar (`clipSpaceTarget`).

---

## 6. Pipeline Post-Processing (`Game/Rendering.js` & `Game/Passes/cheapDOF.js`)

Post-processing dibangun menggunakan **`THREE.RenderPipeline(this.renderer)`** berbasis node TSL (`Rendering.js:74-105`):

```javascript
const scenePass = pass(this.game.scene, this.game.view.camera)
const scenePassColor = scenePass.getTextureNode('output')

this.bloomPass = bloom(scenePassColor)
this.bloomPass._nMips = this.game.quality.level === 0 ? 5 : 2
this.bloomPass.threshold.value = 1
this.bloomPass.strength.value = 0.25
this.bloomPass.smoothWidth.value = 1

this.cheapDOFPass = cheapDOF(renderOutput(scenePass))
```

1. **HDR Emissive Bloom (`BloomNode`)**:
   - Karena `threshold = 1.0` dan `strength = 0.25`, objek biasa tidak memancarkan bloom. Hanya material yang warnanya dinormalisasi dengan luminansi lalu dikalikan intensitas $> 1.0$ (`baseColor.div(luminance(baseColor)).mul(intensity)` pada lampu tiang, lampu rem, pita boost, petir, garis reveal, dan portal) yang menghasilkan pendaran cahaya lembut (5 mip levels pada Desktop, 2 mip levels pada Mobile).
2. **Tilt-Shift `CheapDOFNode` (`Game/Passes/cheapDOF.js`)**:
   - Alih-alih membaca *depth buffer* yang mahal, efek *miniature tilt-shift Depth of Field* dihitung murni dari jarak vertikal koordinat layar `uv().y` terhadap garis tengah horizontal (`0.5`):
     $$\text{strength} = \text{smoothstep}\left(0.2, 0.5, |v - 0.5|\right)$$
   - Area tengah layar ($v \in [0.3, 0.7]$) tetap tajam sempurna (`strength = 0`), sedangkan bagian atas dan bawah layar di-blur menggunakan **`hashBlur(textureNode, strength * 0.003, { repeats: 25, premultipliedAlpha: true })`**.
   - **Quality Scaling**: Pada `quality.level === 0` (Desktop), `outputNode = cheapDOFPass.add(bloomPass)`. Pada `quality.level === 1` (Mobile), `cheapDOFPass` dilewati sepenuhnya (`outputNode = scenePassColor.add(bloomPass)`) demi menjaga frame rate 60 FPS.
