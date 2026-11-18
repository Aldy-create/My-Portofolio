import { Events } from './Events.js'
import { Game } from './Game.js'

export class Modals
{
    static OPEN = 1
    static CLOSED = 2

    constructor()
    {
        this.game = Game.getInstance()
        this.state = Modals.CLOSED
        this.element = document.querySelector('.js-modals')
        this.current = null
        this.events = new Events()
        this.items = new Map()

        if(this.element)
        {
            this.setItems()
            this.setClose()
        }

        this.game.inputs.addActions([
            { name: 'closeModal', categories: [ 'modal', 'wandering' ], keys: [ 'Keyboard.Escape', 'Gamepad.cross' ] }
        ])

        this.game.inputs.events.on('closeModal', (action) =>
        {
            if(action.active && this.state === Modals.OPEN)
            {
                this.close()
            }
        })
    }

    setItems()
    {
        const elements = this.element.querySelectorAll('.js-modal')
        for(const el of elements)
        {
            const name = el.dataset.name
            this.items.set(name, {
                name,
                element: el,
                mainFocus: el.querySelector('.js-close')
            })
        }
    }

    setClose()
    {
        const closeButtons = this.element.querySelectorAll('.js-close')
        for(const btn of closeButtons)
        {
            btn.addEventListener('click', () =>
            {
                this.close()
            })
        }

        this.element.addEventListener('click', (event) =>
        {
            if(event.target === this.element)
                this.close()
        })
    }

    open(name, cinematicCamera = null)
    {
        const item = this.items.get(name)
        if(!item)
            return

        for(const [, other] of this.items)
        {
            other.element.classList.remove('is-displayed')
        }

        this.element.classList.add('is-displayed')
        item.element.classList.add('is-displayed')

        requestAnimationFrame(() =>
        {
            this.element.classList.add('is-visible')
            if(item.mainFocus)
                item.mainFocus.focus()
        })

        this.state = Modals.OPEN
        this.current = item

        this.game.inputs.filters.clear()
        this.game.inputs.filters.add('modal')

        if(cinematicCamera)
        {
            this.game.view.cinematic.start(cinematicCamera.position, cinematicCamera.target)
        }

        this.events.trigger('open', [ name ])
    }

    close()
    {
        if(this.state === Modals.CLOSED)
            return

        this.element.classList.remove('is-visible')
        this.state = Modals.CLOSED

        setTimeout(() =>
        {
            if(this.state === Modals.CLOSED)
            {
                this.element.classList.remove('is-displayed')
                if(this.current)
                    this.current.element.classList.remove('is-displayed')
                this.current = null
            }
        }, 280)

        this.game.inputs.filters.clear()
        this.game.inputs.filters.add('wandering')
        this.game.view.cinematic.end()

        this.events.trigger('close')
    }
}
