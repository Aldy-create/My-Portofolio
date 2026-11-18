# 04 — Vehicle Physics, Multi-Input Controls & Dynamic Audio
**Adaptasi Blueprint & Dokumentasi Reverse Engineering: Aldy Alfaisal Pasaribu**  
*(Target Referensi: `bruno-simon.com` / `folio-2025` $\rightarrow$ Portofolio 3D WebGPU Aldy Alfaisal Pasaribu)*

## 1. Ringkasan Eksekutif & Bukti REA

Dokumen ini disusun untuk **Aldy Alfaisal Pasaribu** sebagai spesifikasi lengkap parameter fisika kendaraan Rapier3D (`DynamicRayCastVehicleController`), mekanika suspensi hidrolik (*lowrider/jump*), deteksi mandiri kondisi terbalik/tersangkut (*auto-unstuck & flip*), arsitektur input multi-perangkat (Keyboard, Gamepad lintas-browser, Virtual 3D Touch Ring `Nipple`), serta formula sintesis audio dinamis berbasis kecepatan dan gaya benturan.

### REA Evidence References
- **`ev_da0125f39bcd9a2206c3030002d621d6a5a2d8ce2e1209b4aaea8933c0ebab08`**: `inspect_analysis_view` pada `Game/Physics/Physics.js` (`jag_node_104e442ef91eab63d12caf9e44a250891f24b5ccbcc2b1462c1cf90a2c27ddd1`, `sha256: 64e32f6ff9bf77c957dfd8db9fb14fd10465a32fbfa4be68f8762195e7ce9030`).
- **`ev_3fb1f7bf7da9ffa4444b747c7fcc30d874dc1bf349f0fd6a1fb34eac950f1fa8`**: `inspect_analysis_view` pada `Game/Inputs/Inputs.js` (`jag_node_15811a71778cc3aa2c8f888c1e21f9bc2d23cfcce532c386d622defe8a14fe40`, `sha256: 4a90a9833b4755850a94a25c3315a7a9833764107120aa97e050c5b9664096e9`).
- **`ev_df8a3b5b1285824a498f773a9e359eb2afef88e481a03de4d2084a2d767982a1`**: Parent Evidence `analyze_javascript_application` pada `sources/` (`Game/Physics/PhysicsVehicle.js`, `Game/Player.js`, `Game/Inputs/*`, `Game/Audio.js`).

---

## 2. Parameter Fisika Kendaraan (`Game/Physics/PhysicsVehicle.js`)

Kendaraan disimulasikan menggunakan **`world.createVehicleController(chassisBody)`** bawaan `@dimforge/rapier3d` (implementasi *raycast vehicle* di mana ke-4 roda ditembakkan sebagai sinar raycast ke bawah dari titik koneksi sasis).

### 2.1 Spesifikasi RigidBody Sasis & Komposisi 3 Collider (`setChassis()`)
Sasis kendaraan (`type: 'dynamic'`, `canSleep: false`, `linearDamping: 0.1`, `angularDamping: 0.1`, `friction: 0.4`, `restitution: 0.15`, `waterGravityMultiplier: 0`) tersusun atas **3 collider `cuboid` komposit** pada satu RigidBody:

| Collider | Shape | Half-Extents (`hx, hy, hz`) | Dimensi Total (`P x T x L`) | Offset Posisi Lokal (`x, y, z`) | Massa & Center of Mass (CoM) | Kategori Collision Group | Fungsi Spesifik |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **1. Main Body** | `cuboid` | `[1.30, 0.40, 0.85]` | `2.60m x 0.80m x 1.70m` | `{ x: 0.0, y: -0.1, z: 0.0 }` | **`mass: 2.5`**, **`CoM: { x: 0, y: -0.5, z: 0 }`** | `object` (`all\|object` $\leftrightarrow$ `all\|bumper`) | Menyimpan seluruh massa kendaraan dengan pusat massa digeser **0,5m ke bawah** agar mobil stabil dan tidak mudah terguling saat menikung tajam. |
| **2. Top Cabin** | `cuboid` | `[0.50, 0.15, 0.65]` | `1.00m x 0.30m x 1.30m` | `{ x: 0.0, y: +0.4, z: 0.0 }` | `mass: 0` (ditambah densitas default `0.1` $\rightarrow$ total $\approx 2.66\text{ kg}$) | `object` | Melindungi atap kabin saat mobil terbalik. |
| **3. Bumper** | `cuboid` | `[1.50, 0.50, 0.90]` | `3.00m x 1.00m x 1.80m` | `{ x: 0.1, y: -0.2, z: 0.0 }` | `mass: 0` | **`bumper`** (`bumper` $\leftrightarrow$ `object` saja!) | Hanya bertabrakan dengan grup `object` (batu bata, kotak, pin bowling, bangku) dan **mengabaikan `floor`**, sehingga moncong mobil dapat menyeruduk objek secara agresif tanpa tersangkut di tanjakan tanah! |

### 2.2 Parameter Raycast Wheels & Suspensi Hidrolik (`setWheels()`)
Keempat roda dipasang secara simetris dari titik pusat sasis dengan offset **`x = ±0.90m`** (jarak sumbu roda / *wheelbase* `1.80m`) dan **`z = ±0.75m`** (lebar jejak / *track width* `1.50m`), dengan urutan indeks:
- `0`: Depan Kanan (`+0.90, 0, +0.75`) — **Steerable**
- `1`: Depan Kiri (`+0.90, 0, -0.75`) — **Steerable**
- `2`: Belakang Kanan (`-0.90, 0, +0.75`)
- `3`: Belakang Kiri (`-0.90, 0, -0.75`)

| Parameter Roda & Suspensi | Nilai Eksak | Keterangan & Perilaku Dinamis |
| :--- | :--- | :--- |
| `radius` | **`0.4` m** | Keliling roda `perimeter = 0.8 * Math.PI` ($\approx 2.513\text{ m}$). |
| `directionCs` / `axleCs` | `{ x: 0, y: -1, z: 0 }` / `{ x: 0, y: 0, z: 1 }` | Arah raycast suspensi lurus ke bawah ($-Y$), poros putaran roda pada sumbu $Z$. |
| `frictionSlip` (Normal vs Es) | **`0.9`** (Normal) $\rightarrow$ **`0.04`** (Di atas Es) | Jika `wheelGroundObject(i)` mengenai collider es danau (`waterSurface.ice`), gesekan diinterpolasi `lerp(0.9, 0.04, iceRatio)` sehingga mobil tergelincir/drifting di atas danau beku! |
| `sideFrictionStiffness` | **`3`** | Kekakuan gesekan lateral ban untuk mencegah selip menyamping di aspal/tanah. |
| `maxSuspensionForce` | **`150`** | Gaya dorong balik maksimum pegas per roda. |
| `maxSuspensionTravel` | **`2` m** | Jarak main maksimum kompresi/ekstensi suspensi. |
| `suspensionCompression` | **`10`** | Redaman (*damping*) saat suspensi tertekan. |
| `suspensionRelaxation` | **`2.7`** | Redaman (*damping*) saat suspensi memantul kembali (*rebound*). |
| **3-State Hydraulic Suspension (`suspensionsHeights` & `suspensionsStiffness`)** | **`low`**: RestLength **`0.88m`**, Stiffness **`20`**<br>**`mid`**: RestLength **`1.23m`**, Stiffness **`30`**<br>**`high`**: RestLength **`1.63m`**, Stiffness **`40`** | Setiap roda dapat dinaikkan sendiri-sendiri (`mid` = *lowrider tilt* via Numpad / tombol `1-4` / `L1`/`R1` / klakson `H`) atau keempatnya sekaligus (`high` = **lompatan penuh** via `Space` / `Triangle` / tap pada cincin `Nipple`). |

### 2.3 Rumus Mesin, Boost, Rem, Kemudi & Self-Righting (`updatePrePhysics()`)
Pada setiap frame (prioritas `2`), gaya mesin, rem, dan sudut kemudi dihitung sebagai berikut:

1. **Top Speed & Engine Force dengan Overflow Attenuation**:
   - Parameter: `engineForceAmplitude = 300`, `boostMultiplier = 2`, `topSpeed = 5`, `topSpeedBoost = 40`.
   - Batas kecepatan aktif:
     $$v_{\text{top}} = \text{lerp}(5, 40, \text{boosting})$$
     $$v_{\text{overflow}} = \max(0, v_{\text{current}} - v_{\text{top}})$$
   - Gaya dorong yang dikirim ke keempat roda (4WD / All-Wheel Drive):
     $$F_{\text{engine}} = \frac{\text{accelerating} \cdot (1 + \text{boosting} \cdot 2) \cdot 300}{1 + v_{\text{overflow}}} \cdot \Delta t_{\text{scaled}}$$
     Perhatikan pembagi $(1 + v_{\text{overflow}})$: alih-alih memotong kecepatan secara kaku, gaya mesin meluruh secara hiperbolik saat kecepatan melewati `topSpeed`. Saat *boost* ditekan (`boosting = 1`), torsi awal meningkat **3x lipat** (`1 + 1 * 2 = 3`) dan batas kecepatan melonjak dari `5` menjadi `40`.
2. **Tiga Mode Pengereman (`brakeAmplitude = 35`)**:
   - **Active Braking (`player.braking = 1`)**: $F_{\text{brake}} = 1.0 \cdot 35 \cdot \Delta t_{\text{scaled}}$.
   - **Idle Engine Braking (`|accelerating| < 0.1`)**: $F_{\text{brake}} = 0.06 \cdot 35 \cdot \Delta t_{\text{scaled}}$ (`idleBrake = 0.06`), membuat mobil berhenti perlahan secara alami ketika pedal gas dilepas.
   - **Reverse Direction Braking**: Jika mobil sedang melaju ($v > 0.5$) dan pemain menekan arah berlawanan (`accelerating > 0 && !goingForward` atau sebaliknya), `engineForce` diputus menjadi `0` dan rem otomatis mengunci dengan `reverseBrake = 0.4` ($F_{\text{brake}} = 0.4 \cdot 35 \cdot \Delta t_{\text{scaled}}$) sebelum mulai mundur.
3. **Steering Angle**:
   - `steeringAmplitude = 0.5` radian ($\approx 28,65^\circ$), diaplikasikan pada roda depan `0` dan `1` (`setWheelSteering(0/1, player.steering * 0.5)`).
   - Pada mesh visual (`VisualVehicle.js:427`), rotasi roda depan dihaluskan dengan `steering += (targetSteer - steering) * deltaScaled * 16`, sementara kemiringan suspensi visual diredam dengan faktor `25 * deltaScaled`.
4. **Vehicle Sub-step Delta**:
   - `controller.updateVehicle(delta)` dipanggil dengan `delta = (quality.level === 1) ? 1/60 : Math.min(1/60, ticker.deltaAverage)` (rata-rata bergerak 30 frame terakhir) agar raycast suspensi Rapier selalu stabil dan bebas *jitter*.
5. **Mekanik Auto-Unstuck, Upside-Down Flip & Reset (`Player.js` & `PhysicsVehicle.js`)**:
   - **Deteksi Terbalik (`upsideDown.test()`)**: Menghitung `ratio = dot(upward, (0, -1, 0)) * 0.5 + 0.5`. Jika `ratio > 0.3` selama **3 detik berturut-turut** (`unstuck.duration = 3`), `flip.jump()` otomatis dipicu: memberikan impuls vertikal ke atas sebesar $5 \times \text{mass}$ (`applyImpulse`) ditambah impuls torsi lokal (`0.8 * mass` pada sumbu X jika terbalik penuh, atau kombinasi sumbu X dan Z jika miring di sisi bodi) untuk membalikkan mobil kembali berdiri!
   - **Deteksi Tersangkut (`stuck.test()`)**: Jika pemain menekan gas (`|accelerating| > 0.5`) selama akumulasi waktu $\ge 3$ detik namun total perpindahan posisi $< 0.5$ meter, event `'stuck'` muncul dan menampilkan tombol UI **Unstuck** untuk melakukan `respawn()`.
   - **Deteksi Backflip / Frontflip (`flip.test()`)**: Saat ke-4 roda lepas landas (`inContactCount === 0`) hingga mendarat kembali (`inContactCount >= 4`), perubahan sudut pitch (`zRotation`) diakumulasikan menggunakan `smallestAngle`. Jika $|\Delta\theta_z| > 5\text{ rad}$ ($\approx 286^\circ$) dan $|\Delta\theta_x| < 1\text{ rad}$, achievement `frontFlip` atau `backFlip` diberikan.

---

## 3. Arsitektur Multi-Input Handler (`Game/Inputs/`)

`Inputs.js` (`ev_3fb1f7bf7da9ffa4444b747c7fcc30d874dc1bf349f0fd6a1fb34eac950f1fa8`) menyatukan 5 sumber perangkat ke dalam satu sistem aksi bernama (`this.actions = new Map()`) dan secara otomatis mendeteksi perpindahan mode aktif (`MODE_MOUSEKEYBOARD = 1`, `MODE_GAMEPAD = 2`, `MODE_TOUCH = 3`), memperbarui class CSS pada `<html>` (`is-mode-mouse-keyboard`, `is-mode-gamepad`, `is-mode-touch`) serta ikon petunjuk 3D di dalam dunia.

### 3.1 Tabel Pemetaan Aksi Mengemudi & Sistem (`Player.js`, `ClosingManager.js`, `Audio.js`, `View.js`)

| Nama Aksi | Kategori Filter Aktif | Binding Keyboard (`code` / `key`) | Binding Gamepad | Fungsi |
| :--- | :--- | :--- | :--- | :--- |
| `forward` | `wandering`, `racing`, `cinematic` | `ArrowUp`, `KeyW` | `Gamepad.up`, `Gamepad.r2` (Trigger analog $0..1$) | Akselerasi maju (`+action.value`). |
| `backward` | `wandering`, `racing`, `cinematic` | `ArrowDown`, `KeyS` | `Gamepad.down`, `Gamepad.l2` (Trigger analog $0..1$) | Akselerasi mundur / rem (`-action.value`). |
| `left` / `right` | `wandering`, `racing`, `cinematic` | `ArrowLeft`/`KeyA`, `ArrowRight`/`KeyD` | `Gamepad.left`/`right` + Left Stick (`safeX`) | Kemudi kiri (`+1`) / kanan (`-1`) & lampu sein berkedip (`0.8s`). |
| `boost` | `wandering`, `racing` | `ShiftLeft`, `ShiftRight` | `Gamepad.circle` (B / Circle) | Mengaktifkan turbo boost (`3x` force, top speed `40`). |
| `brake` | `wandering`, `racing` | `KeyB`, `ControlLeft` | `Gamepad.square` (X / Square) | Rem tangan penuh (`braking = 1`) & menyalakan lampu rem. |
| `suspensions` (All Jump) | `wandering`, `racing` | `Space`, `Numpad5` | `Gamepad.triangle` (Y / Triangle) | Mengangkat ke-4 suspensi ke posisi `high` (`1.63m`) untuk melompat. |
| `suspensionsFront/Back/Left/Right` & Corners | `wandering`, `racing` | `Numpad8/2/4/6`, `Numpad7/9/1/3`, `Digit1..4` | `Gamepad.l1` (Left), `Gamepad.r1` (Right) | Mengangkat roda spesifik ke posisi `mid` (`1.23m`) ala hidrolik *lowrider*. |
| `interact` | `wandering`, `racing`, `cinematic` | `Enter`, `KeyE`, `KeyF` | `Gamepad.cross` (A / Cross) | Mengaktifkan `InteractivePoints` yang sedang terbuka (`STATE_OPEN`). |
| `respawn` | `wandering` | `KeyR` | `Gamepad.select` | Merespawn mobil ke titik `Respawns` terdekat dengan wipe `Overlay`. |
| `honk` | `wandering`, `racing`, `cinematic` | `KeyH` | `Gamepad.l3` | Membunyikan klakson & mengangkat 1 roda acak selama `0.15s`. |
| `close` / `pause` | `modal`, `menu`, `racing`, `cinematic`, `wandering` | `Escape` | `Gamepad.cross` (`close`), `Gamepad.start` (`pause`) | Menutup modal/menu/area aktif atau membuka menu utama. |
| `mute` | Semua kategori | `Keyboard.l` (huruf `l`) | — | Toggle mute suara global (`Howler.mute`) & simpan ke `localStorage`. |
| `zoom` / `zoomToggle` | `wandering`, `racing` | Mouse `Wheel.roll` | `Gamepad.r3` | Mengatur rasio zoom kamera. |

### 3.2 Detail Implementasi Spesifik Per Perangkat
1. **Keyboard Handler (`Keyboard.js`)**:
   - Memancarkan **kedua** identifier `event.code` (posisi fisik tombol, mendukung layout QWERTY maupun AZERTY secara otomatis!) dan `event.key` (karakter aktual, mis. `'l'` untuk mute).
   - Mengabaikan seluruh tombol kecuali `Escape` apabila fokus DOM sedang berada pada `input, textarea, [contenteditable]`.
   - Saat window kehilangan fokus (`window.addEventListener('blur')`), seluruh tombol yang sedang tertahan di `this.pressed` otomatis dilepas (`trigger('up')`) untuk mencegah bug mobil berjalan sendiri.
2. **Cross-Browser Gamepad Remapper (`Gamepad.js`)**:
   - Mengatasi inkonsistensi W3C Gamepad API pada controller **PlayStation 5 DualSense di Firefox Windows (`axes.length === 10`) dan Firefox macOS (`axes.length === 7`)** di mana `gamepad.mapping` kosong (`""`), indeks tombol `cross`/`circle`/`square` tertukar, trigger `L2`/`R2` dilaporkan sebagai sumbu `[-1, +1]` (`axisToTrigger`: `value = axis * 0.5 + 0.5`), dan D-Pad dilaporkan sebagai satu sumbu sudut (`axisToArrow` pada axis 9 atau 6).
   - Menerapkan *radial deadzone* `joystickDeadZone = 0.2` dan `buttonPressedZone = 0.2` menggunakan `remapClamp(|x|, 0.2, 1, 0, 1) * sign(x)`.
   - Mendeteksi jenis controller via regex `/xbox/i` vs `/playstation|dualshock|dualsense|ps\d/i` pada `gamepad.id` untuk mengganti ikon tombol secara *live*.
3. **3D Diegetic Virtual Touch Ring (`Nipple.js`)**:
   - Alih-alih menampilkan joystick 2D HTML di pojok layar pada perangkat mobile/touch, `Nipple.js` merender **cincin SDF 3D interaktif langsung di permukaan tanah mengelilingi mobil** (`RingGeometry`, radius dalam `progressRadiusLow = 2.0m`, radius luar `progressRadiusHigh = 4.5m`, busur maju `forwardAmplitude = 1.5 * Math.PI` atau $270^\circ$)!
   - Saat pengguna menyentuh layar dengan **1 jari** (`pointer.touches.length == 1`), `Raycaster` memproyeksikan titik sentuh ke bidang horizontal setinggi mobil (`Plane(Vector3(0,1,0), -position.y)`).
   - **Kalkulasi Gas & Kemudi dari Titik Sentuh 3D (`Player.js:572-598`)**:
     - Progres jarak radial: $\text{progress} = \text{clamp}\left(\frac{d - 2.0}{4.5 - 2.0}, 0, 1\right)$.
     - Akselerasi menggunakan kurva kubik untuk kontrol presisi kecepatan rendah: $\text{accelerating} = \text{progress}^3$.
     - Jika sudut sentuh relatif terhadap arah hadap mobil $|\Delta\theta| < 135^\circ$ (`forwardAmplitude / 2`), mobil bergerak **maju**; jika di dalam sektor $90^\circ$ belakang, mobil otomatis **mundur** (`forward = false`, membalikkan tanda `accelerating` dan `steering`, serta membalikkan busur shader SDF cincin di `Nipple.js`).
     - **Tap-to-Jump**: Jika pengguna mengetuk di dalam lingkaran dalam (`d <= 2.0m`, `inRadiusLow = true`) lalu melepas jari tanpa menggeser keluar, event `'tap'` terpicu dan membuat mobil melompat (`suspensions = 'high'` selama `200ms`) disertai animasi cincin melompat!

---

## 4. Sistem Sintesis Suara Dinamis Berbasis Fisika (`Player.js` & `Audio.js`)

Seluruh suara kendaraan dan benturan fisik dimodulasi secara *real-time* di setiap frame berdasarkan variabel kinematika dari `PhysicsVehicle` dan `Time.scale`:

### 4.1 Modulasi Audio Kendaraan per Frame (`Player.setSounds()`)
Di luar modulasi global `howl.rate(clamp(item.rate * (time.scale / 2), 0.5, 4))` (yang otomatis menurunkan pitch semua suara ke setengahnya saat *Bullet Time* aktif!), lima lapisan loop audio kendaraan dicampur secara simultan:

| Lapisan Suara (`Howl` Loop) | File Audio | Formula Target Volume (`onPlaying`) | Formula Pitch / Rate (`item.rate`) | Koefisien Smoothing (`easing`) |
| :--- | :--- | :--- | :--- | :--- |
| **1. Engine Idle/Rev** | `muscle car engine loop idle.mp3` | $\max\left(0.05,\; 0.5|\text{accel}| \cdot (\text{boost}+1) \cdot 0.8\right)$ | $\text{remapClamp}\left(0.5|\text{accel}|(\text{boost}+1),\; 0, 1,\; 0.6, 1.1\right)$ | Naik: `10 * dtScaled`<br>Turun: `2.5 * dtScaled`<br>Rate: `5 * dtScaled` |
| **2. Wheel Spin / Wind** | `41051 Glass stone turning loop 09-full.mp3` | $\text{clamp}(v_{xz} \cdot 0.1,\; 0, 1) \cdot 0.3$ | $\text{remapClamp}(\text{speedEffect},\; 0, 1,\; 1.0, 2.0)$ | Naik: `10 * dtScaled`<br>Turun: `2.5 * dtScaled`<br>Rate: `5 * dtScaled` |
| **3. Boost Energy Field** | `Energy_-_force_field_8_loop.mp3` | $(0.5 + 0.5|\text{accel}|) \cdot \text{boost} \cdot 0.3$ | $0.95 + |\text{accel}| \cdot 2.0$ | Naik: `10 * dtScaled`<br>Turun: `1.0 * dtScaled`<br>Rate: `5 * dtScaled` |
| **4. Rolling Pebbles** | `wheels-on-pebbles-road.mp3` | $\text{remapClamp}(|y - 1.08|,\; 0, 2,\; 1, 0) \cdot \min(1, v_{xz} \cdot 0.1) \cdot 0.25$ | `1.0` (Tetap) | Instan (berdasarkan ketinggian $Y$ & kecepatan $v_{xz}$) |
| **5. Skid / Brake Pebbles** | `Source Stone Loop Small Rubbing Pebbles On Concrete 02.mp3` | $0.4 \cdot \text{clamp}\left(\max\left(0.6(1 - |\text{forwardRatio}|), \text{braking}\right) \cdot v_{xz} \cdot 0.15 \cdot \frac{N_{\text{wheels}}}{4},\; 0, 1\right)$ | `0.8` (Tetap) | Naik: `20 * dtScaled`<br>Turun: `5 * dtScaled` |

> **Analisis Formula Skid/Drifting (Lapisan 5):** Perhatikan suku `directionRatio = (1 - Math.abs(forwardRatio)) * 0.6` di mana `forwardRatio = dot(velocityDirection, chassisForward)`. Artinya, **meskipun pemain tidak menekan tombol rem (`braking = 0`)**, setiap kali mobil melakukan *drifting* atau tergelincir menyamping ($|\text{forwardRatio}| < 1$) dengan roda menyentuh tanah ($N_{\text{wheels}} > 0$), suara gesekan kerikil otomatis terdengar proporsional terhadap sudut selip dan kecepatan horizontal $v_{xz}$!

### 4.2 Suara Suspensi & Pendaratan (`justTouchedCount`)
- **Hydraulic Piston (`Robotic_Lifeforms_2...Piston_Studio_Chair_07.mp3`)**: Dipicu saat pemain mengaktifkan suspensi; volume = `0.3 + activeWheelCount * 0.08`, rate = `0.9 + Math.random() * 0.2`.
- **Landing Springs (`HandleSqueak` + `SpringMetalMovements`)**: Pada `PhysicsVehicle.updatePostPhysics()`, engine menghitung `justTouchedCount` (jumlah roda yang baru saja menyentuh tanah dalam jendela waktu `0.2` detik terakhir ketika jumlah total roda yang menapak bertambah). Jika `justTouchedCount > 1` (mobil baru mendarat dari lompatan), kedua suara decitan pegas dimainkan sekaligus dengan volume diskalakan oleh jumlah roda yang mendarat.

### 4.3 Suara Benturan Fisika Berbasis Impuls (`Physics.js` $\rightarrow$ `Audio.js`)
1. Setiap objek fisik yang memiliki callback `onCollision` mengaktifkan flag Rapier `ActiveEvents.CONTACT_FORCE_EVENTS` dengan ambang batas gaya `contactThreshold = 15` (`setContactForceEventThreshold(15)`).
2. Di akhir `Physics.update()`, `eventQueue.drainContactForceEvents` menghitung **akselerasi benturan ternormalisasi massa**:
   $$\text{force} = \frac{\text{event.maxForceMagnitude}()}{m_1 + m_2}$$
3. Nilai `force` dan vektor `bodyPosition` dikirim ke grup audio terkait (`hitDefault`, `hitBrick`, atau `hitMetal`) dengan mekanisme:
   - **Anti-Spam**: `antiSpam = 0.1` detik per varian suara.
   - **Random Non-Repeating Variant**: `group.playRandomNext(force, position)` memilih varian sampel berikutnya secara acak tanpa mengulang sampel yang baru saja diputar (`delta = 1 + floor( rand() * (length - 2) )`).
   - **Force-to-Volume Curve & Spatial Attenuation**:
     - Untuk `hitDefault` (7 sampel): $\text{volume} = \text{baseVolume} \cdot \text{remapClamp}(\text{force}, 0, 200, 0, 1)$.
     - Untuk `hitBrick` (4 sampel) & `hitMetal` (3 sampel): $\text{volume} = 0.6 \cdot \left(\text{remapClamp}(\text{force}, 5, 20, 0, 1)\right)^2$.
     - Pitch diacak pada rentang `rate = 0.9 + Math.random() * 0.2`, lalu diatenuasi jaraknya hingga radius `distanceFade = 20m` dan diposisikan dalam ruang 3D kamera melalui `howl.pos(camRel.x, camRel.y, camRel.z * 0.1)`.
