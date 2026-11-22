import * as THREE from 'three/webgpu'
import { gsap } from 'gsap'
import { VEHICLE_PROFILES, getVehicleProfile } from './vehicleProfiles.js'
import { Modals } from '../Modals.js'

/**
 * Distinct, non-overlapping parking stations (7m–12m apart):
 *  - Garage / Parking Pad (South-West of Spawn Plaza): Buggy, Drift Pickup, City Hatchback, Autonomous Rover
 *  - Construction Pit Staging Bays (East / South-East): Excavator, Dump Truck, Bulldozer
 */
export const VEHICLE_STATIONS = Object.freeze({
  'buggy':        { x: -21, y: 0, z: 15, rotY: Math.PI * 0.5, zone: 'Garage Bay 01' },
  'drift-pickup': { x: -14, y: 0, z: 15, rotY: Math.PI * 0.5, zone: 'Garage Bay 02' },
  'hatchback':    { x: -7,  y: 0, z: 15, rotY: Math.PI * 0.5, zone: 'Garage Bay 03' },
  'rover':        { x: -14, y: 0, z: 22, rotY: Math.PI * 0.5, zone: 'Garage Bay 04' },
  'excavator':    { x: 10,  y: 0, z: 6,    rotY: 0,             zone: 'Construction West Bay' },
  'dump-truck':   { x: 21,  y: 0, z: 11.5, rotY: Math.PI,       zone: 'Construction East Bay' },
  'bulldozer':    { x: 10,  y: 0, z: 15,   rotY: 0,             zone: 'Construction South Bay' }
})

export class VehicleManager {
  constructor(game) {
    this.game = game
    this.activeId = 'buggy'
    this.nearbyId = null
    this.bedRaised = false
    this.hydraulicActive = false

    // Excavator hydraulic angles (tuned so boom/stick easily dip into the dirt pit & lift over dump truck)
    this.turret = 0
    this.boom = -0.32
    this.stick = -0.52
    this.bucket = -0.25
    this. bladeHeight = -0.22
    this.lastSpace = false
    this.lastExcavatorSpace = false
    this.lastDigParticles = 0

    this.models = new Map()
    this.parked = new Map()
    this.parkedBodies = new Map()
    this.stations = new Map(
      Object.entries(VEHICLE_STATIONS).map(([id, cfg]) => [
        id,
        { pos: new THREE.Vector3(cfg.x, cfg.y, cfg.z), rotY: cfg.rotY, zone: cfg.zone }
      ])
    )

    this.buildGaragePad()
    this.makeFleet()
    this.createBulldozerBladeCollider()
    this.makeUI()
    this.bindInputs()
    this.applyProfile()

    game.ticker.events.on('tick', () => this.update(), 12)
  }

  mat(c, o = {}) {
    return new THREE.MeshStandardMaterial({ color: c, roughness: 0.56, metalness: 0.14, ...o })
  }

  box(parent, size, pos, material, rot = null) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material)
    mesh.position.set(...pos)
    if (rot) mesh.rotation.set(...rot)
    mesh.castShadow = true
    mesh.receiveShadow = true
    parent.add(mesh)
    return mesh
  }

  /**
   * Builds a dedicated paved Garage / Parking Pad at (-14, 0, 18.5) with marked bays,
   * concrete wheel stops, and a solid overhead sign gantry.
   */
  buildGaragePad() {
    const garageGroup = new THREE.Group()
    const asphaltMat = this.mat('#23252f', { roughness: 0.92, metalness: 0.05 })
    const curbMat = this.mat('#8c92a4', { roughness: 0.85 })
    const lineMat = new THREE.MeshBasicMaterial({ color: '#f1f5f9' })
    const accentLineMat = new THREE.MeshBasicMaterial({ color: '#ff8a3d' })

    // Main asphalt apron covering (-24..-4, 11..25)
    const apron = new THREE.Mesh(new THREE.BoxGeometry(21.5, 0.04, 14.5), asphaltMat)
    apron.position.set(-14, 0.02, 18.2)
    apron.receiveShadow = true
    garageGroup.add(apron)

    // Perimeter low concrete curbs (West & South outer edges, with solid colliders)
    this.box(garageGroup, [21.8, 0.24, 0.35], [-14, 0.12, 25.4], curbMat)
    this.box(garageGroup, [0.35, 0.24, 14.6], [-24.7, 0.12, 18.2], curbMat)
    this.game.objects.add(null, {
      type: 'fixed',
      position: new THREE.Vector3(-14, 0, 25.4),
      colliders: [{ shape: 'cuboid', parameters: [10.9, 0.3, 0.22], position: { x: 0, y: 0.3, z: 0 } }]
    })
    this.game.objects.add(null, {
      type: 'fixed',
      position: new THREE.Vector3(-24.7, 0, 18.2),
      colliders: [{ shape: 'cuboid', parameters: [0.22, 0.3, 7.3], position: { x: 0, y: 0.3, z: 0 } }]
    })

    // Individual painted parking bays for each station (Garage + Construction Staging Bays)
    for (const [id, st] of this.stations) {
      const bayGroup = new THREE.Group()
      bayGroup.position.set(st.pos.x, 0.045, st.pos.z)
      bayGroup.rotation.y = st.rotY

      // Left & right bay lines + rear wheel stop
      const lineL = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.01, 0.12), lineMat)
      lineL.position.set(0, 0, -1.45)
      const lineR = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.01, 0.12), lineMat)
      lineR.position.set(0, 0, 1.45)
      const lineBack = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.01, 3.02), accentLineMat)
      lineBack.position.set(-1.85, 0, 0)
      bayGroup.add(lineL, lineR, lineBack)

      garageGroup.add(bayGroup)
    }

    // Garage Sign Arch at (-7.2, 0, 11.4)
    const signPostMat = this.mat('#2d3142', { metalness: 0.4, roughness: 0.5 })
    const signGroup = new THREE.Group()
    signGroup.position.set(-6.2, 0, 11.2)
    this.box(signGroup, [0.24, 3.1, 0.24], [-1.6, 1.55, 0], signPostMat)
    this.box(signGroup, [0.24, 3.1, 0.24], [1.6, 1.55, 0], signPostMat)

    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 128
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#171924'
    ctx.fillRect(0, 0, 512, 128)
    ctx.strokeStyle = '#ff8a3d'
    ctx.lineWidth = 6
    ctx.strokeRect(8, 8, 496, 112)
    ctx.fillStyle = '#ffffff'
    ctx.font = '800 42px "Space Grotesk", system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('FLEET GARAGE • 07', 256, 52)
    ctx.fillStyle = '#41e8ff'
    ctx.font = '600 20px "JetBrains Mono", monospace'
    ctx.fillText('CLICK OR PRESS [E] TO DRIVE ANY VEHICLE', 256, 94)

    const signTex = new THREE.CanvasTexture(canvas)
    signTex.colorSpace = THREE.SRGBColorSpace
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(3.6, 0.88, 0.22),
      new THREE.MeshBasicMaterial({ map: signTex })
    )
    board.position.set(0, 2.75, 0)
    signGroup.add(board)
    garageGroup.add(signGroup)

    // Solid colliders for the two garage sign posts
    this.game.objects.add(null, {
      type: 'fixed',
      position: new THREE.Vector3(-6.2, 0, 11.2),
      colliders: [
        { shape: 'cuboid', parameters: [0.2, 1.55, 0.2], position: { x: -1.6, y: 1.55, z: 0 } },
        { shape: 'cuboid', parameters: [0.2, 1.55, 0.2], position: { x: 1.6, y: 1.55, z: 0 } }
      ]
    })

    this.game.scene.add(garageGroup)
  }

  makeModel(profile) {
    const root = new THREE.Group()
    const paint = this.mat(profile.paint, { roughness: 0.36, metalness: 0.26 })
    const dark = this.mat('#25262b', { roughness: 0.88 })
    const metal = this.mat('#a2aab0', { metalness: 0.7, roughness: 0.3 })
    const glass = this.mat('#496b7c', { roughness: 0.23, transparent: true, opacity: 0.82 })
    const parts = { wheels: [] }

    if (profile.kind === 'excavator') {
      this.box(root, [2.35, 0.38, 1.12], [-0.05, -0.16, 0], dark)
      for (const z of [-0.72, 0.72]) {
        this.box(root, [2.5, 0.68, 0.4], [0, -0.45, z], dark)
        for (const x of [-0.82, -0.28, 0.28, 0.82]) {
          const w = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.16, 10), metal)
          w.rotation.x = Math.PI / 2
          w.position.set(x, -0.47, z + Math.sign(z) * 0.22)
          root.add(w)
        }
      }
      const turret = new THREE.Group()
      turret.position.set(-0.02, 0.2, 0)
      root.add(turret)
      parts.turret = turret
      this.box(turret, [1.65, 0.42, 1.22], [-0.06, 0.42, 0], paint)
      this.box(turret, [0.9, 0.82, 0.92], [-0.43, 1.02, 0], glass)
      this.box(turret, [1.05, 0.14, 1.18], [-0.43, 1.48, 0], paint)

      const boom = new THREE.Group()
      boom.position.set(0.65, 0.66, 0)
      turret.add(boom)
      parts.boom = boom
      this.box(boom, [1.65, 0.3, 0.34], [0.74, 0, 0], paint)

      const stick = new THREE.Group()
      stick.position.set(1.42, 0, 0)
      boom.add(stick)
      parts.stick = stick
      this.box(stick, [1.3, 0.24, 0.27], [0.54, -0.02, 0], paint)

      const bucket = new THREE.Group()
      bucket.position.set(1.15, -0.04, 0)
      stick.add(bucket)
      parts.bucket = bucket
      this.box(bucket, [0.58, 0.44, 0.68], [0.14, -0.14, 0], dark)
      this.box(bucket, [0.24, 0.56, 0.72], [0.36, -0.36, 0], paint, [0, 0, -0.28])
      for (const z of [-0.24, 0, 0.24]) {
        this.box(bucket, [0.36, 0.13, 0.12], [0.56, -0.54, z], metal, [0, 0, -0.16])
      }
      parts.piston = this.box(boom, [0.12, 1.05, 0.12], [0.65, -0.28, 0.24], metal, [0, 0, -0.45])
    } else if (profile.kind === 'truck') {
      this.box(root, [3.15, 0.48, 1.28], [-0.05, -0.12, 0], dark)
      const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.26, 12)
      wheelGeo.rotateX(Math.PI / 2)
      for (const x of [-1, 0.96]) {
        for (const z of [-0.72, 0.72]) {
          const w = new THREE.Mesh(wheelGeo, dark)
          w.position.set(x, -0.48, z)
          root.add(w)
          parts.wheels.push(w)
        }
      }
      this.box(root, [1.08, 0.9, 1.22], [0.92, 0.44, 0], paint)
      this.box(root, [0.72, 0.5, 1.08], [0.98, 0.91, 0], glass)
      const bed = new THREE.Group()
      bed.position.set(-0.55, 0.28, 0)
      root.add(bed)
      parts.bed = bed
      this.box(bed, [1.78, 0.18, 1.32], [-0.25, 0.18, 0], paint)
      for (const z of [-0.62, 0.62]) this.box(bed, [1.78, 0.68, 0.12], [-0.25, 0.52, z], paint)
      this.box(bed, [0.12, 0.68, 1.34], [-1.12, 0.52, 0], paint)
    } else if (profile.kind === 'dozer') {
      this.box(root, [2.5, 0.48, 1.42], [-0.08, -0.16, 0], paint)
      for (const z of [-0.73, 0.73]) this.box(root, [2.4, 0.65, 0.34], [0, -0.48, z], dark)
      this.box(root, [1.1, 0.75, 1.08], [-0.05, 0.5, 0], glass)
      const blade = new THREE.Group()
      blade.position.set(1.34, -0.18, 0)
      root.add(blade)
      parts.blade = blade
      this.box(blade, [0.28, 0.98, 2.24], [0.14, -0.06, 0], paint, [0, 0, -0.08])
      this.box(blade, [0.42, 0.14, 2.28], [0.24, -0.48, 0], metal)
    } else {
      const rover = profile.kind === 'rover'
      this.box(root, [2.58, 0.5, 1.5], [0, -0.12, 0], paint)
      this.box(root, [rover ? 1.08 : 1.25, 0.65, 1.26], [-0.05, 0.48, 0], glass)
      this.box(root, [1.2, 0.14, 1.42], [-0.08, 0.86, 0], paint)
      if (profile.kind === 'pickup') this.box(root, [0.72, 0.36, 1.4], [-0.88, 0.32, 0], dark)
      if (rover) {
        const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.62, 8), metal)
        mast.position.set(-0.5, 1.2, 0)
        root.add(mast)
      }
      for (const x of [-0.91, 0.91]) {
        for (const z of [-0.83, 0.83]) {
          const wheel = new THREE.Group()
          wheel.position.set(x, -0.47, z)
          root.add(wheel)
          const tire = new THREE.Mesh(
            new THREE.CylinderGeometry(rover ? 0.48 : 0.4, rover ? 0.48 : 0.4, 0.3, 14),
            dark
          )
          tire.rotation.x = Math.PI / 2
          wheel.add(tire)
          const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.32, 10), metal)
          rim.rotation.x = Math.PI / 2
          wheel.add(rim)
          parts.wheels.push(wheel)
        }
      }
    }

    if (profile.kind !== 'excavator' && profile.kind !== 'dozer') {
      for (const z of [-0.48, 0.48]) {
        const h = new THREE.Mesh(
          new THREE.BoxGeometry(0.09, 0.16, 0.25),
          new THREE.MeshBasicMaterial({ color: '#ffe8af' })
        )
        h.position.set(1.28, 0.18, z)
        root.add(h)
      }
    }

    root.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true
        o.receiveShadow = true
      }
    })
    root.userData.parts = parts
    return root
  }

  makeFleet() {
    for (const p of VEHICLE_PROFILES) {
      // 1. Active player-driven visual model
      const active = this.makeModel(p)
      active.visible = false
      this.game.scene.add(active)
      this.models.set(p.id, active)

      // 2. Stationary parked visual model at its dedicated bay
      const parked = this.makeModel(p)
      const st = this.stations.get(p.id)
      parked.position.set(st.pos.x, 0.88, st.pos.z)
      parked.rotation.y = st.rotY
      parked.visible = p.id !== this.activeId
      this.game.scene.add(parked)
      this.parked.set(p.id, parked)

      // 3. Solid Rapier physics collider for every parked vehicle (enabled whenever inactive)
      const quat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), st.rotY)
      const physical = this.game.physics.getPhysical({
        type: 'fixed',
        position: new THREE.Vector3(st.pos.x, 0.85, st.pos.z),
        rotation: quat,
        enabled: p.id !== this.activeId,
        colliders: [
          { shape: 'cuboid', parameters: [1.32, 0.78, 0.84], category: 'object' }
        ]
      })
      this.parkedBodies.set(p.id, physical.body)

      // 4. Clickable 3D RayCursor target on each parked vehicle to switch directly into it
      this.game.rayCursor?.addIntersect({
        active: true,
        shape: new THREE.Sphere(new THREE.Vector3(st.pos.x, 1.0, st.pos.z), 2.1),
        onClick: () => {
          if (this.game.modals?.state === Modals.CLOSED && this.activeId !== p.id) {
            this.switchTo(p.id, true)
          }
        }
      })
    }
  }

  /**
   * Dedicated kinematic physics body attached to the Bulldozer's front blade
   * so driving forward genuinely pushes dirt chunks, crates, and barrels.
   */
  createBulldozerBladeCollider() {
    this.bladePhysical = this.game.physics.getPhysical({
      type: 'kinematicPositionBased',
      position: new THREE.Vector3(0, -20, 0),
      enabled: false,
      friction: 0.25,
      restitution: 0.2,
      colliders: [
        { shape: 'cuboid', parameters: [0.34, 0.54, 1.18], category: 'object' }
      ]
    })
  }

  makeUI() {
    this.isTouch =
      document.documentElement.classList.contains('is-mode-touch') ||
      window.matchMedia('(max-width: 768px)').matches

    this.ui = document.createElement('aside')
    this.ui.className = 'vehicle-switcher'
    this.ui.setAttribute('aria-label', 'Vehicle fleet')

    this.toggle = document.createElement('button')
    this.toggle.type = 'button'
    this.toggle.className = 'vehicle-switcher-toggle'
    this.toggle.textContent = 'Fleet ▾'

    this.list = document.createElement('div')
    this.list.className = 'vehicle-switcher-list'

    const title = document.createElement('div')
    title.className = 'vehicle-switcher-title'
    title.textContent = 'FLEET / 07'
    this.list.append(title)

    this.buttons = new Map()
    for (const p of VEHICLE_PROFILES) {
      const b = document.createElement('button')
      b.type = 'button'
      b.dataset.vehicle = p.id
      b.textContent = p.short || p.label
      b.title = `Switch to ${p.label}`
      b.onclick = () => this.switchTo(p.id, true)
      this.buttons.set(p.id, b)
      this.list.append(b)
    }

    this.ui.append(this.toggle, this.list)
    this.toggle.onclick = () => this.setFleetOpen(!this.fleetOpen)

    this.prompt = document.createElement('div')
    this.prompt.className = 'vehicle-nearby-prompt'
    this.prompt.hidden = true
    this.prompt.innerHTML = '<kbd>E</kbd><span></span>'
    this.prompt.addEventListener('click', () => {
      if (this.nearbyId) this.switchTo(this.nearbyId, false)
    })

    document.body.append(this.ui, this.prompt)

    this.controlHint = document.createElement('div')
    this.controlHint.className = 'vehicle-controls-hint'
    document.body.append(this.controlHint)

    this.makeTouchControls()
    this.setFleetOpen(!this.isTouch)
    this.syncUI()
  }

  setFleetOpen(open) {
    this.fleetOpen = open
    this.ui.classList.toggle('is-open', open)
    this.toggle.setAttribute('aria-expanded', String(open))
    this.toggle.textContent = open ? 'Fleet ▴' : 'Fleet ▾'
  }

  makeTouchControls() {
    this.touchPanel = document.createElement('div')
    this.touchPanel.className = 'vehicle-touch-controls'
    document.body.append(this.touchPanel)
  }

  bindTouchHold(btn, code) {
    const start = (e) => {
      e.preventDefault()
      const k = this.game.inputs.keyboard.pressed
      if (!k.includes(code)) k.push(code)
      btn.classList.add('is-pressed')
    }
    const end = (e) => {
      e.preventDefault()
      const k = this.game.inputs.keyboard.pressed
      for (let i = k.length - 1; i >= 0; i--) {
        if (k[i] === code) k.splice(i, 1)
      }
      btn.classList.remove('is-pressed')
    }
    btn.addEventListener('pointerdown', start)
    btn.addEventListener('pointerup', end)
    btn.addEventListener('pointerleave', end)
    btn.addEventListener('pointercancel', end)
  }

  refreshTouchControls() {
    if (!this.touchPanel) return
    this.touchPanel.innerHTML = ''
    let defs = []
    if (this.activeId === 'excavator') {
      defs = [
        ['Turret ⟲', 'KeyQ'],
        ['Turret ⟳', 'KeyE'],
        ['Boom ▲', 'KeyI'],
        ['Boom ▼', 'KeyK'],
        ['Scoop', 'KeyJ'],
        ['Dump', 'KeyL']
      ]
    } else if (this.activeId === 'bulldozer') {
      defs = [
        ['Blade ▲', 'KeyI'],
        ['Blade ▼', 'KeyK']
      ]
    } else if (this.activeId === 'dump-truck') {
      defs = [['Tilt Bed', 'Space']]
    }

    for (const [label, code] of defs) {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'touch-btn'
      b.textContent = label
      this.bindTouchHold(b, code)
      this.touchPanel.append(b)
    }
    this.touchPanel.classList.toggle('is-visible', defs.length > 0)
  }

  bindInputs() {
    this.game.inputs.events.on('interact', (a) => {
      if (a.active && this.activeId !== 'excavator' && this.nearbyId) {
        this.switchTo(this.nearbyId, false)
      }
    })
    this.game.inputs.keyboard.events.on('down', (code) => {
      if (code === 'KeyH') this.game.soundEngine?.honk()
    })
  }

  applyProfile() {
    const p = getVehicleProfile(this.activeId)
    const v = this.game.physicalVehicle
    v.engineForceAmplitude = p.engineForce
    v.topSpeed = p.topSpeed
    v.steeringAmplitude = p.steering
    v.boostMultiplier = ['car', 'pickup', 'hatchback', 'rover'].includes(p.kind) ? 2 : 0.35
  }

  switchTo(id, quick = true) {
    const p = getVehicleProfile(id)
    if (!p || id === this.activeId) return

    const oldId = this.activeId
    this.activeId = id
    this.applyProfile()

    // 1. Disable collider on the newly active vehicle's parked slot BEFORE teleporting into it
    const newStation = this.stations.get(id)
    const newParkedBody = this.parkedBodies.get(id)
    if (newParkedBody) newParkedBody.setEnabled(false)

    // 2. Re-enable the old vehicle's parked mesh & solid collider at its dedicated station
    const oldParkedMesh = this.parked.get(oldId)
    const oldParkedBody = this.parkedBodies.get(oldId)
    const oldStation = this.stations.get(oldId)
    if (oldParkedMesh && oldStation) {
      oldParkedMesh.position.set(oldStation.pos.x, 0.88, oldStation.pos.z)
      oldParkedMesh.rotation.y = oldStation.rotY
      oldParkedMesh.visible = true
    }
    if (oldParkedBody) oldParkedBody.setEnabled(true)

    // 3. Move the active physical chassis to the selected vehicle's station
    if (newStation && this.game.physicalVehicle) {
      const targetPos = new THREE.Vector3(newStation.pos.x, 1.85, newStation.pos.z)
      this.game.physicalVehicle.moveTo(targetPos, newStation.rotY)
      if (this.game.player) {
        this.game.player.spawnPoint.position.copy(targetPos)
        this.game.player.spawnPoint.rotation = newStation.rotY
      }
    }

    // 4. Toggle active vs parked meshes
    if (this.game.world?.visualVehicle?.parts?.chassis) {
      this.game.world.visualVehicle.parts.chassis.visible = id === 'buggy'
    }
    for (const [key, m] of this.models) {
      m.visible = key === id && id !== 'buggy'
    }
    for (const [key, m] of this.parked) {
      m.visible = key !== id
    }

    // Enable bulldozer kinematic blade collider only when driving the Bulldozer
    if (this.bladePhysical?.body) {
      this.bladePhysical.body.setEnabled(id === 'bulldozer')
      if (id !== 'bulldozer') {
        this.bladePhysical.body.setNextKinematicTranslation({ x: 0, y: -20, z: 0 })
      }
    }

    this.game.view.focusPoint.isTracking = true
    if (id !== 'buggy') {
      const m = this.models.get(id)
      m.scale.setScalar(0.9)
      gsap.to(m.scale, { x: 1, y: 1, z: 1, duration: 0.48, ease: 'back.out(1.2)', overwrite: true })
    }

    this.syncUI()
    this.game.portfolioUI?.showToast(`Switched to ${p.label} (${newStation?.zone || 'Active'})`)
  }

  syncUI() {
    for (const [id, b] of this.buttons || []) {
      b.classList.toggle('is-active', id === this.activeId)
    }
    const p = getVehicleProfile(this.activeId)
    if (this.controlHint && p) {
      this.controlHint.textContent = p.controls
      this.controlHint.classList.toggle(
        'is-visible',
        ['excavator', 'dump-truck', 'bulldozer'].includes(p.id)
      )
    }
    this.refreshTouchControls()
  }

  pressed(c) {
    return this.game.inputs.keyboard.pressed.includes(c)
  }

  applyControls(player) {
    if (this.activeId === 'excavator') {
      const kw = this.pressed('KeyW') || this.pressed('ArrowUp')
      const ks = this.pressed('KeyS') || this.pressed('ArrowDown')
      const ka = this.pressed('KeyA') || this.pressed('ArrowLeft')
      const kd = this.pressed('KeyD') || this.pressed('ArrowRight')
      if (kw || ks) player.accelerating = (kw ? 1 : 0) - (ks ? 1 : 0)
      if (ka || kd) player.steering = (ka ? 1 : 0) - (kd ? 1 : 0)
      player.boosting = 0
      if (this.pressed('KeyB')) player.braking = 1
    } else if (this.activeId === 'dump-truck') {
      player.boosting = 0
      const s = this.pressed('Space')
      if (s && !this.lastSpace) {
        this.bedRaised = !this.bedRaised
        if (this.bedRaised) {
          const site = this.game.world?.constructionSite
          const dumped = site?.dumpTruckLoad(this.getWorldPosition('dump-truck'), this.game.physicalVehicle.forward) || 0
          if (dumped > 0) {
            this.game.portfolioUI?.showToast(`Dumped ${dumped} dirt chunks from Dump Truck bed!`)
          } else {
            this.game.portfolioUI?.showToast('Dump Truck bed raised')
          }
        } else {
          this.game.portfolioUI?.showToast('Dump Truck bed lowered')
        }
      }
      this.lastSpace = s
    } else if (this.activeId === 'bulldozer') {
      player.boosting = 0
    }
  }

  getWorldPosition(id) {
    if (id === this.activeId) {
      return this.game.physicalVehicle.position.clone()
    }
    const st = this.stations.get(id)
    return st ? st.pos.clone().add(new THREE.Vector3(0, 0.88, 0)) : new THREE.Vector3()
  }

  getWorldQuaternion(id) {
    if (id === this.activeId) {
      return this.game.physicalVehicle.quaternion.clone()
    }
    const parkedMesh = this.parked.get(id)
    return parkedMesh ? parkedMesh.quaternion.clone() : new THREE.Quaternion()
  }

  update() {
    if (!this.game.player) return
    const p = this.game.player.position
    const dt = Math.min(this.game.ticker.deltaScaled, 0.05)

    // Detect nearby parked vehicle for E / tap switch prompt
    let best = 3.8
    let next = null
    for (const [id, st] of this.stations) {
      if (id === this.activeId) continue
      const d = Math.hypot(p.x - st.pos.x, p.z - st.pos.z)
      if (d < best) {
        best = d
        next = id
      }
    }
    this.nearbyId = next
    this.prompt.hidden = !next
    if (next) {
      this.prompt.querySelector('span').textContent = `Drive ${getVehicleProfile(next).label}`
    }

    const bodyPos = this.game.physicalVehicle.position
    const bodyQuat = this.game.physicalVehicle.quaternion

    for (const [id, m] of this.models) {
      if (id === 'buggy') continue
      m.position.copy(bodyPos)
      m.quaternion.copy(bodyQuat)
      const parts = m.userData.parts

      if (parts.wheels?.length && id === this.activeId) {
        const spin = this.game.physicalVehicle.forwardSpeed * dt * 1.9
        for (let i = 0; i < parts.wheels.length; i++) {
          const w = parts.wheels[i]
          w.rotation.z += spin
          if (i >= 2) w.rotation.y = this.game.player.steering * 0.48
        }
      }

      if (id === 'dump-truck' && parts.bed) {
        const targetAngle = this.bedRaised ? 0.52 : 0
        parts.bed.rotation.z += (targetAngle - parts.bed.rotation.z) * Math.min(1, dt * 4.5)
        const parkedParts = this.parked.get(id)?.userData?.parts
        if (parkedParts?.bed) {
          parkedParts.bed.rotation.z = parts.bed.rotation.z
        }
      }

      if (id === 'bulldozer' && parts.blade) {
        if (id === this.activeId) {
          if (this.pressed('KeyI')) {
            this.bladeHeight = Math.min(0.48, this.bladeHeight + dt * 0.75)
          }
          if (this.pressed('KeyK')) {
            this.bladeHeight = Math.max(-0.32, this.bladeHeight - dt * 0.75)
          }
          parts.blade.position.y = this.bladeHeight
          m.updateMatrixWorld(true)

          // Sync kinematic Bulldozer blade physics collider & push debris in front
          const bladeWorldPos = new THREE.Vector3()
          const bladeWorldQuat = new THREE.Quaternion()
          parts.blade.getWorldPosition(bladeWorldPos)
          parts.blade.getWorldQuaternion(bladeWorldQuat)

          if (this.bladePhysical?.body) {
            this.bladePhysical.body.setNextKinematicTranslation({
              x: bladeWorldPos.x,
              y: bladeWorldPos.y,
              z: bladeWorldPos.z
            })
            this.bladePhysical.body.setNextKinematicRotation({
              x: bladeWorldQuat.x,
              y: bladeWorldQuat.y,
              z: bladeWorldQuat.z,
              w: bladeWorldQuat.w
            })
          }

          if (this.bladeHeight < 0.25 && Math.abs(this.game.physicalVehicle.speed) > 0.35) {
            this.game.world?.constructionSite?.pushWithBlade(
              bladeWorldPos,
              this.game.physicalVehicle.forward,
              this.game.physicalVehicle.speed
            )
          }
        }
      }

      if (id === 'excavator' && id === this.activeId) {
        this.updateExcavator(m, parts, dt)
      }
    }

    if (
      (this.activeId === 'excavator' || this.activeId === 'bulldozer') &&
      this.game.world?.constructionSite &&
      p.distanceTo(this.game.world.constructionSite.center) < 14 &&
      Math.abs(this.game.physicalVehicle.speed) > 2.2
    ) {
      this.game.particles?.emit(p.clone().add(new THREE.Vector3(0, -0.65, 0)), 1, 0.25)
    }
  }

  updateExcavator(model, parts, dt) {
    const q = this.pressed('KeyQ')
    const e = this.pressed('KeyE')
    const up = this.pressed('KeyI')
    const down = this.pressed('KeyK')
    let scoopKey = this.pressed('KeyJ')
    let dumpKey = this.pressed('KeyL')
    const spaceKey = this.pressed('Space')

    const site = this.game.world?.constructionSite
    if (spaceKey && site) {
      // Contextual Space bar on Excavator: if carrying chunks & boom raised, dump; otherwise curl/scoop
      if (site.payload.length > 0 && this.boom > -0.15) {
        dumpKey = true
      } else {
        scoopKey = true
      }
    }
    this.lastExcavatorSpace = spaceKey

    this.hydraulicActive = q || e || up || down || scoopKey || dumpKey

    // 1. 360-degree continuous upper cab / turret rotation (Q/E)
    this.turret += ((e ? 1 : 0) - (q ? 1 : 0)) * dt * 1.15

    // 2. Boom & Stick hydraulic arm articulation (I/K)
    this.boom = THREE.MathUtils.clamp(
      this.boom + ((up ? 1 : 0) - (down ? 1 : 0)) * dt * 0.72,
      -0.88,
      0.85
    )
    this.stick = THREE.MathUtils.clamp(
      this.stick + ((down ? 1 : 0) - (up ? 1 : 0)) * dt * 0.52,
      -1.18,
      0.38
    )

    // 3. Bucket curl (J / Space) & dump tilt (L / Space)
    this.bucket = THREE.MathUtils.clamp(
      this.bucket + ((dumpKey ? 1 : 0) - (scoopKey ? 1 : 0)) * dt * 1.25,
      -0.9,
      0.92
    )

    parts.turret.rotation.y = this.turret
    parts.boom.rotation.z = this.boom
    parts.stick.rotation.z = this.stick
    parts.bucket.rotation.z = this.bucket
    model.updateMatrixWorld(true)

    if (!site) return

    // Compute world position of the bucket tip
    const bucketTipWorld = parts.bucket.localToWorld(new THREE.Vector3(0.35, -0.35, 0))

    // Magnetic scoop: attaches nearby dirt chunks whenever curling/scooping OR dipping low into the dirt pile
    const isLowInPit = bucketTipWorld.y < 1.45
    const wantsScoop = scoopKey || (isLowInPit && this.bucket < 0.05 && !dumpKey)
    const collected = site.scoop(bucketTipWorld, wantsScoop, parts.bucket)

    if (collected > 0) {
      this.game.particles?.emit(bucketTipWorld, 10, 0.95)
      this.game.portfolioUI?.showToast(
        `Scooped ${site.payload.length}/${site.maxPayload} dirt chunks in Excavator bucket`
      )
    } else if (scoopKey && this.game.ticker.elapsed - this.lastDigParticles > 0.35) {
      this.lastDigParticles = this.game.ticker.elapsed
      this.game.particles?.emit(bucketTipWorld, 5, 0.55)
    }

    // Dump / release attached chunks back into physics & gravity (or into Dump Truck bed!)
    if ((dumpKey || this.bucket > 0.38) && site.payload.length > 0) {
      const truckMesh = this.activeId === 'dump-truck' ? this.models.get('dump-truck') : this.parked.get('dump-truck')
      const truckBed = truckMesh?.userData?.parts?.bed
      const truckBedWorld = truckBed
        ? truckBed.getWorldPosition(new THREE.Vector3())
        : this.getWorldPosition('dump-truck')

      const result = site.unload(bucketTipWorld, this.bucket, truckBedWorld, truckBed)
      if (result.dropped > 0 || result.delivered > 0) {
        this.game.particles?.emit(bucketTipWorld, 16, 1.35)
        this.game.portfolioUI?.showToast(
          result.delivered > 0
            ? `Dumped ${result.delivered} dirt chunks into Dump Truck bed!`
            : `Released ${result.dropped} dirt chunks with gravity!`
        )
      }
    }
  }
}
