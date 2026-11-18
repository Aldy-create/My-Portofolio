import { color, mix, rangeFogFactor, uniform, vec2, viewportUV } from 'three/tsl'
import { Game } from './Game.js'

export class Fog
{
    constructor()
    {
        this.game = Game.getInstance()

        this.colorA = uniform(color('#00ffff'))
        this.colorB = uniform(color('#9b89ff'))
        this.radialCenter = uniform(vec2(0, 0))
        this.radialStart = uniform(0)
        this.radialEnd = uniform(1)

        const colorMix = vec2(viewportUV.xy).sub(this.radialCenter).length().smoothstep(this.radialStart, this.radialEnd)
        this.color = mix(this.colorA, this.colorB, colorMix)
        this.game.scene.backgroundNode = this.color

        this.near = uniform(this.game.view.optimalArea.nearDistance)
        this.far = uniform(this.game.view.optimalArea.farDistance)
        this.strength = rangeFogFactor(this.near, this.far)

        this.game.ticker.events.on('tick', () =>
        {
            this.update()
        }, 10)
    }

    update()
    {
        const preset = this.game.lighting.currentPreset
        const dt = Math.min(1, this.game.ticker.delta * 4)
        const amplitude = this.game.view.optimalArea.farDistance - this.game.view.optimalArea.nearDistance

        this.colorA.value.lerp(preset.fogColorA, dt)
        this.colorB.value.lerp(preset.fogColorB, dt)
        this.near.value = this.game.view.optimalArea.nearDistance + preset.fogNearRatio * amplitude
        this.far.value = this.game.view.optimalArea.nearDistance + preset.fogFarRatio * amplitude
    }
}
