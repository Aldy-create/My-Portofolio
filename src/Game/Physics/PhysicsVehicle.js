import * as THREE from 'three/webgpu'
import { Game } from '../Game.js'
import { Events } from '../Events.js'
import { lerp, smallestAngle } from '../utilities/maths.js'

export class PhysicsVehicle
{
    constructor()
    {
        this.game = Game.getInstance()
        this.events = new Events()

        // Exact reverse-engineered parameters from 04-physics-controls.md
        this.steeringAmplitude = 0.5
        this.engineForceAmplitude = 300
        this.boostMultiplier = 2
        this.topSpeed = 5
        this.topSpeedBoost = 40
        this.brakeAmplitude = 35
        this.idleBrake = 0.06
        this.reverseBrake = 0.4

        this.sideward = new THREE.Vector3(0, 0, 1)
        this.upward = new THREE.Vector3(0, 1, 0)
        this.forward = new THREE.Vector3(1, 0, 0)
        this.position = new THREE.Vector3(0, 2.5, 0)
        this.quaternion = new THREE.Quaternion()
        this.velocity = new THREE.Vector3()
        this.direction = this.forward.clone()
        this.speed = 0
        this.xzSpeed = 0
        this.forwardRatio = 1
        this.goingForward = true
        this.forwardSpeed = 0

        this.suspensionsHeights = {
            low: 0.88,
            mid: 1.23,
            high: 1.63
        }
        this.suspensionsStiffness = {
            low: 20,
            mid: 30,
            high: 40
        }

        this.setChassis()
        this.controller = this.game.physics.world.createVehicleController(this.chassis.physical.body)
        this.setWheels()
        this.setStop()
        this.setUpsideDown()
        this.setStuck()
        this.setFlip()

        this.game.ticker.events.on('tick', () =>
        {
            this.updatePrePhysics()
        }, 2)
        this.game.ticker.events.on('tick', () =>
        {
            this.updatePostPhysics()
        }, 5)
    }

    setChassis()
    {
        this.chassis = {}
        const object = this.game.objects.add(null, {
            type: 'dynamic',
            position: this.position,
            friction: 0.4,
            linearDamping: 0.14,
            angularDamping: 0.48,
            rotation: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0),
            colliders: [
                // 1. Main Body with low Center of Mass (y: -1.15) for anti-roll stability
                { shape: 'cuboid', mass: 2.8, parameters: [ 1.3, 0.4, 0.85 ], position: { x: 0, y: -0.1, z: 0 }, centerOfMass: { x: 0, y: -1.15, z: 0 } },
                // 2. Top Cabin
                { shape: 'cuboid', mass: 0, parameters: [ 0.5, 0.15, 0.65 ], position: { x: 0, y: 0.4, z: 0 } },
                // 3. Bumper (only collides with dynamic objects, ignores floor)
                { shape: 'cuboid', mass: 0, parameters: [ 1.5, 0.5, 0.9 ], position: { x: 0.1, y: -0.2, z: 0 }, category: 'bumper' },
            ],
            canSleep: false,
            waterGravityMultiplier: 0,
            onCollision: (force, position) =>
            {
                if(force > 8 && this.game.view)
                {
                    this.game.view.roll.kick(Math.min(2.5, force * 0.04))
                    this.game.soundEngine?.impact(force)
                }
            }
        })
        this.chassis.physical = object.physical
        this.chassis.mass = this.chassis.physical.body.mass()
    }

    setWheels()
    {
        this.wheels = {}
        this.wheels.inContactCount = 0
        this.wheels.justTouchedCount = 0
        this.wheels.items = []

        for(let i = 0; i < 4; i++)
        {
            const wheel = {}
            wheel.inContact = false
            wheel.contactPoint = new THREE.Vector3()
            wheel.suspensionLength = 0.88
            wheel.suspensionState = 'low'
            wheel.lastTouchTime = this.game.ticker.elapsed
            wheel.basePosition = new THREE.Vector3()

            this.controller.addWheel(new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), 1, 1)
            this.wheels.items.push(wheel)
        }

        this.wheels.settings = {
            offset: { x: 0.90, y: 0, z: 0.75 },
            radius: 0.4,
            directionCs: { x: 0, y: -1, z: 0 },
            axleCs: { x: 0, y: 0, z: 1 },
            frictionSlip: 0.9,
            maxSuspensionForce: 150,
            maxSuspensionTravel: 2,
            sideFrictionStiffness: 3,
            suspensionCompression: 10,
            suspensionRelaxation: 2.7,
            suspensionStiffness: 25,
        }

        this.wheels.updateSettings = () =>
        {
            this.wheels.perimeter = this.wheels.settings.radius * Math.PI * 2

            const wheelsPositions = [
                new THREE.Vector3(  this.wheels.settings.offset.x, this.wheels.settings.offset.y,   this.wheels.settings.offset.z),
                new THREE.Vector3(  this.wheels.settings.offset.x, this.wheels.settings.offset.y, - this.wheels.settings.offset.z),
                new THREE.Vector3(- this.wheels.settings.offset.x, this.wheels.settings.offset.y,   this.wheels.settings.offset.z),
                new THREE.Vector3(- this.wheels.settings.offset.x, this.wheels.settings.offset.y, - this.wheels.settings.offset.z),
            ]

            let i = 0
            for(const wheel of this.wheels.items)
            {
                wheel.basePosition.copy(wheelsPositions[i])

                this.controller.setWheelDirectionCs(i, this.wheels.settings.directionCs)
                this.controller.setWheelAxleCs(i, this.wheels.settings.axleCs)
                this.controller.setWheelRadius(i, this.wheels.settings.radius)
                this.controller.setWheelChassisConnectionPointCs(i, wheel.basePosition)
                this.controller.setWheelFrictionSlip(i, this.wheels.settings.frictionSlip)
                this.controller.setWheelMaxSuspensionForce(i, this.wheels.settings.maxSuspensionForce)
                this.controller.setWheelMaxSuspensionTravel(i, this.wheels.settings.maxSuspensionTravel)
                this.controller.setWheelSideFrictionStiffness(i, this.wheels.settings.sideFrictionStiffness)
                this.controller.setWheelSuspensionCompression(i, this.wheels.settings.suspensionCompression)
                this.controller.setWheelSuspensionRelaxation(i, this.wheels.settings.suspensionRelaxation)

                i++
            }
        }

        this.wheels.updateSettings()
    }

    setStop()
    {
        this.stop = {}
        this.stop.active = true
        this.stop.lowThreshold = 0.04
        this.stop.highThreshold = 0.7

        this.stop.test = () =>
        {
            if(this.speed < this.stop.lowThreshold)
            {
                if(!this.stop.active)
                {
                    this.stop.active = true
                    this.events.trigger('stop')
                }
            }
            else if(this.speed > this.stop.highThreshold)
            {
                if(this.stop.active)
                {
                    this.stop.active = false
                    this.events.trigger('start')
                }
            }
        }
    }

    setUpsideDown()
    {
        this.upsideDown = {}
        this.upsideDown.active = false
        this.upsideDown.ratio = 0
        this.upsideDown.threshold = 0.28
        this.upsideDown.elapsed = 0

        this.upsideDown.test = () =>
        {
            this.upsideDown.ratio = this.upward.dot(new THREE.Vector3(0, -1, 0)) * 0.5 + 0.5

            if(this.upsideDown.ratio > this.upsideDown.threshold)
            {
                this.upsideDown.elapsed += this.game.ticker.delta
                if(!this.upsideDown.active)
                {
                    this.upsideDown.active = true
                    this.events.trigger('upsideDown', [ this.upsideDown.ratio ])
                }

                // Guaranteed upright recovery if flipped for > 1.4s
                if(this.upsideDown.elapsed > 1.4)
                {
                    this.upsideDown.elapsed = 0
                    const heading = Math.atan2(this.forward.z, this.forward.x)
                    this.moveTo(
                        new THREE.Vector3(this.position.x, Math.max(1.8, this.position.y + 1.1), this.position.z),
                        -heading
                    )
                }
            }
            else
            {
                this.upsideDown.elapsed = 0
                if(this.upsideDown.active)
                {
                    this.upsideDown.active = false
                    this.events.trigger('rightSideUp')
                }
            }
        }
    }

    setStuck()
    {
        this.stuck = {}
        this.stuck.durationTest = 3
        this.stuck.durationSaved = 0
        this.stuck.savedItems = []
        this.stuck.distance = 0
        this.stuck.distanceThreshold = 0.5
        this.stuck.active = false

        this.stuck.accumulate = (traveled, time) =>
        {
            this.stuck.savedItems.unshift([traveled, time])
            this.stuck.distance = 0
            this.stuck.durationSaved = 0

            for(let i = 0; i < this.stuck.savedItems.length; i++)
            {
                const item = this.stuck.savedItems[i]

                if(this.stuck.durationSaved >= this.stuck.durationTest)
                {
                    this.stuck.savedItems.splice(i)
                    break
                }
                else
                {
                    this.stuck.distance += item[0]
                    this.stuck.durationSaved += item[1]
                }
            }
        }

        this.stuck.test = () =>
        {
            if(this.stuck.durationSaved >= this.stuck.durationTest && this.stuck.distance < this.stuck.distanceThreshold)
            {
                if(!this.stuck.active)
                {
                    this.stuck.active = true
                    this.events.trigger('stuck')
                }
            }
            else
            {
                if(this.stuck.active)
                {
                    this.stuck.active = false
                    this.events.trigger('unstuck')
                }
            }
        }
    }

    setFlip()
    {
        this.flip = {}
        this.flip.force = 5
        let inAir = false
        let previousXAngle = 0
        let accumulatedXAngle = 0
        let previousZAngle = 0
        let accumulatedZAngle = 0

        this.flip.test = () =>
        {
            if(this.wheels.inContactCount === 0)
            {
                if(!inAir)
                {
                    inAir = true
                    previousXAngle = this.xRotation
                    accumulatedXAngle = 0
                    previousZAngle = this.zRotation
                    accumulatedZAngle = 0
                }
            }

            if(this.wheels.inContactCount >= 4)
            {
                if(inAir)
                {
                    inAir = false

                    if(Math.abs(accumulatedXAngle) < 1 && Math.abs(accumulatedZAngle) > 5)
                    {
                        this.events.trigger('flip', [ Math.sign(accumulatedZAngle) ])
                    }
                }
            }
            else
            {
                if(inAir)
                {
                    accumulatedXAngle += smallestAngle(previousXAngle, this.xRotation)
                    previousXAngle = this.xRotation

                    accumulatedZAngle += smallestAngle(previousZAngle, this.zRotation)
                    previousZAngle = this.zRotation
                }
            }
        }

        this.flip.jump = () =>
        {
            accumulatedXAngle = 0
            accumulatedZAngle = 0

            const up = new THREE.Vector3(0, 1, 0)
            const sidewardDot = up.dot(this.sideward)
            const forwardDot = up.dot(this.forward)
            const upwardDot = up.dot(this.upward)

            const sidewardAbsolute = Math.abs(sidewardDot)
            const forwardAbsolute = Math.abs(forwardDot)
            const upwardAbsolute = Math.abs(upwardDot)

            const impulse = new THREE.Vector3(0, 1, 0).multiplyScalar(this.flip.force * this.chassis.mass)
            this.chassis.physical.body.applyImpulse(impulse, true)

            if(upwardAbsolute > sidewardAbsolute && upwardAbsolute > forwardAbsolute)
            {
                const torqueX = 0.8 * this.chassis.mass
                const torque = new THREE.Vector3(torqueX, 0, 0)
                const rot = this.chassis.physical.body.rotation()
                torque.applyQuaternion(new THREE.Quaternion(rot.x, rot.y, rot.z, rot.w))
                this.chassis.physical.body.applyTorqueImpulse(torque, true)
            }
            else
            {
                const torqueX = sidewardDot * 0.4 * this.chassis.mass
                const torqueZ = -forwardDot * 0.8 * this.chassis.mass
                const torque = new THREE.Vector3(torqueX, 0, torqueZ)
                const rot = this.chassis.physical.body.rotation()
                torque.applyQuaternion(new THREE.Quaternion(rot.x, rot.y, rot.z, rot.w))
                this.chassis.physical.body.applyTorqueImpulse(torque, true)
            }
        }
    }

    moveTo(position, rotation = 0)
    {
        const quaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotation)
        this.chassis.physical.body.setTranslation(position, true)
        this.chassis.physical.body.setRotation(quaternion, true)
        this.chassis.physical.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
        this.chassis.physical.body.setAngvel({ x: 0, y: 0, z: 0 }, true)

        this.position.copy(position)
    }

    updatePrePhysics()
    {
        const topSpeed = lerp(this.topSpeed, this.topSpeedBoost, this.game.player.boosting)
        const overflowSpeed = Math.max(0, this.speed - topSpeed)
        let engineForce = (this.game.player.accelerating * (1 + this.game.player.boosting * this.boostMultiplier)) * this.engineForceAmplitude / (1 + overflowSpeed) * this.game.ticker.deltaScaled

        let brake = this.game.player.braking

        if(!this.game.player.braking && Math.abs(this.game.player.accelerating) < 0.1)
            brake = this.idleBrake

        if(
            this.speed > 0.5 &&
            (
                (this.game.player.accelerating > 0 && !this.goingForward) ||
                (this.game.player.accelerating < 0 && this.goingForward)
            )
        )
        {
            brake = this.reverseBrake
            engineForce = 0
        }

        brake *= this.brakeAmplitude * this.game.ticker.deltaScaled

        const steer = this.game.player.steering * this.steeringAmplitude

        this.controller.setWheelSteering(0, steer)
        this.controller.setWheelSteering(1, steer)

        for(let i = 0; i < 4; i++)
        {
            const suspState = this.game.player.suspensions[i] || 'low'
            this.controller.setWheelBrake(i, brake)
            this.controller.setWheelEngineForce(i, engineForce)
            this.controller.setWheelSuspensionRestLength(i, this.suspensionsHeights[suspState])
            this.controller.setWheelSuspensionStiffness(i, this.suspensionsStiffness[suspState])
        }

        const delta = this.game.quality.level === 1 ? 1 / 60 : Math.min(1 / 60, this.game.ticker.deltaAverage)
        this.controller.updateVehicle(delta)
    }

    updatePostPhysics()
    {
        const trans = this.chassis.physical.body.translation()
        const newPosition = new THREE.Vector3(trans.x, trans.y, trans.z)
        this.velocity = newPosition.clone().sub(this.position)
        this.direction = this.velocity.lengthSq() > 0.000001 ? this.velocity.clone().normalize() : this.forward.clone()
        this.position.copy(newPosition)

        const rot = this.chassis.physical.body.rotation()
        this.quaternion.set(rot.x, rot.y, rot.z, rot.w)
        this.sideward.set(0, 0, 1).applyQuaternion(this.quaternion)
        this.upward.set(0, 1, 0).applyQuaternion(this.quaternion)
        this.forward.set(1, 0, 0).applyQuaternion(this.quaternion)

        this.speed = this.velocity.length() / this.game.ticker.deltaScaled
        this.xzSpeed = Math.hypot(this.velocity.x, this.velocity.z) / this.game.ticker.deltaScaled
        this.forwardRatio = this.direction.dot(this.forward)
        this.goingForward = this.forwardRatio > 0.5
        this.forwardSpeed = this.speed * this.forwardRatio

        this.xRotation = new THREE.Euler().setFromQuaternion(this.quaternion, 'XYZ').x
        this.yRotation = new THREE.Euler().setFromQuaternion(this.quaternion, 'YXZ').y
        this.zRotation = new THREE.Euler().setFromQuaternion(this.quaternion, 'ZYX').z

        if(Math.abs(this.game.player.accelerating) > 0.5)
            this.stuck.accumulate(this.velocity.length(), this.game.ticker.deltaScaled)

        let inContactCount = 0
        for(let i = 0; i < 4; i++)
        {
            const wheel = this.wheels.items[i]
            const inContact = this.controller.wheelIsInContact(i)

            if(inContact && !wheel.inContact)
            {
                wheel.lastTouchTime = this.game.ticker.elapsed
            }

            wheel.inContact = inContact
            const cp = this.controller.wheelContactPoint(i)
            if(cp)
                wheel.contactPoint.set(cp.x, cp.y, cp.z)
            else
                wheel.contactPoint.copy(this.position)

            wheel.suspensionLength = this.controller.wheelSuspensionLength(i) ?? 0.88

            if(wheel.inContact)
                inContactCount++
        }

        let justTouchedCount = 0
        if(inContactCount > this.wheels.inContactCount)
        {
            for(const wheel of this.wheels.items)
            {
                if(wheel.lastTouchTime > this.game.ticker.elapsed - 0.2)
                    justTouchedCount++
            }
        }

        this.wheels.inContactCount = inContactCount
        this.wheels.justTouchedCount = justTouchedCount

        this.stop.test()
        this.upsideDown.test()
        this.stuck.test()
        this.flip.test()
    }
}
