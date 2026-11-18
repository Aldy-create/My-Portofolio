import * as THREE from 'three/webgpu'
import { Game } from './Game.js'
import { color, Fn, mix, texture, uniform, vec2 } from 'three/tsl'

export class Terrain
{
    constructor()
    {
        this.game = Game.getInstance()

        this.subdivision = 128
        this.size = 192

        this.setProceduralTerrainTexture()
        this.setSlabsTexture()
        this.setGradient()
        this.setNodes()

        this.game.ticker.events.on('tick', () =>
        {
            this.update()
        }, 10)
    }

    setProceduralTerrainTexture()
    {
        // Generate 256x256 terrain data map:
        // R = Stone slab mask (roads, central plaza, zone pads)
        // G = Grass density mask (1 on grass, 0 on roads/water)
        // B = Water / dirt gradient depth (0 = dry land, >0.25 = water pond/moat)
        const size = 256
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        const imgData = ctx.createImageData(size, size)
        const data = imgData.data

        const worldSpan = this.subdivision * 1.5 // 192m

        for(let y = 0; y < size; y++)
        {
            for(let x = 0; x < size; x++)
            {
                const u = x / size - 0.5
                const v = y / size - 0.5
                const wx = u * worldSpan
                const wz = v * worldSpan

                const distCenter = Math.hypot(wx, wz)

                // Stone plaza at spawn (0,0) and connecting roads to zones
                const distSpawn = Math.hypot(wx, wz)
                const distProjects = Math.hypot(wx - (-15), wz - (-11))
                const distAbout = Math.hypot(wx - 15, wz - (-11))
                const distSpecs = Math.hypot(wx - 0, wz - (-19))

                let slabMask = 0
                if(distSpawn < 5.5 || distProjects < 6.2 || distAbout < 6.2 || distSpecs < 6.0)
                    slabMask = 1.0

                // Cross-road paths connecting spawn to zones and stunt arena
                if(Math.abs(wx) < 2.4 && wz > -20 && wz < 16)
                    slabMask = Math.max(slabMask, 0.85)
                if(Math.abs(wz + 11) < 2.2 && wx > -16 && wx < 16)
                    slabMask = Math.max(slabMask, 0.85)

                // Water pond at (-18, 16) and outer island shore (> 58m)
                const distPond = Math.hypot(wx - (-18), wz - 16)
                let waterDepth = 0.08
                if(distPond < 7.5)
                {
                    waterDepth = Math.min(0.95, 0.15 + (1 - distPond / 7.5) * 0.8)
                }
                if(distCenter > 56)
                {
                    waterDepth = Math.max(waterDepth, Math.min(0.95, 0.08 + ((distCenter - 56) / 22) * 0.88))
                }

                // Grass mask: lush everywhere except stone roads and deep water
                let grassMask = 1.0 - slabMask * 0.92
                if(waterDepth > 0.18)
                    grassMask *= Math.max(0, 1 - (waterDepth - 0.18) * 3.5)

                const idx = (y * size + x) * 4
                data[idx + 0] = Math.round(Math.max(0, Math.min(1, slabMask)) * 255)
                data[idx + 1] = Math.round(Math.max(0, Math.min(1, grassMask)) * 255)
                data[idx + 2] = Math.round(Math.max(0, Math.min(1, waterDepth)) * 255)
                data[idx + 3] = 255
            }
        }

        ctx.putImageData(imgData, 0, 0)

        this.terrainTexture = new THREE.Texture(canvas)
        this.terrainTexture.flipY = false
        this.terrainTexture.minFilter = THREE.LinearFilter
        this.terrainTexture.magFilter = THREE.LinearFilter
        this.terrainTexture.wrapS = THREE.ClampToEdgeWrapping
        this.terrainTexture.wrapT = THREE.ClampToEdgeWrapping
        this.terrainTexture.needsUpdate = true
    }

    setSlabsTexture()
    {
        const size = 128
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')

        ctx.fillStyle = '#555555'
        ctx.fillRect(0, 0, size, size)

        ctx.fillStyle = '#cccccc'
        const gap = 4
        const half = size / 2
        ctx.fillRect(gap, gap, half - gap * 2, half - gap * 2)
        ctx.fillRect(half + gap, gap, half - gap * 2, half - gap * 2)
        ctx.fillRect(gap, half + gap, half - gap * 2, half - gap * 2)
        ctx.fillRect(half + gap, half + gap, half - gap * 2, half - gap * 2)

        this.slabsTexture = new THREE.Texture(canvas)
        this.slabsTexture.wrapS = THREE.RepeatWrapping
        this.slabsTexture.wrapT = THREE.RepeatWrapping
        this.slabsTexture.minFilter = THREE.LinearFilter
        this.slabsTexture.magFilter = THREE.LinearFilter
        this.slabsTexture.generateMipmaps = false
        this.slabsTexture.needsUpdate = true
    }

    setGradient()
    {
        const height = 16
        const canvas = document.createElement('canvas')
        canvas.width = 1
        canvas.height = height

        this.gradientTexture = new THREE.Texture(canvas)
        this.gradientTexture.colorSpace = THREE.SRGBColorSpace

        const context = canvas.getContext('2d')
        this.colors = [
            { stop: 0.1, value: '#ffa94e' },
            { stop: 0.3, value: '#5bc2b9' },
            { stop: 0.9, value: '#13375f' },
        ]

        const gradient = context.createLinearGradient(0, 0, 0, height)
        for(const c of this.colors)
            gradient.addColorStop(c.stop, c.value)

        context.fillStyle = gradient
        context.fillRect(0, 0, 1, height)
        this.gradientTexture.needsUpdate = true
    }

    setNodes()
    {
        this.grassColorUniform = uniform(color('#b8b62e'))
        this.tracksDelta = uniform(vec2(0))

        const worldPositionToUvNode = Fn(([position]) =>
        {
            return position.div(this.subdivision).div(1.5).add(0.5)
        })

        this.terrainNode = Fn(([position]) =>
        {
            const textureUv = worldPositionToUvNode(position)
            const data = texture(this.terrainTexture, textureUv).toVar()

            // Wheel tracks carve through the grass channel (G)
            const groundDataColor = texture(
                this.game.tracks.renderTarget.texture,
                position.sub(-this.game.tracks.halfSize).sub(this.tracksDelta).div(this.game.tracks.size)
            )
            data.g.mulAssign(groundDataColor.r.oneMinus())

            return data
        })

        this.colorNode = Fn(([terrainData]) =>
        {
            const baseColor = texture(this.gradientTexture, vec2(0, terrainData.b.oneMinus())).toVar()
            baseColor.assign(mix(baseColor, this.grassColorUniform, terrainData.g))
            return baseColor.rgb
        })
    }

    update()
    {
        this.tracksDelta.value.set(
            this.game.tracks.focusPoint.x,
            this.game.tracks.focusPoint.y
        )
    }
}
