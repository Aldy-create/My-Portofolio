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
        // R = Dark charcoal asphalt road & plaza mask
        // G = Grass density mask (strictly 0 on all roads, garage pads, construction pit, and plazas)
        // B = Water / shoreline depth (0 = dry land, >0.25 = water pond/moat)
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

                // Plazas: Spawn (0,0) and 5 Portfolio Landmark Plazas
                const distSpawn = Math.hypot(wx, wz - (-1.5))
                const distRobotics = Math.hypot(wx - (-15), wz - (-10))
                const distEducation = Math.hypot(wx - 14, wz - (-10))
                const distMusic = Math.hypot(wx - 0, wz - (-19))
                const distMl = Math.hypot(wx - (-20), wz - 4)
                const distExp = Math.hypot(wx - 24, wz - (-5))

                let slabMask = 0
                if(
                    distSpawn < 6.8 ||
                    distRobotics < 6.4 ||
                    distEducation < 6.4 ||
                    distMusic < 6.4 ||
                    distMl < 6.4 ||
                    distExp < 6.4
                )
                {
                    slabMask = 1.0
                }

                // 1. Main North-South Asphalt Avenue (x = 0, z = -20..32)
                if(Math.abs(wx) < 2.9 && wz > -20.5 && wz < 33)
                    slabMask = 1.0

                // 2. North East-West Asphalt Avenue (z = -10, x = -32..32)
                if(Math.abs(wz + 10) < 2.8 && wx > -33 && wx < 33)
                    slabMask = 1.0

                // 3. Mid East-West Asphalt Avenue (z = 4, x = -32..32)
                if(Math.abs(wz - 4) < 2.7 && wx > -33 && wx < 33)
                    slabMask = 1.0

                // 4. Outer Asphalt Ring Road Loop (|x| = 32, |z| = 32)
                const ringHalf = 32
                const ringRoadHalfWidth = 3.2
                const onVerticalRing = Math.abs(Math.abs(wx) - ringHalf) < ringRoadHalfWidth && Math.abs(wz) <= ringHalf + ringRoadHalfWidth
                const onHorizontalRing = Math.abs(Math.abs(wz) - ringHalf) < ringRoadHalfWidth && Math.abs(wx) <= ringHalf + ringRoadHalfWidth
                if(onVerticalRing || onHorizontalRing)
                    slabMask = 1.0

                // 5. Garage / Parking Pad Apron (-25.5..-3.5, 10.5..26.0)
                const inGaragePad = wx >= -25.5 && wx <= -3.5 && wz >= 10.5 && wz <= 26.0
                if(inGaragePad)
                    slabMask = 1.0

                // 6. Active Construction Pit & Equipment Staging Area (8.0..25.8, 1.0..18.0)
                const inConstructionZone = wx >= 8.0 && wx <= 25.8 && wz >= 1.0 && wz <= 18.0
                if(inConstructionZone)
                    slabMask = Math.max(slabMask, 0.92)

                // Scenic water pond at (-24, -22) and outer island shore (> 58m)
                const distPond = Math.hypot(wx - (-24), wz - (-22))
                let waterDepth = 0.08
                if(distPond < 6.2)
                {
                    waterDepth = Math.min(0.95, 0.15 + (1 - distPond / 6.2) * 0.8)
                }
                if(distCenter > 58)
                {
                    waterDepth = Math.max(waterDepth, Math.min(0.95, 0.08 + ((distCenter - 58) / 22) * 0.88))
                }

                // Strictly zero tall grass on all roads, plazas, garage pads, construction pit, and water
                let grassMask = slabMask > 0.12 ? 0.0 : 1.0
                if(waterDepth > 0.16)
                    grassMask = 0.0

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
        // Fine asphalt grain texture (replaces the old blocky orange/gray grid tiles)
        const size = 128
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')

        ctx.fillStyle = '#303440'
        ctx.fillRect(0, 0, size, size)

        for(let i = 0; i < 600; i++)
        {
            const v = 38 + Math.floor(Math.random() * 28)
            ctx.fillStyle = `rgb(${v},${v + 2},${v + 6})`
            ctx.fillRect(Math.random() * size, Math.random() * size, 2, 2)
        }

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
            { stop: 0.1, value: '#6f8c49' },
            { stop: 0.35, value: '#469e94' },
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
        this.grassColorUniform = uniform(color('#7da442'))
        this.dirtColorUniform = uniform(color('#594c3c'))
        this.tracksDelta = uniform(vec2(0))

        const worldPositionToUvNode = Fn(([position]) =>
        {
            return position.div(this.subdivision).div(1.5).add(0.5)
        })

        this.terrainNode = Fn(([position]) =>
        {
            const textureUv = worldPositionToUvNode(position)
            const data = texture(this.terrainTexture, textureUv).toVar()

            // Wheel tracks softly carve the grass channel (G); mask kept in A for dirt tinting
            const groundDataColor = texture(
                this.game.tracks.renderTarget.texture,
                position.sub(-this.game.tracks.halfSize).sub(this.tracksDelta).div(this.game.tracks.size)
            )
            const trackMask = groundDataColor.r.toVar()
            data.g.mulAssign(trackMask.mul(0.5).oneMinus())
            data.a.assign(trackMask)

            return data
        })

        this.colorNode = Fn(([terrainData]) =>
        {
            const baseColor = texture(this.gradientTexture, vec2(0, terrainData.b.oneMinus())).toVar()
            baseColor.assign(mix(baseColor, this.grassColorUniform, terrainData.g))
            baseColor.assign(mix(baseColor, this.dirtColorUniform, terrainData.a.mul(0.45)))
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
