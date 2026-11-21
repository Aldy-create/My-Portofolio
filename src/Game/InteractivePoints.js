import * as THREE from 'three/webgpu'
import { Game } from './Game.js'
import { color, Fn, max, mix, step, texture, uniform, uv, vec2, vec3, vec4 } from 'three/tsl'
import gsap from 'gsap'

export class InteractivePoints
{
    static ALIGN_LEFT = 1
    static ALIGN_RIGHT = 2

    static STATE_HIDDEN = 3
    static STATE_OPEN = 4
    static STATE_CONCEALED = 5

    constructor()
    {
        this.game = Game.getInstance()

        this.items = []
        this.activeItem = null
        this.needsTest = true

        this.setGeometries()
        this.setMaterials()
        this.setKeyIcon()
        this.setInputs()

        this.game.ticker.events.on('tick', () =>
        {
            this.update()
        }, 9)
    }

    setGeometries()
    {
        this.geometries = {}
        this.geometries.plane = new THREE.PlaneGeometry(2, 2)
        this.geometries.label = new THREE.PlaneGeometry(1, 1, 1, 1)
        this.geometries.label.translate(0.5, 0, 0)
    }

    setMaterials()
    {
        this.playerPosition = uniform(vec2())
        this.backColor = uniform(color('#251f2b'))
        this.frontColor = uniform(color('#ffffff'))
    }

    setKeyIcon()
    {
        const canvas = document.createElement('canvas')
        canvas.width = 64
        canvas.height = 64
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = '#000000'
        ctx.fillRect(0, 0, 64, 64)
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 5
        ctx.strokeRect(10, 14, 44, 36)
        ctx.fillStyle = '#ffffff'
        ctx.font = '700 22px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('E', 32, 33)

        const keyTex = new THREE.Texture(canvas)
        keyTex.minFilter = THREE.LinearFilter
        keyTex.magFilter = THREE.LinearFilter
        keyTex.needsUpdate = true

        const material = new THREE.MeshLambertNodeMaterial({ transparent: true, depthTest: false })
        material.outputNode = Fn(() =>
        {
            const a = texture(keyTex, uv()).r
            a.lessThan(0.35).discard()
            return vec4(vec3(this.frontColor), 1)
        })()

        const mesh = new THREE.Mesh(this.geometries.plane, material)
        mesh.renderOrder = 8
        mesh.scale.setScalar(0)
        mesh.position.z = 0.01
        mesh.visible = false

        this.keyIcon = mesh
    }

    setInputs()
    {
        this.game.inputs.events.on('interact', (action) =>
        {
            if(this.game.vehicleManager?.nearbyId || this.game.vehicleManager?.activeId === 'excavator')
                return

            if(action.active && this.activeItem && this.activeItem.state === InteractivePoints.STATE_OPEN)
            {
                this.activeItem.interact()
            }
        })
    }

    create(
        position,
        text = '',
        align = InteractivePoints.ALIGN_LEFT,
        interactCallback = null
    )
    {
        const newPosition = position.clone()

        const group = new THREE.Group()
        group.rotation.reorder('YXZ')
        group.rotation.x = -Math.PI * 0.15
        group.rotation.y = Math.PI * 0.25
        group.position.copy(newPosition)
        group.scale.setScalar(0.85)
        this.game.scene.add(group)

        const materials = []

        // 2D Canvas Text Label
        const height = 64
        const textPaddingLeft = align === InteractivePoints.ALIGN_LEFT ? 56 : 16
        const textPaddingRight = align === InteractivePoints.ALIGN_LEFT ? 16 : 56
        const font = `700 34px "Space Grotesk", system-ui, sans-serif`

        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d')
        context.font = font

        const textSize = context.measureText(text)
        const width = Math.ceil(textSize.width) + textPaddingLeft + textPaddingRight + 4
        canvas.width = width
        canvas.height = height

        context.fillStyle = '#000000'
        context.fillRect(0, 0, width, height)

        context.font = font
        context.fillStyle = '#ffffff'
        context.textAlign = 'start'
        context.textBaseline = 'middle'
        context.fillText(text, textPaddingLeft, height * 0.5 + 1)

        const labelTexture = new THREE.Texture(canvas)
        labelTexture.minFilter = THREE.LinearFilter
        labelTexture.magFilter = THREE.LinearFilter
        labelTexture.generateMipmaps = false
        labelTexture.needsUpdate = true

        const labelMaterial = new THREE.MeshLambertNodeMaterial({ transparent: true, depthTest: true })
        materials.push(labelMaterial)

        const labelOffset = uniform(1)
        labelMaterial.outputNode = Fn(() =>
        {
            const _uv = vec2(uv().x.sub(labelOffset), uv().y)
            const textSample = texture(labelTexture, _uv).r

            _uv.x.greaterThan(1).discard()
            _uv.x.lessThan(0).discard()

            const foggedBackColor = this.game.fog.strength.mix(this.backColor, this.game.fog.color)
            const finalColor = mix(foggedBackColor, this.frontColor, textSample)
            return vec4(vec3(finalColor), 1)
        })()

        const label = new THREE.Mesh(this.geometries.label, labelMaterial)
        label.renderOrder = 6
        label.scale.x = 0.75 * width / height
        label.scale.y = 0.75
        label.position.z = -0.01
        label.position.x = align === InteractivePoints.ALIGN_LEFT ? 0 : -label.scale.x
        label.visible = false
        group.add(label)

        // TSL Diamond Shader
        const diamondMaterial = new THREE.MeshLambertNodeMaterial({ transparent: true, depthTest: true })
        materials.push(diamondMaterial)

        const threshold = uniform(0.25)
        const lineThickness = uniform(0.150)
        const lineOffset = uniform(0.175)

        diamondMaterial.outputNode = Fn(() =>
        {
            const _uv = uv()
            const dist = max(_uv.x.sub(0.5).abs(), _uv.y.sub(0.5).abs()).mul(2)

            const lineDistance = threshold.sub(dist).sub(lineOffset).abs()
            const line = step(lineDistance, lineThickness.mul(0.5))

            dist.greaterThan(threshold).discard()

            const foggedBackColor = this.game.fog.strength.mix(this.backColor, this.game.fog.color)
            const finalColor = mix(foggedBackColor, this.frontColor, line)
            return vec4(vec3(finalColor), 1)
        })()

        const diamond = new THREE.Mesh(this.geometries.plane, diamondMaterial)
        diamond.renderOrder = 7
        diamond.rotation.z = Math.PI * 0.25
        diamond.visible = true
        group.add(diamond)

        const item = {}
        item.text = text
        item.position = new THREE.Vector2(position.x, position.z)
        item.interactCallback = interactCallback
        item.isIn = false
        item.state = InteractivePoints.STATE_CONCEALED
        item.materials = materials
        this.items.push(item)

        item.intersect = this.game.rayCursor.addIntersect({
            active: true,
            shape: new THREE.Sphere(newPosition, 0.9),
            onClick: () =>
            {
                item.interact()
            },
            onEnter: () =>
            {
                if(item !== this.activeItem && this.activeItem !== null)
                    this.activeItem.conceal()

                this.activeItem = item
                item.reveal()
            },
            onLeave: () =>
            {
                if(this.activeItem === item && !item.isIn)
                {
                    item.conceal()
                    this.activeItem = null
                }
            }
        })

        item.reveal = () =>
        {
            if(item.state === InteractivePoints.STATE_OPEN)
                return

            item.state = InteractivePoints.STATE_OPEN
            diamond.visible = true
            label.visible = true
            group.add(this.keyIcon)

            gsap.to(threshold, { value: 0.5, ease: 'elastic.out(1.3,0.4)', duration: 1.2, overwrite: true })
            gsap.to(lineThickness, { value: 0.075, ease: 'elastic.out(1.3,0.4)', duration: 1.2, overwrite: true })
            gsap.to(lineOffset, { value: 0.150, ease: 'elastic.out(1.3,0.4)', duration: 1.2, overwrite: true })

            this.keyIcon.visible = true
            this.keyIcon.scale.setScalar(0)
            gsap.to(this.keyIcon.scale, { x: 0.25, y: 0.25, z: 0.25, ease: 'elastic.out(1.3,0.8)', duration: 1.2, delay: 0.25, overwrite: true })
            gsap.to(labelOffset, { value: 0, ease: 'power2.out', duration: 0.5, delay: 0.1, overwrite: true })

            for(const mat of item.materials)
            {
                mat.depthTest = false
                mat.needsUpdate = true
            }

            this.game.updatePromptUI?.(item)
        }

        item.conceal = () =>
        {
            if(item.state === InteractivePoints.STATE_CONCEALED)
                return

            item.state = InteractivePoints.STATE_CONCEALED
            diamond.visible = true

            gsap.to(threshold, { value: 0.250, ease: 'back.in(3.5)', duration: 0.5, overwrite: true })
            gsap.to(lineThickness, { value: 0.150, ease: 'back.in(3.5)', duration: 0.5, overwrite: true })
            gsap.to(lineOffset, { value: 0.175, ease: 'back.in(3.5)', duration: 0.5, overwrite: true, onComplete: () =>
            {
                label.visible = false
                for(const mat of item.materials)
                {
                    mat.depthTest = true
                    mat.needsUpdate = true
                }
            }})

            if(this.activeItem === item)
            {
                gsap.to(this.keyIcon.scale, { x: 0, y: 0, z: 0, ease: 'power2.in', duration: 0.4, overwrite: true, onComplete: () =>
                {
                    this.keyIcon.visible = false
                }})
            }

            gsap.to(labelOffset, { value: align === InteractivePoints.ALIGN_LEFT ? -1 : 1, ease: 'power2.in', duration: 0.4, overwrite: true })
            this.game.updatePromptUI?.(null)
        }

        item.interact = () =>
        {
            gsap.to(threshold, { value: 0.6, ease: 'power2.out', duration: 0.1, overwrite: true, onComplete: () =>
            {
                gsap.to(threshold, { value: 0.5, ease: 'elastic.out(1.3,0.6)', duration: 1.2, overwrite: true })
            }})

            if(typeof item.interactCallback === 'function')
                item.interactCallback()
        }

        return item
    }

    update()
    {
        if(!this.game.player)
            return

        const distanceTraveled = Math.hypot(
            this.playerPosition.value.x - this.game.player.position2.x,
            this.playerPosition.value.y - this.game.player.position2.y
        )

        if(distanceTraveled > 0.15 || this.needsTest)
        {
            this.needsTest = false
            this.playerPosition.value.copy(this.game.player.position2)

            let minDistance = Infinity
            let activeItem = null
            for(const item of this.items)
            {
                const itemDistance = Math.hypot(
                    item.position.x - this.game.player.position2.x,
                    item.position.y - this.game.player.position2.y
                )
                const isIn = itemDistance < 3.4

                if(isIn)
                {
                    if(itemDistance < minDistance)
                    {
                        minDistance = itemDistance
                        activeItem = item
                    }
                }
                else
                {
                    if(item.isIn)
                    {
                        item.isIn = false
                        item.conceal()
                    }
                }
            }

            if(activeItem)
            {
                if(activeItem !== this.activeItem && this.activeItem !== null)
                {
                    this.activeItem.isIn = false
                    this.activeItem.conceal()
                }

                if(!activeItem.isIn || this.activeItem === null)
                {
                    this.activeItem = activeItem
                    activeItem.isIn = true
                    activeItem.reveal()
                }
            }
            else if(this.activeItem && !this.activeItem.intersect.isIntersecting)
            {
                this.activeItem = null
                this.game.updatePromptUI?.(null)
            }
        }
    }
}
