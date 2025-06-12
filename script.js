// --- Three.js Setup ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1, 1000
);
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 0); // Transparent background
document.body.appendChild(renderer.domElement);
camera.position.z = 12;
camera.position.y = 0;
const ambientLight = new THREE.AmbientLight(0xffffff, 1);
scene.add(ambientLight);

// --- Gallery Group and Invisible Cylinder ---
const galleryGroup = new THREE.Group();
scene.add(galleryGroup);
const radius = 6;
const height = 30; // Total height of the scroll area for blocks
const segments = 30; // For cylinder geometry

const cylinderGeometry = new THREE.CylinderGeometry(
  radius,
  radius,
  height,
  segments,
  1,
  true
);

const cylinderMaterial = new THREE.MeshPhongMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0,
  side: THREE.DoubleSide
});

const cylinder = new THREE.Mesh(cylinderGeometry, cylinderMaterial);
galleryGroup.add(cylinder);

// --- Texture Loading ---
const textureLoader = new THREE.TextureLoader();

function getRandomImage() {
  return Math.floor(Math.random() * 20) + 1; // Assuming img1.jpg to img50.jpg
}

function loadImageTexture(imageNumber) {
  return new Promise((resolve) => {
    const texture = textureLoader.load(
      `assets/img${imageNumber}.jpg`,
      (loadedTexture) => {
        loadedTexture.generateMipmaps = true;
        loadedTexture.minFilter = THREE.LinearMipmapLinearFilter;
        loadedTexture.magFilter = THREE.LinearFilter;
        loadedTexture.anisotropy = renderer.capabilities.getMaxAnisotropy(); // Fixed typo here
        resolve(loadedTexture);
      }
    );
  });
}

// --- Custom Curved Plane Geometry ---
function createCurvedPlane(width, height, radius, segments) {
  const geometry = new THREE.BufferGeometry();
  const vertices = [];
  const indices = [];
  const uvs = [];

  const segmentsX = segments * 4;
  const segmentsY = Math.floor(height * 12); // Adjust based on desired vertical resolution
  const theta = width / radius; // Angle of the curved plane segment

  for (let y = 0; y <= segmentsY; y++) {
    const yPos = (y / segmentsY - 0.5) * height;
    for (let x = 0; x <= segmentsX; x++) {
      const xAngle = (x / segmentsX - 0.5) * theta;
      const xPos = Math.sin(xAngle) * radius;
      const zPos = Math.cos(xAngle) * radius;
      vertices.push(xPos, yPos, zPos);

      uvs.push((x / segmentsX) * 0.8 + 0.1, y / segmentsY); // UV adjustment
    }
  }

  for (let y = 0; y < segmentsY; y++) {
    for (let x = 0; x < segmentsX; x++) {
      const a = x + (segmentsX + 1) * y;
      const b = x + (segmentsX + 1) * (y + 1);
      const c = x + 1 + (segmentsX + 1) * (y + 1);
      const d = x + 1 + (segmentsX + 1) * y;
      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return geometry;
}

// --- Block Creation and Initialization ---
const numVerticalSections = 12; // Number of rows of images
const blocksPerSection = 4; // Number of images per row around the cylinder
const verticalSpacing = 3.25;
const blocks = [];

const totalBlockHeight = numVerticalSections * verticalSpacing;
const heightBuffer = (height - totalBlockHeight) / 2;
const starty = -height / 2 + heightBuffer + verticalSpacing;

const sectionAngle = (Math.PI * 2) / blocksPerSection;
const maxRandomAngle = sectionAngle * 0.3;

async function createBlock(baseY, yOffset, sectionIndex, blockIndex) {
  const blockGeometry = createCurvedPlane(5, 3, radius, 10);
  const imageNumber = getRandomImage();
  const texture = await loadImageTexture(imageNumber);

  const blockMaterial = new THREE.MeshPhongMaterial({
    map: texture,
    side: THREE.DoubleSide,
    toneMapped: false,
  });

  const block = new THREE.Mesh(blockGeometry, blockMaterial);
  block.position.y = baseY + yOffset;

  const blockContainer = new THREE.Group();
  const baseAngle = sectionAngle * blockIndex;
  const randomAngleOffset = (Math.random() * 2 - 1) * maxRandomAngle;

  const finalAngle = baseAngle + randomAngleOffset;

  blockContainer.rotation.y = finalAngle;
  blockContainer.add(block);

  return blockContainer;
}

async function initializeBlocks() {
  for (let section = 0; section < numVerticalSections; section++) {
    const baseY = starty + section * verticalSpacing;

    // --- FIXED LOGIC ERROR HERE: 'i < blocksPerSection' ---
    for (let i = 0; i < blocksPerSection; i++) {
      const yoffset = Math.random() * 0.2 - 0.1;
      const blockContainer = await createBlock(baseY, yoffset, section, i);
      blocks.push(blockContainer);
      galleryGroup.add(blockContainer);
    }
  }
}

// --- Lenis Smooth Scrolling Setup ---
const lenis = new Lenis({
  autoRaf: false, // Set to false so your `animate` loop can drive it
});

let currentScroll = 0;
// totalScroll will be `document.documentElement.scrollHeight - window.innerHeight`
// when the page loads, but might not account for all content immediately.
// For smooth scrolling, `lenis.limit` might be more appropriate if using Lenis v1+
// or ensure this value is dynamically updated if content changes.
const totalScroll = document.documentElement.scrollHeight - window.innerHeight;

let rotationSpeed = 0;
const baseRotationSpeed = 0.0025;
// const maxRotationSpeed = 0.05; // Not directly used in the current animation logic, but good for reference

lenis.on("scroll", (e) => {
  currentScroll = e.scroll; // Correctly get scroll from Lenis event
  rotationSpeed = e.velocity * 0.005;
});

// --- Main Animation Loop ---
function animate(time) {
  requestAnimationFrame(animate); // Request next frame

  // Update Lenis (essential when autoRaf is false)
  lenis.raf(time);

  const scrollFraction = currentScroll / totalScroll; // Assuming totalScroll is correctly calculated
  const targetY = scrollFraction * height - height / 2;
  camera.position.y = -targetY; // Move camera up/down based on scroll progress

  galleryGroup.rotation.y += baseRotationSpeed + rotationSpeed;
  rotationSpeed *= 0.92; // Apply dampening to rotation speed (e.g., 0.9 to 0.95)

  renderer.render(scene, camera);
}

// --- Initialize and Start ---
initializeBlocks(); // Creates all the image blocks
animate(); // Starts the Three.js rendering loop