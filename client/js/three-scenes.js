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
  const prefersReduced = prefersReducedMotion();
  const isMobileDevice = window.matchMedia?.('(pointer: coarse)').matches;
  const minFrameGap = prefersReduced ? 180 : (isMobileDevice ? 33 : 0);

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
  const applySize = (width, height) => {
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  const resize = () => {
    const width = Math.max(1, element.clientWidth || 1);
    const height = Math.max(1, element.clientHeight || 1);
    applySize(width, height);
  };

  const observer = 'ResizeObserver' in window ? new ResizeObserver((entries) => {
    const entry = entries[0];
    if (!entry) return;
    const width = Math.max(1, entry.contentRect.width);
    const height = Math.max(1, entry.contentRect.height);
    applySize(width, height);
  }) : null;
  if (observer) {
    observer.observe(element);
    resize();
  } else {
    window.addEventListener('resize', resize);
    resize();
  }

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

  const isMobileDevice = window.matchMedia?.('(pointer: coarse)').matches;
  const geometry = new THREE.BufferGeometry();
  const count = isMobileDevice ? 90 : (window.innerWidth < 760 ? 190 : 360);
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
  const motion = prefersReducedMotion() ? 0.15 : 1;

  function resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  const stopLoop = createLoop((time) => {
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
  canvas.style.touchAction = 'none'; // prevent scroll when dragging
  container.appendChild(canvas);
  const renderer = createRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' }, 1.65);
  if (!renderer) return () => {};

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0, 9);

  const core = new THREE.Group();
  scene.add(core);

  const isMobileDevice = window.matchMedia?.('(pointer: coarse)').matches;

  // Premium, glass-like and glowing materials
  const solid = isMobileDevice
    ? new THREE.MeshStandardMaterial({
        color: 0x65e4d4,
        roughness: 0.2,
        metalness: 0.5,
        transparent: true,
        opacity: 0.85
      })
    : new THREE.MeshPhysicalMaterial({ 
        color: 0x65e4d4, 
        roughness: 0.1, 
        metalness: 0.6, 
        transmission: 0.8, // glass effect
        thickness: 0.5,
        transparent: true, 
        opacity: 1 
      });
  const wire = new THREE.MeshStandardMaterial({ 
    color: 0x5ba7ff, 
    roughness: 0.2, 
    metalness: 0.8, 
    wireframe: true,
    emissive: 0x1a4a8c,
    emissiveIntensity: 0.6
  });
  
  const geometries = [
    new THREE.IcosahedronGeometry(1.2, 2),
    new THREE.TorusKnotGeometry(0.75, 0.2, 120, 16),
    new THREE.OctahedronGeometry(1.0, 1),
    new THREE.BoxGeometry(1.15, 1.15, 1.15)
  ];

  for (let i = 0; i < 8; i += 1) {
    const mesh = new THREE.Mesh(geometries[i % geometries.length], i % 2 ? wire : solid);
    mesh.position.set(Math.sin(i) * 2.7, Math.cos(i * 1.7) * 1.75, (i % 3) - 1.25);
    mesh.rotation.set(Math.random() * 2, Math.random() * 2, 0);
    mesh.userData.speed = 0.22 + Math.random() * 0.36;
    mesh.userData.baseY = mesh.position.y;
    core.add(mesh);
  }

  const particlesGeo = new THREE.BufferGeometry();
  const particleCount = isMobileDevice ? 120 : (window.innerWidth < 760 ? 250 : 450); // Optimized count
  const particlePositions = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i += 1) {
    particlePositions[i * 3] = (Math.random() - 0.5) * 14;
    particlePositions[i * 3 + 1] = (Math.random() - 0.5) * 10;
    particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 10;
  }
  particlesGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
  const particles = new THREE.Points(particlesGeo, new THREE.PointsMaterial({
    size: 0.035,
    color: 0xffffff,
    transparent: true,
    opacity: 0.6,
    depthWrite: false,
    blending: THREE.AdditiveBlending // Glow effect for particles
  }));
  scene.add(particles);

  scene.add(new THREE.AmbientLight(0xffffff, 0.8));
  const p1 = new THREE.PointLight(0x65e4d4, 4.5, 20);
  p1.position.set(-4, 3, 5);
  scene.add(p1);
  const p2 = new THREE.PointLight(0xf5c66b, 3.5, 18);
  p2.position.set(4, -3, 5);
  scene.add(p2);
  const p3 = new THREE.PointLight(0x5ba7ff, 2.5, 20);
  p3.position.set(0, 0, -6); // Backlight
  scene.add(p3);
  
  const motion = prefersReducedMotion() ? 0.16 : 1;

  // Drag Interaction State
  let isDragging = false;
  let lastX = 0, lastY = 0;
  let targetRotX = 0;
  let targetRotY = 0;
  let currentRotX = 0;
  let currentRotY = 0;

  canvas.addEventListener('pointerdown', (e) => {
    isDragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });

  canvas.addEventListener('pointermove', (e) => {
    if (isDragging) {
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      targetRotY += dx * 0.005;
      targetRotX += dy * 0.005;
      lastX = e.clientX;
      lastY = e.clientY;
    }
  });

  canvas.addEventListener('pointerup', (e) => {
    isDragging = false;
    try { canvas.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
  });

  const stopResize = observeElementSize(container, renderer, camera);
  const stopLoop = createLoop((time) => {
    // Smooth dampening for drag rotation
    currentRotX += (targetRotX - currentRotX) * 0.08;
    currentRotY += (targetRotY - currentRotY) * 0.08;

    core.rotation.y = time * 0.00015 * motion + currentRotY + pointer.x * 0.15;
    core.rotation.x = currentRotX + pointer.y * 0.1;
    
    core.children.forEach((mesh, index) => {
      mesh.rotation.x += 0.0035 * mesh.userData.speed * motion;
      mesh.rotation.y += 0.005 * mesh.userData.speed * motion;
      // Smooth vertical floating motion
      mesh.position.y = mesh.userData.baseY + Math.sin(time * 0.001 + index) * 0.12 * motion;
    });

    particles.rotation.y = time * 0.00005 * motion + currentRotY * 0.15;
    particles.rotation.x = currentRotX * 0.15;

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
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
  camera.position.set(0, 0, 18);
  camera.userData.targetRadius = 18;

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  const nodes = [];
  const lines = [];
  const palette = { note: 0x65e4d4, file: 0x5ba7ff, idea: 0xf5c66b };
  
  const isMobileDevice = window.matchMedia?.('(pointer: coarse)').matches;

  // LOD geometries: low/med/high detail
  const lodGeometries = {
    note: isMobileDevice ? [
      new THREE.SphereGeometry(0.35, 4, 4),
      new THREE.SphereGeometry(0.35, 8, 8),
      new THREE.SphereGeometry(0.35, 12, 12)
    ] : [
      new THREE.SphereGeometry(0.35, 8, 8),
      new THREE.SphereGeometry(0.35, 16, 16),
      new THREE.SphereGeometry(0.35, 24, 24)
    ],
    file: isMobileDevice ? [
      new THREE.SphereGeometry(0.44, 4, 4),
      new THREE.SphereGeometry(0.44, 8, 8),
      new THREE.SphereGeometry(0.44, 12, 12)
    ] : [
      new THREE.SphereGeometry(0.44, 8, 8),
      new THREE.SphereGeometry(0.44, 16, 16),
      new THREE.SphereGeometry(0.44, 24, 24)
    ],
    idea: isMobileDevice ? [
      new THREE.SphereGeometry(0.35, 4, 4),
      new THREE.SphereGeometry(0.35, 8, 8),
      new THREE.SphereGeometry(0.35, 12, 12)
    ] : [
      new THREE.SphereGeometry(0.35, 8, 8),
      new THREE.SphereGeometry(0.35, 16, 16),
      new THREE.SphereGeometry(0.35, 24, 24)
    ]
  };

  const materials = Object.fromEntries(Object.entries(palette).map(([type, color]) => [type, new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.16,
    roughness: 0.28,
    metalness: 0.35
  })]));

  const source = data.length ? data : [{ id: 'welcome', type: 'note', title: i18n.t('graph.placeholderNode') }];
  
  // Limit edges by weight for performance
  const edgesByWeight = [];

  source.forEach((item, index) => {
    const type = item.type || 'note';
    const mesh = new THREE.Mesh(lodGeometries[type][2], materials[type] || materials.note);
    const angle = (index / source.length) * Math.PI * 2;
    const radius = 3.2 + (index % 5) * 0.72;
    mesh.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, (Math.random() - 0.5) * 4);
    mesh.userData = {
      ...item,
      velocity: new THREE.Vector3((Math.random() - 0.5) * 0.005, (Math.random() - 0.5) * 0.005, 0),
      lodLevel: 2
    };
    scene.add(mesh);
    nodes.push(mesh);
  });

  const lineMat = new THREE.LineBasicMaterial({ color: 0x8ad9ff, transparent: true, opacity: 0.26 });
  function createLine(a, b, weight = 1) {
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const line = new THREE.Line(lineGeo, lineMat);
    scene.add(line);
    lines.push({ line, a, b, weight });
  }

  // Frustum for culling
  const frustum = new THREE.Frustum();
  const projScreenMatrix = new THREE.Matrix4();
  const frustumSphere = new THREE.Sphere(new THREE.Vector3(), 0.44);

  function updateFrustumCulling() {
    projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(projScreenMatrix);
  }

  function isSphereInFrustum(position, radius = 0.35) {
    frustumSphere.center.copy(position);
    frustumSphere.radius = radius;
    return frustum.intersectsSphere(frustumSphere);
  }

  // Create edges with weight tracking
  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const weight = (i % 3 === j % 3 ? 2 : 0) + (Math.random() > 0.8 ? 1 : 0);
      if (weight > 0) edgesByWeight.push({ i, j, weight });
    }
  }

  // Sort by weight and take top 50%
  edgesByWeight.sort((a, b) => b.weight - a.weight);
  const maxEdges = Math.ceil(edgesByWeight.length * 0.5);
  edgesByWeight.slice(0, maxEdges).forEach(({ i, j, weight }) => {
    createLine(nodes[i], nodes[j], weight);
  });

  scene.add(new THREE.AmbientLight(0xffffff, 0.72));
  const light = new THREE.PointLight(0x65e4d4, 3.8, 30);
  light.position.set(0, 3, 8);
  scene.add(light);

  let dragging = null;
  const stopResize = observeElementSize(container, renderer, camera);
  const motion = prefersReducedMotion() ? 0.2 : 1;

  // Orbit controls state
  const orbit = {
    theta: 0,
    phi: Math.PI * 0.35,
    radius: camera.userData.targetRadius
  };

  // Touch tracking
  const touches = new Map();
  let lastTouchDistance = 0;

  function setMouse(event) {
    const width = canvas.clientWidth || 1;
    const height = canvas.clientHeight || 1;
    mouse.x = (event.offsetX / width) * 2 - 1;
    mouse.y = -(event.offsetY / height) * 2 + 1;
  }

  function intersect(event) {
    setMouse(event);
    raycaster.setFromCamera(mouse, camera);
    return raycaster.intersectObjects(nodes)[0];
  }

  function getTouchDistance(t1, t2) {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // Orbit controls with mouse and touch
  let lastX = 0, lastY = 0;
  canvas.addEventListener('pointerdown', (event) => {
    touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const hit = intersect(event);
    if (hit && event.button === 0 && touches.size === 1) {
      dragging = hit.object;
      canvas.setPointerCapture(event.pointerId);
    } else if ((event.button === 0 || event.isPrimary) && touches.size === 1) {
      lastX = event.clientX;
      lastY = event.clientY;
    }
    if (touches.size === 2) {
      const touchArray = Array.from(touches.values());
      lastTouchDistance = getTouchDistance(touchArray[0], touchArray[1]);
    }
  });

  canvas.addEventListener('pointermove', (event) => {
    touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    setMouse(event);
    if (dragging) {
      const vector = new THREE.Vector3(mouse.x, mouse.y, 0.5).unproject(camera);
      const direction = vector.sub(camera.position).normalize();
      const distance = -orbit.radius / direction.z;
      dragging.position.copy(camera.position.clone().add(direction.multiplyScalar(distance)));
    } else if (touches.size === 1 && (event.buttons & 1)) {
      const dX = event.clientX - lastX;
      const dY = event.clientY - lastY;
      orbit.theta -= dX * 0.008;
      orbit.phi -= dY * 0.008;
      orbit.phi = Math.max(0.1, Math.min(Math.PI - 0.1, orbit.phi));
      lastX = event.clientX;
      lastY = event.clientY;
    } else if (touches.size === 2) {
      const touchArray = Array.from(touches.values());
      const currentDistance = getTouchDistance(touchArray[0], touchArray[1]);
      if (lastTouchDistance > 0) {
        const scale = currentDistance / lastTouchDistance;
        orbit.radius /= scale;
        orbit.radius = Math.max(5, Math.min(50, orbit.radius));
      }
      lastTouchDistance = currentDistance;
      const centerX = (touchArray[0].x + touchArray[1].x) / 2;
      const centerY = (touchArray[0].y + touchArray[1].y) / 2;
      const dX = centerX - (lastX + event.clientX) / 2;
      const dY = centerY - (lastY + event.clientY) / 2;
      orbit.theta -= dX * 0.004;
      orbit.phi -= dY * 0.004;
      orbit.phi = Math.max(0.1, Math.min(Math.PI - 0.1, orbit.phi));
      lastX = centerX;
      lastY = centerY;
    }
  });

  canvas.addEventListener('pointerup', (event) => {
    if (dragging) {
      const hit = intersect(event);
      if (hit && hit.object === dragging) onSelect?.(hit.object.userData);
    }
    dragging = null;
    touches.delete(event.pointerId);
    try {
      canvas.releasePointerCapture(event.pointerId);
    } catch {
      // The browser may release pointer capture before this handler runs.
    }
  });

  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    orbit.radius *= 1 + (event.deltaY > 0 ? 0.1 : -0.1);
    orbit.radius = Math.max(5, Math.min(50, orbit.radius));
  }, { passive: false });

  let lastLodUpdate = 0;
  function updateLOD(time) {
    if (time - lastLodUpdate < 220) return;
    lastLodUpdate = time;
    nodes.forEach((node) => {
      const distToCamera = node.position.distanceTo(camera.position);
      const newLOD = distToCamera < 8 ? 2 : (distToCamera < 15 ? 1 : 0);

      if (node.userData.lodLevel !== newLOD) {
        const type = node.userData.type || 'note';
        node.geometry = lodGeometries[type][newLOD];
        node.userData.lodLevel = newLOD;
      }
    });
  }

  const stopLoop = createLoop((time) => {
    // Update orbit camera position
    camera.position.x = orbit.radius * Math.sin(orbit.phi) * Math.cos(orbit.theta);
    camera.position.y = orbit.radius * Math.cos(orbit.phi);
    camera.position.z = orbit.radius * Math.sin(orbit.phi) * Math.sin(orbit.theta);
    camera.lookAt(0, 0, 0);

    // Update frustum for culling
    updateFrustumCulling();

    // Update LOD based on distance
    updateLOD(time);

    let visibleNodes = 0;
    let visibleEdges = 0;

    // Update nodes with frustum culling
    nodes.forEach((node, index) => {
      if (node !== dragging) {
        node.position.addScaledVector(node.userData.velocity, motion);
        if (Math.abs(node.position.x) > 7) node.userData.velocity.x *= -1;
        if (Math.abs(node.position.y) > 5) node.userData.velocity.y *= -1;
        node.position.z += Math.sin(time * 0.001 + index) * 0.0016 * motion;
      }
      node.rotation.y += 0.009 * motion;
      node.visible = isSphereInFrustum(node.position, 0.44);
      if (node.visible) visibleNodes += 1;
    });

    // Update lines with frustum culling
    lines.forEach(({ line, a, b }) => {
      const bothVisible = a.visible && b.visible;
      line.visible = bothVisible;
      if (bothVisible) {
        visibleEdges += 1;
        const position = line.geometry.attributes.position;
        position.setXYZ(0, a.position.x, a.position.y, a.position.z);
        position.setXYZ(1, b.position.x, b.position.y, b.position.z);
        position.needsUpdate = true;
      }
    });

    renderer.render(scene, camera);

    // Store for debugging
    window.__graphMetrics = {
      totalNodes: nodes.length,
      visibleNodes,
      totalEdges: lines.length,
      visibleEdges,
      cameraDistance: orbit.radius
    };
  });

  return () => {
    cleanup(renderer, scene, stopLoop, stopResize);
  };
}
