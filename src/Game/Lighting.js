import * as THREE from 'three/webgpu'
import { Game } from './Game.js'
import { uniform, color, float } from 'three/tsl'

export class Lighting
{
    constructor()
    {
        this.game = Game.getInstance()

        this.phi = 0.63
        this.theta = 0.72
        this.phiAmplitude = 0.62
        this.thetaAmplitude = 1.25
        this.near = 1
        this.spherical = new THREE.Spherical(this.game.view.optimalArea.radius + this.near, this.phi, this.theta)
        this.direction = new THREE.Vector3().setFromSpherical(this.spherical).normalize()
        this.directionUniform = uniform(this.direction)

        // Presets from DayCycles.js
        this.presets = {
            day: {
                lightColor: new THREE.Color('#ffd2c2'),
                lightIntensity: 1.2,
                shadowColor: new THREE.Color('#6d3fff'),
                fogColorA: new THREE.Color('#00ffff'),
                fogColorB: new THREE.Color('#9b89ff'),
                fogNearRatio: 0.315,
                fogFarRatio: 1.25,
                revealColor: new THREE.Color('#5f7dff'),
                revealIntensity: 8.5,
                progress: 0.08
            },
            dusk: {
                lightColor: new THREE.Color('#ff8181'),
                lightIntensity: 1.3,
                shadowColor: new THREE.Color('#4e009c'),
                fogColorA: new THREE.Color('#3e53ff'),
                fogColorB: new THREE.Color('#ff4ce4'),
                fogNearRatio: 0.0,
                fogFarRatio: 1.25,
                revealColor: new THREE.Color('#ff86d9'),
                revealIntensity: 5.55,
                progress: 0.25
            },
            night: {
                lightColor: new THREE.Color('#3240ff'),
                lightIntensity: 3.4,
                shadowColor: new THREE.Color('#2f00db'),
                fogColorA: new THREE.Color('#10266f'),
                fogColorB: new THREE.Color('#490a42'),
                fogNearRatio: -0.85,
                fogFarRatio: 1.0,
                revealColor: new THREE.Color('#b678ff'),
                revealIntensity: 9.0,
                progress: 0.45
            }
        }
        this.currentPresetName = 'day'
        this.currentPreset = this.presets.day

        this.colorUniform = uniform(color('#ffd2c2'))
        this.intensityUniform = uniform(1.2)
        this.mapSize = this.game.quality.level === 0 ? 2048 : 512
        this.shadowAmplitude = this.game.view.optimalArea.radius
        this.depth = this.game.view.optimalArea.radius * 2
        this.shadowBias = -0.001
        this.shadowNormalBias = 0.1
        this.shadowRadius = this.game.quality.level === 0 ? 3 : 2

        this.setNodes()
        this.setLight()
        this.updateShadow()

        this.game.ticker.events.on('tick', () =>
        {
            this.update()
        }, 9)

        this.game.viewport.events.on('throttleChange', () =>
        {
            this.spherical.radius = this.game.view.optimalArea.radius
            this.shadowAmplitude = this.game.view.optimalArea.radius
            this.depth = this.game.view.optimalArea.radius * 2
            this.updateShadow()
        }, 3)
    }

    setNodes()
    {
        this.lightBounceEdgeLow = uniform(float(-1))
        this.lightBounceEdgeHigh = uniform(float(1))
        this.lightBounceDistance = uniform(float(1.5))
        this.lightBounceMultiplier = uniform(float(1))

        this.shadowColor = uniform(color('#6d3fff'))
        this.bounceColor = uniform(color('#82487f'))
        this.coreShadowEdgeLow = uniform(float(-0.25))
        this.coreShadowEdgeHigh = uniform(float(1))
    }

    setLight()
    {
        this.light = new THREE.DirectionalLight(0xffffff, 5)
        this.light.position.setFromSpherical(this.spherical)
        this.light.castShadow = true

        this.game.scene.add(this.light)
        this.game.scene.add(this.light.target)
    }

    setPreset(name)
    {
        if(!this.presets[name])
            return

        this.currentPresetName = name
        this.currentPreset = this.presets[name]
    }

    cyclePreset()
    {
        const order = ['day', 'dusk', 'night']
        const next = order[(order.indexOf(this.currentPresetName) + 1) % order.length]
        this.setPreset(next)
        return next
    }

    updateShadow()
    {
        this.light.shadow.camera.top = this.shadowAmplitude
        this.light.shadow.camera.right = this.shadowAmplitude
        this.light.shadow.camera.bottom = -this.shadowAmplitude
        this.light.shadow.camera.left = -this.shadowAmplitude
        this.light.shadow.camera.near = this.near
        this.light.shadow.camera.far = this.near + this.depth
        this.light.shadow.bias = this.shadowBias
        this.light.shadow.normalBias = this.shadowNormalBias
        this.light.shadow.radius = this.shadowRadius

        this.light.shadow.camera.updateProjectionMatrix()
        this.light.shadow.mapSize.set(this.mapSize, this.mapSize)

        this.game.quality.events.on('change', () =>
        {
            this.mapSize = this.game.quality.level === 0 ? 2048 : 512
            this.light.shadow.mapSize.set(this.mapSize, this.mapSize)
        })
    }

    update()
    {
        const preset = this.currentPreset
        const progressOffset = 9 / 16
        this.spherical.theta = this.theta + Math.sin(-(preset.progress + progressOffset) * Math.PI * 2) * this.thetaAmplitude
        this.spherical.phi = this.phi + (Math.cos(-(preset.progress + progressOffset) * Math.PI * 2) * 0.5) * this.phiAmplitude

        this.direction.setFromSpherical(this.spherical).normalize()

        const optimalPosition = this.game.view.optimalArea.position
        this.light.position.setFromSpherical(this.spherical).add(optimalPosition)
        this.light.target.position.copy(optimalPosition)

        const dt = Math.min(1, this.game.ticker.delta * 4)
        this.colorUniform.value.lerp(preset.lightColor, dt)
        this.shadowColor.value.lerp(preset.shadowColor, dt)
        this.intensityUniform.value += (preset.lightIntensity - this.intensityUniform.value) * dt
    }
}
