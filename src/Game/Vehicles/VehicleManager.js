import * as THREE from 'three/webgpu'
import { gsap } from 'gsap'
import { VEHICLE_PROFILES, getVehicleProfile } from './vehicleProfiles.js'

export class VehicleManager {
  constructor(game) {
    this.game=game;this.activeId='buggy';this.nearbyId=null;this.bedRaised=false;this.hydraulicActive=false
    this.turret=0;this.boom=-.22;this.stick=-.58;this.bucket=-.3;this.lastSpace=false;this.lastDig=false
    this.models=new Map();this.parked=new Map();this.stations=new Map([
      ['buggy',new THREE.Vector3(0,0,0)],['excavator',new THREE.Vector3(11.8,0,8)],['dump-truck',new THREE.Vector3(19,0,8)],['bulldozer',new THREE.Vector3(11.8,0,12.2)],['drift-pickup',new THREE.Vector3(-14,0,-7)],['rover',new THREE.Vector3(-18,0,-2)],['hatchback',new THREE.Vector3(13,0,-15)]])
    this.makeFleet();this.makeUI();this.bindInputs();this.applyProfile();game.ticker.events.on('tick',()=>this.update(),12)
  }
  mat(c,o={}){return new THREE.MeshStandardMaterial({color:c,roughness:.58,metalness:.12,...o})}
  box(p,s,pos,m){const o=new THREE.Mesh(new THREE.BoxGeometry(...s),m);o.position.set(...pos);o.castShadow=o.receiveShadow=true;p.add(o);return o}
  makeModel(profile){
    const root=new THREE.Group(),paint=this.mat(profile.paint,{roughness:.38,metalness:.26}),dark=this.mat('#25262b',{roughness:.88}),metal=this.mat('#a2aab0',{metalness:.7,roughness:.3}),glass=this.mat('#496b7c',{roughness:.23,transparent:true,opacity:.82}),parts={wheels:[]}
    if(profile.kind==='excavator'){
      this.box(root,[2.35,.38,1.12],[-.05,-.16,0],dark)
      for(const z of [-.72,.72]){this.box(root,[2.5,.68,.4],[0,-.45,z],dark);for(const x of [-.82,-.28,.28,.82]){const w=new THREE.Mesh(new THREE.CylinderGeometry(.22,.22,.16,10),metal);w.rotation.x=Math.PI/2;w.position.set(x,-.47,z+Math.sign(z)*.22);root.add(w)}}
      const turret=new THREE.Group();turret.position.set(-.02,.2,0);root.add(turret);parts.turret=turret
      this.box(turret,[1.65,.42,1.22],[-.06,.42,0],paint);this.box(turret,[.9,.82,.92],[-.43,1.02,0],glass);this.box(turret,[1.05,.14,1.18],[-.43,1.48,0],paint)
      const boom=new THREE.Group();boom.position.set(.65,.66,0);turret.add(boom);parts.boom=boom;this.box(boom,[1.55,.3,.34],[.68,0,0],paint)
      const stick=new THREE.Group();stick.position.set(1.35,0,0);boom.add(stick);parts.stick=stick;this.box(stick,[1.2,.23,.27],[.48,-.02,0],paint)
      const bucket=new THREE.Group();bucket.position.set(1.08,-.03,0);stick.add(bucket);parts.bucket=bucket
      this.box(bucket,[.55,.42,.62],[.12,-.12,0],dark);this.box(bucket,[.22,.55,.66],[.34,-.35,0],paint,[0,0,-.28]);for(const z of [-.24,0,.24])this.box(bucket,[.34,.13,.12],[.54,-.53,z],metal,[0,0,-.16])
      parts.piston=this.box(boom,[.12,1.05,.12],[.65,-.28,.24],metal,[0,0,-.45])
      parts.cargo=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.19,0),this.mat('#90785c',{roughness:1}),12);bucket.add(parts.cargo)
    }else if(profile.kind==='truck'){
      this.box(root,[3.15,.48,1.28],[-.05,-.12,0],dark);const wheelGeo=new THREE.CylinderGeometry(.38,.38,.26,12);wheelGeo.rotateX(Math.PI/2);for(const x of [-1,.96])for(const z of [-.72,.72]){const w=new THREE.Mesh(wheelGeo,dark);w.position.set(x,-.48,z);root.add(w);parts.wheels.push(w)}this.box(root,[1.08,.9,1.22],[.92,.44,0],paint);this.box(root,[.72,.5,1.08],[.98,.91,0],glass)
      const bed=new THREE.Group();bed.position.set(-.55,.28,0);root.add(bed);parts.bed=bed;this.box(bed,[1.72,.18,1.25],[-.25,.18,0],paint);for(const z of [-.59,.59])this.box(bed,[1.75,.65,.12],[-.25,.52,z],paint);this.box(bed,[.12,.65,1.28],[-1.1,.52,0],paint)
      parts.cargo=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.2,0),this.mat('#927a60',{roughness:1}),12);bed.add(parts.cargo)
    }else if(profile.kind==='dozer'){
      this.box(root,[2.5,.48,1.42],[-.08,-.16,0],paint);for(const z of [-.73,.73])this.box(root,[2.4,.65,.34],[0,-.48,z],dark);this.box(root,[1.1,.75,1.08],[-.05,.5,0],glass)
      const blade=new THREE.Group();blade.position.set(1.28,-.04,0);root.add(blade);parts.blade=blade;this.box(blade,[.22,.95,2.08],[.13,-.08,0],paint,[0,0,-.08])
    }else{
      const rover=profile.kind==='rover';this.box(root,[2.58,.5,1.5],[0,-.12,0],paint);this.box(root,[rover?1.08:1.25,.65,1.26],[-.05,.48,0],glass);this.box(root,[1.2,.14,1.42],[-.08,.86,0],paint)
      if(profile.kind==='pickup')this.box(root,[.72,.36,1.4],[-.88,.32,0],dark)
      if(rover){const mast=new THREE.Mesh(new THREE.CylinderGeometry(.04,.05,.62,8),metal);mast.position.set(-.5,1.2,0);root.add(mast)}
      for(const x of [-.91,.91])for(const z of [-.83,.83]){const wheel=new THREE.Group();wheel.position.set(x,-.47,z);root.add(wheel);const tire=new THREE.Mesh(new THREE.CylinderGeometry(rover?.48:.4,rover?.48:.4,.3,14),dark);tire.rotation.x=Math.PI/2;wheel.add(tire);const rim=new THREE.Mesh(new THREE.CylinderGeometry(.2,.2,.32,10),metal);rim.rotation.x=Math.PI/2;wheel.add(rim);parts.wheels.push(wheel)}
    }
    if(profile.kind!=='excavator'&&profile.kind!=='dozer')for(const z of [-.48,.48]){const h=new THREE.Mesh(new THREE.BoxGeometry(.09,.16,.25),new THREE.MeshBasicMaterial({color:'#ffe8af'}));h.position.set(1.28,.18,z);root.add(h)}
    root.traverse(o=>{if(o.isMesh)o.castShadow=o.receiveShadow=true});root.userData.parts=parts;return root
  }
  makeFleet(){for(const p of VEHICLE_PROFILES){const active=this.makeModel(p);active.visible=p.id!=='buggy';this.game.scene.add(active);this.models.set(p.id,active);const parked=this.makeModel(p),s=this.stations.get(p.id);parked.position.set(s.x,.9,s.z);if(p.id==='dump-truck'||p.id==='hatchback')parked.rotation.y=Math.PI;parked.visible=p.id!=='buggy';this.game.scene.add(parked);this.parked.set(p.id,parked)}}
  makeUI(){this.ui=document.createElement('aside');this.ui.className='vehicle-switcher';this.ui.setAttribute('aria-label','Vehicle fleet');const title=document.createElement('div');title.className='vehicle-switcher-title';title.textContent='FLEET / 07';this.ui.append(title);this.buttons=new Map()
    for(const p of VEHICLE_PROFILES){const b=document.createElement('button');b.type='button';b.dataset.vehicle=p.id;b.textContent=p.label;b.title=`Switch to ${p.label}`;b.onclick=()=>this.switchTo(p.id,true);this.buttons.set(p.id,b);this.ui.append(b)}
    this.prompt=document.createElement('div');this.prompt.className='vehicle-nearby-prompt';this.prompt.hidden=true;this.prompt.innerHTML='<kbd>E</kbd><span></span>';document.body.append(this.ui,this.prompt)
    this.controlHint=document.createElement('div');this.controlHint.className='vehicle-controls-hint';document.body.append(this.controlHint);this.syncUI()}
  bindInputs(){this.game.inputs.events.on('interact',a=>{if(a.active&&this.activeId!=='excavator'&&this.nearbyId)this.switchTo(this.nearbyId,false)});this.game.inputs.keyboard.events.on('down',code=>{if(code==='KeyH')this.game.soundEngine?.honk()})}
  applyProfile(){const p=getVehicleProfile(this.activeId),v=this.game.physicalVehicle;v.engineForceAmplitude=p.engineForce;v.topSpeed=p.topSpeed;v.steeringAmplitude=p.steering;v.boostMultiplier=['car','pickup','hatchback','rover'].includes(p.kind)?2:1}
  switchTo(id,quick){const p=getVehicleProfile(id);if(!p||id===this.activeId)return;const old=this.activeId;this.activeId=id;this.applyProfile();if(this.game.world?.visualVehicle?.parts?.chassis)this.game.world.visualVehicle.parts.chassis.visible=id==='buggy';for(const [key,m] of this.models)m.visible=key===id&&id!=='buggy';for(const [key,m] of this.parked)m.visible=key!==id;if(old!=='buggy')this.models.get(old).visible=false
    this.game.view.focusPoint.isTracking=true;if(id!=='buggy'){const m=this.models.get(id);m.scale.setScalar(.9);gsap.to(m.scale,{x:1,y:1,z:1,duration:.55,ease:'back.out(1.2)',overwrite:true})}this.syncUI();this.game.portfolioUI?.showToast(`Vehicle: ${p.label}`)}
  syncUI(){for(const [id,b] of this.buttons||[])b.classList.toggle('is-active',id===this.activeId);const p=getVehicleProfile(this.activeId);if(this.controlHint){this.controlHint.textContent=p.controls;this.controlHint.classList.toggle('is-visible',['excavator','dump-truck','bulldozer'].includes(p.id))}}
  pressed(c){return this.game.inputs.keyboard.pressed.includes(c)}
  applyControls(player){if(this.activeId==='excavator'){player.accelerating=(this.pressed('KeyW')?1:0)-(this.pressed('KeyS')?1:0);player.steering=(this.pressed('KeyA')?1:0)-(this.pressed('KeyD')?1:0);player.boosting=0;player.braking=this.pressed('KeyB')?1:0}
    if(this.activeId==='dump-truck'){player.boosting=0;const s=this.pressed('Space');if(s&&!this.lastSpace)this.bedRaised=!this.bedRaised;this.lastSpace=s}if(this.activeId==='bulldozer')player.boosting=0}
  getWorldPosition(id){return id===this.activeId?this.game.physicalVehicle.position.clone():this.stations.get(id).clone().add(new THREE.Vector3(0,.8,0))}
  setCargo(mesh,count){if(!mesh)return;const o=new THREE.Object3D();for(let i=0;i<mesh.count;i++){if(i<count){o.position.set((i%4-1.5)*.23,.12+Math.floor(i/4)*.18,(Math.floor(i/4)-1)*.21);o.rotation.set(i*.7,i,i*.33);o.scale.setScalar(.82)}else{o.position.set(0,-3,0);o.scale.setScalar(0)}o.updateMatrix();mesh.setMatrixAt(i,o.matrix)}mesh.instanceMatrix.needsUpdate=true}
  update(){if(!this.game.player)return;const p=this.game.player.position;let best=3.6,next=null;for(const [id,s] of this.stations){if(id===this.activeId)continue;const d=Math.hypot(p.x-s.x,p.z-s.z);if(d<best){best=d;next=id}}this.nearbyId=next;this.prompt.hidden=!next;if(next)this.prompt.querySelector('span').textContent=`Drive ${getVehicleProfile(next).label}`
    const body=this.game.physicalVehicle.position;for(const [id,m] of this.models){if(id==='buggy')continue;m.position.copy(body);m.quaternion.copy(this.game.physicalVehicle.quaternion);const parts=m.userData.parts;if(parts.wheels?.length){const spin=this.game.physicalVehicle.forwardSpeed*this.game.ticker.deltaScaled*1.9;for(let i=0;i<parts.wheels.length;i++){const w=parts.wheels[i];w.rotation.z+=spin;if(i>=2)w.rotation.y=this.game.player.steering*.48}}
      if(id==='dump-truck'&&parts.bed){parts.bed.rotation.z+=((this.bedRaised?.46:0)-parts.bed.rotation.z)*Math.min(1,this.game.ticker.deltaScaled*4);this.setCargo(parts.cargo,this.game.world.constructionSite.truckCargo);const parkedParts=this.parked.get(id).userData.parts;parkedParts.bed.rotation.z+=((this.bedRaised?.46:0)-parkedParts.bed.rotation.z)*Math.min(1,this.game.ticker.deltaScaled*4);this.setCargo(parkedParts.cargo,this.game.world.constructionSite.truckCargo)}
      if(id==='bulldozer'&&parts.blade){if(this.pressed('KeyI'))parts.blade.position.y=Math.min(.55,parts.blade.position.y+this.game.ticker.deltaScaled*.6);if(this.pressed('KeyK'))parts.blade.position.y=Math.max(-.29,parts.blade.position.y-this.game.ticker.deltaScaled*.6)}
      if(id==='excavator')this.updateExcavator(m,parts)}
    if(this.activeId==='excavator'&&p.distanceTo(this.game.world.constructionSite.center)<13&&Math.abs(this.game.physicalVehicle.speed)>3)this.game.particles?.emit(p.clone().add(new THREE.Vector3(0,-.7,0)),1,.22)}
  updateExcavator(model,parts){const k=this.game.inputs.keyboard.pressed,dt=Math.min(this.game.ticker.deltaScaled,.05),has=c=>k.includes(c),q=has('KeyQ'),e=has('KeyE'),i=has('KeyI'),down=has('KeyK'),j=has('KeyJ'),l=has('KeyL');this.hydraulicActive=q||e||i||down||j||l
    this.turret+=((e?1:0)-(q?1:0))*dt*.8;this.boom=THREE.MathUtils.clamp(this.boom+((i?1:0)-(down?1:0))*dt*.55,-.95,.85);this.stick=THREE.MathUtils.clamp(this.stick+((down?1:0)-(i?1:0))*dt*.44,-1.25,.35);this.bucket=THREE.MathUtils.clamp(this.bucket+((l?1:0)-(j?1:0))*dt*.9,-.85,.9)
    parts.turret.rotation.y=this.turret;parts.boom.rotation.z=this.boom;parts.stick.rotation.z=this.stick;parts.bucket.rotation.z=this.bucket;model.updateMatrixWorld(true);const bp=parts.bucket.getWorldPosition(new THREE.Vector3()),site=this.game.world.constructionSite,scoop=j&&this.bucket<-.15,collected=site.scoop(bp,scoop)
    if(collected||(scoop&&!this.lastDig))this.game.particles?.emit(bp,9,.8);this.lastDig=scoop
    if(l&&this.bucket>.35&&site.payload.length){const r=site.unload(bp,this.bucket,this.getWorldPosition('dump-truck'),this.bedRaised);if(r.dropped||r.delivered){this.game.particles?.emit(bp,14,1.2);this.game.portfolioUI?.showToast(r.delivered?`Loaded ${r.delivered} soil chunks into dump truck`:`Released ${r.dropped} soil chunks`)}}
    this.setCargo(parts.cargo,site.payload.length)
  }
}
