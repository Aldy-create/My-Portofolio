import * as THREE from 'three/webgpu'
import { Game } from '../Game.js'
import { color, luminance } from 'three/tsl'
import { MeshDefaultMaterial } from '../Materials/MeshDefaultMaterial.js'

export class Playground
{
    constructor()
    {
        this.game = Game.getInstance()

        this.dynamicObjects = []

        this.setMaterials()
        this.setHeroSignage()
        this.setJumpRamps()
        this.setBrickWallsAndPyramids()
        this.setExplosiveBulletTimeCrates()
        this.setSceneryPosts()
    }

    setMaterials()
    {
        this.stoneMaterial = new MeshDefaultMaterial({ colorNode: color('#e3d7c8') })
        this.rampSurfaceMaterial = new MeshDefaultMaterial({ colorNode: color('#ff7b3b') })
        this.rampSideMaterial = new MeshDefaultMaterial({ colorNode: color('#3a3248') })
        this.brickMaterialA = new MeshDefaultMaterial({ colorNode: color('#e85f4a') })
        this.brickMaterialB = new MeshDefaultMaterial({ colorNode: color('#f4a261') })
        this.crateMaterial = new MeshDefaultMaterial({ colorNode: color('#d48c46') })
        this.pillarMaterial = new MeshDefaultMaterial({ colorNode: color('#2e293a') })

        const cyanColor = color('#41e8ff')
        this.emissiveCyan = new THREE.MeshBasicNodeMaterial()
        this.emissiveCyan.colorNode = cyanColor.div(luminance(cyanColor)).mul(2.8)

        const amberColor = color('#ff7315')
        this.emissiveAmber = new THREE.MeshBasicNodeMaterial()
        this.emissiveAmber.colorNode = amberColor.div(luminance(amberColor)).mul(3.2)

        const violetColor = color('#c850ff')
        this.emissiveViolet = new THREE.MeshBasicNodeMaterial()
        this.emissiveViolet.colorNode = violetColor.div(luminance(violetColor)).mul(2.8)
    }

    setHeroSignage()
    {
        // Central 3D Monolith Banner behind spawn point: "ALDY ALFAISAL PASARIBU"
        const bannerGroup = new THREE.Group()
        bannerGroup.position.set(0, 0, -5.8)

        const basePedestal = new THREE.Mesh(
            new THREE.BoxGeometry(9.2, 0.45, 1.4),
            this.pillarMaterial
        )
        basePedestal.position.y = 0.225
        basePedestal.castShadow = true
        basePedestal.receiveShadow = true
        bannerGroup.add(basePedestal)

        // Create high-resolution 3D sign board texture
        const canvas = document.createElement('canvas')
        canvas.width = 1024
        canvas.height = 256
        const ctx = canvas.getContext('2d')

        ctx.fillStyle = '#1d1927'
        ctx.fillRect(0, 0, 1024, 256)

        ctx.strokeStyle = '#ff8b3d'
        ctx.lineWidth = 8
        ctx.strokeRect(12, 12, 1000, 232)

        ctx.fillStyle = '#ffffff'
        ctx.font = '800 62px "Space Grotesk", system-ui, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('ALDY ALFAISAL PASARIBU', 512, 102)

        ctx.fillStyle = '#5eead4'
        ctx.font = '600 28px "Space Grotesk", system-ui, sans-serif'
        ctx.fillText('AI & ROBOTICS UNDERGRADUATE • TANGERANG, INDONESIA', 512, 178)

        const signTexture = new THREE.Texture(canvas)
        signTexture.colorSpace = THREE.SRGBColorSpace
        signTexture.needsUpdate = true

        const signBoardMat = new THREE.MeshBasicNodeMaterial({ map: signTexture })
        const signBoard = new THREE.Mesh(new THREE.BoxGeometry(8.6, 2.15, 0.36), signBoardMat)
        signBoard.position.y = 1.55
        signBoard.castShadow = true
        bannerGroup.add(signBoard)

        const topGlowBar = new THREE.Mesh(new THREE.BoxGeometry(8.8, 0.14, 0.44), this.emissiveAmber)
        topGlowBar.position.y = 2.68
        bannerGroup.add(topGlowBar)

        this.game.objects.add(
            { model: bannerGroup },
            {
                type: 'fixed',
                position: new THREE.Vector3(0, 0, -5.8),
                colliders: [
                    { shape: 'cuboid', parameters: [ 4.6, 1.4, 0.7 ], position: { x: 0, y: 1.4, z: 0 } }
                ]
            }
        )
    }

    setJumpRamps()
    {
        const createRamp = (pos, rotY, width = 4.5, length = 5.5, tiltAngle = 0.34) =>
        {
            const group = new THREE.Group()
            const slabGeo = new THREE.BoxGeometry(length, 0.4, width)
            const slabMesh = new THREE.Mesh(slabGeo, this.rampSurfaceMaterial)
            slabMesh.castShadow = true
            slabMesh.receiveShadow = true
            group.add(slabMesh)

            const railGeo = new THREE.BoxGeometry(length, 0.56, 0.25)
            const railL = new THREE.Mesh(railGeo, this.rampSideMaterial)
            railL.position.z = -width * 0.5 + 0.12
            const railR = new THREE.Mesh(railGeo, this.rampSideMaterial)
            railR.position.z = width * 0.5 - 0.12
            group.add(railL, railR)

            const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.42, width - 0.6), this.emissiveAmber)
            stripe.position.x = length * 0.42
            group.add(stripe)

            const qY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY)
            const qZ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), tiltAngle)
            const finalQuat = qY.multiply(qZ)

            group.position.copy(pos)
            group.quaternion.copy(finalQuat)

            this.game.objects.add(
                { model: group },
                {
                    type: 'fixed',
                    position: pos,
                    rotation: finalQuat,
                    friction: 0.5,
                    colliders: [
                        { shape: 'cuboid', parameters: [ length * 0.5, 0.2, width * 0.5 ], category: 'floor' }
                    ]
                }
            )
        }

        // Dual stunt jump ramps facing each other in the southern playground
        createRamp(new THREE.Vector3(-6.5, 0.52, 9.5), 0, 4.4, 5.4, 0.31)
        createRamp(new THREE.Vector3(6.5, 0.52, 9.5), Math.PI, 4.4, 5.4, 0.31)

        // Mega launch ramp facing north toward center plaza
        createRamp(new THREE.Vector3(0, 0.72, 20.5), Math.PI * 0.5, 5.2, 6.2, 0.38)
    }

    setBrickWallsAndPyramids()
    {
        const brickHalf = { x: 0.42, y: 0.26, z: 0.24 }
        const brickGeo = new THREE.BoxGeometry(brickHalf.x * 2, brickHalf.y * 2, brickHalf.z * 2)

        const buildBrickWall = (originX, originZ, cols = 5, rows = 4, rotate90 = false) =>
        {
            for(let r = 0; r < rows; r++)
            {
                const offsetRow = (r % 2) * (brickHalf.x * 0.95)
                for(let c = 0; c < cols; c++)
                {
                    const localOffset = (c - (cols - 1) * 0.5) * (brickHalf.x * 2.06) + offsetRow
                    const x = rotate90 ? originX : originX + localOffset
                    const z = rotate90 ? originZ + localOffset : originZ
                    const y = brickHalf.y + r * (brickHalf.y * 2.02)

                    const mat = (r + c) % 2 === 0 ? this.brickMaterialA : this.brickMaterialB
                    const mesh = new THREE.Mesh(brickGeo, mat)

                    const quat = new THREE.Quaternion().setFromAxisAngle(
                        new THREE.Vector3(0, 1, 0),
                        rotate90 ? Math.PI * 0.5 : 0
                    )

                    const obj = this.game.objects.add(
                        { model: mesh },
                        {
                            type: 'dynamic',
                            position: new THREE.Vector3(x, y, z),
                            rotation: quat,
                            sleeping: true,
                            mass: 0.32,
                            friction: 0.35,
                            restitution: 0.12,
                            colliders: [
                                { shape: 'cuboid', parameters: [ brickHalf.x, brickHalf.y, brickHalf.z ], category: 'object' }
                            ]
                        }
                    )
                    this.dynamicObjects.push(obj)
                }
            }
        }

        // 1. Center Southern Brick Wall (between the two ramps)
        buildBrickWall(0, 9.5, 5, 4, false)

        // 2. West & East Destructible Brick Stacks
        buildBrickWall(-11.5, 2.0, 4, 4, true)
        buildBrickWall(11.5, 2.0, 4, 4, true)

        // 3. Dynamic Cargo Crate Pyramid at (0, 0, 14.5)
        const crateHalf = 0.45
        const crateGeo = new THREE.BoxGeometry(crateHalf * 2, crateHalf * 2, crateHalf * 2)
        const pyramidBase = new THREE.Vector3(0, 0, 14.5)

        for(let layer = 0; layer < 3; layer++)
        {
            const count = 4 - layer
            for(let i = 0; i < count; i++)
            {
                const x = pyramidBase.x + (i - (count - 1) * 0.5) * (crateHalf * 2.08)
                const y = crateHalf + layer * (crateHalf * 2.02)
                const z = pyramidBase.z

                const mesh = new THREE.Mesh(crateGeo, this.crateMaterial)
                const obj = this.game.objects.add(
                    { model: mesh },
                    {
                        type: 'dynamic',
                        position: new THREE.Vector3(x, y, z),
                        sleeping: true,
                        mass: 0.45,
                        friction: 0.3,
                        restitution: 0.15,
                        colliders: [
                            { shape: 'cuboid', parameters: [ crateHalf, crateHalf, crateHalf ], category: 'object' }
                        ]
                    }
                )
                this.dynamicObjects.push(obj)
            }
        }
    }

    setExplosiveBulletTimeCrates()
    {
        // Glowing HDR Explosive Crates: hitting them triggers Bullet-Time + radial blast + camera roll kick!
        const positions = [
            new THREE.Vector3(-4.8, 0.5, 4.5),
            new THREE.Vector3(4.8, 0.5, 4.5),
            new THREE.Vector3(0, 0.5, 12.0),
        ]

        const crateGeo = new THREE.BoxGeometry(0.95, 0.95, 0.95)
        const coreBandGeo = new THREE.BoxGeometry(1.02, 0.22, 1.02)

        for(const pos of positions)
        {
            const group = new THREE.Group()
            const boxMesh = new THREE.Mesh(crateGeo, this.pillarMaterial)
            boxMesh.castShadow = true
            boxMesh.receiveShadow = true
            const glowBand = new THREE.Mesh(coreBandGeo, this.emissiveAmber)
            group.add(boxMesh, glowBand)

            let lastBlastTime = -10

            const obj = this.game.objects.add(
                { model: group },
                {
                    type: 'dynamic',
                    position: pos,
                    sleeping: true,
                    mass: 0.6,
                    contactThreshold: 5,
                    colliders: [
                        { shape: 'cuboid', parameters: [ 0.475, 0.475, 0.475 ], category: 'object' }
                    ],
                    onCollision: (force, blastCenter) =>
                    {
                        if(force < 3.5 || this.game.ticker.elapsed - lastBlastTime < 1.5)
                            return

                        lastBlastTime = this.game.ticker.elapsed

                        // Trigger Slow-Motion Bullet Time & Camera Roll Shake
                        this.game.time.bulletTime.activate(1.6)
                        this.game.view.roll.kick(1.8)

                        // Radial impulse to nearby dynamic objects
                        const radius = 7.5
                        for(const dyn of this.dynamicObjects)
                        {
                            if(!dyn.physical)
                                continue

                            const t = dyn.physical.body.translation()
                            const dx = t.x - blastCenter.x
                            const dy = (t.y - blastCenter.y) + 0.75
                            const dz = t.z - blastCenter.z
                            const dist = Math.hypot(dx, dy, dz)

                            if(dist < radius && dist > 0.001)
                            {
                                const strength = (1 - dist / radius) * 4.2 * dyn.physical.body.mass()
                                dyn.physical.body.wakeUp()
                                dyn.physical.body.applyImpulse({
                                    x: (dx / dist) * strength,
                                    y: Math.abs(dy / dist) * strength * 1.3,
                                    z: (dz / dist) * strength
                                }, true)
                            }
                        }
                    }
                }
            )
            this.dynamicObjects.push(obj)
        }
    }

    setSceneryPosts()
    {
        // Stylized lantern posts around the road intersections
        const lampCoords = [
            [-6, -3], [6, -3],
            [-6, -11], [6, -11],
            [-11, -5], [11, -5]
        ]

        const poleGeo = new THREE.CylinderGeometry(0.10, 0.14, 3.2, 8)
        const bulbGeo = new THREE.SphereGeometry(0.28, 12, 12)

        for(const [lx, lz] of lampCoords)
        {
            const group = new THREE.Group()
            const pole = new THREE.Mesh(poleGeo, this.pillarMaterial)
            pole.position.y = 1.6
            pole.castShadow = true

            const bulb = new THREE.Mesh(bulbGeo, this.emissiveAmber)
            bulb.position.y = 3.3
            group.add(pole, bulb)

            this.game.objects.add(
                { model: group },
                {
                    type: 'fixed',
                    position: new THREE.Vector3(lx, 0, lz),
                    colliders: [
                        { shape: 'cylinder', parameters: [ 1.6, 0.14 ], position: { x: 0, y: 1.6, z: 0 } }
                    ]
                }
            )
        }
    }
}
