import { uniform } from 'three/tsl'
import { Game } from './Game.js'

export class Water
{
    constructor()
    {
        this.game = Game.getInstance()

        this.surfaceElevation = -0.35
        this.depthElevation = -2.2

        this.surfaceElevationUniform = uniform(this.surfaceElevation)
        this.surfaceThicknessUniform = uniform(0.018)
    }
}
