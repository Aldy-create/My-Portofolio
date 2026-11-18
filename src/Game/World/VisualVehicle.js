import * as THREE from 'three/webgpu'
import { Game } from '../Game.js'
import { Track } from '../Tracks.js'
import { Trails } from '../Trails.js'
import { clamp, remapClamp } from '../utilities/maths.js'
import { color, luminance, mix, uniform, uv, vec3 } from 'three/tsl'
import { MeshDefaultMaterial } from '../Materials/MeshDefaultMaterial.js'

export class VisualVehicle
{
    constructor()
    {
        this.game = Game.getInstance()

        this.setPaints()
        this.setMaterials()
        this.setModel()
        this.setMainGroundTrack()
        this.setWheels()
        this.setBoostTrails()
        this.setScreenPosition()

        this.game.ticker.events.on('tick', () =>
        {
            this.update()
        }, 8)
    }

    setPaints()
    {
        this.paintPresets = {
            crimson: { colorA: '#ff3a3a', colorB: '#721551', label: 'Crimson Red' },
            solar:   { colorA: '#ff940d', colorB: '#af0071', label: 'Solar Orange' },
            cyber:   { colorA: '#3af2ff', colorB: '#2a22b5', label: 'Cyber Cyan' },
            stealth: { colorA: '#626262', colorB: '#222126', label: 'Stealth Obsidian' },
        }
        this.currentPaintKey = 'crimson'
        this.paintColorA = uniform(new THREE.Color(this.paintPresets.crimson.colorA))
        this.paintColorB = uniform(new THREE.Color(this.paintPresets.crimson.colorB))

        this.bodyMaterial = new MeshDefaultMaterial({
            colorNode: mix(this.paintColorA, this.paintColorB, uv().y)
        })
    }

    cyclePaint()
    {
        const keys = Object.keys(this.paintPresets)
        const nextKey = keys[(keys.indexOf(this.currentPaintKey) + 1) % keys.length]
        this.currentPaintKey = nextKey
        const preset = this.paintPresets[nextKey]
        this.paintColorA.value.set(preset.colorA)
        this.paintColorB.value.set(preset.colorB)
        return preset.label
    }

    setMaterials()
    {
        this.darkMetalMaterial = new MeshDefaultMaterial({
            colorNode: color('#2b2933')
        })
        this.lightMetalMaterial = new MeshDefaultMaterial({
            colorNode: color('#d6d9e0')
        })
        this.glassMaterial = new MeshDefaultMaterial({
            colorNode: color('#1b263b')
        })
        this.tireMaterial = new MeshDefaultMaterial({
            colorNode: color('#1f1e24')
        })

        // HDR Emissive materials for BloomNode (> 1.0 threshold)
        const headColor = color('#fff4d2')
        this.headlightMaterial = new THREE.MeshBasicNodeMaterial()
        this.headlightMaterial.colorNode = headColor.div(luminance(headColor)).mul(2.4)

        const brakeColor = color('#ff3e00')
        this.brakeLightMaterial = new THREE.MeshBasicNodeMaterial()
        this.brakeLightMaterial.colorNode = brakeColor.div(luminance(brakeColor)).mul(3.5)

        this.reverseLightMaterial = new THREE.MeshBasicNodeMaterial({
            colorNode: vec3(2.2)
        })

        const energyOffColor = color('#3a2c47')
        const energyOnColor = color('#d938ff')
        this.boostMixUniform = uniform(0)
        this.energyMaterial = new THREE.MeshBasicNodeMaterial()
        this.energyMaterial.colorNode = mix(
            energyOffColor,
            energyOnColor.div(luminance(energyOnColor)).mul(3.8),
            this.boostMixUniform
        )
    }

    setModel()
    {
        this.parts = {}
        this.parts.chassis = new THREE.Group()
        this.parts.chassis.rotation.reorder('YXZ')
        this.game.scene.add(this.parts.chassis)

        // Lower chassis tub
        const lowerTub = new THREE.Mesh(
            new THREE.BoxGeometry(2.55, 0.36, 1.46),
            this.darkMetalMaterial
        )
        lowerTub.position.set(0, -0.1, 0)
        lowerTub.castShadow = true
        lowerTub.receiveShadow = true
        this.parts.chassis.add(lowerTub)

        // Main painted body shell
        const mainBody = new THREE.Mesh(
            new THREE.BoxGeometry(2.38, 0.42, 1.56),
            this.bodyMaterial
        )
        mainBody.position.set(-0.02, 0.14, 0)
        mainBody.castShadow = true
        mainBody.receiveShadow = true
        this.parts.chassis.add(mainBody)

        // Sloped front hood
        const hood = new THREE.Mesh(
            new THREE.BoxGeometry(0.85, 0.25, 1.38),
            this.bodyMaterial
        )
        hood.position.set(0.85, 0.24, 0)
        hood.rotation.z = -0.18
        hood.castShadow = true
        hood.receiveShadow = true
        this.parts.chassis.add(hood)

        // Cabin & Windshield
        const cabin = new THREE.Mesh(
            new THREE.BoxGeometry(1.05, 0.42, 1.32),
            this.glassMaterial
        )
        cabin.position.set(-0.08, 0.48, 0)
        cabin.castShadow = true
        cabin.receiveShadow = true
        this.parts.chassis.add(cabin)

        const roof = new THREE.Mesh(
            new THREE.BoxGeometry(0.92, 0.08, 1.36),
            this.bodyMaterial
        )
        roof.position.set(-0.12, 0.71, 0)
        roof.castShadow = true
        roof.receiveShadow = true
        this.parts.chassis.add(roof)

        // Front bull-bar bumper
        const bullBar = new THREE.Mesh(
            new THREE.BoxGeometry(0.18, 0.26, 1.54),
            this.lightMetalMaterial
        )
        bullBar.position.set(1.32, -0.02, 0)
        bullBar.castShadow = true
        this.parts.chassis.add(bullBar)

        // Headlights
        const headGeo = new THREE.BoxGeometry(0.08, 0.14, 0.28)
        const headLeft = new THREE.Mesh(headGeo, this.headlightMaterial)
        headLeft.position.set(1.22, 0.15, -0.52)
        const headRight = new THREE.Mesh(headGeo, this.headlightMaterial)
        headRight.position.set(1.22, 0.15, 0.52)
        this.parts.chassis.add(headLeft, headRight)

        // Brake & Reverse taillights
        const tailGeo = new THREE.BoxGeometry(0.08, 0.14, 0.34)
        this.parts.stopLights = new THREE.Group()
        const stopL = new THREE.Mesh(tailGeo, this.brakeLightMaterial)
        stopL.position.set(-1.22, 0.18, -0.52)
        const stopR = new THREE.Mesh(tailGeo, this.brakeLightMaterial)
        stopR.position.set(-1.22, 0.18, 0.52)
        this.parts.stopLights.add(stopL, stopR)
        this.parts.stopLights.visible = false
        this.parts.chassis.add(this.parts.stopLights)

        this.parts.backLights = new THREE.Group()
        const backL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.10, 0.22), this.reverseLightMaterial)
        backL.position.set(-1.23, 0.05, -0.52)
        const backR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.10, 0.22), this.reverseLightMaterial)
        backR.position.set(-1.23, 0.05, 0.52)
        this.parts.backLights.add(backL, backR)
        this.parts.backLights.visible = false
        this.parts.chassis.add(this.parts.backLights)

        // 3 Boost Energy Cells on Rear Deck
        this.parts.cells = []
        const cellGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.28, 12)
        const cellOffsetsZ = [-0.28, 0, 0.28]
        for(let i = 0; i < 3; i++)
        {
            const cell = new THREE.Mesh(cellGeo, this.energyMaterial)
            cell.position.set(-0.88, 0.42, cellOffsetsZ[i])
            cell.castShadow = true
            this.parts.chassis.add(cell)
            this.parts.cells.push(cell)
        }

        // Roof Radar Antenna pointing to nearest interactive zone
        this.antenna = {}
        this.antenna.target = new THREE.Vector3(0, 2, -12)
        this.antenna.pivot = new THREE.Group()
        this.antenna.pivot.position.set(-0.35, 0.76, 0)
        this.parts.chassis.add(this.antenna.pivot)

        const mast = new THREE.Mesh(
            new THREE.CylinderGeometry(0.03, 0.04, 0.38, 8),
            this.lightMetalMaterial
        )
        mast.position.y = 0.19
        this.antenna.pivot.add(mast)

        this.antenna.rotor = new THREE.Mesh(
            new THREE.BoxGeometry(0.26, 0.10, 0.10),
            this.energyMaterial
        )
        this.antenna.rotor.position.set(0.08, 0.38, 0)
        this.antenna.pivot.add(this.antenna.rotor)
    }

    setMainGroundTrack()
    {
        this.mainGroundTrack = this.game.tracks.add(new Track(1.5, 'g'))
    }

    setWheels()
    {
        this.wheels = {}
        this.wheels.items = []
        this.wheels.steering = 0

        const tireGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.34, 20)
        tireGeo.rotateX(Math.PI * 0.5)

        const rimGeo = new THREE.CylinderGeometry(0.23, 0.23, 0.36, 12)
        rimGeo.rotateX(Math.PI * 0.5)

        const hubCapGeo = new THREE.BoxGeometry(0.32, 0.10, 0.37)
        const strutGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.0, 8)
        strutGeo.translate(0, 0.5, 0)

        for(let i = 0; i < 4; i++)
        {
            const wheel = {}
            wheel.container = new THREE.Group()
            this.parts.chassis.add(wheel.container)

            wheel.suspension = new THREE.Mesh(strutGeo, this.lightMetalMaterial)
            wheel.container.add(wheel.suspension)

            wheel.cylinder = new THREE.Group()
            const tireMesh = new THREE.Mesh(tireGeo, this.tireMaterial)
            tireMesh.castShadow = true
            tireMesh.receiveShadow = true

            const rimMesh = new THREE.Mesh(rimGeo, this.bodyMaterial)
            const spokeMesh = new THREE.Mesh(hubCapGeo, this.lightMetalMaterial)

            wheel.cylinder.add(tireMesh, rimMesh, spokeMesh)
            wheel.container.add(wheel.cylinder)

            if(i === 0 || i === 2)
                wheel.container.rotation.y = Math.PI

            wheel.groundTrack = this.game.tracks.add(new Track(0.5, 'r'))
            this.wheels.items.push(wheel)
        }
    }

    setBoostTrails()
    {
        this.boostTrails = {}
        this.boostTrails.instance = new Trails()

        this.boostTrails.leftReference = new THREE.Object3D()
        this.boostTrails.leftReference.position.set(-1.28, 0.1, -0.52)
        this.parts.chassis.add(this.boostTrails.leftReference)

        this.boostTrails.left = this.boostTrails.instance.create()
        this.boostTrails.leftReference.getWorldPosition(this.boostTrails.left.position)

        this.boostTrails.rightReference = new THREE.Object3D()
        this.boostTrails.rightReference.position.set(-1.28, 0.1, 0.52)
        this.parts.chassis.add(this.boostTrails.rightReference)

        this.boostTrails.right = this.boostTrails.instance.create()
        this.boostTrails.rightReference.getWorldPosition(this.boostTrails.right.position)

        this.boostAnimation = { mix: 0, speed: 1.4 }
    }

    setScreenPosition()
    {
        this.screenPosition = new THREE.Vector2(0.5, 0.5)
    }

    update()
    {
        const physicalVehicle = this.game.physicalVehicle

        this.parts.chassis.position.copy(physicalVehicle.position)
        this.parts.chassis.quaternion.copy(physicalVehicle.quaternion)

        this.wheels.steering += ((this.game.player.steering * physicalVehicle.steeringAmplitude) - this.wheels.steering) * this.game.ticker.deltaScaled * 16

        const wheelsRotation = (physicalVehicle.forwardSpeed) / physicalVehicle.wheels.settings.radius * 0.012

        for(let i = 0; i < 4; i++)
        {
            const visualWheel = this.wheels.items[i]
            const physicalWheel = physicalVehicle.wheels.items[i]

            if(!this.game.inputs.actions.get('brake').active || this.game.inputs.actions.get('forward').active || this.game.inputs.actions.get('backward').active)
            {
                if(i === 0 || i === 2)
                    visualWheel.cylinder.rotation.z += wheelsRotation
                else
                    visualWheel.cylinder.rotation.z -= wheelsRotation
            }

            if(i === 0)
                visualWheel.container.rotation.y = Math.PI + this.wheels.steering
            if(i === 1)
                visualWheel.container.rotation.y = this.wheels.steering

            const suspensionLength = physicalWheel.suspensionLength
            let wheelY = physicalWheel.basePosition.y - suspensionLength
            wheelY = Math.min(wheelY, -0.45)

            visualWheel.container.position.x = physicalWheel.basePosition.x
            visualWheel.container.position.y += (wheelY - visualWheel.container.position.y) * Math.min(1, 25 * this.game.ticker.deltaScaled)
            visualWheel.container.position.z = physicalWheel.basePosition.z

            if(visualWheel.suspension)
            {
                const suspensionScale = Math.max(0.15, Math.abs(visualWheel.container.position.y) - 0.35)
                visualWheel.suspension.scale.y = suspensionScale
            }

            visualWheel.groundTrack.update(physicalWheel.contactPoint, physicalWheel.inContact)
        }

        this.mainGroundTrack.update(physicalVehicle.position, physicalVehicle.position.y < 1.5)

        // Point roof antenna toward closest interactive point
        if(this.antenna && this.game.interactivePoints?.items.length)
        {
            let closestDist = Infinity
            let closestPos = null
            for(const pt of this.game.interactivePoints.items)
            {
                const d = Math.hypot(pt.position.x - physicalVehicle.position.x, pt.position.y - physicalVehicle.position.z)
                if(d < closestDist)
                {
                    closestDist = d
                    closestPos = pt.position
                }
            }
            if(closestPos)
            {
                const angle = Math.atan2(closestPos.x - physicalVehicle.position.x, closestPos.y - physicalVehicle.position.z)
                this.antenna.pivot.rotation.y = angle - this.parts.chassis.rotation.y
                const spinSpeed = remapClamp(closestDist, 35, 4, 1.5, 12)
                this.antenna.rotor.rotation.x += this.game.ticker.deltaScaled * spinSpeed
            }
        }

        // Stop & reverse lights
        if(this.game.player.braking)
        {
            this.parts.stopLights.visible = true
            this.parts.backLights.visible = false
        }
        else
        {
            this.parts.stopLights.visible = false
            this.parts.backLights.visible = this.game.player.accelerating < -0.05
        }

        // Boost trails
        const trailAlpha = physicalVehicle.goingForward && this.game.player.boosting && this.game.player.accelerating > 0 ? 1 : 0
        this.boostTrails.leftReference.getWorldPosition(this.boostTrails.left.position)
        this.boostTrails.left.alpha = trailAlpha
        this.boostTrails.rightReference.getWorldPosition(this.boostTrails.right.position)
        this.boostTrails.right.alpha = trailAlpha

        // Boost energy cells animation
        this.boostAnimation.mix += (this.game.player.boosting ? 1 : -1) * this.game.ticker.deltaScaled * this.boostAnimation.speed
        this.boostAnimation.mix = clamp(this.boostAnimation.mix, 0, 1)
        this.boostMixUniform.value = 1 - Math.pow(1 - this.boostAnimation.mix, 5)

        if(this.parts.cells)
        {
            this.parts.cells[0].position.y = remapClamp(this.boostAnimation.mix, 0.0, 0.6, 0.42, 0.25)
            this.parts.cells[2].position.y = remapClamp(this.boostAnimation.mix, 0.2, 0.8, 0.42, 0.25)
            this.parts.cells[1].position.y = remapClamp(this.boostAnimation.mix, 0.4, 1.0, 0.42, 0.25)
        }

        const vector = new THREE.Vector3()
        vector.setFromMatrixPosition(this.parts.chassis.matrixWorld)
        vector.project(this.game.view.camera)

        this.screenPosition.x = (vector.x * 0.5 + 0.5)
        this.screenPosition.y = (vector.y * -0.5 + 0.5)
    }
}
