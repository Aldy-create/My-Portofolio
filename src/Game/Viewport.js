import { Events } from './Events.js'

export class Viewport
{
    constructor(domElement)
    {
        this.domElement = domElement
        this.events = new Events()

        this.measure()

        let throttleTimeout = null
        window.addEventListener('resize', () =>
        {
            this.measure()
            this.events.trigger('change')

            if(throttleTimeout)
                clearTimeout(throttleTimeout)

            throttleTimeout = setTimeout(() =>
            {
                this.events.trigger('throttleChange')
            }, 200)
        })
    }

    measure()
    {
        this.width = window.innerWidth
        this.height = window.innerHeight
        this.ratio = this.width / this.height
        this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
    }
}
