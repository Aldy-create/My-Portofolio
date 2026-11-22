import * as THREE from 'three/webgpu'

export class AmbientWorld {
  constructor(game) {
    this.game = game
    this.clock = 0
    this.cars = []
    this.drones = []
    this.windTurbines = []
    this.dustMotes = []

    this.buildRoadNetworkAndSignage()
    this.buildVegetation()
    this.buildStreetFurnitureAndRocks()
    this.buildWindTurbines()
    this.buildTraffic()
    this.buildDrones()
    this.buildFloatingDust()

    this.game.ticker.events.on('tick', () => this.update(), 15)
  }

  addFixedCollider(x, z, shape, parameters, yOffset = 1.0, rotY = 0) {
    const quat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY)
    this.game.objects.add(null, {
      type: 'fixed',
      position: new THREE.Vector3(x, 0, z),
      rotation: quat,
      colliders: [{ shape, parameters, position: { x: 0, y: yOffset, z: 0 } }]
    })
  }

  box(parent, size, pos, material, rot = null) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(...size), material)
    m.position.set(...pos)
    if (rot) m.rotation.set(...rot)
    m.castShadow = true
    m.receiveShadow = true
    parent.add(m)
    return m
  }

  /**
   * Phase 3.1: Crisp white dashed lane markings, crosswalks, curbs, and 3D directional signposts
   */
  buildRoadNetworkAndSignage() {
    const roadGroup = new THREE.Group()
    const lineMat = new THREE.MeshBasicMaterial({ color: '#e2e8f0' })
    const yellowLineMat = new THREE.MeshBasicMaterial({ color: '#f59e0b' })
    const curbMat = new THREE.MeshStandardMaterial({ color: '#646b7d', roughness: 0.85 })

    // Collect dashed center-line transforms into one InstancedMesh for 60 FPS performance
    const dashTransforms = []
    const pushDash = (x, z, rotY = 0) => {
      const dummy = new THREE.Object3D()
      dummy.position.set(x, 0.022, z)
      dummy.rotation.y = rotY
      dummy.updateMatrix()
      dashTransforms.push(dummy.matrix.clone())
    }

    // 1. Main North-South Avenue dashes (x = 0)
    for (let z = -16; z <= 29; z += 3.2) {
      if (Math.abs(z) < 4.5 || Math.abs(z + 10) < 3.0 || Math.abs(z - 4) < 3.0) continue
      pushDash(0, z, Math.PI * 0.5)
    }

    // 2. North East-West Avenue dashes (z = -10)
    for (let x = -29; x <= 29; x += 3.2) {
      if (Math.abs(x) < 4.0 || Math.abs(x + 15) < 4.5 || Math.abs(x - 14) < 4.5) continue
      pushDash(x, -10, 0)
    }

    // 3. Mid East-West Avenue dashes (z = 4)
    for (let x = -29; x <= 29; x += 3.2) {
      if (Math.abs(x) < 4.0 || Math.abs(x + 20) < 4.5 || Math.abs(x - 20) < 4.5) continue
      pushDash(x, 4, 0)
    }

    // 4. Outer Asphalt Ring Road dashes (|x| = 32, |z| = 32)
    for (let v = -28; v <= 28; v += 3.5) {
      pushDash(v, -32, 0)
      pushDash(v, 32, 0)
      pushDash(-32, v, Math.PI * 0.5)
      pushDash(32, v, Math.PI * 0.5)
    }

    const dashInst = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1.45, 0.015, 0.14),
      lineMat,
      dashTransforms.length
    )
    for (let i = 0; i < dashTransforms.length; i++) {
      dashInst.setMatrixAt(i, dashTransforms[i])
    }
    dashInst.instanceMatrix.needsUpdate = true
    roadGroup.add(dashInst)

    // Zebra Crosswalks at key intersections
    const addCrosswalk = (cx, cz, vertical = false) => {
      for (let i = -2; i <= 2; i++) {
        const stripe = new THREE.Mesh(
          new THREE.BoxGeometry(vertical ? 0.32 : 1.7, 0.018, vertical ? 1.7 : 0.32),
          i === 0 ? yellowLineMat : lineMat
        )
        stripe.position.set(
          cx + (vertical ? i * 0.65 : 0),
          0.022,
          cz + (vertical ? 0 : i * 0.65)
        )
        roadGroup.add(stripe)
      }
    }
    addCrosswalk(0, -6.8, true)
    addCrosswalk(0, 0.8, true)
    addCrosswalk(-3.6, -10, false)
    addCrosswalk(3.6, -10, false)
    addCrosswalk(-3.6, 4, false)
    addCrosswalk(3.6, 4, false)

    // Raised Sidewalk Curbs along the central avenues (decorative low curbs, flush for driving, plus corner bollards)
    const curbSpecs = [
      [-3.1, -14.5, 0.28, 5.2],
      [3.1, -14.5, 0.28, 5.2],
      [-7.5, -7.1, 6.2, 0.28],
      [7.5, -7.1, 5.8, 0.28],
      [-7.5, 1.2, 6.2, 0.28],
      [5.8, 1.2, 4.2, 0.28]
    ]
    for (const [cx, cz, w, d] of curbSpecs) {
      const curb = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, d), curbMat)
      curb.position.set(cx, 0.06, cz)
      curb.receiveShadow = true
      roadGroup.add(curb)
    }

    this.game.scene.add(roadGroup)

    // 3D Directional Signposts with Solid Physics Colliders
    this.buildDirectionalSignpost(4.2, -1.8, [
      { text: 'PROJECTS →', color: '#41e8ff' },
      { text: 'EDUCATION ↑', color: '#ff8a4c' },
      { text: 'CONSTRUCTION ←', color: '#facc15' }
    ])
    this.buildDirectionalSignpost(-4.2, 1.4, [
      { text: '← AI / ML & ROBOTICS', color: '#c084fc' },
      { text: 'FLEET GARAGE ↓', color: '#41e8ff' },
      { text: 'RING ROAD →', color: '#f1f5f9' }
    ])
    this.buildDirectionalSignpost(7.4, 6.8, [
      { text: 'EXCAVATOR PIT →', color: '#facc15' },
      { text: '↑ ACADEMIC VAULT', color: '#ff3b5c' }
    ])
  }

  buildDirectionalSignpost(x, z, signs) {
    const group = new THREE.Group()
    group.position.set(x, 0, z)

    const postMat = new THREE.MeshStandardMaterial({ color: '#2b2f3c', metalness: 0.5, roughness: 0.45 })
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 2.9, 10), postMat)
    pole.position.y = 1.45
    pole.castShadow = true
    group.add(pole)

    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 10), postMat)
    cap.position.y = 2.95
    group.add(cap)

    signs.forEach((item, idx) => {
      const canvas = document.createElement('canvas')
      canvas.width = 384
      canvas.height = 84
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#161923'
      ctx.fillRect(0, 0, 384, 84)
      ctx.strokeStyle = item.color
      ctx.lineWidth = 6
      ctx.strokeRect(6, 6, 372, 72)
      ctx.fillStyle = '#ffffff'
      ctx.font = '800 30px "Space Grotesk", system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(item.text, 192, 44)

      const tex = new THREE.CanvasTexture(canvas)
      tex.colorSpace = THREE.SRGBColorSpace
      const board = new THREE.Mesh(
        new THREE.BoxGeometry(1.75, 0.36, 0.08),
        new THREE.MeshBasicMaterial({ map: tex })
      )
      board.position.set(0, 2.58 - idx * 0.44, 0)
      board.rotation.y = (idx - 1) * 0.18
      board.castShadow = true
      group.add(board)
    })

    this.game.scene.add(group)
    this.addFixedCollider(x, z, 'cylinder', [1.45, 0.16], 1.45)
  }

  /**
   * Phase 1.2 & 3.2: Varied Tree Clusters (Round Foliage Trees + Layered Conical Pine Trees)
   * strictly outside roads/plazas/garage/pit, ALL with solid Rapier cylinder colliders.
   */
  isClearForScenery(x, z) {
    // Keep away from roads
    if (Math.abs(x) < 4.5 && z > -22 && z < 35) return false
    if (Math.abs(z + 10) < 4.4 && Math.abs(x) < 35) return false
    if (Math.abs(z - 4) < 4.4 && Math.abs(x) < 35) return false
    if (Math.abs(Math.abs(x) - 32) < 4.8 && Math.abs(z) < 36) return false
    if (Math.abs(Math.abs(z) - 32) < 4.8 && Math.abs(x) < 36) return false

    // Keep away from Spawn Plaza & Contact Pads
    if (Math.hypot(x, z + 2) < 8.5) return false

    // Keep away from Garage Pad (-26..-3, 9.5..26.5)
    if (x > -26.5 && x < -2.5 && z > 9.5 && z < 26.8) return false

    // Keep away from Construction Pit & Staging (7..27, 0..18.5)
    if (x > 7.0 && x < 27.5 && z > 0.0 && z < 18.8) return false

    // Keep away from Stunt Park (-6..6, 6..25)
    if (Math.abs(x) < 6.8 && z > 6.0 && z < 25.5) return false

    // Keep away from the 5 Portfolio Landmarks & Pond
    const forbiddenCenters = [
      [-15, -10, 7.2],
      [14, -10, 7.2],
      [0, -19, 7.2],
      [-20, 4, 7.2],
      [24, -5, 7.2],
      [-24, -22, 6.8]
    ]
    for (const [cx, cz, r] of forbiddenCenters) {
      if (Math.hypot(x - cx, z - cz) < r) return false
    }
    return true
  }

  buildVegetation() {
    // 1. Round Foliage Trees
    const roundCandidates = [
      [-9, -16], [9, -16], [-23, -15], [23, -15],
      [-10, -4], [8, -4], [-25, -4], [26, -6],
      [-26, 9], [-27, 27], [11, 23], [19, 23],
      [26, 22], [-9, 27], [9, 27], [-24, -28],
      [24, -26], [-14, -25], [15, -24], [27, -18],
      [-37, -14], [37, -14], [-37, 12], [37, 12]
    ].filter(([x, z]) => this.isClearForScenery(x, z))

    const trunkMat = new THREE.MeshStandardMaterial({ color: '#654f3a', roughness: 0.95 })
    const crownMat = new THREE.MeshStandardMaterial({ color: '#4d8449', roughness: 0.88 })
    const roundTrunk = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.18, 0.25, 1.9, 7),
      trunkMat,
      roundCandidates.length
    )
    const roundCrown = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1.18, 1),
      crownMat,
      roundCandidates.length
    )

    const dummy = new THREE.Object3D()
    roundCandidates.forEach(([x, z], i) => {
      const s = 0.85 + (i % 4) * 0.14
      dummy.position.set(x, 0.95 * s, z)
      dummy.scale.setScalar(s)
      dummy.rotation.set(0, i * 1.1, 0)
      dummy.updateMatrix()
      roundTrunk.setMatrixAt(i, dummy.matrix)

      dummy.position.set(x, 2.55 * s, z)
      dummy.scale.set(1.15 * s, 1.3 * s, 1.15 * s)
      dummy.rotation.set((i % 3) * 0.05, i * 1.7, 0)
      dummy.updateMatrix()
      roundCrown.setMatrixAt(i, dummy.matrix)

      this.addFixedCollider(x, z, 'cylinder', [1.35 * s, 0.32 * s], 1.35 * s)
    })
    roundTrunk.castShadow = roundCrown.castShadow = true
    roundTrunk.receiveShadow = roundCrown.receiveShadow = true
    this.game.scene.add(roundTrunk, roundCrown)

    // 2. Layered Conical Pine Trees
    const pineCandidates = [
      [-18, -19], [-12, -22], [12, -21], [19, -20],
      [-26, -11], [26, -11], [-27, 0], [27, 0],
      [14, 26], [22, 26], [-19, 28], [-27, 20],
      [-37, -25], [37, -25], [-37, 25], [37, 25],
      [-38, 0], [38, 0]
    ].filter(([x, z]) => this.isClearForScenery(x, z))

    const pineMat = new THREE.MeshStandardMaterial({ color: '#2f6646', roughness: 0.88 })
    for (let i = 0; i < pineCandidates.length; i++) {
      const [px, pz] = pineCandidates[i]
      const s = 0.88 + (i % 3) * 0.16
      const pineGroup = new THREE.Group()
      pineGroup.position.set(px, 0, pz)

      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15 * s, 0.22 * s, 1.2 * s, 7), trunkMat)
      trunk.position.y = 0.6 * s
      trunk.castShadow = true
      pineGroup.add(trunk)

      const c1 = new THREE.Mesh(new THREE.ConeGeometry(1.15 * s, 1.9 * s, 7), pineMat)
      c1.position.y = 1.75 * s
      c1.castShadow = true
      const c2 = new THREE.Mesh(new THREE.ConeGeometry(0.88 * s, 1.65 * s, 7), pineMat)
      c2.position.y = 2.75 * s
      c2.castShadow = true
      const c3 = new THREE.Mesh(new THREE.ConeGeometry(0.58 * s, 1.3 * s, 7), pineMat)
      c3.position.y = 3.6 * s
      c3.castShadow = true
      pineGroup.add(c1, c2, c3)

      this.game.scene.add(pineGroup)
      this.addFixedCollider(px, pz, 'cylinder', [1.6 * s, 0.36 * s], 1.6 * s)
    }
  }

  /**
   * Street lamps, park benches, and low-poly rocks — ALL with solid physics colliders
   */
  buildStreetFurnitureAndRocks() {
    // 1. Warm Glowing Street Lamps along outer avenues
    const poleMat = new THREE.MeshStandardMaterial({ color: '#2b2d3a', metalness: 0.5, roughness: 0.5 })
    const bulbMat = new THREE.MeshBasicMaterial({ color: '#ffbe73' })
    const lampCoords = [
      [-10, -7], [10, -7],
      [-10, 7], [6, 7],
      [-26, -7], [26, -7],
      [-3.5, 10.5], [3.5, 10.5]
    ]
    for (const [lx, lz] of lampCoords) {
      const lamp = new THREE.Group()
      lamp.position.set(lx, 0, lz)
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 3.4, 8), poleMat)
      pole.position.y = 1.7
      pole.castShadow = true
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.08, 0.08), poleMat)
      arm.position.set(0.22, 3.38, 0)
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 10), bulbMat)
      bulb.position.set(0.45, 3.26, 0)
      lamp.add(pole, arm, bulb)
      this.game.scene.add(lamp)
      this.addFixedCollider(lx, lz, 'cylinder', [1.7, 0.16], 1.7)
    }

    // 2. Park Benches with Solid Cuboid Colliders
    const woodMat = new THREE.MeshStandardMaterial({ color: '#9c663b', roughness: 0.85 })
    const benchSpecs = [
      [-5.6, -5.2, Math.PI * 0.25],
      [5.6, -5.2, -Math.PI * 0.25],
      [-11.5, -13.2, 0],
      [10.5, -13.2, 0],
      [-15.5, 8.2, 0]
    ]
    for (const [bx, bz, rotY] of benchSpecs) {
      const bench = new THREE.Group()
      bench.position.set(bx, 0, bz)
      bench.rotation.y = rotY
      this.box(bench, [1.65, 0.1, 0.52], [0, 0.44, 0], woodMat)
      this.box(bench, [1.65, 0.42, 0.09], [0, 0.68, -0.22], woodMat)
      this.box(bench, [0.12, 0.44, 0.48], [-0.68, 0.22, 0], poleMat)
      this.box(bench, [0.12, 0.44, 0.48], [0.68, 0.22, 0], poleMat)
      this.game.scene.add(bench)
      this.addFixedCollider(bx, bz, 'cuboid', [0.85, 0.45, 0.3], 0.45, rotY)
    }

    // 3. Low-Poly Rock Clusters with Solid Colliders
    const rockMat = new THREE.MeshStandardMaterial({ color: '#6e7382', roughness: 0.92 })
    const rockCoords = [
      [-19, -23, 0.95], [-28, -19, 1.15], [22, -23, 1.05],
      [-28, 13, 0.9], [27, 17, 1.1], [15, 21, 0.85],
      [-9, -19, 0.78], [9, -19, 0.82]
    ].filter(([x, z]) => this.isClearForScenery(x, z))

    for (const [rx, rz, scale] of rockCoords) {
      const rockMesh = new THREE.Mesh(new THREE.DodecahedronGeometry(0.68 * scale, 0), rockMat)
      rockMesh.position.set(rx, 0.38 * scale, rz)
      rockMesh.rotation.set(rx * 0.3, rz * 0.5, 0.2)
      rockMesh.castShadow = true
      rockMesh.receiveShadow = true
      this.game.scene.add(rockMesh)
      this.addFixedCollider(rx, rz, 'ball', [0.64 * scale], 0.4 * scale)
    }
  }

  /**
   * Spinning Wind Turbines in the distance with solid tower colliders
   */
  buildWindTurbines() {
    const steel = new THREE.MeshStandardMaterial({ color: '#e2e8f0', metalness: 0.28, roughness: 0.52 })
    const hubMat = new THREE.MeshStandardMaterial({ color: '#f59e0b', roughness: 0.4 })
    const turbineCoords = [
      [35, -24],
      [-36, -25],
      [35, 22]
    ]

    for (const [tx, tz] of turbineCoords) {
      const turbine = new THREE.Group()
      turbine.position.set(tx, 0, tz)
      turbine.rotation.y = Math.atan2(-tx, -tz) * 0.35

      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.42, 11.5, 12), steel)
      pole.position.y = 5.75
      pole.castShadow = true
      turbine.add(pole)

      const rotor = new THREE.Group()
      rotor.position.set(0, 11.4, 0.35)
      turbine.add(rotor)
      rotor.add(new THREE.Mesh(new THREE.SphereGeometry(0.38, 12, 10), hubMat))

      for (let i = 0; i < 3; i++) {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.24, 5.1, 0.14), steel)
        blade.position.y = 2.55
        const arm = new THREE.Group()
        arm.rotation.z = (i * Math.PI * 2) / 3
        arm.add(blade)
        rotor.add(arm)
      }

      this.game.scene.add(turbine)
      this.windTurbines.push(rotor)
      this.addFixedCollider(tx, tz, 'cylinder', [2.5, 0.45], 2.5)
    }
  }

  /**
   * Phase 1.3: Full-Scale Realistic NPC Cars (matching player vehicle proportions),
   * 3 cars max on the outer ring road (|x|=32, |z|=32), with kinematic physics colliders
   * and forward raycast/cone braking before hitting the player or another vehicle.
   */
  makeCar(hex) {
    const g = new THREE.Group()
    const paint = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.32, metalness: 0.28 })
    const dark = new THREE.MeshStandardMaterial({ color: '#1b1d24', roughness: 0.85 })
    const glass = new THREE.MeshStandardMaterial({ color: '#7ea3ba', roughness: 0.22, metalness: 0.1 })
    const headMat = new THREE.MeshBasicMaterial({ color: '#fff3c4' })
    const brakeOffMat = new THREE.MeshBasicMaterial({ color: '#6e1423' })
    const brakeOnMat = new THREE.MeshBasicMaterial({ color: '#ff2a4b' })

    // Realistic full-size proportions matching Player Buggy & Fleet cars (~2.62m x 1.52m, wheel radius 0.40m)
    this.box(g, [2.62, 0.52, 1.52], [0, 0.54, 0], paint)
    this.box(g, [1.32, 0.52, 1.32], [-0.14, 1.02, 0], glass)
    this.box(g, [1.24, 0.1, 1.34], [-0.14, 1.3, 0], paint)

    const wheels = []
    const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.28, 14)
    wheelGeo.rotateX(Math.PI / 2)
    for (const x of [-0.9, 0.9]) {
      for (const z of [-0.8, 0.8]) {
        const w = new THREE.Mesh(wheelGeo, dark)
        w.position.set(x, 0.4, z)
        w.castShadow = true
        g.add(w)
        wheels.push(w)
      }
    }

    // Headlights (+X front) & Dynamic Brake Tail Lights (-X rear)
    const brakeLights = []
    for (const z of [-0.52, 0.52]) {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.16, 0.28), headMat)
      hl.position.set(1.32, 0.58, z)
      g.add(hl)

      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.16, 0.3), brakeOffMat)
      tl.position.set(-1.32, 0.6, z)
      g.add(tl)
      brakeLights.push(tl)
    }

    this.game.scene.add(g)
    return { group: g, wheels, brakeLights, brakeOffMat, brakeOnMat }
  }

  buildTraffic() {
    const h = 32
    const pts = [
      [-h, -h], [0, -h], [h, -h], [h, 0],
      [h, h], [0, h], [-h, h], [-h, 0]
    ].map(([x, z]) => new THREE.Vector3(x, 0, z))

    this.route = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.08)
    this.routeLength = this.route.getLength()

    const colors = ['#ef5b4c', '#38bdf8', '#f59e0b']
    for (let i = 0; i < 3; i++) {
      const c = this.makeCar(colors[i])
      c.progress = i / 3
      c.baseSpeed = 6.2 / this.routeLength
      c.speedFactor = 1.0
      c.angle = 0

      // Solid kinematic Rapier collider so player cannot ghost through NPC traffic
      const pt = this.route.getPointAt(c.progress)
      c.physical = this.game.physics.getPhysical({
        type: 'kinematicPositionBased',
        position: new THREE.Vector3(pt.x, 0.72, pt.z),
        colliders: [{ shape: 'cuboid', parameters: [1.32, 0.65, 0.78], category: 'object' }]
      })

      this.cars.push(c)
    }
  }

  /**
   * 2 Autonomous Quadcopter Drones patrolling smoothly overhead
   */
  buildDrones() {
    const shell = new THREE.MeshStandardMaterial({ color: '#2b3340', metalness: 0.65, roughness: 0.3 })
    const rotorCyan = new THREE.MeshBasicMaterial({ color: '#41e8ff' })
    const rotorAmber = new THREE.MeshBasicMaterial({ color: '#ff8a3d' })

    const droneConfigs = [
      { center: new THREE.Vector3(16, 13.5, 9), radius: 9.5, phase: 0, mat: rotorCyan },
      { center: new THREE.Vector3(-14, 14.5, -8), radius: 11.0, phase: Math.PI, mat: rotorAmber }
    ]

    for (const cfg of droneConfigs) {
      const g = new THREE.Group()
      g.add(new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.18, 0.42), shell))
      for (const x of [-0.46, 0.46]) {
        for (const z of [-0.48, 0.48]) {
          const arm = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.04, 0.06), shell)
          arm.position.set(x * 0.5, 0, z * 0.5)
          g.add(arm)
          const r = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.03, 10), cfg.mat)
          r.position.set(x, 0.08, z)
          g.add(r)
        }
      }
      g.position.copy(cfg.center)
      this.game.scene.add(g)
      this.drones.push({ group: g, center: cfg.center, radius: cfg.radius, phase: cfg.phase })
    }
  }

  /**
   * Subtle golden-hour floating dust motes across the world
   */
  buildFloatingDust() {
    const count = 48
    const geo = new THREE.SphereGeometry(0.055, 6, 6)
    const mat = new THREE.MeshBasicMaterial({
      color: '#ffd584',
      transparent: true,
      opacity: 0.52,
      depthWrite: false
    })
    this.dustInst = new THREE.InstancedMesh(geo, mat, count)
    this.dustInst.frustumCulled = false
    this.dustInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage)

    for (let i = 0; i < count; i++) {
      this.dustMotes.push({
        baseX: (Math.random() - 0.5) * 52,
        baseY: 0.7 + Math.random() * 3.8,
        baseZ: (Math.random() - 0.5) * 52,
        phase: Math.random() * Math.PI * 2,
        speed: 0.4 + Math.random() * 0.65
      })
    }
    this.game.scene.add(this.dustInst)
  }

  update() {
    const dt = Math.min(this.game.ticker.deltaScaled, 0.05)
    this.clock += dt
    const playerPos = this.game.player.position

    // 1. Spin distant Wind Turbines
    for (let i = 0; i < this.windTurbines.length; i++) {
      this.windTurbines[i].rotation.z += dt * (0.55 + i * 0.08)
    }

    // 2. NPC Traffic with Forward Raycast/Lookahead Braking & Kinematic Collider Sync
    const carPositions = this.cars.map((c) => this.route.getPointAt(c.progress))
    const carTangents = this.cars.map((c) => this.route.getTangentAt(c.progress))

    for (let i = 0; i < this.cars.length; i++) {
      const c = this.cars[i]
      const pos = carPositions[i]
      const tan = carTangents[i]

      // Forward lookahead points at 3.2m and 6.2m ahead along the car's lane direction
      const look1X = pos.x + tan.x * 3.2
      const look1Z = pos.z + tan.z * 3.2
      const look2X = pos.x + tan.x * 6.2
      const look2Z = pos.z + tan.z * 6.2

      // Check if player vehicle is ahead in the NPC car's forward path
      const toPlayerX = playerPos.x - pos.x
      const toPlayerZ = playerPos.z - pos.z
      const distPlayer = Math.hypot(toPlayerX, toPlayerZ)
      const forwardDot = distPlayer > 0.01 ? (toPlayerX * tan.x + toPlayerZ * tan.z) / distPlayer : 0

      let shouldBrake =
        Math.hypot(look1X - playerPos.x, look1Z - playerPos.z) < 3.8 ||
        Math.hypot(look2X - playerPos.x, look2Z - playerPos.z) < 3.4 ||
        (distPlayer < 7.2 && forwardDot > 0.28)

      // Check against other NPC cars ahead
      if (!shouldBrake) {
        for (let j = 0; j < this.cars.length; j++) {
          if (j === i) continue
          const other = carPositions[j]
          if (
            Math.hypot(look1X - other.x, look1Z - other.z) < 3.6 ||
            Math.hypot(look2X - other.x, look2Z - other.z) < 3.2
          ) {
            shouldBrake = true
            break
          }
        }
      }

      // Smoothly brake to 0.0 before collision, or accelerate smoothly back to 1.0 when clear
      const targetFactor = shouldBrake ? 0.0 : 1.0
      c.speedFactor += (targetFactor - c.speedFactor) * Math.min(1, dt * (shouldBrake ? 9.5 : 3.5))
      if (c.speedFactor < 0.02) c.speedFactor = 0

      // Illuminate red brake lights when braking
      const isBraking = shouldBrake || c.speedFactor < 0.75
      for (const tl of c.brakeLights) {
        tl.material = isBraking ? c.brakeOnMat : c.brakeOffMat
      }

      c.progress = (c.progress + c.baseSpeed * c.speedFactor * dt) % 1
      const pt = this.route.getPointAt(c.progress)
      const nextTan = this.route.getTangentAt(c.progress)

      c.group.position.set(pt.x, 0, pt.z)
      const targetAngle = Math.atan2(-nextTan.z, nextTan.x)
      let delta = targetAngle - c.angle
      delta = Math.atan2(Math.sin(delta), Math.cos(delta))
      c.angle += delta * Math.min(1, dt * 8)
      c.group.rotation.y = c.angle

      // Sync kinematic Rapier physics body to the NPC car
      if (c.physical?.body) {
        c.physical.body.setNextKinematicTranslation({ x: pt.x, y: 0.72, z: pt.z })
        const q = c.group.quaternion
        c.physical.body.setNextKinematicRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
      }

      const spin = dt * 6.5 * c.speedFactor
      for (const w of c.wheels) w.rotation.z -= spin
    }

    // 3. Autonomous Patrol Drones
    for (const d of this.drones) {
      const a = this.clock * 0.24 + d.phase
      d.group.position.set(
        d.center.x + Math.cos(a) * d.radius,
        d.center.y + Math.sin(this.clock * 1.1 + d.phase) * 0.85,
        d.center.z + Math.sin(a) * d.radius
      )
      d.group.rotation.y = -a
    }

    // 4. Golden-hour floating dust motes
    if (this.dustInst) {
      const dummy = new THREE.Object3D()
      for (let i = 0; i < this.dustMotes.length; i++) {
        const m = this.dustMotes[i]
        const t = this.clock * m.speed + m.phase
        dummy.position.set(
          m.baseX + Math.sin(t) * 1.2,
          m.baseY + Math.cos(t * 1.3) * 0.45,
          m.baseZ + Math.cos(t * 0.9) * 1.2
        )
        const pulse = 0.7 + Math.sin(t * 2.1) * 0.3
        dummy.scale.setScalar(pulse)
        dummy.updateMatrix()
        this.dustInst.setMatrixAt(i, dummy.matrix)
      }
      this.dustInst.instanceMatrix.needsUpdate = true
    }
  }
}
