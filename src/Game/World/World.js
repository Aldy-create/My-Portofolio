import { Game } from '../Game.js'
import { Floor } from './Floor.js'
import { Grass } from './Grass.js'
import { VisualVehicle } from './VisualVehicle.js'
import { Playground } from './Playground.js'

export class World
{
    constructor()
    {
        this.game = Game.getInstance()
    }

    build()
    {
        this.visualVehicle = new VisualVehicle()
        this.floor = new Floor()
        this.grass = new Grass()
        this.playground = new Playground()
    }
}
