import { color, uniform, vec2 } from 'three/tsl'
import { Game } from './Game.js'
import gsap from 'gsap'

export class Reveal
{
    constructor()
    {
        this.game = Game.getInstance()

        this.step = 0
        this.position2Uniform = uniform(vec2(0, 0))
        this.distance = uniform(0)
        this.thickness = uniform(0.06)
        this.color = uniform(color('#e88eff'))
        this.intensity = uniform(6.5)

        this.update = this.update.bind(this)
        this.game.ticker.events.on('tick', this.update, 10)
    }

    start()
    {
        this.distance.value = 0

        gsap.to(this.distance, {
            value: 65,
            ease: 'power2.inOut',
            duration: 2.2,
            overwrite: true,
            onComplete: () =>
            {
                this.distance.value = 99999
                this.step = 2
                this.game.ticker.events.off('tick', this.update)
            }
        })

        gsap.to(this.game.view.zoom, {
            baseRatio: 0.15,
            ease: 'power2.out',
            duration: 1.8,
            overwrite: true
        })
    }

    update()
    {
        const preset = this.game.lighting.currentPreset
        this.color.value.copy(preset.revealColor)
        this.intensity.value = preset.revealIntensity
    }
}
