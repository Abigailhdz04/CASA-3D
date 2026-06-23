import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

// DOM Elements
const canvasContainer = document.getElementById('canvas-container');
const fileInput = document.getElementById('file-input');
const autoRotateCheckbox = document.getElementById('auto-rotate');
const speedInput = document.getElementById('rotation-speed');
const materialSelect = document.getElementById('material-select');
const fullscreenBtn = document.getElementById('fullscreen-btn');
const hidePanelBtn = document.getElementById('hide-panel-btn');
const uiPanel = document.getElementById('ui-panel');
const loadDefaultBtn = document.getElementById('load-default-btn');
const loadingOverlay = document.getElementById('loading-overlay');
const progressText = document.getElementById('progress-text');
const loadingStatus = document.getElementById('loading-status');
const toast = document.getElementById('toast');

// Application State
let scene, camera, renderer, controls;
let currentModel = null;
let autoRotate = true;
let rotationSpeed = 0.005;
let currentMaterialName = 'clay';

// Define Premium Materials
const materials = {
  clay: new THREE.MeshStandardMaterial({
    color: 0xdddddd,
    roughness: 0.7,
    metalness: 0.1,
    side: THREE.DoubleSide
  }),
  gold: new THREE.MeshStandardMaterial({
    color: 0xd4af37,
    roughness: 0.25,
    metalness: 0.85,
    side: THREE.DoubleSide
  }),
  glass: new THREE.MeshPhysicalMaterial({
    color: 0xe0f2fe,
    roughness: 0.1,
    metalness: 0.1,
    transmission: 0.9,
    thickness: 1.5,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide
  }),
  wireframe: new THREE.MeshBasicMaterial({
    color: 0x3b82f6,
    wireframe: true,
    side: THREE.DoubleSide
  })
};

// Initialize Three.js Scene
function init() {
  // 1. Create Scene & set background color matching CSS
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d0f12);

  // 2. Setup Camera
  camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(10, 10, 10);

  // 3. Setup Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  canvasContainer.appendChild(renderer.domElement);

  // 4. Setup Controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.maxPolarAngle = Math.PI / 2 + 0.1; // Don't go too far below the floor

  // 5. Add Lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
  mainLight.position.set(10, 20, 15);
  mainLight.castShadow = true;
  mainLight.shadow.mapSize.width = 2048;
  mainLight.shadow.mapSize.height = 2048;
  scene.add(mainLight);

  const backLight = new THREE.DirectionalLight(0x3b82f6, 0.4); // Subtle blue back light
  backLight.position.set(-10, 10, -10);
  scene.add(backLight);

  // 6. Window Resize Handler
  window.addEventListener('resize', onWindowResize);

  // 7. Event Listeners
  setupEventListeners();

  // 8. Start Animation Loop
  animate();

  // 9. Load Default Model
  loadDefaultModel();
}

// Adjust camera and center any model
function fitModelToCamera(object) {
  const box = new THREE.Box3().setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());

  // Center model at origin
  object.position.x += (object.position.x - center.x);
  object.position.y += (object.position.y - center.y);
  object.position.z += (object.position.z - center.z);

  // Find camera distance
  const maxDim = Math.max(size.x, size.y, size.z);
  const fov = camera.fov * (Math.PI / 180);
  let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
  cameraZ *= 1.4; // Add padding

  // Position camera dynamically based on model size
  camera.position.set(cameraZ * 0.8, cameraZ * 0.6, cameraZ * 0.8);
  camera.lookAt(0, 0, 0);

  // Adjust clip planes
  camera.near = maxDim / 100;
  camera.far = cameraZ * 10;
  camera.updateProjectionMatrix();

  controls.target.set(0, 0, 0);
  controls.update();
}

// Apply selected material style to model meshes
function applySelectedMaterial(object) {
  const material = materials[currentMaterialName];
  object.traverse((child) => {
    if (child.isMesh) {
      child.material = material;
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
}

// Show message notification (Toast)
function showToast(message, isError = false) {
  toast.innerText = message;
  toast.style.background = isError ? 'rgba(239, 68, 68, 0.9)' : 'rgba(16, 185, 129, 0.9)';
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 4000);
}

// Show/Hide Loading Screen
function showLoader(statusText, progressTextContent = '') {
  loadingOverlay.classList.remove('hidden');
  loadingStatus.innerText = statusText;
  progressText.innerText = progressTextContent;
}

function hideLoader() {
  loadingOverlay.classList.add('hidden');
}

// Load default local file 'casa exA 1.obj'
function loadDefaultModel() {
  showLoader('Buscando archivo predeterminado...', '0%');
  
  const loader = new OBJLoader();
  
  loader.load(
    'casa exA 1.obj',
    (object) => {
      handleLoadedModel(object);
      showToast('Modelo predeterminado cargado correctamente.');
    },
    (xhr) => {
      if (xhr.lengthComputable) {
        const percent = Math.round((xhr.loaded / xhr.total) * 100);
        showLoader('Cargando casa exA 1.obj...', `${percent}%`);
      } else {
        const loadedMB = (xhr.loaded / 1024 / 1024).toFixed(1);
        showLoader('Cargando casa exA 1.obj...', `${loadedMB} MB cargados`);
      }
    },
    (error) => {
      console.warn('Could not load default OBJ file. Showing fallback instructions.', error);
      hideLoader();
      showToast('No se pudo cargar el archivo predeterminado automáticamente. Sube el archivo usando el panel.', true);
    }
  );
}

// Handle the loaded 3D Object
function handleLoadedModel(object) {
  // Remove existing model if any
  if (currentModel) {
    scene.remove(currentModel);
  }

  currentModel = object;
  applySelectedMaterial(currentModel);
  scene.add(currentModel);
  
  fitModelToCamera(currentModel);
  hideLoader();
}

// Read and parse uploaded local file
function loadUploadedFile(file) {
  if (!file.name.toLowerCase().endsWith('.obj')) {
    showToast('Por favor, selecciona un archivo con extensión .obj', true);
    return;
  }

  showLoader(`Procesando ${file.name}...`, 'Leyendo archivo...');

  const reader = new FileReader();

  reader.onload = (event) => {
    try {
      showLoader('Interpretando datos 3D...', 'Parseando OBJ...');
      
      const loader = new OBJLoader();
      const object = loader.parse(event.target.result);
      
      handleLoadedModel(object);
      showToast(`Archivo "${file.name}" cargado con éxito.`);
    } catch (err) {
      console.error(err);
      hideLoader();
      showToast('Error al procesar el archivo OBJ. Asegúrate de que el formato sea correcto.', true);
    }
  };

  reader.onerror = () => {
    hideLoader();
    showToast('Error al leer el archivo del disco.', true);
  };

  // Monitor FileReader reading progress
  reader.onprogress = (event) => {
    if (event.lengthComputable) {
      const percent = Math.round((event.loaded / event.total) * 100);
      showLoader(`Leyendo ${file.name}...`, `${percent}%`);
    }
  };

  reader.readAsText(file);
}

// Event Listeners setup
function setupEventListeners() {
  // 1. File Upload Selector
  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      loadUploadedFile(e.target.files[0]);
    }
  });

  // 2. Auto Rotate Toggle
  autoRotateCheckbox.addEventListener('change', (e) => {
    autoRotate = e.target.checked;
  });

  // 3. Rotation Speed Slider
  speedInput.addEventListener('input', (e) => {
    rotationSpeed = parseFloat(e.target.value);
  });

  // 4. Material Selector
  materialSelect.addEventListener('change', (e) => {
    currentMaterialName = e.target.value;
    if (currentModel) {
      applySelectedMaterial(currentModel);
    }
  });

  // 5. Load Default File manually
  loadDefaultBtn.addEventListener('click', () => {
    loadDefaultModel();
  });

  // 6. Toggle UI panel visibility (so the screen is completely clean on the TV)
  let isPanelVisible = true;
  hidePanelBtn.addEventListener('click', () => {
    isPanelVisible = !isPanelVisible;
    if (isPanelVisible) {
      uiPanel.classList.remove('hidden');
      hidePanelBtn.innerText = 'Ocultar Panel';
    } else {
      uiPanel.classList.add('hidden');
      hidePanelBtn.innerText = 'Mostrar Panel';
    }
  });

  // 7. Fullscreen Toggle
  fullscreenBtn.addEventListener('click', toggleFullscreen);
}

// Toggle Fullscreen Mode for TV view
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen()
      .catch((err) => {
        showToast('Error al activar pantalla completa.', true);
      });
  } else {
    document.exitFullscreen();
  }
}

// Window resize handler
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// Animation Loop
function animate() {
  requestAnimationFrame(animate);

  // Auto Rotation
  if (autoRotate && currentModel) {
    currentModel.rotation.y += rotationSpeed;
  }

  // Update controls if damping is active
  controls.update();

  renderer.render(scene, camera);
}

// Run app
init();
