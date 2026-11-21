import * as THREE from 'three/webgpu'

export class AmbientWorld {
  constructor(game) {
    this.game = game; this.clock = 0; this.cars = []; this.drones = []
    this.buildVegetation(); this.buildTraffic(); this.buildDrones(); this.buildProps()
    this.game.ticker.events.on('tick', () => this.update(), 15)
  }
  addFixedCollider(x, z, shape, parameters, yOffset) {
    this.game.objects.add(null, {
      type: 'fixed',
      position: new THREE.Vector3(x, 0, z),
      colliders: [{ shape, parameters, position: { x: 0, y: yOffset, z: 0 } }]
    })
  }
  buildVegetation() {
    const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(.16,.22,1.8,7), new THREE.MeshStandardMaterial({color:'#65503a',roughness:.95}), 26)
    const crown = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.1,1), new THREE.MeshStandardMaterial({color:'#4f7b4e',roughness:.9}), 26)
    const o = new THREE.Object3D()
    for(let i=0;i<26;i++) {
      const a=i*2.399,r=20+(i%5)*1.7; let x=Math.cos(a)*r,z=Math.sin(a)*r
      if(Math.abs(z+11)<4||(x>7&&z>0&&z<17)||(Math.abs(x)<4&&z<15)){x+=Math.sign(x||1)*6;z+=5}
      if(Math.abs(Math.abs(x)-30)<4.5||Math.abs(Math.abs(z)-30)<4.5){x*=0.7;z*=0.7}
      const s=.75+(i%4)*.12; o.position.set(x,.9,z);o.scale.setScalar(s);o.updateMatrix();trunk.setMatrixAt(i,o.matrix)
      o.position.y=2.7*s;o.scale.set(1.15*s,1.3*s,1.15*s);o.rotation.set((i%3)*.06,a,0);o.updateMatrix();crown.setMatrixAt(i,o.matrix)
      this.addFixedCollider(x,z,'cylinder',[1.1,0.28*s],1.1)
    }
    trunk.castShadow=crown.castShadow=true;trunk.receiveShadow=crown.receiveShadow=true;this.game.scene.add(trunk,crown)
  }
  makeCar(hex) {
    const g=new THREE.Group(),paint=new THREE.MeshStandardMaterial({color:hex,roughness:.32,metalness:.3}),black=new THREE.MeshStandardMaterial({color:'#17191c',roughness:.85})
    const glass=new THREE.MeshStandardMaterial({color:'#91b5c7',roughness:.25,metalness:.08})
    const body=new THREE.Mesh(new THREE.BoxGeometry(1.9,.46,.94),paint);body.position.y=.45;body.castShadow=true;g.add(body)
    const cabin=new THREE.Mesh(new THREE.BoxGeometry(.88,.42,.78),glass);cabin.position.set(-.12,.83,0);g.add(cabin)
    const wheels=[],geo=new THREE.CylinderGeometry(.27,.27,.18,10);geo.rotateX(Math.PI/2)
    for(const x of [-.63,.62])for(const z of [-.51,.51]){const w=new THREE.Mesh(geo,black);w.position.set(x,.28,z);w.castShadow=true;g.add(w);wheels.push(w)}
    const lampMat=new THREE.MeshBasicMaterial({color:'#ffe7a4'})
    for(const z of [-.3,.3]){const l=new THREE.Mesh(new THREE.BoxGeometry(.07,.11,.18),lampMat);l.position.set(.96,.49,z);g.add(l)}
    this.game.scene.add(g);return {group:g,wheels}
  }
  buildTraffic() {
    // Outer asphalt ring loop (matches the perimeter road painted in Terrain), kept far
    // from spawn, the 3D Contact Pads, Academic Vault and the construction/project zones.
    const h=30
    const pts=[[-h,-h],[0,-h],[h,-h],[h,0],[h,h],[0,h],[-h,h],[-h,0]].map(([x,z])=>new THREE.Vector3(x,0,z))
    this.route=new THREE.CatmullRomCurve3(pts,true,'catmullrom',0.05)
    this.routeLength=this.route.getLength()
    const colors=['#ed5d50','#4eb7a5','#e9bf43']
    for(let i=0;i<3;i++){const c=this.makeCar(colors[i]);c.progress=i/3;c.speed=4.6/this.routeLength;c.angle=0;this.cars.push(c)}
  }
  buildDrones() {
    const shell=new THREE.MeshStandardMaterial({color:'#303844',metalness:.65,roughness:.3}),lamp=new THREE.MeshBasicMaterial({color:'#3cf2dc'})
    // A single small drone patrolling high above the construction/project area
    const g=new THREE.Group();g.add(new THREE.Mesh(new THREE.BoxGeometry(.5,.16,.34),shell))
    for(const x of [-.4,.4])for(const z of [-.45,.45]){const a=new THREE.Mesh(new THREE.BoxGeometry(.5,.035,.05),shell);a.position.set(x*.5,0,z*.5);g.add(a);const r=new THREE.Mesh(new THREE.CylinderGeometry(.19,.19,.03,8),lamp);r.position.set(x,.07,z);g.add(r)}
    g.position.set(15,15,8);this.game.scene.add(g);this.drones.push({group:g,phase:0})
  }
  buildProps() {
    const cones=new THREE.InstancedMesh(new THREE.ConeGeometry(.22,.62,8),new THREE.MeshStandardMaterial({color:'#ef702e',roughness:.75}),18),o=new THREE.Object3D()
    for(let i=0;i<18;i++){o.position.set(8+(i%6)*2.2,.31,-1+Math.floor(i/6)*1.8);o.rotation.y=i*.3;o.updateMatrix();cones.setMatrixAt(i,o.matrix)}
    cones.castShadow=true;this.game.scene.add(cones)
    const mat=new THREE.MeshStandardMaterial({color:'#f0bc42',roughness:.62})
    for(const x of [-19,19]){const b=new THREE.Group();this.box(b,[3.5,.18,.2],[0,.8,0],mat);for(let z=-1.3;z<=1.4;z+=1.3)this.box(b,[.18,.9,.18],[0,.45,z],mat);b.position.set(x,0,-11);this.game.scene.add(b);this.addFixedCollider(x,-11,'cuboid',[1.8,0.5,0.3],0.5)}
    // Neat parked cars in marked parking slots (static ambience with solid colliders)
    const slotMat=new THREE.MeshStandardMaterial({color:'#d8d2c4',roughness:.9})
    const parkedColors=['#628dde','#ad74cf','#e98b3e']
    for(let i=0;i<3;i++){const x=-4+i*4,z=20
      const slot=new THREE.Mesh(new THREE.BoxGeometry(3.2,.05,5.4),slotMat);slot.position.set(x,.02,z);slot.receiveShadow=true;this.game.scene.add(slot)
      const car=this.makeCar(parkedColors[i]);car.group.position.set(x,0,z);car.group.rotation.y=Math.PI/2
      this.addFixedCollider(x,z,'cuboid',[0.6,0.6,1.1],0.6)}
  }
  box(parent,size,pos,material){const m=new THREE.Mesh(new THREE.BoxGeometry(...size),material);m.position.set(...pos);m.castShadow=true;parent.add(m);return m}
  update() {
    const dt=Math.min(this.game.ticker.deltaScaled,.05);this.clock+=dt;const p=this.game.player.position
    // NPC traffic: advance only when the path is clear of the player and other NPCs.
    const positions=this.cars.map(c=>this.route.getPointAt(c.progress))
    for(let i=0;i<this.cars.length;i++){
      const c=this.cars[i],pos=positions[i]
      let blocked=Math.hypot(pos.x-p.x,pos.z-p.z)<5
      if(!blocked){for(let j=0;j<this.cars.length;j++){if(j===i)continue;if(Math.hypot(pos.x-positions[j].x,pos.z-positions[j].z)<4){blocked=true;break}}}
      if(!blocked)c.progress=(c.progress+c.speed*dt)%1
      const pt=this.route.getPointAt(c.progress),t=this.route.getTangentAt(c.progress)
      c.group.position.set(pt.x,0,pt.z)
      const target=Math.atan2(t.z,t.x);let delta=target-c.angle;delta=Math.atan2(Math.sin(delta),Math.cos(delta));c.angle+=delta*Math.min(1,dt*6);c.group.rotation.y=c.angle
      const spin=blocked?0:dt*5;for(const w of c.wheels)w.rotation.x+=spin
    }
    for(const d of this.drones){const a=this.clock*.12+d.phase;d.group.position.set(15+Math.cos(a)*9,15+Math.sin(this.clock*.7+d.phase)*1.2,8+Math.sin(a)*9);d.group.rotation.y=-a}
  }
}
