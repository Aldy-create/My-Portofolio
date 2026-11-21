import * as THREE from 'three/webgpu'

export class ConstructionSite {
  constructor(game) {
    this.game = game
    this.center = new THREE.Vector3(15, 0, 8)
    this.rocks = []
    this.payload = []
    this.truckCargo = 0
    this.maxPayload = 10
    this.temp = new THREE.Object3D()
    this.stoneMaterial = new THREE.MeshStandardMaterial({ color: '#8e7961', roughness: 1 })
    this.yellow = new THREE.MeshStandardMaterial({ color: '#e9a828', roughness: 0.55, metalness: 0.18 })
    this.dark = new THREE.MeshStandardMaterial({ color: '#33333a', roughness: 0.8 })
    this.buildSite()
    this.buildDebris()
    this.game.ticker.events.on('tick', () => this.update(), 16)
  }

  box(parent, size, position, material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material)
    mesh.position.set(...position)
    mesh.castShadow = true
    mesh.receiveShadow = true
    parent.add(mesh)
    return mesh
  }

  buildSite() {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 128
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#6b6256'
    ctx.fillRect(0, 0, 128, 128)
    for (let i = 0; i < 850; i++) {
      const s = 65 + Math.random() * 75
      ctx.fillStyle = `rgba(${s},${s * 0.91},${s * 0.78},${Math.random() * 0.28})`
      ctx.fillRect(Math.random() * 128, Math.random() * 128, 1 + Math.random() * 2, 1 + Math.random() * 2)
    }
    const texture = new THREE.CanvasTexture(canvas)
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(4, 3)
    const ground = new THREE.Mesh(new THREE.BoxGeometry(14, 0.16, 11), new THREE.MeshStandardMaterial({ map: texture, color: '#a58b68', roughness: 0.96 }))
    ground.position.set(15, -0.06, 8)
    ground.receiveShadow = true
    this.game.scene.add(ground)
    this.game.objects.add(null, { type: 'fixed', position: this.center, colliders: [{ shape: 'cuboid', parameters: [7, 0.1, 5.5], category: 'floor' }] })

    for (let i = 0; i < 7; i++) {
      const group = new THREE.Group()
      group.position.set(9.3 + i * 0.95, 0, 13.5)
      this.box(group, [0.9, 0.68, 0.9], [0, 0.34, 0], i % 2 ? this.yellow : this.dark)
      this.box(group, [0.92, 0.12, 0.12], [0, 0.34, 0.47], this.yellow)
      this.game.scene.add(group)
    }
    const container = new THREE.Group()
    container.position.set(20.3, 0, 11.8)
    const blue = new THREE.MeshStandardMaterial({ color: '#435a67', roughness: 0.75, metalness: 0.32 })
    this.box(container, [3.2, 2.2, 1.8], [0, 1.1, 0], blue)
    for (let x = -1.35; x < 1.4; x += 0.45) this.box(container, [0.045, 2.05, 1.86], [x, 1.1, 0], this.dark)
    this.game.scene.add(container)
    this.buildCrane()
  }

  buildCrane() {
    const crane = new THREE.Group()
    crane.position.set(24, 0, -1)
    const steel = new THREE.MeshStandardMaterial({ color: '#d8a837', metalness: 0.3, roughness: 0.62 })
    this.box(crane, [0.38, 12, 0.38], [0, 6, 0], steel)
    const pivot = new THREE.Group()
    pivot.position.set(0, 11.6, 0)
    crane.add(pivot)
    this.box(pivot, [10, 0.38, 0.45], [4.4, 0, 0], steel)
    for (const x of [1, 7.8]) this.box(pivot, [0.12, 2.7, 0.12], [x, -1.35, 0], steel)
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.8, 6), this.dark)
    cable.position.set(7.8, -1.7, 0)
    pivot.add(cable)
    this.box(pivot, [0.42, 0.28, 0.36], [7.8, -3.15, 0], this.yellow)
    this.game.scene.add(crane)
    this.crane = { group: crane, pivot }

    const turbine = new THREE.Group()
    turbine.position.set(29, 0, 13)
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.32, 10, 10), steel)
    pole.position.y = 5
    turbine.add(pole)
    this.turbineRotor = new THREE.Group()
    this.turbineRotor.position.y = 10
    turbine.add(this.turbineRotor)
    this.turbineRotor.add(new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), this.yellow))
    for (let i = 0; i < 3; i++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.2, 4.8, 0.28), steel)
      blade.position.y = 2.35
      const arm = new THREE.Group()
      arm.rotation.z = i * Math.PI * 2 / 3
      arm.add(blade)
      this.turbineRotor.add(arm)
    }
    this.game.scene.add(turbine)
  }

  buildDebris() {
    this.rockInstances = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.42, 0), this.stoneMaterial, 28)
    this.rockInstances.castShadow = true
    this.rockInstances.receiveShadow = true
    this.rockInstances.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.game.scene.add(this.rockInstances)
    const rand = (a, b) => a + Math.random() * (b - a)
    for (let i = 0; i < 28; i++) {
      const scale = new THREE.Vector3(rand(0.6, 1.25), rand(0.55, 1.15), rand(0.6, 1.25))
      const physical = this.game.physics.getPhysical({
        type: 'dynamic', position: new THREE.Vector3(12.3 + rand(-1.3, 2.8), 0.45 + (i % 3) * 0.4, 7.8 + rand(-2.2, 1.8)),
        sleeping: true, mass: 0.55, friction: 0.9, restitution: 0.06,
        colliders: [{ shape: 'ball', parameters: [0.38 * Math.max(scale.x, scale.y, scale.z)], category: 'object' }]
      })
      this.rocks.push({ physical, scale, loaded: false, stored: false })
    }
  }

  scoop(bucketPosition, active) {
    if (!active || this.payload.length >= this.maxPayload) return 0
    let collected = 0
    for (let i = 0; i < this.rocks.length && this.payload.length < this.maxPayload; i++) {
      const rock = this.rocks[i]
      if (rock.loaded || rock.stored) continue
      const p = rock.physical.body.translation()
      if (Math.hypot(p.x - bucketPosition.x, p.z - bucketPosition.z) > 1.45 || Math.abs(p.y - bucketPosition.y) > 2.1) continue
      rock.loaded = true
      rock.physical.body.setEnabled(false)
      this.payload.push(i)
      collected++
    }
    return collected
  }

  unload(bucketPosition, bucketTilt, truckPosition, truckBedRaised) {
    if (!this.payload.length || bucketTilt < 0.42) return { dropped: 0, delivered: 0 }
    const atTruck = truckPosition && truckBedRaised && bucketPosition.distanceTo(truckPosition) < 5
    let delivered = 0
    const cargo = this.payload.splice(0)
    for (const index of cargo) {
      const rock = this.rocks[index]
      rock.loaded = false
      if (atTruck && this.truckCargo < 12) {
        rock.stored = true
        this.truckCargo++
        delivered++
      } else {
        const body = rock.physical.body
        body.setTranslation({ x: bucketPosition.x + (Math.random() - 0.5) * 0.8, y: Math.max(0.8, bucketPosition.y), z: bucketPosition.z + (Math.random() - 0.5) * 0.8 }, true)
        body.setEnabled(true)
        body.wakeUp()
        body.applyImpulse({ x: (Math.random() - 0.5) * 1.4, y: 1.4 + Math.random() * 1.4, z: (Math.random() - 0.5) * 1.4 }, true)
      }
    }
    return { dropped: cargo.length - delivered, delivered }
  }

  update() {
    const t = this.game.ticker.elapsed
    this.crane.pivot.rotation.y = Math.sin(t * 0.18) * 0.12
    this.crane.group.rotation.y = Math.sin(t * 0.08) * 0.08
    this.turbineRotor.rotation.z += this.game.ticker.deltaScaled * 0.48
    for (let i = 0; i < this.rocks.length; i++) {
      const rock = this.rocks[i]
      if (rock.loaded || rock.stored) {
        this.temp.position.set(0, -100, 0)
        this.temp.scale.setScalar(0)
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
