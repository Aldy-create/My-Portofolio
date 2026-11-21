import { Game } from '../Game.js'
import { Floor } from './Floor.js'
import { Grass } from './Grass.js'
import { VisualVehicle } from './VisualVehicle.js'
import { Playground } from './Playground.js'
import { PortfolioLandmarks } from './PortfolioLandmarks.js'
import { ConstructionSite } from './ConstructionSite.js'
import { AmbientWorld } from './AmbientWorld.js'

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
        this.landmarks = new PortfolioLandmarks()
        this.constructionSite = new ConstructionSite(this.game)
        this.ambientWorld = new AmbientWorld(this.game)
    }
}
