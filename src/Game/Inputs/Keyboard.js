import { Events } from '../Events.js'

export default class Keyboard
{
    constructor()
    {
        this.events = new Events()
        this.pressed = []

        window.addEventListener('blur', () =>
        {
            for(const key of this.pressed)
                this.events.trigger('up', [ key ])

            this.pressed = []
        })

        window.addEventListener('keydown', (_event) =>
        {
            if(document.activeElement && document.activeElement.matches('input, textarea, [contenteditable]') && _event.code !== 'Escape')
                return

            const isWandering = document.documentElement.classList.contains('input-filter-wandering')
            if(isWandering && (_event.code === 'Space' || _event.code.startsWith('Arrow')))
                _event.preventDefault()

            if(!this.pressed.includes(_event.code))
                this.pressed.push(_event.code)
            if(!this.pressed.includes(_event.key))
                this.pressed.push(_event.key)

            if(!_event.repeat)
                this.events.trigger('down', [ _event.code, _event.key ])
        })

        window.addEventListener('keyup', (_event) =>
        {
            for(let i = this.pressed.length - 1; i >= 0; i--)
            {
                if(this.pressed[i] === _event.code || this.pressed[i] === _event.key)
                    this.pressed.splice(i, 1)
            }

            this.events.trigger('up', [ _event.code, _event.key ])
        })
    }
}
