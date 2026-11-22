import * as THREE from 'three/webgpu'

export class ConstructionSite {
  constructor(game) {
    this.game = game
    this.center = new THREE.Vector3(16, 0, 10)
    this.rocks = []
    this.payload = []
    this.pushableProps = []
    this.truckCargoCount = 0
    this.maxPayload = 10
    this.rockCount = 36
    this.temp = new THREE.Object3D()

    this.stoneMaterial = new THREE.MeshStandardMaterial({ color: '#8f775c', roughness: 0.98 })
    this.crateMaterial = new THREE.MeshStandardMaterial({ color: '#c98842', roughness: 0.82 })
    this.barrelMaterial = new THREE.MeshStandardMaterial({ color: '#2d6a9f', roughness: 0.48, metalness: 0.35 })
    this.coneMaterial = new THREE.MeshStandardMaterial({ color: '#ff6b2b', roughness: 0.65 })
    this.yellow = new THREE.MeshStandardMaterial({ color: '#e9a828', roughness: 0.52, metalness: 0.18 })
    this.dark = new THREE.MeshStandardMaterial({ color: '#2d2f38', roughness: 0.82 })

    this.buildSite()
    this.buildDebris()
    this.buildPitProps()
    this.game.ticker.events.on('tick', () => this.update(), 16)
  }

  box(parent, size, position, material, rotation = null) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material)
    mesh.position.set(...position)
    if (rotation) mesh.rotation.set(...rotation)
    mesh.castShadow = true
    mesh.receiveShadow = true
    parent.add(mesh)
    return mesh
  }

  buildSite() {
    // 1. Flush sandy dirt pit surface at (16, 0.01, 10) — no raised collider lip so vehicles drive smoothly
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 128
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#73624e'
    ctx.fillRect(0, 0, 128, 128)
    for (let i = 0; i < 900; i++) {
      const s = 68 + Math.random() * 78
      ctx.fillStyle = `rgba(${s},${s * 0.88},${s * 0.72},${Math.random() * 0.32})`
      ctx.fillRect(Math.random() * 128, Math.random() * 128, 1 + Math.random() * 2, 1 + Math.random() * 2)
    }
    const texture = new THREE.CanvasTexture(canvas)
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(5, 4)

    const ground = new THREE.Mesh(
      new THREE.BoxGeometry(15.5, 0.03, 13.5),
      new THREE.MeshStandardMaterial({ map: texture, color: '#a88c68', roughness: 0.96 })
    )
    ground.position.set(16, 0.015, 10)
    ground.receiveShadow = true
    this.game.scene.add(ground)

    // 2. Fenced perimeter barriers with SOLID physics colliders (leaving wide entry gates on West & North)
    const addBarrierSegment = (bx, bz, rotY = 0) => {
      const group = new THREE.Group()
      group.position.set(bx, 0, bz)
      group.rotation.y = rotY
      this.box(group, [1.5, 0.72, 0.36], [0, 0.36, 0], this.yellow)
      this.box(group, [1.54, 0.16, 0.4], [0, 0.56, 0], this.dark)
      this.game.scene.add(group)

      const quat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY)
      this.game.objects.add(null, {
        type: 'fixed',
        position: new THREE.Vector3(bx, 0, bz),
        rotation: quat,
        colliders: [{ shape: 'cuboid', parameters: [0.76, 0.42, 0.22], position: { x: 0, y: 0.42, z: 0 } }]
      })
    }

    // South fence row along z = 16.8
    for (let i = 0; i < 5; i++) {
      addBarrierSegment(12.2 + i * 1.85, 16.8, 0)
    }
    // East fence row along x = 23.8
    for (let i = 0; i < 4; i++) {
      addBarrierSegment(23.8, 4.8 + i * 1.85, Math.PI * 0.5)
    }

    // 3. Small Construction Pit Ramp at (16.5, 0.32, 14.8) with solid floor collider
    const rampGroup = new THREE.Group()
    const rampPos = new THREE.Vector3(16.5, 0.32, 14.6)
    const rampTilt = 0.24
    const rampQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), rampTilt)
    this.box(rampGroup, [3.6, 0.32, 2.8], [0, 0, 0], this.yellow)
    this.box(rampGroup, [3.6, 0.44, 0.18], [0, 0.08, -1.32], this.dark)
    this.box(rampGroup, [3.6, 0.44, 0.18], [0, 0.08, 1.32], this.dark)
    rampGroup.position.copy(rampPos)
    rampGroup.quaternion.copy(rampQuat)
    this.game.scene.add(rampGroup)
    this.game.objects.add(null, {
      type: 'fixed',
      position: rampPos,
      rotation: rampQuat,
      friction: 0.6,
      colliders: [{ shape: 'cuboid', parameters: [1.8, 0.16, 1.4], category: 'floor' }]
    })

    // 4. Shipping Container Site Office at (22.5, 0, 14.2) with solid Rapier collider
    const containerPos = new THREE.Vector3(22.5, 0, 14.2)
    const container = new THREE.Group()
    container.position.copy(containerPos)
    const blue = new THREE.MeshStandardMaterial({ color: '#3b586b', roughness: 0.72, metalness: 0.32 })
    this.box(container, [3.4, 2.3, 1.9], [0, 1.15, 0], blue)
    for (let x = -1.4; x <= 1.45; x += 0.48) {
      this.box(container, [0.05, 2.15, 1.96], [x, 1.15, 0], this.dark)
    }
    this.game.scene.add(container)
    this.game.objects.add(null, {
      type: 'fixed',
      position: containerPos,
      colliders: [{ shape: 'cuboid', parameters: [1.72, 1.18, 0.98], position: { x: 0, y: 1.18, z: 0 } }]
    })

    this.buildCrane()
  }

  buildCrane() {
    // Slowly rotating Tower Crane at (24.5, 0, 2.2) with solid base collider
    const cranePos = new THREE.Vector3(24.5, 0, 2.2)
    const crane = new THREE.Group()
    crane.position.copy(cranePos)
    const steel = new THREE.MeshStandardMaterial({ color: '#e0aa2f', metalness: 0.32, roughness: 0.58 })

    // Concrete foundation pad + vertical lattice mast
    this.box(crane, [1.8, 0.45, 1.8], [0, 0.225, 0], this.dark)
    this.box(crane, [0.58, 12.5, 0.58], [0, 6.25, 0], steel)

    // Rotating upper slewing jib assembly
    const pivot = new THREE.Group()
    pivot.position.set(0, 12.2, 0)
    crane.add(pivot)

    // Operator cab + main jib + counter-jib + concrete counterweight
    this.box(pivot, [1.1, 1.2, 1.0], [0.5, -0.4, 0], this.dark)
    this.box(pivot, [11.5, 0.42, 0.48], [3.6, 0, 0], steel)
    this.box(pivot, [1.4, 0.95, 0.88], [-1.9, -0.1, 0], this.dark)
    this.box(pivot, [0.48, 2.2, 0.48], [0, 1.1, 0], steel)

    // Trolley & hook cable
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 3.6, 6), this.dark)
    cable.position.set(7.6, -1.9, 0)
    pivot.add(cable)
    this.box(pivot, [0.48, 0.34, 0.4], [7.6, -3.7, 0], this.yellow)

    this.game.scene.add(crane)
    this.crane = { group: crane, pivot }

    // Solid collider on Tower Crane base & mast
    this.game.objects.add(null, {
      type: 'fixed',
      position: cranePos,
      colliders: [{ shape: 'cuboid', parameters: [0.92, 3.2, 0.92], position: { x: 0, y: 3.2, z: 0 } }]
    })
  }

  /**
   * 36 physics-enabled dirt/gravel chunks inside the Construction Pit
   */
  buildDebris() {
    this.rockInstances = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(0.42, 0),
      this.stoneMaterial,
      this.rockCount
    )
    this.rockInstances.castShadow = true
    this.rockInstances.receiveShadow = true
    this.rockInstances.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.game.scene.add(this.rockInstances)

    const rand = (a, b) => a + Math.random() * (b - a)
    for (let i = 0; i < this.rockCount; i++) {
      const scale = new THREE.Vector3(rand(0.62, 1.24), rand(0.58, 1.16), rand(0.62, 1.24))
      const layer = Math.floor(i / 12)
      const angle = (i % 12) * ((Math.PI * 2) / 12) + layer * 0.3
      const radius = rand(0.35, 2.4 - layer * 0.45)
      const spawnPos = new THREE.Vector3(
        14.6 + Math.cos(angle) * radius,
        0.38 + layer * 0.44,
        8.6 + Math.sin(angle) * radius
      )

      const physical = this.game.physics.getPhysical({
        type: 'dynamic',
        position: spawnPos,
        sleeping: false,
        linearDamping: 0.45,
        angularDamping: 0.55,
        mass: 0.42,
        friction: 0.85,
        restitution: 0.08,
        colliders: [
          {
            shape: 'ball',
            parameters: [0.35 * Math.max(scale.x, scale.y, scale.z)],
            category: 'object'
          }
        ]
      })

      this.rocks.push({
        index: i,
        physical,
        scale,
        state: 'free', // 'free' | 'bucket' | 'truck'
        bucketRef: null,
        truckBedRef: null,
        localOffset: new THREE.Vector3(),
        localRot: new THREE.Euler(rand(0, 3), rand(0, 3), rand(0, 3))
      })
    }
  }

  /**
   * Wooden crates, steel barrels, and cones inside the Construction Pit for Bulldozer pushing
   */
  buildPitProps() {
    // 6 Dynamic Wooden Crates at (14.2..16.2, 0.45, 13.0)
    const crateGeo = new THREE.BoxGeometry(0.76, 0.76, 0.76)
    for (let i = 0; i < 6; i++) {
      const cx = 13.6 + (i % 3) * 0.88
      const cy = 0.42 + Math.floor(i / 3) * 0.8
      const cz = 12.6
      const mesh = new THREE.Mesh(crateGeo, this.crateMaterial)
      mesh.castShadow = true
      mesh.receiveShadow = true
      const obj = this.game.objects.add(
        { model: mesh },
        {
          type: 'dynamic',
          position: new THREE.Vector3(cx, cy, cz),
          sleeping: true,
          mass: 0.38,
          friction: 0.35,
          restitution: 0.12,
          colliders: [{ shape: 'cuboid', parameters: [0.38, 0.38, 0.38], category: 'object' }]
        }
      )
      this.pushableProps.push(obj.physical)
    }

    // 4 Dynamic Steel Barrels at (17.8, 0.5, 11.4..13.2)
    const barrelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.88, 12)
    for (let i = 0; i < 4; i++) {
      const bx = 18.0 + (i % 2) * 0.75
      const bz = 11.5 + Math.floor(i / 2) * 0.78
      const mesh = new THREE.Mesh(barrelGeo, this.barrelMaterial)
      mesh.castShadow = true
      mesh.receiveShadow = true
      const obj = this.game.objects.add(
        { model: mesh },
        {
          type: 'dynamic',
          position: new THREE.Vector3(bx, 0.46, bz),
          sleeping: true,
          mass: 0.35,
          friction: 0.32,
          restitution: 0.14,
          colliders: [{ shape: 'cylinder', parameters: [0.44, 0.32], category: 'object' }]
        }
      )
      this.pushableProps.push(obj.physical)
    }

    // 6 Dynamic Traffic Cones marking the pit lane
    const coneGeo = new THREE.ConeGeometry(0.22, 0.62, 10)
    for (let i = 0; i < 6; i++) {
      const cx = 11.5 + i * 1.4
      const cz = 3.6
      const mesh = new THREE.Mesh(coneGeo, this.coneMaterial)
      mesh.castShadow = true
      const obj = this.game.objects.add(
        { model: mesh },
        {
          type: 'dynamic',
          position: new THREE.Vector3(cx, 0.32, cz),
          sleeping: true,
          mass: 0.15,
          friction: 0.4,
          restitution: 0.15,
          colliders: [{ shape: 'cylinder', parameters: [0.31, 0.2], category: 'object' }]
        }
      )
      this.pushableProps.push(obj.physical)
    }
  }

  /**
   * Magnetic / Attach Scoop Mechanic:
   * Attaches nearby free dirt chunks directly inside the 3D Excavator bucket so they visibly
   * ride along with the boom, stick, and turret until dumped!
   */
  scoop(bucketPosition, active, bucketObject3D = null) {
    if (!active || this.payload.length >= this.maxPayload) return 0
    let collected = 0
    for (let i = 0; i < this.rocks.length && this.payload.length < this.maxPayload; i++) {
      const rock = this.rocks[i]
      if (rock.state !== 'free') continue
      const p = rock.physical.body.translation()
      const horizDist = Math.hypot(p.x - bucketPosition.x, p.z - bucketPosition.z)
      const vertDist = Math.abs(p.y - bucketPosition.y)
      if (horizDist > 2.15 || vertDist > 1.95) continue

      rock.state = 'bucket'
      rock.bucketRef = bucketObject3D
      const slot = this.payload.length
      rock.localOffset.set(
        0.16 + (slot % 3) * 0.13,
        -0.32 + Math.floor(slot / 3) * 0.14,
        ((slot % 2) - 0.5) * 0.24
      )
      rock.physical.body.setEnabled(false)
      this.payload.push(i)
      collected++
    }
    return collected
  }

  /**
   * Releases attached dirt chunks from the Excavator bucket back into physics/gravity
   * (or attaches them into the Dump Truck bed if dumped near/over the Dump Truck).
   */
  unload(bucketPosition, bucketTilt, truckBedWorldPos, truckBedObject3D = null) {
    if (!this.payload.length || bucketTilt < 0.34) return { dropped: 0, delivered: 0 }
    const distToTruck = truckBedWorldPos ? bucketPosition.distanceTo(truckBedWorldPos) : Infinity
    const loadIntoTruck = distToTruck < 4.6 && truckBedObject3D

    let delivered = 0
    const cargo = this.payload.splice(0)
    for (const index of cargo) {
      const rock = this.rocks[index]
      rock.bucketRef = null

      if (loadIntoTruck && this.truckCargoCount < 16) {
        this.attachRockToTruck(rock, truckBedObject3D)
        delivered++
      } else {
        rock.state = 'free'
        const body = rock.physical.body
        const dropX = bucketPosition.x + (Math.random() - 0.5) * 0.65
        const dropY = Math.max(0.85, bucketPosition.y - 0.15)
        const dropZ = bucketPosition.z + (Math.random() - 0.5) * 0.65
        body.setTranslation({ x: dropX, y: dropY, z: dropZ }, true)
        body.setLinvel({ x: (Math.random() - 0.5) * 1.6, y: -0.8, z: (Math.random() - 0.5) * 1.6 }, true)
        body.setEnabled(true)
        body.wakeUp()
      }
    }
    return { dropped: cargo.length - delivered, delivered }
  }

  attachRockToTruck(rock, truckBedObject3D) {
    rock.state = 'truck'
    rock.truckBedRef = truckBedObject3D
    const slot = this.truckCargoCount
    rock.localOffset.set(
      -0.75 + (slot % 4) * 0.34,
      0.34 + Math.floor(slot / 8) * 0.24,
      (Math.floor((slot % 8) / 4) - 0.5) * 0.46
    )
    rock.physical.body.setEnabled(false)
    this.truckCargoCount++
  }

  /**
   * Dumps all dirt chunks carried inside the Dump Truck bed out the back into live physics & gravity!
   */
  dumpTruckLoad(truckWorldPos, truckForward) {
    let dumped = 0
    const backDir = truckForward ? truckForward.clone().multiplyScalar(-1) : new THREE.Vector3(-1, 0, 0)
    for (const rock of this.rocks) {
      if (rock.state !== 'truck') continue
      rock.state = 'free'
      rock.truckBedRef = null
      const body = rock.physical.body
      const spawnX = truckWorldPos.x + backDir.x * (1.8 + Math.random() * 0.8) + (Math.random() - 0.5) * 0.7
      const spawnY = 1.35 + (dumped % 4) * 0.22
      const spawnZ = truckWorldPos.z + backDir.z * (1.8 + Math.random() * 0.8) + (Math.random() - 0.5) * 0.7
      body.setTranslation({ x: spawnX, y: spawnY, z: spawnZ }, true)
      body.setLinvel(
        {
          x: backDir.x * (2.2 + Math.random() * 1.5),
          y: 0.9 + Math.random() * 1.1,
          z: backDir.z * (2.2 + Math.random() * 1.5)
        },
        true
      )
      body.setEnabled(true)
      body.wakeUp()
      dumped++
    }
    this.truckCargoCount = 0
    if (dumped > 0) {
      const burstPos = truckWorldPos.clone().addScaledVector(backDir, 1.8)
      this.game.particles?.emit(burstPos, 16, 1.4)
    }
    return dumped
  }

  /**
   * Bulldozer front blade pushing: wakes and pushes dirt chunks, wooden crates, barrels, and cones
   */
  pushWithBlade(bladeWorldPos, forwardDir, speed) {
    const pushRadius = 1.95
    const pushStrength = Math.min(3.4, Math.max(0.9, Math.abs(speed) * 0.42))

    // 1. Push free dirt/gravel chunks
    for (const rock of this.rocks) {
      if (rock.state !== 'free') continue
      const body = rock.physical.body
      const p = body.translation()
      const dx = p.x - bladeWorldPos.x
      const dz = p.z - bladeWorldPos.z
      const dist = Math.hypot(dx, dz)
      if (dist < pushRadius && Math.abs(p.y - bladeWorldPos.y) < 1.25) {
        body.wakeUp()
        body.applyImpulse(
          {
            x: (forwardDir.x * 0.8 + (dx / Math.max(0.1, dist)) * 0.35) * pushStrength * 0.42,
            y: 0.14 * pushStrength,
            z: (forwardDir.z * 0.8 + (dz / Math.max(0.1, dist)) * 0.35) * pushStrength * 0.42
          },
          true
        )
      }
    }

    // 2. Push dynamic crates, barrels, and cones
    for (const phys of this.pushableProps) {
      if (!phys?.body) continue
      const p = phys.body.translation()
      const dx = p.x - bladeWorldPos.x
      const dz = p.z - bladeWorldPos.z
      const dist = Math.hypot(dx, dz)
      if (dist < pushRadius && Math.abs(p.y - bladeWorldPos.y) < 1.35) {
        phys.body.wakeUp()
        phys.body.applyImpulse(
          {
            x: (forwardDir.x * 0.85 + (dx / Math.max(0.1, dist)) * 0.25) * pushStrength * 0.36,
            y: 0.1 * pushStrength,
            z: (forwardDir.z * 0.85 + (dz / Math.max(0.1, dist)) * 0.25) * pushStrength * 0.36
          },
          true
        )
      }
    }
  }

  update() {
    const t = this.game.ticker.elapsed
    if (this.crane) {
      this.crane.pivot.rotation.y = Math.sin(t * 0.22) * 0.55
    }

    const worldPos = new THREE.Vector3()
    const worldQuat = new THREE.Quaternion()

    for (let i = 0; i < this.rocks.length; i++) {
      const rock = this.rocks[i]

      if (rock.state === 'bucket' && rock.bucketRef) {
        // Visibly ride inside the Excavator's moving 3D bucket!
        worldPos.copy(rock.localOffset)
        rock.bucketRef.localToWorld(worldPos)
        rock.bucketRef.getWorldQuaternion(worldQuat)
        this.temp.position.copy(worldPos)
        this.temp.quaternion.copy(worldQuat)
        this.temp.scale.copy(rock.scale).multiplyScalar(0.68)
      } else if (rock.state === 'truck' && rock.truckBedRef) {
        // Visibly ride inside the Dump Truck's 3D bed!
        worldPos.copy(rock.localOffset)
        rock.truckBedRef.localToWorld(worldPos)
        rock.truckBedRef.getWorldQuaternion(worldQuat)
        this.temp.position.copy(worldPos)
        this.temp.quaternion.copy(worldQuat)
        this.temp.scale.copy(rock.scale).multiplyScalar(0.75)
      } else {
        const p = rock.physical.body.translation()
        const q = rock.physical.body.rotation()
        this.temp.position.set(p.x, p.y, p.z)
        this.temp.quaternion.set(q.x, q.y, q.z, q.w)
        this.temp.scale.copy(rock.scale)
      }

      this.temp.updateMatrix()
      this.rockInstances.setMatrixAt(i, this.temp.matrix)
    }

    this.rockInstances.instanceMatrix.needsUpdate = true
  }
}
