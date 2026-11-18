import * as THREE from 'three/webgpu'
import { Inputs } from './Inputs/Inputs.js'
import { Physics } from './Physics/Physics.js'
import { Rendering } from './Rendering.js'
import { Ticker } from './Ticker.js'
import { Time } from './Time.js'
import { Player } from './Player.js'
import { View } from './View.js'
import { Viewport } from './Viewport.js'
import { World } from './World/World.js'
import { Tracks } from './Tracks.js'
import { Lighting } from './Lighting.js'
import { Objects } from './Objects.js'
import { Fog } from './Fog.js'
import { Noises } from './Noises.js'
import { Wind } from './Wind.js'
import { Terrain } from './Terrain.js'
import { Modals } from './Modals.js'
import { PhysicsVehicle } from './Physics/PhysicsVehicle.js'
import { Zones } from './Zones.js'
import { InteractivePoints } from './InteractivePoints.js'
import { RayCursor } from './RayCursor.js'
import { Water } from './Water.js'
import { Reveal } from './Reveal.js'
import { Quality } from './Quality.js'
import { PreRenderer } from './PreRenderer.js'

export class Game
{
    static getInstance()
    {
        return Game.instance
    }

    constructor()
    {
        if(Game.instance)
            return Game.instance

        Game.instance = this
        this.init()
    }

    async init()
    {
        this.domElement = document.querySelector('.game')
        this.canvasElement = this.domElement.querySelector('.js-canvas')

        // Phase 1: Core Engine & WebGPU Renderer Init
        this.scene = new THREE.Scene()
        this.quality = new Quality()
        this.ticker = new Ticker()
        this.time = new Time()
        this.viewport = new Viewport(this.domElement)
        this.inputs = new Inputs([], [ 'wandering' ])
        this.rayCursor = new RayCursor()
        this.modals = new Modals()
        this.rendering = new Rendering()
        await this.rendering.setRenderer()

        // Phase 2: Camera, Post-Processing & Procedural Shader Nodes
        this.view = new View()
        this.rendering.setPostprocessing()
        this.rendering.start()

        this.reveal = new Reveal()
        this.noises = new Noises()
        this.wind = new Wind()
        this.tracks = new Tracks()
        this.lighting = new Lighting()
        this.fog = new Fog()
        this.water = new Water()
        this.objects = new Objects()

        // Phase 3: Load Rapier3D WASM & Build Physical/Visual World
        const RAPIER = await import('@dimforge/rapier3d')
        this.RAPIER = RAPIER.default || RAPIER

        this.terrain = new Terrain()
        this.physics = new Physics()
        this.physicalVehicle = new PhysicsVehicle()
        this.zones = new Zones()
        this.player = new Player()
        this.interactivePoints = new InteractivePoints()

        this.world = new World()
        this.world.build()

        // Phase 4: WebGPU Shader Pre-Warmup (CubeCamera 32x32) & Reveal Animation
        if(this.quality.level === 0 && this.rendering.renderer.backend?.isWebGPUBackend)
        {
            PreRenderer.render()
        }

        this.setupHUD()

        document.documentElement.classList.add('is-started')
        const loaderEl = document.querySelector('.js-loader')
        if(loaderEl)
            loaderEl.classList.add('is-hidden')

        this.ticker.wait(2, () =>
        {
            this.reveal.start()
        })
    }

    setupHUD()
    {
        const speedEl = document.querySelector('.js-telemetry-speed')
        const distEl = document.querySelector('.js-telemetry-distance')
        const backendEl = document.querySelector('.js-telemetry-backend')
        const timeScaleEl = document.querySelector('.js-telemetry-timescale')
        const promptEl = document.querySelector('.js-interaction-prompt')
        const promptTextEl = document.querySelector('.js-interaction-prompt-text')
        const zoneBadgeEl = document.querySelector('.js-zone-badge')

        if(backendEl)
        {
            const isWebGPU = !!this.rendering.renderer.backend?.isWebGPUBackend
            backendEl.textContent = isWebGPU ? 'WebGPU + TSL' : 'WebGL2 Fallback + TSL'
        }

        this.updatePromptUI = (item) =>
        {
            if(!promptEl || !promptTextEl)
                return

            if(item)
            {
                promptTextEl.textContent = item.text
                promptEl.classList.add('is-visible')
            }
            else
            {
                promptEl.classList.remove('is-visible')
            }
        }

        this.setZoneBadge = (title) =>
        {
            if(!zoneBadgeEl)
                return

            if(title)
            {
                zoneBadgeEl.textContent = `ZONE: ${title}`
                zoneBadgeEl.classList.add('is-visible')
            }
            else
            {
                zoneBadgeEl.classList.remove('is-visible')
            }
        }

        if(promptEl)
        {
            promptEl.addEventListener('click', () =>
            {
                if(this.interactivePoints.activeItem)
                    this.interactivePoints.activeItem.interact()
            })
        }

        // Action Bar Buttons
        const btnReset = document.querySelector('.js-btn-reset')
        if(btnReset)
        {
            btnReset.addEventListener('click', () =>
            {
                this.reset()
            })
        }

        const btnCycleTime = document.querySelector('.js-btn-daycycle')
        if(btnCycleTime)
        {
            btnCycleTime.addEventListener('click', () =>
            {
                const preset = this.lighting.cyclePreset()
                btnCycleTime.textContent = `Atmosphere: ${preset.toUpperCase()}`
            })
        }

        const btnPaint = document.querySelector('.js-btn-paint')
        if(btnPaint)
        {
            btnPaint.addEventListener('click', () =>
            {
                const label = this.world.visualVehicle.cyclePaint()
                btnPaint.textContent = `Paint: ${label}`
            })
        }

        const btnBulletTime = document.querySelector('.js-btn-bullettime')
        if(btnBulletTime)
        {
            btnBulletTime.addEventListener('click', () =>
            {
                this.time.bulletTime.activate(2.0)
            })
        }

        const btnTouchRing = document.querySelector('.js-btn-touchring')
        if(btnTouchRing)
        {
            btnTouchRing.addEventListener('click', () =>
            {
                this.inputs.touchRingEnabled = !this.inputs.touchRingEnabled
                if(this.inputs.touchRingEnabled)
                    this.inputs.updateMode(Inputs.MODE_TOUCH)
                else
                    this.inputs.updateMode(Inputs.MODE_MOUSEKEYBOARD)

                btnTouchRing.textContent = `3D Touch Ring: ${this.inputs.touchRingEnabled ? 'ON' : 'OFF'}`
            })
        }

        // Mobile / On-Screen Touch Driving Controls
        const bindHoldButton = (selector, keyName) =>
        {
            const btn = document.querySelector(selector)
            if(!btn)
                return

            const startHold = (e) =>
            {
                e.preventDefault()
                this.inputs.start(keyName)
                btn.classList.add('is-pressed')
            }
            const endHold = (e) =>
            {
                e.preventDefault()
                this.inputs.end(keyName)
                btn.classList.remove('is-pressed')
            }

            btn.addEventListener('pointerdown', startHold)
            btn.addEventListener('pointerup', endHold)
            btn.addEventListener('pointerleave', endHold)
            btn.addEventListener('pointercancel', endHold)
        }

        bindHoldButton('.js-touch-up', 'Keyboard.KeyW')
        bindHoldButton('.js-touch-down', 'Keyboard.KeyS')
        bindHoldButton('.js-touch-left', 'Keyboard.KeyA')
        bindHoldButton('.js-touch-right', 'Keyboard.KeyD')
        bindHoldButton('.js-touch-boost', 'Keyboard.ShiftLeft')
        bindHoldButton('.js-touch-jump', 'Keyboard.Space')

        // Live HUD telemetry update on tick priority 14
        this.ticker.events.on('tick', () =>
        {
            if(speedEl)
            {
                const kmh = Math.round(this.physicalVehicle.xzSpeed * 3.6)
                speedEl.textContent = `${kmh} km/h`
            }
            if(distEl)
            {
                distEl.textContent = `${Math.floor(this.player.distanceDriven)} m`
            }
            if(timeScaleEl)
            {
                timeScaleEl.textContent = `${this.time.scale.toFixed(2)}x`
            }
        }, 14)
    }

    reset()
    {
        this.player.respawn(() =>
        {
            this.objects.resetAll()
        })
    }
}
