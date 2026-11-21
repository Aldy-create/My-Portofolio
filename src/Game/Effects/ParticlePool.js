import * as THREE from 'three/webgpu'

export class ParticlePool {
  constructor(game, capacity = 72) {
    this.game = game
    this.capacity = capacity
    this.cursor = 0
    this.items = Array.from({ length: capacity }, () => ({ age: 2, life: 1, velocity: new THREE.Vector3(), size: 0 }))
    this.mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.1, 6, 5), new THREE.MeshStandardMaterial({ color: '#b99b79', transparent: true, opacity: 0.42, roughness: 1, depthWrite: false }), capacity)
    this.mesh.frustumCulled = false
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.temp = new THREE.Object3D()
    this.game.scene.add(this.mesh)
    this.game.ticker.events.on('tick', () => this.update(), 17)
  }
  emit(position, count = 3, strength = 1) {
    for (let i = 0; i < count; i++) {
      const p = this.items[this.cursor]
      this.cursor = (this.cursor + 1) % this.capacity
      p.position = position.clone().add(new THREE.Vector3((Math.random() - .5) * .5, Math.random() * .35, (Math.random() - .5) * .5))
      p.velocity.set((Math.random() - .5) * strength, .25 + Math.random() * .8, (Math.random() - .5) * strength)
      p.age = 0; p.life = .55 + Math.random() * .7; p.size = .35 + Math.random() * .55
    }
  }
  update() {
    const dt = Math.min(this.game.ticker.deltaScaled, .05)
    for (let i = 0; i < this.items.length; i++) {
      const p = this.items[i]
      p.age += dt
      if (p.age < p.life) {
        p.position.addScaledVector(p.velocity, dt)
        p.velocity.y += .22 * dt
        const f = (1 - p.age / p.life) * p.size
        this.temp.position.copy(p.position); this.temp.scale.setScalar(f); this.temp.updateMatrix()
        this.mesh.setMatrixAt(i, this.temp.matrix)
      } else {
        this.temp.position.set(0, -100, 0); this.temp.scale.setScalar(0); this.temp.updateMatrix(); this.mesh.setMatrixAt(i, this.temp.matrix)
      }
    }
    this.mesh.instanceMatrix.needsUpdate = true
  }
}
