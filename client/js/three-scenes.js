import * as THREE from 'three';
import i18n from './i18n.js';

const pointer = { x: 0, y: 0 };

window.addEventListener('pointermove', (event) => {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
}, { passive: true });

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

function createRenderer(options, pixelRatio = 1.6) {
  if (!THREE?.WebGLRenderer) return null;
  try {
    const renderer = new THREE.WebGLRenderer(options);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, pixelRatio));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    return renderer;
  } catch (error) {
    console.warn('Three.js renderer could not be created; 3D scenes are disabled.', error);
    return null;
  }
}

function disposeScene(scene) {
  scene.traverse((object) => {
    object.geometry?.dispose?.();
    if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose?.());
    else object.material?.dispose?.();
  });
}

function createLoop(render) {
  let frame;
  let last = 0;
  const minFrameGap = prefersReducedMotion() ? 180 : 0;

  function tick(time) {
    if (!document.hidden && time - last >= minFrameGap) {
      render(time);
      last = time;
    }
    frame = requestAnimationFrame(tick);
  }

  frame = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(frame);
}

function observeElementSize(element, renderer, camera) {
  const resize = () => {
    const rect = element.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };

  const observer = 'ResizeObserver' in window ? new ResizeObserver(resize) : null;
  if (observer) observer.observe(element);
  else window.addEventListener('resize', resize);
  resize();

  return () => {
    if (observer) observer.disconnect();
    else window.removeEventListener('resize', resize);
  };
}

function cleanup(renderer, scene, stopLoop, stopResize) {
  stopLoop?.();
  stopResize?.();
  disposeScene(scene);
  renderer.dispose();
}

export function createAmbientBackground(canvas) {
  if (!canvas) return () => {};
  const renderer = createRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'high-performance' }, 1.35);
  if (!renderer) return () => {};

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
  camera.position.set(0, 0, 18);

  const group = new THREE.Group();
  scene.add(group);

  const geometry = new THREE.BufferGeometry();
  const count = window.innerWidth < 760 ? 190 : 360;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = (Math.random() - 0.5) * 42;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 26;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 26;
  }
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  group.add(new THREE.Points(geometry, new THREE.PointsMaterial({
    size: 0.045,
    color: 0x9ddcff,
    transparent: true,
    opacity: 0.58,
    depthWrite: false
  })));

  const light = new THREE.PointLight(0x65e4d4, 1.6, 50);
  scene.add(light);

  function resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  const stopLoop = createLoop((time) => {
    const motion = prefersReducedMotion() ? 0.15 : 1;
    group.rotation.y = time * 0.000032 * motion + pointer.x * 0.045;
    group.rotation.x = pointer.y * 0.03;
    light.position.set(pointer.x * 8, pointer.y * 5, 8);
    renderer.render(scene, camera);
  });

  resize();
  window.addEventListener('resize', resize);

  return () => {
    window.removeEventListener('resize', resize);
    cleanup(renderer, scene, stopLoop);
  };
}

export function createHeroScene(container) {
  if (!container) return () => {};
  container.innerHTML = '';
  const canvas = document.createElement('canvas');
  container.appendChild(canvas);
  const renderer = createRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' }, 1.65);
  if (!renderer) return () => {};

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0, 9);

  const core = new THREE.Group();
  scene.add(core);

  const solid = new THREE.MeshStandardMaterial({ color: 0x65e4d4, roughness: 0.24, metalness: 0.62, transparent: true, opacity: 0.82 });
  const wire = new THREE.MeshStandardMaterial({ color: 0x5ba7ff, roughness: 0.18, metalness: 0.72, wireframe: true });
  const geometries = [
    new THREE.IcosahedronGeometry(1.15, 1),
    new THREE.TorusKnotGeometry(0.7, 0.16, 80, 12),
    new THREE.OctahedronGeometry(0.92, 0),
    new THREE.BoxGeometry(1.12, 1.12, 1.12)
  ];

  for (let i = 0; i < 8; i += 1) {
    const mesh = new THREE.Mesh(geometries[i % geometries.length], i % 2 ? wire : solid);
    mesh.position.set(Math.sin(i) * 2.7, Math.cos(i * 1.7) * 1.75, (i % 3) - 1.25);
    mesh.rotation.set(Math.random() * 2, Math.random() * 2, 0);
    mesh.userData.speed = 0.22 + Math.random() * 0.36;
    core.add(mesh);
  }

  const particlesGeo = new THREE.BufferGeometry();
  const particleCount = window.innerWidth < 760 ? 320 : 560;
  const particlePositions = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i += 1) {
    particlePositions[i * 3] = (Math.random() - 0.5) * 12;
    particlePositions[i * 3 + 1] = (Math.random() - 0.5) * 8;
    particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 8;
  }
  particlesGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
  scene.add(new THREE.Points(particlesGeo, new THREE.PointsMaterial({
    size: 0.026,
    color: 0xffffff,
    transparent: true,
    opacity: 0.56,
    depthWrite: false
  })));

  scene.add(new THREE.AmbientLight(0xffffff, 0.72));
  const p1 = new THREE.PointLight(0x65e4d4, 4.2, 20);
  p1.position.set(-4, 3, 5);
  scene.add(p1);
  const p2 = new THREE.PointLight(0xf5c66b, 3.2, 18);
  p2.position.set(4, -3, 5);
  scene.add(p2);

  const stopResize = observeElementSize(container, renderer, camera);
  const stopLoop = createLoop((time) => {
    const motion = prefersReducedMotion() ? 0.16 : 1;
    core.rotation.y = time * 0.0002 * motion + pointer.x * 0.18;
    core.rotation.x = pointer.y * 0.1;
    core.children.forEach((mesh, index) => {
      mesh.rotation.x += 0.0035 * mesh.userData.speed * motion;
      mesh.rotation.y += 0.005 * mesh.userData.speed * motion;
      mesh.position.y += Math.sin(time * 0.001 + index) * 0.0016 * motion;
    });
    camera.position.x += (pointer.x * 0.7 - camera.position.x) * 0.035;
    camera.position.y += (pointer.y * 0.42 - camera.position.y) * 0.035;
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
  });

  return () => cleanup(renderer, scene, stopLoop, stopResize);
}

export function createKnowledgeGraph(container, data, onSelect) {
  if (!container) return () => {};
  container.innerHTML = '';
  const canvas = document.createElement('canvas');
  container.appendChild(canvas);
  const renderer = createRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' }, 1.55);
  if (!renderer) return () => {};

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(0, 0, 18);

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  const nodes = [];
  const lines = [];
  const palette = { note: 0x65e4d4, file: 0x5ba7ff, idea: 0xf5c66b };
  const materials = Object.fromEntries(Object.entries(palette).map(([type, color]) => [type, new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.16,
    roughness: 0.28,
    metalness: 0.35
  })]));
  const sphere = new THREE.SphereGeometry(0.35, 24, 24);
  const fileSphere = new THREE.SphereGeometry(0.44, 24, 24);
  const source = data.length ? data : [{ id: 'welcome', type: 'note', title: i18n.t('graph.placeholderNode') }];

  source.forEach((item, index) => {
    const mesh = new THREE.Mesh(item.type === 'file' ? fileSphere : sphere, materials[item.type] || materials.note);
    const angle = (index / source.length) * Math.PI * 2;
    const radius = 3.2 + (index % 5) * 0.72;
    mesh.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, (Math.random() - 0.5) * 4);
    mesh.userData = {
      ...item,
      velocity: new THREE.Vector3((Math.random() - 0.5) * 0.005, (Math.random() - 0.5) * 0.005, 0)
    };
    scene.add(mesh);
    nodes.push(mesh);
  });

  const lineMat = new THREE.LineBasicMaterial({ color: 0x8ad9ff, transparent: true, opacity: 0.26 });
  function createLine(a, b) {
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const line = new THREE.Line(lineGeo, lineMat);
    scene.add(line);
    lines.push({ line, a, b });
  }

  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      if (i % 3 === j % 3 || Math.random() > 0.8) createLine(nodes[i], nodes[j]);
    }
  }

  scene.add(new THREE.AmbientLight(0xffffff, 0.72));
  const light = new THREE.PointLight(0x65e4d4, 3.8, 30);
  light.position.set(0, 3, 8);
  scene.add(light);

  let dragging = null;
  const stopResize = observeElementSize(container, renderer, camera);

  function setMouse(event) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function intersect(event) {
    setMouse(event);
    raycaster.setFromCamera(mouse, camera);
    return raycaster.intersectObjects(nodes)[0];
  }

  canvas.addEventListener('pointerdown', (event) => {
    const hit = intersect(event);
    if (!hit) return;
    dragging = hit.object;
    canvas.setPointerCapture(event.pointerId);
  });

  canvas.addEventListener('pointermove', (event) => {
    setMouse(event);
    if (!dragging) return;
    const vector = new THREE.Vector3(mouse.x, mouse.y, 0.5).unproject(camera);
    const direction = vector.sub(camera.position).normalize();
    const distance = -camera.position.z / direction.z;
    dragging.position.copy(camera.position.clone().add(direction.multiplyScalar(distance)));
  });

  canvas.addEventListener('pointerup', (event) => {
    const hit = intersect(event);
    if (hit && (!dragging || hit.object === dragging)) onSelect?.(hit.object.userData);
    dragging = null;
    try {
      canvas.releasePointerCapture(event.pointerId);
    } catch {
      // The browser may release pointer capture before this handler runs.
    }
  });

  const stopLoop = createLoop((time) => {
    const motion = prefersReducedMotion() ? 0.2 : 1;
    nodes.forEach((node, index) => {
      if (node !== dragging) {
        node.position.addScaledVector(node.userData.velocity, motion);
        if (Math.abs(node.position.x) > 7) node.userData.velocity.x *= -1;
        if (Math.abs(node.position.y) > 5) node.userData.velocity.y *= -1;
        node.position.z += Math.sin(time * 0.001 + index) * 0.0016 * motion;
      }
      node.rotation.y += 0.009 * motion;
    });

    lines.forEach(({ line, a, b }) => {
      const position = line.geometry.attributes.position;
      position.setXYZ(0, a.position.x, a.position.y, a.position.z);
      position.setXYZ(1, b.position.x, b.position.y, b.position.z);
      position.needsUpdate = true;
    });

    scene.rotation.y += (pointer.x * 0.08 - scene.rotation.y) * 0.03;
    renderer.render(scene, camera);
  });

  return () => cleanup(renderer, scene, stopLoop, stopResize);
}
