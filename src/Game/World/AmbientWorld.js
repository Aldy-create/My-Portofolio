import * as THREE from 'three/webgpu'

export class AmbientWorld {
  constructor(game) {
    this.game = game; this.clock = 0; this.cars = []; this.drones = []
    this.buildVegetation(); this.buildTraffic(); this.buildDrones(); this.buildProps()
    this.game.ticker.events.on('tick', () => this.update(), 15)
  }
  buildVegetation() {
    const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(.16,.22,1.8,7), new THREE.MeshStandardMaterial({color:'#65503a',roughness:.95}), 26)
    const crown = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.1,1), new THREE.MeshStandardMaterial({color:'#4f7b4e',roughness:.9}), 26)
    const o = new THREE.Object3D()
    for(let i=0;i<26;i++) {
      const a=i*2.399,r=20+(i%5)*1.7; let x=Math.cos(a)*r,z=Math.sin(a)*r
      if(Math.abs(z+11)<4||(x>7&&z>0&&z<17)||(Math.abs(x)<4&&z<15)){x+=Math.sign(x||1)*6;z+=5}
      const s=.75+(i%4)*.12; o.position.set(x,.9,z);o.scale.setScalar(s);o.updateMatrix();trunk.setMatrixAt(i,o.matrix)
      o.position.y=2.7*s;o.scale.set(1.15*s,1.3*s,1.15*s);o.rotation.set((i%3)*.06,a,0);o.updateMatrix();crown.setMatrixAt(i,o.matrix)
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
    const pts=[[-18,-11],[-13,-15],[14,-15],[18,-11],[14,-7],[-14,-7]].map(([x,z])=>new THREE.Vector3(x,.55,z))
    this.route=new THREE.CatmullRomCurve3(pts,true,'catmullrom',.15)
    for(let i=0;i<6;i++){const c=this.makeCar(['#ed5d50','#4eb7a5','#628dde','#e9bf43','#ad74cf','#e98b3e'][i]);c.progress=i/6;c.speed=.025+(i%3)*.003;this.cars.push(c)}
  }
  buildDrones() {
    const shell=new THREE.MeshStandardMaterial({color:'#303844',metalness:.65,roughness:.3}),lamp=new THREE.MeshBasicMaterial({color:'#3cf2dc'})
    for(let i=0;i<2;i++){const g=new THREE.Group();g.add(new THREE.Mesh(new THREE.BoxGeometry(.62,.2,.42),shell))
      for(const x of [-.48,.48])for(const z of [-.55,.55]){const a=new THREE.Mesh(new THREE.BoxGeometry(.6,.04,.06),shell);a.position.set(x*.5,0,z*.5);g.add(a);const r=new THREE.Mesh(new THREE.CylinderGeometry(.23,.23,.035,8),lamp);r.position.set(x,.08,z);g.add(r)}
      g.position.y=7+i*2;this.game.scene.add(g);this.drones.push({group:g,phase:i*Math.PI})}
  }
  buildProps() {
    const cones=new THREE.InstancedMesh(new THREE.ConeGeometry(.22,.62,8),new THREE.MeshStandardMaterial({color:'#ef702e',roughness:.75}),18),o=new THREE.Object3D()
    for(let i=0;i<18;i++){o.position.set(8+(i%6)*2.2,.31,-1+Math.floor(i/6)*1.8);o.rotation.y=i*.3;o.updateMatrix();cones.setMatrixAt(i,o.matrix)}
    cones.castShadow=true;this.game.scene.add(cones)
    const mat=new THREE.MeshStandardMaterial({color:'#f0bc42',roughness:.62})
    for(const x of [-19,19]){const b=new THREE.Group();this.box(b,[3.5,.18,.2],[0,.8,0],mat);for(let z=-1.3;z<=1.4;z+=1.3)this.box(b,[.18,.9,.18],[0,.45,z],mat);b.position.set(x,0,-11);this.game.scene.add(b)}
  }
  box(parent,size,pos,material){const m=new THREE.Mesh(new THREE.BoxGeometry(...size),material);m.position.set(...pos);m.castShadow=true;parent.add(m);return m}
  update() {
    const dt=Math.min(this.game.ticker.deltaScaled,.05);this.clock+=dt;const p=this.game.player.position
    for(const c of this.cars){let pt=this.route.getPointAt(c.progress),gap=Math.hypot(pt.x-p.x,pt.z-p.z);if(gap>3.8)c.progress=(c.progress+c.speed*dt)%1
      pt=this.route.getPointAt(c.progress);const t=this.route.getTangentAt(c.progress);c.group.position.set(pt.x,0,pt.z);c.group.rotation.y=Math.atan2(t.z,t.x);for(const w of c.wheels)w.rotation.x+=dt*(gap>3.8?4:0)}
    for(const d of this.drones){const a=this.clock*.18+d.phase;d.group.position.set(Math.cos(a)*18,8+Math.sin(this.clock*.8+d.phase)*1.2,Math.sin(a)*18);d.group.rotation.y=-a}
  }
}
