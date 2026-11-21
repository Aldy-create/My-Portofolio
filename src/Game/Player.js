import { Game } from './Game.js'
import gsap from 'gsap'
import * as THREE from 'three/webgpu'

export class Player
{
    static STATE_DEFAULT = 1
    static STATE_LOCKED = 2

    constructor()
    {
        this.game = Game.getInstance()

        this.state = Player.STATE_DEFAULT
        this.accelerating = 0
        this.steering = 0
        this.boosting = 0
        this.braking = 0
        this.suspensions = ['low', 'low', 'low', 'low']

        this.spawnPoint = {
            position: new THREE.Vector3(0, 2.2, 0),
            rotation: 0
        }

        this.position = this.spawnPoint.position.clone()
        this.position2 = new THREE.Vector2(this.position.x, this.position.z)
        this.rotationY = 0
        this.distanceDriven = 0

        this.setInputs()
        this.setUnstuck()

        this.game.physicalVehicle.chassis.physical.initialState.position.x = this.spawnPoint.position.x
        this.game.physicalVehicle.chassis.physical.initialState.position.y = this.spawnPoint.position.y
        this.game.physicalVehicle.chassis.physical.initialState.position.z = this.spawnPoint.position.z
        this.game.physicalVehicle.moveTo(this.spawnPoint.position, this.spawnPoint.rotation)

        this.game.ticker.events.on('tick', () =>
        {
            this.updatePrePhysics()
        }, 1)

        this.game.ticker.events.on('tick', () =>
        {
            this.updatePostPhysics()
        }, 6)
    }

    setInputs()
    {
        this.game.inputs.addActions([
            { name: 'forward',               categories: [ 'wandering', 'racing', 'cinematic' ], keys: [ 'Keyboard.ArrowUp', 'Keyboard.KeyW', 'Gamepad.up', 'Gamepad.r2' ] },
            { name: 'right',                 categories: [ 'wandering', 'racing', 'cinematic' ], keys: [ 'Keyboard.ArrowRight', 'Keyboard.KeyD', 'Gamepad.right' ] },
            { name: 'backward',              categories: [ 'wandering', 'racing', 'cinematic' ], keys: [ 'Keyboard.ArrowDown', 'Keyboard.KeyS', 'Gamepad.down', 'Gamepad.l2' ] },
            { name: 'left',                  categories: [ 'wandering', 'racing', 'cinematic' ], keys: [ 'Keyboard.ArrowLeft', 'Keyboard.KeyA', 'Gamepad.left' ] },
            { name: 'boost',                 categories: [ 'wandering', 'racing'              ], keys: [ 'Keyboard.ShiftLeft', 'Keyboard.ShiftRight', 'Gamepad.circle' ] },
            { name: 'brake',                 categories: [ 'wandering', 'racing'              ], keys: [ 'Keyboard.KeyB', 'Keyboard.ControlLeft', 'Gamepad.square' ] },
            { name: 'respawn',               categories: [ 'wandering'                        ], keys: [ 'Keyboard.KeyR', 'Gamepad.select' ] },
            { name: 'suspensions',           categories: [ 'wandering', 'racing'              ], keys: [ 'Keyboard.Numpad5', 'Keyboard.Space', 'Gamepad.triangle' ] },
            { name: 'suspensionsFront',      categories: [ 'wandering', 'racing'              ], keys: [ 'Keyboard.Numpad8' ] },
            { name: 'suspensionsBack',       categories: [ 'wandering', 'racing'              ], keys: [ 'Keyboard.Numpad2' ] },
            { name: 'suspensionsRight',      categories: [ 'wandering', 'racing'              ], keys: [ 'Keyboard.Numpad6', 'Gamepad.r1' ] },
            { name: 'suspensionsLeft',       categories: [ 'wandering', 'racing'              ], keys: [ 'Keyboard.Numpad4', 'Gamepad.l1' ] },
            { name: 'suspensionsFrontLeft',  categories: [ 'wandering', 'racing'              ], keys: [ 'Keyboard.Numpad7', 'Keyboard.Digit2' ] },
            { name: 'suspensionsFrontRight', categories: [ 'wandering', 'racing'              ], keys: [ 'Keyboard.Numpad9', 'Keyboard.Digit3' ] },
            { name: 'suspensionsBackRight',  categories: [ 'wandering', 'racing'              ], keys: [ 'Keyboard.Numpad3', 'Keyboard.Digit4' ] },
            { name: 'suspensionsBackLeft',   categories: [ 'wandering', 'racing'              ], keys: [ 'Keyboard.Numpad1', 'Keyboard.Digit1' ] },
            { name: 'interact',              categories: [ 'wandering', 'racing', 'cinematic' ], keys: [ 'Keyboard.Enter', 'Keyboard.KeyE', 'Keyboard.KeyF', 'Gamepad.cross' ] },
            { name: 'bulletTime',            categories: [ 'wandering', 'racing'              ], keys: [ 'Keyboard.KeyT' ] },
        ])

        this.game.inputs.events.on('respawn', (action) =>
        {
            if(this.state !== Player.STATE_DEFAULT)
                return

            if(action.active)
                this.respawn()
        })

        this.game.inputs.events.on('bulletTime', (action) =>
        {
            if(action.active)
                this.game.time.bulletTime.activate(2.0)
        })

        const suspensionsUpdate = () =>
        {
            if(this.state !== Player.STATE_DEFAULT)
                return

            const activeSuspensions = [
                this.game.inputs.actions.get('suspensions').active || this.game.inputs.actions.get('suspensionsFront').active || this.game.inputs.actions.get('suspensionsRight').active || this.game.inputs.actions.get('suspensionsFrontRight').active,
                this.game.inputs.actions.get('suspensions').active || this.game.inputs.actions.get('suspensionsFront').active || this.game.inputs.actions.get('suspensionsLeft').active || this.game.inputs.actions.get('suspensionsFrontLeft').active,
                this.game.inputs.actions.get('suspensions').active || this.game.inputs.actions.get('suspensionsBack').active || this.game.inputs.actions.get('suspensionsRight').active || this.game.inputs.actions.get('suspensionsBackRight').active,
                this.game.inputs.actions.get('suspensions').active || this.game.inputs.actions.get('suspensionsBack').active || this.game.inputs.actions.get('suspensionsLeft').active || this.game.inputs.actions.get('suspensionsBackLeft').active,
            ]

            const activeState = this.game.inputs.actions.get('suspensions').active ? 'high' : 'mid'

            for(let i = 0; i < 4; i++)
                this.suspensions[i] = activeSuspensions[i] ? activeState : 'low'
        }

        this.game.inputs.events.on('suspensions', suspensionsUpdate)
        this.game.inputs.events.on('suspensionsFront', suspensionsUpdate)
        this.game.inputs.events.on('suspensionsBack', suspensionsUpdate)
        this.game.inputs.events.on('suspensionsRight', suspensionsUpdate)
        this.game.inputs.events.on('suspensionsLeft', suspensionsUpdate)
        this.game.inputs.events.on('suspensionsFrontLeft', suspensionsUpdate)
        this.game.inputs.events.on('suspensionsFrontRight', suspensionsUpdate)
        this.game.inputs.events.on('suspensionsBackRight', suspensionsUpdate)
        this.game.inputs.events.on('suspensionsBackLeft', suspensionsUpdate)

        let nippleJumpTimeout = null
        this.game.inputs.nipple.events.on('tap', () =>
        {
            this.game.inputs.nipple.jump()

            for(let i = 0; i < 4; i++)
                this.suspensions[i] = 'high'

            if(nippleJumpTimeout)
                clearTimeout(nippleJumpTimeout)

            nippleJumpTimeout = setTimeout(() =>
            {
                for(let i = 0; i < 4; i++)
                    this.suspensions[i] = 'low'
            }, 200)
        })
    }

    setUnstuck()
    {
        this.unstuck = {}
        this.unstuck.duration = 1.2
        this.unstuck.delay = null

        this.game.physicalVehicle.events.on('rightSideUp', () =>
        {
            if(this.unstuck.delay)
                this.unstuck.delay.kill()
        })

        const waitAndTest = () =>
        {
            this.unstuck.delay = gsap.delayedCall(this.unstuck.duration, () =>
            {
                this.unstuck.delay = null

                if(this.state !== Player.STATE_DEFAULT)
                    return

                if(this.game.physicalVehicle.upsideDown.active)
                {
                    this.game.physicalVehicle.flip.jump()
                    waitAndTest()
                }
            })
        }

        this.game.physicalVehicle.events.on('upsideDown', () =>
        {
            if(this.unstuck.delay)
                this.unstuck.delay.kill()

            waitAndTest()
        })
    }

    respawn(callback = null)
    {
        if(typeof callback === 'function')
            callback()

        this.game.physicalVehicle.moveTo(this.spawnPoint.position, this.spawnPoint.rotation)
        this.state = Player.STATE_DEFAULT
        this.game.view.focusPoint.isTracking = true
    }

    updatePrePhysics()
    {
        this.accelerating = 0
        this.steering = 0
        this.boosting = 0
        this.braking = 0

        if(this.state !== Player.STATE_DEFAULT)
            return

        if(this.game.inputs.actions.get('forward').active)
            this.accelerating += this.game.inputs.actions.get('forward').value

        if(this.game.inputs.actions.get('backward').active)
            this.accelerating -= this.game.inputs.actions.get('backward').value

        if(this.game.inputs.actions.get('boost').active)
            this.boosting = 1

        if(this.game.inputs.actions.get('brake').active)
        {
            this.accelerating = 0
            this.braking = 1
        }

        if(this.game.inputs.actions.get('right').active)
            this.steering -= 1
        if(this.game.inputs.actions.get('left').active)
            this.steering += 1

        if(this.steering === 0 && this.game.inputs.gamepad.joysticks.left.active)
            this.steering = -this.game.inputs.gamepad.joysticks.left.safeX

        if(this.game.inputs.nipple.active && this.game.inputs.nipple.progress > 0)
        {
            if(!this.game.view.focusPoint.isTracking)
            {
                this.game.ticker.wait(5, () =>
                {
                    if(this.game.inputs.nipple.active)
                        this.game.view.focusPoint.isTracking = true
                })
            }
            this.accelerating = Math.pow(this.game.inputs.nipple.progress, 3)

            const angleDeltaAbs = Math.abs(this.game.inputs.nipple.smallestAngle)
            const angleDeltaAbsNormalized = angleDeltaAbs / ((Math.PI * 2 - this.game.inputs.nipple.forwardAmplitude) / 2)
            const angleDeltaSign = Math.sign(this.game.inputs.nipple.smallestAngle)
            const steering = -Math.min(angleDeltaAbsNormalized, 1) * angleDeltaSign

            this.steering = steering

            if(!this.game.inputs.nipple.forward)
            {
                this.accelerating *= -1
                this.steering *= -1
            }
        }

        this.game.vehicleManager?.applyControls(this)
    }

    updatePostPhysics()
    {
        this.position.copy(this.game.physicalVehicle.position)
        this.position2.set(this.position.x, this.position.z)

        // Fall off world recovery
        if(this.position.y < -4)
        {
            this.respawn()
        }

        this.game.view.focusPoint.trackedPosition.copy(this.position)

        if(this.boosting && this.accelerating && this.game.physicalVehicle.speed > 15)
            this.game.view.speedLines.strength = 1
        else
            this.game.view.speedLines.strength = 0

        this.game.view.speedLines.worldTarget.copy(this.position)

        if(this.game.tracks)
            this.game.tracks.focusPoint.set(this.position.x, this.position.z)

        this.rotationY = Math.atan2(this.game.physicalVehicle.forward.z, this.game.physicalVehicle.forward.x)
        this.game.inputs.nipple.setCoordinates(this.position.x, this.position.y, this.position.z, this.rotationY)

        this.distanceDriven += this.game.physicalVehicle.xzSpeed * this.game.ticker.deltaScaled
    }
}
