import { Events } from '../Events.js'
import { remapClamp } from '../utilities/maths.js'

export class Gamepad
{
    constructor()
    {
        this.events = new Events()
        this.type = 'default'
        this.buttons = {}
        this.joysticks = {
            left: { name: 'left', x: 0, y: 0, safeX: 0, safeY: 0, radius: 0, safeRadius: 0, angle: 0, active: false },
            right: { name: 'right', x: 0, y: 0, safeX: 0, safeY: 0, radius: 0, safeRadius: 0, angle: 0, active: false }
        }

        this.standardButtons = [
            'cross', 'circle', 'square', 'triangle',
            'l1', 'r1', 'l2', 'r2',
            'select', 'start', 'l3', 'r3',
            'up', 'down', 'left', 'right'
        ]

        for(const name of this.standardButtons)
        {
            this.buttons[name] = { name, value: 0, pressed: false }
        }
    }

    update()
    {
        if(!navigator.getGamepads)
            return

        let gamepad = null
        for(const _gp of navigator.getGamepads())
        {
            if(_gp !== null)
                gamepad = _gp
        }

        if(gamepad === null)
            return

        const deadZone = 0.2

        for(let i = 0; i < this.standardButtons.length; i++)
        {
            const name = this.standardButtons[i]
            const saved = this.buttons[name]
            const rawBtn = gamepad.buttons[i]
            const val = rawBtn ? rawBtn.value : 0
            const pressed = val > deadZone

            const oldPressed = saved.pressed
            const oldValue = saved.value

            saved.value = val
            saved.pressed = pressed

            if(pressed && !oldPressed)
                this.events.trigger('down', [ saved ])
            else if(!pressed && oldPressed)
                this.events.trigger('up', [ saved ])

            if(val !== oldValue)
                this.events.trigger('change', [ saved ])
        }

        const parseStick = (stick, axX, axY) =>
        {
            stick.x = gamepad.axes[axX] || 0
            stick.y = gamepad.axes[axY] || 0
            stick.safeX = remapClamp(Math.abs(stick.x), deadZone, 1, 0, 1) * Math.sign(stick.x)
            stick.safeY = remapClamp(Math.abs(stick.y), deadZone, 1, 0, 1) * Math.sign(stick.y)
            stick.angle = Math.atan2(stick.y, stick.x)
            stick.radius = Math.hypot(stick.y, stick.x)
            stick.safeRadius = remapClamp(stick.radius, deadZone, 1, 0, 1)
            stick.active = stick.radius > deadZone
        }

        parseStick(this.joysticks.left, 0, 1)
        parseStick(this.joysticks.right, 2, 3)

        let type = 'default'
        if(/xbox/i.test(gamepad.id))
            type = 'xbox'
        else if(/playstation|dualshock|dualsense|ps\d/i.test(gamepad.id))
            type = 'playstation'

        if(type !== this.type)
        {
            this.type = type
            this.events.trigger('typeChange', [ this.type ])
        }
    }
}
