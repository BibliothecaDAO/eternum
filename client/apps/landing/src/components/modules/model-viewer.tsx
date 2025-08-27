import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { DRACOLoader, GLTFLoader, OrbitControls } from "three-stdlib";
import { AssetRarity } from "./chest-content";

interface ModelViewerProps {
  modelPath: string;
  className?: string;
  positionY?: number;
  scale?: number;
  rotationY?: number;
  rotationX?: number | undefined;
  rotationZ?: number | undefined;
  rarity?: AssetRarity;
  cameraPosition?: { x: number; y: number; z: number };
}

const getRarityAmbientColor = (rarity: AssetRarity | undefined) => {
  switch (rarity) {
    case AssetRarity.Common:
      return "#848484";
    case AssetRarity.Uncommon:
      return "#6cc95e";
    case AssetRarity.Rare:
      return "#56c8da";
    case AssetRarity.Epic:
      return "#ba37d4";
    case AssetRarity.Legendary:
      return "#e9b062";
    default:
      return "#666666";
  }
};

export const ModelViewer = ({
  modelPath,
  positionY = 0,
  scale = 1,
  rotationY = 0,
  rotationX = 0,
  rotationZ = 0,
  rarity,
  className = "",
  cameraPosition = { x: 0, y: 1, z: 1 },
}: ModelViewerProps) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const frameIdRef = useRef<number>();
  const modelRef = useRef<THREE.Group | null>(null);
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const basePositionYRef = useRef<number>(0);
  const baseScaleRef = useRef<number>(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    const mount = mountRef.current;
    const width = mount.clientWidth;
    const height = mount.clientHeight;

    // Scene setup with dark background for dramatic lighting
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    sceneRef.current = scene;

    // Camera setup
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.set(cameraPosition.x, cameraPosition.y, cameraPosition.z);
    cameraRef.current = camera;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    rendererRef.current = renderer;

    mount.appendChild(renderer.domElement);

    // OrbitControls setup exactly like Three.js example
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1, 0);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    controls.minDistance = 2;
    controls.maxDistance = 5;
    controlsRef.current = controls;

    // Enhanced lighting setup with rarity-based ambient light
    const rarityColor = getRarityAmbientColor(rarity);
    const ambientLight = new THREE.AmbientLight(rarityColor, 0.6);
    ambientLightRef.current = ambientLight;
    scene.add(ambientLight);

    // Key light - main directional light from front-top
    const keyLight = new THREE.DirectionalLight(0xffffff, 4);
    keyLight.position.set(2, 3, 2);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 0.1;
    keyLight.shadow.camera.far = 50;
    keyLight.shadow.camera.left = -10;
    keyLight.shadow.camera.right = 10;
    keyLight.shadow.camera.top = 10;
    keyLight.shadow.camera.bottom = -10;
    scene.add(keyLight);

    // Fill light - softer light from opposite side
    const fillLight = new THREE.DirectionalLight(0xccddff, 2);
    fillLight.position.set(-2, 2, 1);
    scene.add(fillLight);

    // Rim light - dramatic backlighting
    const rimLight = new THREE.DirectionalLight(0xffffcc, 1.5);
    rimLight.position.set(0, 1, -3);
    scene.add(rimLight);

    // Additional point light for overall brightness
    const pointLight = new THREE.PointLight(0xffffff, 2, 10);
    pointLight.position.set(0, 2, 1);
    scene.add(pointLight);

    const loader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.6/");
    loader.setDRACOLoader(dracoLoader);
    loader.load(
      modelPath,
      (gltf) => {
        const model = gltf.scene;
        modelRef.current = model;

        // Get bounding box and center the model
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        // Center the model horizontally and position vertically
        model.position.x = -center.x;
        model.position.z = -center.z;
        const baseY = -box.min.y + positionY;
        model.position.y = baseY;
        basePositionYRef.current = baseY;

        // Scale model appropriately
        const maxDim = Math.max(size.x, size.y, size.z);
        const autoScale = 2 / maxDim;
        const finalScale = autoScale * scale;
        model.scale.setScalar(finalScale);
        baseScaleRef.current = finalScale;

        // Apply Y rotation
        model.rotation.y = rotationY;
        model.rotation.x = rotationX;
        model.rotation.z = rotationZ;

        // Enable shadows
        model.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        scene.add(model);
        setIsLoading(false);
      },
      (progress) => {
        console.log("Loading progress:", (progress.loaded / progress.total) * 100 + "%");
      },
      (error) => {
        console.error("Error loading model:", error);
        setError("Failed to load 3D model");
        setIsLoading(false);
      },
    );

    const animate = () => {
      frameIdRef.current = requestAnimationFrame(animate);

      // Update controls with damping
      if (controls) {
        controls.update();
      }

      // Animation calculations
      const time = (Date.now() - startTimeRef.current) * 0.001; // Convert to seconds

      // Animate the model if it exists
      if (modelRef.current) {
        // Very subtle floating motion - gentle up-down movement based on base position
        const floatAmplitude = 0.02; // Small, uniform amplitude for all rarities
        const floatSpeed = 1.2; // Gentle, consistent speed
        const floatOffset = Math.sin(time * floatSpeed) * floatAmplitude;
        modelRef.current.position.y = basePositionYRef.current + floatOffset;
      }

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!mount || !renderer || !camera) return;

      const newWidth = mount.clientWidth;
      const newHeight = mount.clientHeight;

      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      if (frameIdRef.current) {
        cancelAnimationFrame(frameIdRef.current);
      }

      window.removeEventListener("resize", handleResize);

      if (controls) {
        controls.dispose();
      }

      if (mount && renderer) {
        mount.removeChild(renderer.domElement);
      }

      if (renderer) {
        renderer.dispose();
      }

      if (scene) {
        scene.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            if (Array.isArray(child.material)) {
              child.material.forEach((material) => material.dispose());
            } else {
              child.material.dispose();
            }
          }
        });
        scene.clear();
      }

      dracoLoader.dispose();
    };
  }, [modelPath, positionY, scale, rotationY, rarity]);

  return (
    <div className={`relative ${className}`}>
      <div ref={mountRef} className="w-full h-full" />
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="flex flex-col items-center gap-2 text-white">
            <Loader2 className="w-8 h-8 animate-spin" />
            <span className="text-sm">Loading 3D model...</span>
          </div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="text-red-400 text-sm text-center p-4">{error}</div>
        </div>
      )}
    </div>
  );
};
