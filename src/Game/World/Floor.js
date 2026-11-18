import * as THREE from 'three/webgpu'
import { Game } from '../Game.js'
import { color, Fn, min, mix, positionLocal, positionWorld, texture, uniform, uv, vec3 } from 'three/tsl'
import { MeshDefaultMaterial } from '../Materials/MeshDefaultMaterial.js'

export class Floor
{
    constructor()
    {
        this.game = Game.getInstance()

        this.setVisual()
        this.setPhysical()

        this.game.ticker.events.on('tick', () =>
        {
            this.update()
        }, 10)
    }

    setVisual()
    {
        this.size = Math.round(this.game.view.optimalArea.radius * 2) + 4
        this.halfSize = this.size * 0.5
        this.cellSize = 1.5
        this.subdivisions = Math.round(this.size / this.cellSize)

        let geometry = new THREE.PlaneGeometry(this.size, this.size, this.subdivisions, this.subdivisions)
        geometry.rotateX(-Math.PI * 0.5)
        geometry.deleteAttribute('normal')

        const terrainData = this.game.terrain.terrainNode(positionWorld.xz)
        const slabHighColor = uniform(color('#ffcf8b'))
        const slabLowColor = uniform(color('#a87762'))
        const slabTextureFrequency = uniform(0.175)
        const slabNoiseFrequency = uniform(0.03)

        const colorNode = Fn(() =>
        {
            const baseColor = this.game.terrain.colorNode(terrainData)

            const slabTerrain = terrainData.r
            const slabNoiseUv = positionWorld.xz.mul(slabNoiseFrequency)
            const slabNoise = texture(this.game.noises.perlin, slabNoiseUv).r.mul(0.55).add(0.45)
            const slabsTexture = texture(this.game.terrain.slabsTexture, positionWorld.xz.mul(slabTextureFrequency)).r
            const slabColor = mix(slabLowColor, slabHighColor, slabsTexture)

            const slab = slabTerrain.mul(slabNoise)
            return mix(baseColor, slabColor, slab)
        })()

        const material = new MeshDefaultMaterial({
            colorNode: colorNode,
            normalNode: vec3(0, 1, 0),
            shadowNode: terrainData.g,
            hasWater: false,
            hasLightBounce: false,
            wireframe: false
        })

        material.positionNode = Fn(() =>
        {
            const uvDim = min(min(uv().x, uv().y).mul(20), 1)
            const newPosition = positionLocal.toVar()
            newPosition.y.addAssign(terrainData.b.sub(0.08).max(0).mul(-1.4).mul(uvDim))
            return newPosition
        })()

        this.mesh = new THREE.Mesh(geometry, material)
        this.mesh.receiveShadow = true
        this.game.scene.add(this.mesh)

        this.game.viewport.events.on('throttleChange', () =>
        {
            this.size = Math.round(this.game.view.optimalArea.radius * 2) + 4
            this.halfSize = this.size * 0.5
            this.subdivisions = Math.round(this.size / this.cellSize)

            geometry.dispose()
            geometry = new THREE.PlaneGeometry(this.size, this.size, this.subdivisions, this.subdivisions)
            geometry.rotateX(-Math.PI * 0.5)
            geometry.deleteAttribute('normal')

            this.mesh.geometry = geometry
        }, 2)
    }

    setPhysical()
    {
        const object = this.game.objects.add(
            null,
            {
                type: 'fixed',
                friction: 0.25,
                restitution: 0.05,
                colliders: [
                    { shape: 'cuboid', parameters: [ 120, 1, 120 ], position: { x: 0, y: -1.0, z: 0 }, category: 'floor' }
                ]
            }
        )
        this.physical = object.physical
    }

    update()
    {
        this.mesh.position.x = Math.round(this.game.view.optimalArea.position.x / this.cellSize) * this.cellSize
        this.mesh.position.z = Math.round(this.game.view.optimalArea.position.z / this.cellSize) * this.cellSize
    }
}
