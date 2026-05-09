const THREE = window.THREE || await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/three@0.172.0/build/three.module.js');

const pointer = { x: 0, y: 0 };
window.addEventListener('pointermove', (event) => {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
});

export function createAmbientBackground(canvas) {
  if (!canvas) return () => {};
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
  camera.position.set(0, 0, 18);
  const group = new THREE.Group();
  scene.add(group);
  const geometry = new THREE.BufferGeometry();
  const positions = [];
  for (let i = 0; i < 420; i += 1) positions.push((Math.random() - .5) * 42, (Math.random() - .5) * 26, (Math.random() - .5) * 26);
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({ size: .045, color: 0x9ddcff, transparent: true, opacity: .68 });
  group.add(new THREE.Points(geometry, material));
  const light = new THREE.PointLight(0x8b5cf6, 2, 50); scene.add(light);
  let frame;
  function resize(){const w=window.innerWidth,h=window.innerHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()}
  function tick(time){group.rotation.y=time*.000035+pointer.x*.05;group.rotation.x=pointer.y*.035;light.position.set(pointer.x*8,pointer.y*5,8);renderer.render(scene,camera);frame=requestAnimationFrame(tick)}
  resize(); window.addEventListener('resize',resize); tick(0);
  return () => { cancelAnimationFrame(frame); window.removeEventListener('resize', resize); renderer.dispose(); };
}

export function createHeroScene(container) {
  if (!container) return () => {};
  container.innerHTML = '';
  const canvas = document.createElement('canvas');
  container.appendChild(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100); camera.position.set(0, 0, 9);
  const core = new THREE.Group(); scene.add(core);
  const matA = new THREE.MeshStandardMaterial({ color: 0x8b5cf6, roughness: .25, metalness: .65, transparent: true, opacity: .82 });
  const matB = new THREE.MeshStandardMaterial({ color: 0x06b6d4, roughness: .18, metalness: .72, wireframe: true });
  const shapes = [new THREE.IcosahedronGeometry(1.2, 1), new THREE.TorusKnotGeometry(.72, .18, 96, 14), new THREE.OctahedronGeometry(.95, 0), new THREE.BoxGeometry(1.2, 1.2, 1.2)];
  for (let i=0;i<9;i+=1){const mesh=new THREE.Mesh(shapes[i%shapes.length],i%2?matB:matA);mesh.position.set(Math.sin(i)*2.8,Math.cos(i*1.7)*1.8,(i%3)-1.3);mesh.rotation.set(Math.random()*2,Math.random()*2,0);mesh.userData.speed=.25+Math.random()*.45;core.add(mesh)}
  const particlesGeo = new THREE.BufferGeometry(); const positions=[];
  for(let i=0;i<800;i+=1)positions.push((Math.random()-.5)*12,(Math.random()-.5)*8,(Math.random()-.5)*8);
  particlesGeo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  scene.add(new THREE.Points(particlesGeo,new THREE.PointsMaterial({size:.025,color:0xffffff,transparent:true,opacity:.7})));
  scene.add(new THREE.AmbientLight(0xbec7ff, .8));
  const p1=new THREE.PointLight(0x8b5cf6,5,20);p1.position.set(-4,3,5);scene.add(p1);
  const p2=new THREE.PointLight(0x06b6d4,4,20);p2.position.set(4,-3,5);scene.add(p2);
  let frame;
  function resize(){const r=container.getBoundingClientRect();renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix()}
  function tick(time){core.rotation.y=time*.00022+pointer.x*.2;core.rotation.x=pointer.y*.12;core.children.forEach((m,i)=>{m.rotation.x+=.004*m.userData.speed;m.rotation.y+=.006*m.userData.speed;m.position.y+=Math.sin(time*.001+i)*.002});camera.position.x+=(pointer.x*.75-camera.position.x)*.035;camera.position.y+=(pointer.y*.45-camera.position.y)*.035;camera.lookAt(0,0,0);renderer.render(scene,camera);frame=requestAnimationFrame(tick)}
  resize(); window.addEventListener('resize',resize); tick(0);
  return () => { cancelAnimationFrame(frame); window.removeEventListener('resize', resize); renderer.dispose(); };
}

export function createKnowledgeGraph(container, data, onSelect) {
  if (!container) return () => {};
  container.innerHTML = '';
  const canvas = document.createElement('canvas'); container.appendChild(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true }); renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
  const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(50, 1, .1, 100); camera.position.set(0,0,18);
  const raycaster = new THREE.Raycaster(); const mouse = new THREE.Vector2(); const nodes=[]; const lines=[];
  const palette = { note: 0x8b5cf6, file: 0x06b6d4, idea: 0xf59e0b };
  const source = data.length ? data : [{id:'welcome',type:'note',title:'Create your first note'}];
  source.forEach((item,i)=>{const geo=new THREE.SphereGeometry(item.type==='file'?.42:.34,24,24);const mat=new THREE.MeshStandardMaterial({color:palette[item.type]||0xffffff,emissive:palette[item.type]||0xffffff,emissiveIntensity:.18,roughness:.28,metalness:.35});const mesh=new THREE.Mesh(geo,mat);const angle=(i/source.length)*Math.PI*2;const radius=3.2+(i%5)*.72;mesh.position.set(Math.cos(angle)*radius,Math.sin(angle)*radius,(Math.random()-.5)*4);mesh.userData={...item,velocity:new THREE.Vector3((Math.random()-.5)*.006,(Math.random()-.5)*.006,0)};scene.add(mesh);nodes.push(mesh)});
  const lineMat = new THREE.LineBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: .28 });
  for(let i=0;i<nodes.length;i+=1){for(let j=i+1;j<nodes.length;j+=1){if(i%3===j%3||Math.random()>.78){const geo=new THREE.BufferGeometry().setFromPoints([nodes[i].position,nodes[j].position]);const line=new THREE.Line(geo,lineMat);scene.add(line);lines.push({line,a:nodes[i],b:nodes[j]})}}}
  scene.add(new THREE.AmbientLight(0xffffff,.72)); const light=new THREE.PointLight(0x8b5cf6,4,30);light.position.set(0,3,8);scene.add(light);
  let dragging=null; let frame;
  function resize(){const r=container.getBoundingClientRect();renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix()}
  function setMouse(event){const rect=canvas.getBoundingClientRect();mouse.x=((event.clientX-rect.left)/rect.width)*2-1;mouse.y=-((event.clientY-rect.top)/rect.height)*2+1}
  function intersect(event){setMouse(event);raycaster.setFromCamera(mouse,camera);return raycaster.intersectObjects(nodes)[0]}
  canvas.addEventListener('pointerdown',(e)=>{const hit=intersect(e);if(hit){dragging=hit.object;canvas.setPointerCapture(e.pointerId)}});
  canvas.addEventListener('pointermove',(e)=>{setMouse(e);if(dragging){const vector=new THREE.Vector3(mouse.x,mouse.y,.5).unproject(camera);const dir=vector.sub(camera.position).normalize();const dist=-camera.position.z/dir.z;dragging.position.copy(camera.position.clone().add(dir.multiplyScalar(dist)));}});
  canvas.addEventListener('pointerup',(e)=>{const hit=intersect(e);if(hit && (!dragging || hit.object===dragging)) onSelect?.(hit.object.userData);dragging=null;try{canvas.releasePointerCapture(e.pointerId)}catch {
      // Pointer capture can already be released by the browser.
    }});
  function tick(time){nodes.forEach((n,i)=>{if(n!==dragging){n.position.add(n.userData.velocity); if(Math.abs(n.position.x)>7)n.userData.velocity.x*=-1;if(Math.abs(n.position.y)>5)n.userData.velocity.y*=-1;n.position.z+=Math.sin(time*.001+i)*.002}n.rotation.y+=.01});lines.forEach(({line,a,b})=>line.geometry.setFromPoints([a.position,b.position]));scene.rotation.y += (pointer.x*.08-scene.rotation.y)*.03;renderer.render(scene,camera);frame=requestAnimationFrame(tick)}
  resize(); window.addEventListener('resize',resize); tick(0);
  return () => { cancelAnimationFrame(frame); window.removeEventListener('resize', resize); renderer.dispose(); };
}
