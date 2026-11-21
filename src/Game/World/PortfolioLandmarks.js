import * as THREE from 'three/webgpu'
import { Game } from '../Game.js'
import { color, luminance, uniform } from 'three/tsl'
import { MeshDefaultMaterial } from '../Materials/MeshDefaultMaterial.js'
import { InteractivePoints } from '../InteractivePoints.js'
import { Modals } from '../Modals.js'

/**
 * Centralized 3D coordinates for all procedural AI & Robotics portfolio landmarks
 * and 3D Contact Pads. Adjust any (x, y, z) here to reposition the mesh, collider,
 * proximity zone, click target, and cinematic camera together.
 */
export const LANDMARK_COORDS = {
    contactPads: {
        github: {
            id: 'contact-github',
            key: 'github',
            label: 'GITHUB',
            accent: '#c084fc',
            position: { x: -3.2, y: 0, z: -3.4 },
            zoneRadius: 2.1
        },
        linkedin: {
            id: 'contact-linkedin',
            key: 'linkedin',
            label: 'LINKEDIN',
            accent: '#38bdf8',
            position: { x: 0.0, y: 0, z: -3.4 },
            zoneRadius: 2.1
        },
        email: {
            id: 'contact-email',
            key: 'email',
            label: 'EMAIL',
            accent: '#ff8a4c',
            position: { x: 3.2, y: 0, z: -3.4 },
            zoneRadius: 2.1
        }
    },
    educationVault: {
        id: 'education',
        label: 'ACADEMIC VAULT • GPA',
        position: { x: 14, y: 0, z: -10 },
        interactivePointOffset: { x: 0, y: 1.9, z: 2.8 },
        cinematicOffset: { x: -6.5, y: 5.5, z: 8.5 },
        zoneRadius: 6.2
    },
    roboticsRover: {
        id: 'project-robotics',
        label: 'WIFI MOBILE ROBOT',
        position: { x: -15, y: 0, z: -10 },
        interactivePointOffset: { x: 0, y: 1.9, z: 2.8 },
        cinematicOffset: { x: 6.5, y: 5.8, z: 8.5 },
        zoneRadius: 6.2
    },
    musicEqualizer: {
        id: 'project-music',
        label: 'MUSIC STREAM APP',
        position: { x: 0, y: 0, z: -19 },
        interactivePointOffset: { x: 0, y: 1.9, z: 2.8 },
        cinematicOffset: { x: 5.5, y: 5.8, z: 8.5 },
        zoneRadius: 6.2
    },
    aiNeuralNet: {
        id: 'project-ml',
        label: 'CAR ML CLASSIFIER',
        position: { x: -20, y: 0, z: 4 },
        interactivePointOffset: { x: 0, y: 1.9, z: 2.8 },
        cinematicOffset: { x: 7.0, y: 5.8, z: 8.0 },
        zoneRadius: 6.2
    },
    experienceSkillsTower: {
        id: 'experience',
        label: 'EXPERIENCE & SKILLS',
        position: { x: 20, y: 0, z: 4 },
        interactivePointOffset: { x: 0, y: 1.9, z: 2.8 },
        cinematicOffset: { x: -7.0, y: 5.8, z: 8.0 },
        zoneRadius: 6.2
    }
}

export class PortfolioLandmarks
{
    constructor()
    {
        this.game = Game.getInstance()
        this.cinematicTargets = new Map()

        // 3D Contact Pads animation state
        this.contactPads = []

        // Permanently locked 3D Academic Vault state (GPA Never Unlocks!)
        this.vault = {
            status: 'classified', // 'classified' | 'pending'
            pivot: null,
            beaconMesh: null,
            deniedTimer: 0,
            flashTimer: 0,
            lampColorUniform: uniform(new THREE.Color('#ff2e55')),
            lampIntensityUniform: uniform(2.8),
            ringColorUniform: uniform(new THREE.Color('#ff2e55')),
            baseColor: new THREE.Color('#ff2e55'),
            hasAutoPromptedInZone: false
        }

        this.robotics = {
            radarPivot: null,
            wifiWaves: []
        }

        this.music = {
            bars: []
        }

        this.neuralNet = {
            graphGroup: null,
            nodes: []
        }

        this.experienceTower = {
            rings: []
        }

        this.setMaterials()
        this.buildContactPads()
        this.buildEducationVault()
        this.buildRoboticsLandmark()
        this.buildMusicEqualizerLandmark()
        this.buildNeuralNetLandmark()
        this.buildExperienceSkillsLandmark()

        this.game.ticker.events.on('tick', () =>
        {
            this.update()
        }, 10)
    }

    setMaterials()
    {
        this.padMaterial = new MeshDefaultMaterial({ colorNode: color('#e3d7c8') })
        this.darkMetalMaterial = new MeshDefaultMaterial({ colorNode: color('#221d30') })
        this.slateMaterial = new MeshDefaultMaterial({ colorNode: color('#3a3350') })
        this.whiteMaterial = new MeshDefaultMaterial({ colorNode: color('#f5f3fa') })
        this.redBarrierMaterial = new MeshDefaultMaterial({ colorNode: color('#ef4444') })
        this.pcbMaterial = new MeshDefaultMaterial({ colorNode: color('#0f766e') })
        this.roverBodyMaterial = new MeshDefaultMaterial({ colorNode: color('#38bdf8') })
        this.rubberMaterial = new MeshDefaultMaterial({ colorNode: color('#1b1924') })

        const makeEmissive = (hex, intensity = 2.6) =>
        {
            const base = color(hex)
            const mat = new THREE.MeshBasicNodeMaterial()
            mat.colorNode = base.div(luminance(base)).mul(intensity)
            return mat
        }

        this.emissiveCyan = makeEmissive('#41e8ff', 2.6)
        this.emissiveAmber = makeEmissive('#ff7b3b', 2.8)
        this.emissiveViolet = makeEmissive('#c850ff', 2.7)
        this.emissiveTeal = makeEmissive('#2dd4bf', 2.5)
        this.emissivePink = makeEmissive('#f472b6', 2.6)

        // Dynamic TSL emissive material for the Academic Vault beacon & perimeter ring
        this.vaultLampMaterial = new THREE.MeshBasicNodeMaterial()
        this.vaultLampMaterial.colorNode = this.vault.lampColorUniform.mul(this.vault.lampIntensityUniform)

        this.vaultRingMaterial = new THREE.MeshBasicNodeMaterial()
        this.vaultRingMaterial.colorNode = this.vault.ringColorUniform.mul(2.1)

        // WiFi signal wave rings
        this.wifiWaveMaterials = [0, 1, 2].map(() =>
        {
            const mat = new THREE.MeshBasicNodeMaterial({ transparent: true, opacity: 0.85, depthWrite: false })
            const base = color('#41e8ff')
            mat.colorNode = base.div(luminance(base)).mul(2.4)
            return mat
        })

        // Neural network synapse rod material
        this.synapseMaterial = new THREE.MeshBasicNodeMaterial({ transparent: true, opacity: 0.55 })
        this.synapseMaterial.colorNode = color('#a855f7').mul(1.8)
    }

    getCinematicCamera(zoneId)
    {
        if(zoneId === 'projects')
            return this.cinematicTargets.get('project-robotics') || null
        if(zoneId === 'skills')
            return this.cinematicTargets.get('experience') || null
        return this.cinematicTargets.get(zoneId) || null
    }

    /**
     * Generates a crisp 512x512 CanvasTexture with vector icon + label for each 3D Contact Pad
     */
    createContactPadTexture(key, label, accentHex)
    {
        const canvas = document.createElement('canvas')
        canvas.width = 512
        canvas.height = 512
        const ctx = canvas.getContext('2d')

        // Dark slate background with crisp accent border
        ctx.fillStyle = '#181424'
        ctx.fillRect(0, 0, 512, 512)

        // Soft radial top glow
        const grad = ctx.createRadialGradient(256, 200, 20, 256, 220, 240)
        grad.addColorStop(0, `${accentHex}33`)
        grad.addColorStop(1, 'rgba(24, 20, 36, 0)')
        ctx.fillStyle = grad
        ctx.fillRect(0, 0, 512, 512)

        ctx.strokeStyle = accentHex
        ctx.lineWidth = 14
        ctx.strokeRect(18, 18, 476, 476)

        ctx.fillStyle = '#ffffff'
        ctx.strokeStyle = '#ffffff'

        if(key === 'github')
        {
            // Clean geometric GitHub / Code octo-mark
            ctx.beginPath()
            ctx.arc(256, 198, 76, 0, Math.PI * 2)
            ctx.lineWidth = 14
            ctx.strokeStyle = accentHex
            ctx.stroke()

            ctx.fillStyle = '#ffffff'
            ctx.font = '800 92px "JetBrains Mono", monospace'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText('</>', 256, 202)
        }
        else if(key === 'linkedin')
        {
            // Clean rounded square with bold "in" mark
            const rx = 180
            const ry = 122
            const rw = 152
            const rh = 152
            const rad = 28
            ctx.beginPath()
            ctx.moveTo(rx + rad, ry)
            ctx.lineTo(rx + rw - rad, ry)
            ctx.quadraticCurveTo(rx + rw, ry, rx + rw, ry + rad)
            ctx.lineTo(rx + rw, ry + rh - rad)
            ctx.quadraticCurveTo(rx + rw, ry + rh, rx + rw - rad, ry + rh)
            ctx.lineTo(rx + rad, ry + rh)
            ctx.quadraticCurveTo(rx, ry + rh, rx, ry + rh - rad)
            ctx.lineTo(rx, ry + rad)
            ctx.quadraticCurveTo(rx, ry, rx + rad, ry)
            ctx.closePath()
            ctx.fillStyle = accentHex
            ctx.fill()

            ctx.fillStyle = '#14101c'
            ctx.font = '800 96px "Space Grotesk", system-ui, sans-serif'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText('in', 256, 204)
        }
        else if(key === 'email')
        {
            // Clean minimalist Envelope vector
            ctx.lineWidth = 14
            ctx.strokeStyle = accentHex
            ctx.lineJoin = 'round'
            ctx.strokeRect(148, 134, 216, 142)

            ctx.beginPath()
            ctx.moveTo(154, 142)
            ctx.lineTo(256, 216)
            ctx.lineTo(358, 142)
            ctx.strokeStyle = '#ffffff'
            ctx.stroke()
        }

        // Sharp label text
        ctx.fillStyle = '#f8fafc'
        ctx.font = '700 54px "Space Grotesk", system-ui, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(label, 256, 372)

        // Subtle sub-hint
        ctx.fillStyle = accentHex
        ctx.font = '600 24px "JetBrains Mono", monospace'
        ctx.fillText('CLICK OR DRIVE OVER', 256, 434)

        const tex = new THREE.Texture(canvas)
        tex.colorSpace = THREE.SRGBColorSpace
        tex.needsUpdate = true
        return tex
    }

    /**
     * 0. 3 Aesthetic 3D Interactive Contact Pads in front of the Hero Name Monolith
     */
    buildContactPads()
    {
        const padConfigs = Object.values(LANDMARK_COORDS.contactPads)

        for(const cfg of padConfigs)
        {
            const pos = new THREE.Vector3(cfg.position.x, cfg.position.y, cfg.position.z)
            const group = new THREE.Group()
            group.position.copy(pos)

            // Sleek octagonal low pedestal
            const base = new THREE.Mesh(
                new THREE.CylinderGeometry(1.06, 1.18, 0.16, 8),
                this.darkMetalMaterial
            )
            base.position.y = 0.08
            base.castShadow = true
            base.receiveShadow = true
            group.add(base)

            // Dynamic TSL glowing perimeter ring
            const intensityUniform = uniform(1.75)
            const ringMat = new THREE.MeshBasicNodeMaterial()
            ringMat.colorNode = color(cfg.accent).mul(intensityUniform)

            const ring = new THREE.Mesh(
                new THREE.TorusGeometry(1.02, 0.045, 8, 28),
                ringMat
            )
            ring.rotation.x = Math.PI * 0.5
            ring.position.y = 0.17
            group.add(ring)

            // Floating tilted icon plate (CanvasTexture)
            const tilePivot = new THREE.Group()
            tilePivot.position.set(0, 0.42, 0)

            const tex = this.createContactPadTexture(cfg.key, cfg.label, cfg.accent)
            const topFaceMat = new THREE.MeshBasicNodeMaterial({ map: tex })
            const sideMat = this.slateMaterial

            const tileMesh = new THREE.Mesh(
                new THREE.BoxGeometry(1.36, 0.12, 1.36),
                [sideMat, sideMat, topFaceMat, sideMat, sideMat, sideMat]
            )
            tileMesh.rotation.x = 0.34
            tileMesh.castShadow = true
            tilePivot.add(tileMesh)
            group.add(tilePivot)

            this.game.scene.add(group)

            const padState = {
                cfg,
                tilePivot,
                intensityUniform,
                hovered: false,
                near: false,
                currentLift: 0,
                currentIntensity: 1.75
            }
            this.contactPads.push(padState)

            const triggerAction = () =>
            {
                this.game.portfolioUI?.triggerContact(cfg.key)
            }

            // Proximity Zone (drives hover-lift & quick prompt without obstructing driving)
            const zone = this.game.zones.create('cylinder', pos, cfg.zoneRadius, { title: cfg.label, id: cfg.id })
            zone.events.on('enter', () =>
            {
                padState.near = true
                this.game.setZoneBadge?.(`CONTACT: ${cfg.label}`)
            })
            zone.events.on('leave', () =>
            {
                padState.near = false
                this.game.setZoneBadge?.(null)
            })

            // InteractivePoint diamond (allows pressing E / Enter when parked on the pad)
            const pointPos = pos.clone().add(new THREE.Vector3(0, 1.35, 0))
            this.game.interactivePoints.create(
                pointPos,
                `OPEN ${cfg.label}`,
                InteractivePoints.ALIGN_LEFT,
                triggerAction
            )

            // Direct mouse hover & click via RayCursor
            const hitSphere = new THREE.Sphere(pos.clone().add(new THREE.Vector3(0, 0.45, 0)), 1.25)
            this.game.rayCursor.addIntersect({
                active: true,
                shape: hitSphere,
                onEnter: () =>
                {
                    padState.hovered = true
                },
                onLeave: () =>
                {
                    padState.hovered = false
                },
                onClick: () =>
                {
                    if(this.game.modals.state === Modals.CLOSED)
                    {
                        triggerAction()
                    }
                }
            })
        }
    }

    registerZoneInteraction(cfg, group, clickSphereOffset, onInteract, onEnterExtra = null)
    {
        const pos = new THREE.Vector3(cfg.position.x, cfg.position.y, cfg.position.z)
        const cinematicPos = pos.clone().add(
            new THREE.Vector3(cfg.cinematicOffset.x, cfg.cinematicOffset.y, cfg.cinematicOffset.z)
        )
        const cinematicTarget = pos.clone().add(new THREE.Vector3(0, 1.8, 0))
        this.cinematicTargets.set(cfg.id, { position: cinematicPos, target: cinematicTarget })

        // 1. Proximity Cylinder Zone
        const zone = this.game.zones.create('cylinder', pos, cfg.zoneRadius, { title: cfg.label, id: cfg.id })
        zone.events.on('enter', () =>
        {
            const displayLabel = cfg.id === 'education' && this.vault.status === 'pending'
                ? 'ACADEMIC VAULT • PENDING OFFER'
                : cfg.label
            this.game.setZoneBadge?.(displayLabel)
            if(typeof onEnterExtra === 'function')
                onEnterExtra(true)
        })
        zone.events.on('leave', () =>
        {
            this.game.setZoneBadge?.(null)
            if(typeof onEnterExtra === 'function')
                onEnterExtra(false)
        })

        // 2. Floating 3D Diamond InteractivePoint (E / Enter / Click)
        const pointPos = pos.clone().add(
            new THREE.Vector3(
                cfg.interactivePointOffset.x,
                cfg.interactivePointOffset.y,
                cfg.interactivePointOffset.z
            )
        )
        const align = cfg.position.x < 0 ? InteractivePoints.ALIGN_LEFT : InteractivePoints.ALIGN_RIGHT
        this.game.interactivePoints.create(pointPos, cfg.label, align, onInteract)

        // 3. Direct 3D Landmark Click via RayCursor
        const hitCenter = pos.clone().add(clickSphereOffset)
        this.game.rayCursor.addIntersect({
            active: true,
            shape: new THREE.Sphere(hitCenter, 2.2),
            onClick: () =>
            {
                if(this.game.modals.state === Modals.CLOSED)
                {
                    onInteract()
                }
            }
        })
    }

    createBasePad(radius, ringMaterial)
    {
        const padGroup = new THREE.Group()

        const pad = new THREE.Mesh(
            new THREE.CylinderGeometry(radius, radius + 0.3, 0.24, 8),
            this.padMaterial
        )
        pad.position.y = 0.12
        pad.receiveShadow = true
        padGroup.add(pad)

        const ring = new THREE.Mesh(
            new THREE.TorusGeometry(radius - 0.15, 0.075, 8, 36),
            ringMaterial
        )
        ring.rotation.x = Math.PI * 0.5
        ring.position.y = 0.26
        padGroup.add(ring)

        return padGroup
    }

    /**
     * 1. Permanently Locked 3D Academic Vault / Palang GPA (Education Zone)
     */
    buildEducationVault()
    {
        const cfg = LANDMARK_COORDS.educationVault
        const pos = new THREE.Vector3(cfg.position.x, cfg.position.y, cfg.position.z)

        const group = new THREE.Group()
        group.position.copy(pos)
        group.add(this.createBasePad(3.5, this.vaultRingMaterial))

        // Main vault pillar (left side)
        const pillarBase = new THREE.Mesh(
            new THREE.BoxGeometry(1.18, 0.35, 1.18),
            this.slateMaterial
        )
        pillarBase.position.set(-1.35, 0.4, 0)
        pillarBase.castShadow = true
        pillarBase.receiveShadow = true
        group.add(pillarBase)

        const pillarBody = new THREE.Mesh(
            new THREE.BoxGeometry(0.88, 2.15, 0.88),
            this.darkMetalMaterial
        )
        pillarBody.position.set(-1.35, 1.55, 0)
        pillarBody.castShadow = true
        pillarBody.receiveShadow = true
        group.add(pillarBody)

        // Vault cap & pulsing red indicator beacon
        const cap = new THREE.Mesh(
            new THREE.CylinderGeometry(0.48, 0.58, 0.22, 8),
            this.slateMaterial
        )
        cap.position.set(-1.35, 2.72, 0)
        cap.castShadow = true
        group.add(cap)

        const lampBeacon = new THREE.Mesh(
            new THREE.SphereGeometry(0.28, 16, 16),
            this.vaultLampMaterial
        )
        lampBeacon.position.set(-1.35, 3.08, 0)
        group.add(lampBeacon)
        this.vault.beaconMesh = lampBeacon

        const lampHalo = new THREE.Mesh(
            new THREE.TorusGeometry(0.44, 0.045, 8, 24),
            this.vaultLampMaterial
        )
        lampHalo.rotation.x = Math.PI * 0.5
        lampHalo.position.set(-1.35, 3.08, 0)
        group.add(lampHalo)

        // Counter-post / catch rest (right side)
        const catchPost = new THREE.Mesh(
            new THREE.CylinderGeometry(0.16, 0.22, 1.35, 10),
            this.darkMetalMaterial
        )
        catchPost.position.set(1.75, 0.9, 0)
        catchPost.castShadow = true
        group.add(catchPost)

        const catchFork = new THREE.Mesh(
            new THREE.BoxGeometry(0.32, 0.24, 0.38),
            this.slateMaterial
        )
        catchFork.position.set(1.75, 1.58, 0)
        group.add(catchFork)

        // Locked Boom Barrier Arm (permanently closed; performs "denied bounce" when forced)
        const pivot = new THREE.Group()
        pivot.position.set(-0.92, 1.62, 0)

        const hingeHub = new THREE.Mesh(
            new THREE.CylinderGeometry(0.22, 0.22, 0.42, 12),
            this.slateMaterial
        )
        hingeHub.rotation.x = Math.PI * 0.5
        pivot.add(hingeHub)

        const segmentCount = 6
        const segmentLen = 0.46
        const segGeo = new THREE.BoxGeometry(segmentLen, 0.16, 0.14)
        for(let i = 0; i < segmentCount; i++)
        {
            const mat = i % 2 === 0 ? this.redBarrierMaterial : this.whiteMaterial
            const seg = new THREE.Mesh(segGeo, mat)
            seg.position.set(0.25 + i * segmentLen, 0, 0)
            seg.castShadow = true
            pivot.add(seg)
        }

        const tipLed = new THREE.Mesh(
            new THREE.SphereGeometry(0.09, 10, 10),
            this.vaultLampMaterial
        )
        tipLed.position.set(0.25 + segmentCount * segmentLen - 0.15, 0, 0)
        pivot.add(tipLed)

        group.add(pivot)
        this.vault.pivot = pivot

        this.game.objects.add(
            { model: group },
            {
                type: 'fixed',
                position: pos,
                colliders: [
                    { shape: 'cuboid', parameters: [ 0.58, 1.35, 0.58 ], position: { x: -1.35, y: 1.35, z: 0 } },
                    { shape: 'cylinder', parameters: [ 0.7, 0.22 ], position: { x: 1.75, y: 0.9, z: 0 } }
                ]
            }
        )

        const openVaultGimmick = () =>
        {
            this.game.modals.open('gpa-gate', this.getCinematicCamera(cfg.id))
        }

        this.registerZoneInteraction(
            cfg,
            group,
            new THREE.Vector3(0, 1.8, 0),
            openVaultGimmick,
            (entered) =>
            {
                if(entered)
                {
                    if(!this.vault.hasAutoPromptedInZone && this.game.modals.state === Modals.CLOSED)
                    {
                        this.vault.hasAutoPromptedInZone = true
                        openVaultGimmick()
                    }
                }
                else
                {
                    this.vault.hasAutoPromptedInZone = false
                }
            }
        )
    }

    /**
     * Triggers a sharp "denied bounce" vibration on the locked barrier + intense red beacon flash
     */
    triggerDeniedBounce()
    {
        this.vault.deniedTimer = 0.72
        this.vault.flashTimer = 0.72
    }

    /**
     * Transitions the 3D Academic Vault beacon to warm amber ("PENDING OFFER") while remaining locked
     */
    setPendingOfferState()
    {
        this.vault.status = 'pending'
        this.vault.baseColor.set('#f59e0b')
        this.vault.deniedTimer = 0.35
    }

    /**
     * 2. Robotics Landmark: Miniature ESP32 Rover + Rotating Radar + Pulsing WiFi Waves
     */
    buildRoboticsLandmark()
    {
        const cfg = LANDMARK_COORDS.roboticsRover
        const pos = new THREE.Vector3(cfg.position.x, cfg.position.y, cfg.position.z)

        const group = new THREE.Group()
        group.position.copy(pos)
        group.add(this.createBasePad(3.5, this.emissiveCyan))

        const plinth = new THREE.Mesh(
            new THREE.CylinderGeometry(1.45, 1.65, 0.65, 8),
            this.darkMetalMaterial
        )
        plinth.position.y = 0.55
        plinth.castShadow = true
        plinth.receiveShadow = true
        group.add(plinth)

        const roverGroup = new THREE.Group()
        roverGroup.position.set(0, 0.92, 0)

        const chassis = new THREE.Mesh(
            new THREE.BoxGeometry(1.5, 0.28, 1.05),
            this.roverBodyMaterial
        )
        chassis.position.y = 0.28
        chassis.castShadow = true
        roverGroup.add(chassis)

        const pcb = new THREE.Mesh(
            new THREE.BoxGeometry(0.75, 0.1, 0.52),
            this.pcbMaterial
        )
        pcb.position.set(-0.1, 0.47, 0)
        roverGroup.add(pcb)

        const espChip = new THREE.Mesh(
            new THREE.BoxGeometry(0.28, 0.08, 0.26),
            this.slateMaterial
        )
        espChip.position.set(-0.1, 0.55, 0)
        roverGroup.add(espChip)

        const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.22, 16)
        wheelGeo.rotateX(Math.PI * 0.5)
        const wheelCoords = [
            [-0.4, 0.28, 0.62],
            [-0.4, 0.28, -0.62],
            [0.42, 0.28, 0.62],
            [0.42, 0.28, -0.62]
        ]
        for(const [wx, wy, wz] of wheelCoords)
        {
            const wheel = new THREE.Mesh(wheelGeo, this.rubberMaterial)
            wheel.position.set(wx, wy, wz)
            wheel.castShadow = true
            roverGroup.add(wheel)

            const hub = new THREE.Mesh(
                new THREE.CylinderGeometry(0.12, 0.12, 0.25, 10).rotateX(Math.PI * 0.5),
                this.emissiveCyan
            )
            hub.position.set(wx, wy, wz)
            roverGroup.add(hub)
        }

        const eyeGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.14, 12).rotateZ(Math.PI * 0.5)
        const eyeL = new THREE.Mesh(eyeGeo, this.emissiveCyan)
        eyeL.position.set(0.78, 0.32, -0.22)
        const eyeR = new THREE.Mesh(eyeGeo, this.emissiveCyan)
        eyeR.position.set(0.78, 0.32, 0.22)
        roverGroup.add(eyeL, eyeR)

        const radarPivot = new THREE.Group()
        radarPivot.position.set(0.1, 0.55, 0)

        const mast = new THREE.Mesh(
            new THREE.CylinderGeometry(0.06, 0.08, 1.05, 8),
            this.slateMaterial
        )
        mast.position.y = 0.52
        radarPivot.add(mast)

        const dish = new THREE.Mesh(
            new THREE.CylinderGeometry(0.55, 0.14, 0.22, 16),
            this.whiteMaterial
        )
        dish.position.set(0.18, 1.05, 0)
        dish.rotation.z = -Math.PI * 0.32
        dish.castShadow = true
        radarPivot.add(dish)

        const emitterTip = new THREE.Mesh(
            new THREE.SphereGeometry(0.12, 12, 12),
            this.emissiveCyan
        )
        emitterTip.position.set(0.36, 1.15, 0)
        radarPivot.add(emitterTip)

        roverGroup.add(radarPivot)
        this.robotics.radarPivot = radarPivot

        for(let i = 0; i < 3; i++)
        {
            const wave = new THREE.Mesh(
                new THREE.TorusGeometry(0.55, 0.045, 8, 28),
                this.wifiWaveMaterials[i]
            )
            wave.rotation.x = Math.PI * 0.5
            wave.position.set(0.1, 1.9, 0)
            roverGroup.add(wave)
            this.robotics.wifiWaves.push({ mesh: wave, material: this.wifiWaveMaterials[i], phase: i / 3 })
        }

        group.add(roverGroup)

        this.game.objects.add(
            { model: group },
            {
                type: 'fixed',
                position: pos,
                colliders: [
                    { shape: 'cylinder', parameters: [ 0.75, 1.55 ], position: { x: 0, y: 0.75, z: 0 } }
                ]
            }
        )

        this.registerZoneInteraction(
            cfg,
            group,
            new THREE.Vector3(0, 1.9, 0),
            () =>
            {
                this.game.portfolioUI?.openProjectsDrawer('project-robotics')
            }
        )
    }

    /**
     * 3. Network / Music Landmark: 5 Rhythmic 3D Equalizer Bars + Audio Deck
     */
    buildMusicEqualizerLandmark()
    {
        const cfg = LANDMARK_COORDS.musicEqualizer
        const pos = new THREE.Vector3(cfg.position.x, cfg.position.y, cfg.position.z)

        const group = new THREE.Group()
        group.position.copy(pos)
        group.add(this.createBasePad(3.5, this.emissiveAmber))

        const consoleDeck = new THREE.Mesh(
            new THREE.BoxGeometry(3.4, 0.65, 1.4),
            this.darkMetalMaterial
        )
        consoleDeck.position.set(0, 0.56, 0)
        consoleDeck.castShadow = true
        consoleDeck.receiveShadow = true
        group.add(consoleDeck)

        const speakerGeo = new THREE.BoxGeometry(0.75, 1.45, 0.82)
        const wooferGeo = new THREE.TorusGeometry(0.22, 0.045, 8, 20)
        for(const side of [-1, 1])
        {
            const speaker = new THREE.Mesh(speakerGeo, this.slateMaterial)
            speaker.position.set(side * 2.1, 0.96, 0)
            speaker.castShadow = true
            group.add(speaker)

            const woofer = new THREE.Mesh(wooferGeo, this.emissiveAmber)
            woofer.position.set(side * 2.1, 0.88, 0.43)
            group.add(woofer)

            const tweeter = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 10), this.emissiveCyan)
            tweeter.position.set(side * 2.1, 1.38, 0.42)
            group.add(tweeter)
        }

        const barGeo = new THREE.BoxGeometry(0.38, 1.0, 0.38)
        barGeo.translate(0, 0.5, 0)

        const barMaterials = [
            this.emissiveCyan,
            this.emissiveTeal,
            this.emissiveAmber,
            this.emissivePink,
            this.emissiveViolet
        ]

        for(let i = 0; i < 5; i++)
        {
            const x = (i - 2) * 0.58
            const bar = new THREE.Mesh(barGeo, barMaterials[i])
            bar.position.set(x, 0.9, 0)
            bar.castShadow = true
            group.add(bar)

            this.music.bars.push({
                mesh: bar,
                speed: 2.3 + i * 0.55,
                phase: i * 1.15,
                minHeight: 0.45,
                maxHeight: 2.55 - Math.abs(i - 2) * 0.22
            })
        }

        this.game.objects.add(
            { model: group },
            {
                type: 'fixed',
                position: pos,
                colliders: [
                    { shape: 'cuboid', parameters: [ 2.45, 0.9, 0.72 ], position: { x: 0, y: 0.9, z: 0 } }
                ]
            }
        )

        this.registerZoneInteraction(
            cfg,
            group,
            new THREE.Vector3(0, 2.0, 0),
            () =>
            {
                this.game.portfolioUI?.openProjectsDrawer('project-music')
            }
        )
    }

    /**
     * 4. AI / ML Landmark: Floating Rotating 3D Neural Network Graph
     */
    buildNeuralNetLandmark()
    {
        const cfg = LANDMARK_COORDS.aiNeuralNet
        const pos = new THREE.Vector3(cfg.position.x, cfg.position.y, cfg.position.z)

        const group = new THREE.Group()
        group.position.copy(pos)
        group.add(this.createBasePad(3.5, this.emissiveViolet))

        const pedestal = new THREE.Mesh(
            new THREE.CylinderGeometry(0.95, 1.25, 0.6, 12),
            this.darkMetalMaterial
        )
        pedestal.position.y = 0.52
        pedestal.castShadow = true
        group.add(pedestal)

        const emitterRing = new THREE.Mesh(
            new THREE.TorusGeometry(0.75, 0.05, 8, 24),
            this.emissiveViolet
        )
        emitterRing.rotation.x = Math.PI * 0.5
        emitterRing.position.y = 0.85
        group.add(emitterRing)

        const graphGroup = new THREE.Group()
        graphGroup.position.set(0, 2.45, 0)

        const layers = [
            [
                new THREE.Vector3(-1.25, -0.65, 0.25),
                new THREE.Vector3(-1.25, 0.0, -0.25),
                new THREE.Vector3(-1.25, 0.65, 0.25)
            ],
            [
                new THREE.Vector3(0, -0.85, -0.35),
                new THREE.Vector3(0, -0.28, 0.4),
                new THREE.Vector3(0, 0.28, -0.4),
                new THREE.Vector3(0, 0.85, 0.35)
            ],
            [
                new THREE.Vector3(1.25, -0.42, 0.15),
                new THREE.Vector3(1.25, 0.42, -0.15)
            ]
        ]

        const layerMats = [this.emissiveCyan, this.emissiveViolet, this.emissiveAmber]
        const nodeGeo = new THREE.SphereGeometry(0.18, 14, 14)

        layers.forEach((layer, layerIndex) =>
        {
            layer.forEach((nodePos, nodeIndex) =>
            {
                const sphere = new THREE.Mesh(nodeGeo, layerMats[layerIndex])
                sphere.position.copy(nodePos)
                graphGroup.add(sphere)
                this.neuralNet.nodes.push({ mesh: sphere, phase: layerIndex * 1.4 + nodeIndex * 0.7 })
            })
        })

        const upVec = new THREE.Vector3(0, 1, 0)
        const dirVec = new THREE.Vector3()
        const midVec = new THREE.Vector3()
        const synapseGeo = new THREE.CylinderGeometry(0.025, 0.025, 1, 6)

        for(let l = 0; l < layers.length - 1; l++)
        {
            for(const from of layers[l])
            {
                for(const to of layers[l + 1])
                {
                    dirVec.subVectors(to, from)
                    const length = dirVec.length()
                    midVec.addVectors(from, to).multiplyScalar(0.5)

                    const rod = new THREE.Mesh(synapseGeo, this.synapseMaterial)
                    rod.position.copy(midVec)
                    rod.scale.set(1, length, 1)
                    rod.quaternion.setFromUnitVectors(upVec, dirVec.clone().normalize())
                    graphGroup.add(rod)
                }
            }
        }

        group.add(graphGroup)
        this.neuralNet.graphGroup = graphGroup

        this.game.objects.add(
            { model: group },
            {
                type: 'fixed',
                position: pos,
                colliders: [
                    { shape: 'cylinder', parameters: [ 0.45, 1.2 ], position: { x: 0, y: 0.45, z: 0 } }
                ]
            }
        )

        this.registerZoneInteraction(
            cfg,
            group,
            new THREE.Vector3(0, 2.2, 0),
            () =>
            {
                this.game.portfolioUI?.openProjectsDrawer('project-ml')
            }
        )
    }

    /**
     * 5. Experience & Skills Hub Tower
     */
    buildExperienceSkillsLandmark()
    {
        const cfg = LANDMARK_COORDS.experienceSkillsTower
        const pos = new THREE.Vector3(cfg.position.x, cfg.position.y, cfg.position.z)

        const group = new THREE.Group()
        group.position.copy(pos)
        group.add(this.createBasePad(3.5, this.emissiveTeal))

        const tower = new THREE.Mesh(
            new THREE.BoxGeometry(1.1, 2.5, 1.1),
            this.darkMetalMaterial
        )
        tower.position.y = 1.45
        tower.castShadow = true
        tower.receiveShadow = true
        group.add(tower)

        const core = new THREE.Mesh(
            new THREE.SphereGeometry(0.42, 16, 16),
            this.emissiveTeal
        )
        core.position.y = 3.2
        group.add(core)

        const ringSpecs = [
            { radius: 0.92, mat: this.emissiveCyan, tiltX: 0.55, tiltZ: 0.25, speed: 0.9 },
            { radius: 1.18, mat: this.emissiveAmber, tiltX: -0.45, tiltZ: 0.65, speed: -0.7 },
            { radius: 1.42, mat: this.emissiveViolet, tiltX: 0.85, tiltZ: -0.35, speed: 0.55 }
        ]

        for(const spec of ringSpecs)
        {
            const ring = new THREE.Mesh(
                new THREE.TorusGeometry(spec.radius, 0.045, 8, 32),
                spec.mat
            )
            ring.position.y = 3.2
            ring.rotation.set(spec.tiltX, 0, spec.tiltZ)
            group.add(ring)
            this.experienceTower.rings.push({ mesh: ring, speed: spec.speed })
        }

        this.game.objects.add(
            { model: group },
            {
                type: 'fixed',
                position: pos,
                colliders: [
                    { shape: 'cuboid', parameters: [ 0.6, 1.35, 0.6 ], position: { x: 0, y: 1.35, z: 0 } }
                ]
            }
        )

        this.registerZoneInteraction(
            cfg,
            group,
            new THREE.Vector3(0, 2.2, 0),
            () =>
            {
                this.game.portfolioUI?.openDrawer('experience')
            }
        )
    }

    update()
    {
        const dt = Math.min(0.05, this.game.ticker.delta)
        const t = this.game.ticker.elapsed

        // 0. 3D Contact Pads hover / proximity lift & glow interpolation
        for(let i = 0; i < this.contactPads.length; i++)
        {
            const pad = this.contactPads[i]
            const active = pad.hovered || pad.near
            const targetLift = active ? 0.36 : 0
            const targetIntensity = active ? 3.8 : 1.75

            pad.currentLift += (targetLift - pad.currentLift) * Math.min(1, dt * 10)
            pad.currentIntensity += (targetIntensity - pad.currentIntensity) * Math.min(1, dt * 10)

            const idleBob = Math.sin(t * 2.2 + i * 1.1) * 0.045
            pad.tilePivot.position.y = 0.42 + pad.currentLift + idleBob
            pad.intensityUniform.value = pad.currentIntensity
        }

        // 1. Academic Vault permanently locked beacon pulse + "denied bounce" barrier shake
        if(this.vault.pivot)
        {
            let bounceAngle = 0
            if(this.vault.deniedTimer > 0)
            {
                this.vault.deniedTimer = Math.max(0, this.vault.deniedTimer - dt)
                // Crisp damped "denied bounce" lifting slightly then slapping back down onto the catch
                const env = this.vault.deniedTimer / 0.72
                bounceAngle = Math.abs(Math.sin(this.vault.deniedTimer * 34)) * 0.14 * env
            }
            this.vault.pivot.rotation.z = bounceAngle

            // Smooth color interpolation + intense red flash when access is forced
            this.vault.lampColorUniform.value.lerp(this.vault.baseColor, Math.min(1, dt * 6))
            this.vault.ringColorUniform.value.lerp(this.vault.baseColor, Math.min(1, dt * 6))

            if(this.vault.flashTimer > 0)
            {
                this.vault.flashTimer = Math.max(0, this.vault.flashTimer - dt)
                const strobe = Math.sin(this.vault.flashTimer * 42) > 0 ? 5.6 : 1.1
                this.vault.lampIntensityUniform.value = strobe
                this.vault.lampColorUniform.value.set('#ff1e42')
                if(this.vault.beaconMesh)
                    this.vault.beaconMesh.scale.setScalar(1.0 + (this.vault.flashTimer / 0.72) * 0.35)
            }
            else
            {
                // Steady locked breathing pulse
                const pulse = 2.1 + Math.sin(t * 3.4) * 0.9
                this.vault.lampIntensityUniform.value = pulse
                if(this.vault.beaconMesh)
                    this.vault.beaconMesh.scale.setScalar(1.0)
            }
        }

        // 2. Robotics Radar rotation + pulsing WiFi signal Torus waves
        if(this.robotics.radarPivot)
        {
            this.robotics.radarPivot.rotation.y = t * 1.15
        }
        for(const wave of this.robotics.wifiWaves)
        {
            const p = (t * 0.65 + wave.phase) % 1
            const scale = 0.35 + p * 2.1
            wave.mesh.scale.set(scale, scale, 1)
            wave.mesh.position.y = 1.65 + p * 1.35
            wave.material.opacity = (1 - p) * 0.85
        }

        // 3. Music Stream 3D Equalizer rhythmic sine bars
        for(const bar of this.music.bars)
        {
            const wave = (Math.sin(t * bar.speed + bar.phase) + Math.sin(t * bar.speed * 1.7 + bar.phase * 0.5) * 0.45) * 0.5 + 0.5
            const clamped = Math.max(0, Math.min(1, wave))
            bar.mesh.scale.y = bar.minHeight + clamped * (bar.maxHeight - bar.minHeight)
        }

        // 4. AI/ML 3D Neural Network gentle rotation, bobbing, and neuron pulse
        if(this.neuralNet.graphGroup)
        {
            this.neuralNet.graphGroup.rotation.y = t * 0.5
            this.neuralNet.graphGroup.position.y = 2.45 + Math.sin(t * 1.6) * 0.16
        }
        for(const node of this.neuralNet.nodes)
        {
            const pulse = 0.88 + Math.sin(t * 3.0 + node.phase) * 0.18
            node.mesh.scale.setScalar(pulse)
        }

        // 5. Experience & Skills Tower orbiting gyro rings
        for(const item of this.experienceTower.rings)
        {
            item.mesh.rotation.y += item.speed * dt
            item.mesh.rotation.x += item.speed * 0.35 * dt
        }
    }
}
