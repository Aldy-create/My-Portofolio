import { Game } from './Game.js'

export class Objects
{
    constructor()
    {
        this.game = Game.getInstance()
        this.list = new Map()
        this.key = 0
        this.roundedViewPosition = { x: 0, z: 0 }

        this.game.ticker.events.on('tick', () =>
        {
            this.update()
        }, 4)
    }

    add(_visualDescription = null, _physicalDescription = null)
    {
        const object = {
            visual: null,
            physical: null,
            needsUpdate: false,
            reseting: false
        }

        if(_visualDescription && _visualDescription.model)
        {
            const visualDescription = {
                updateMaterials: false,
                castShadow: true,
                receiveShadow: true,
                parent: this.game.scene,
                ..._visualDescription
            }

            const visual = {}
            visual.object3D = _visualDescription.model
            visual.parent = visualDescription.parent

            if(visualDescription.castShadow || visualDescription.receiveShadow)
            {
                visualDescription.model.traverse(_child =>
                {
                    if(_child.isMesh)
                    {
                        if(visualDescription.castShadow)
                            _child.castShadow = true

                        if(visualDescription.receiveShadow)
                            _child.receiveShadow = true
                    }
                })
            }

            if(visualDescription.parent !== null)
                visualDescription.parent.add(visual.object3D)

            object.visual = visual
        }

        if(_physicalDescription)
        {
            object.physical = this.game.physics.getPhysical(_physicalDescription)
        }

        if(object.physical)
        {
            object.physical.body.userData = { object: object }
        }
        if(object.visual)
        {
            object.visual.object3D.userData.object = object
        }

        this.key++
        this.list.set(this.key, object)

        if(object.visual && object.physical)
        {
            if(_physicalDescription.sleeping || _physicalDescription.enabled === false || object.physical.type === 'fixed')
            {
                const t = object.physical.body.translation()
                const r = object.physical.body.rotation()
                object.visual.object3D.position.set(t.x, t.y, t.z)
                object.visual.object3D.quaternion.set(r.x, r.y, r.z, r.w)
            }
        }

        return object
    }

    resetObject(object)
    {
        if(
            !object.physical ||
            (object.physical.type !== 'dynamic' && object.physical.type !== 'kinematicPositionBased') ||
            object.reseting
        )
            return

        object.reseting = true

        const isEnabled = object.physical.body.isEnabled()
        object.physical.body.setEnabled(false)
        object.physical.body.setTranslation(object.physical.initialState.position, false)
        object.physical.body.setRotation(object.physical.initialState.rotation, false)
        object.physical.body.setLinvel({ x: 0, y: 0, z: 0 }, false)
        object.physical.body.setAngvel({ x: 0, y: 0, z: 0 }, false)
        object.physical.body.resetForces()
        object.physical.body.resetTorques()

        this.game.ticker.wait(1, () =>
        {
            object.physical.body.setEnabled(isEnabled)

            if(object.physical.initialState.sleeping)
                object.physical.body.sleep()

            object.reseting = false
            this.game.ticker.wait(1, () =>
            {
                object.needsUpdate = true
            })
        })

        if(object.visual)
        {
            if(object.visual.parent && object.visual.parent !== object.visual.object3D.parent)
                object.visual.parent.add(object.visual.object3D)
            const p = object.physical.initialState.position
            const r = object.physical.initialState.rotation
            object.visual.object3D.position.set(p.x, p.y, p.z)
            object.visual.object3D.quaternion.set(r.x, r.y, r.z, r.w)
        }
    }

    resetAll()
    {
        this.list.forEach((object) =>
        {
            this.resetObject(object)
        })
    }

    update()
    {
        const roundedViewPosition = {
            x: Math.round(this.game.view.focusPoint.position.x),
            z: Math.round(this.game.view.focusPoint.position.z)
        }
        let objectsNeedDistanceTest = false

        if(roundedViewPosition.x !== this.roundedViewPosition.x || roundedViewPosition.z !== this.roundedViewPosition.z)
        {
            objectsNeedDistanceTest = true
            this.roundedViewPosition.x = roundedViewPosition.x
            this.roundedViewPosition.z = roundedViewPosition.z
        }

        const depthElevation = this.game.water ? this.game.water.depthElevation : -2.5

        this.list.forEach((_object) =>
        {
            const position = _object.physical ? _object.physical.body.translation() : null

            if(
                _object.visual &&
                _object.physical &&
                (
                    _object.needsUpdate ||
                    (
                        !_object.physical.body.isSleeping() &&
                        _object.physical.body.isEnabled()
                    )
                )
            )
            {
                _object.needsUpdate = false
                const rot = _object.physical.body.rotation()
                _object.visual.object3D.position.set(position.x, position.y, position.z)
                _object.visual.object3D.quaternion.set(rot.x, rot.y, rot.z, rot.w)
            }

            if(_object.physical && _object.physical.type === 'dynamic')
            {
                if(position.y < depthElevation)
                {
                    this.resetObject(_object)
                }

                if(objectsNeedDistanceTest && _object.physical.body.isEnabled() && !_object.physical.body.isSleeping())
                {
                    const distanceToView = Math.hypot(this.roundedViewPosition.x - position.x, this.roundedViewPosition.z - position.z)
                    if(distanceToView > this.game.view.optimalArea.radius * 1.35)
                    {
                        _object.physical.body.sleep()
                    }
                }
            }
        })
    }
}
