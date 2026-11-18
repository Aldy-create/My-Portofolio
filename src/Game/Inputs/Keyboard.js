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

            if(_event.code === 'Space' || _event.code.startsWith('Arrow'))
                _event.preventDefault()

            this.pressed.push(_event.code, _event.key)
            this.events.trigger('down', [ _event.code, _event.key ])
        })

        window.addEventListener('keyup', (_event) =>
        {
            const indexCode = this.pressed.indexOf(_event.code)
            if(indexCode !== -1)
                this.pressed.splice(indexCode, 1)

            const indexKey = this.pressed.indexOf(_event.key)
            if(indexKey !== -1)
                this.pressed.splice(indexKey, 1)

            this.events.trigger('up', [ _event.code, _event.key ])
        })
    }
}
