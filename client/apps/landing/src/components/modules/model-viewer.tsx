import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { DRACOLoader, GLTFLoader, OrbitControls } from "three-stdlib";

interface ModelViewerProps {
  modelPath: string;
  className?: string;
  positionY?: number;
  scale?: number;
  rotationY?: number;
}

export const ModelViewer = ({
  modelPath,
  positionY = 0,
  scale = 1,
  rotationY = 0,
  className = "",
}: ModelViewerProps) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const frameIdRef = useRef<number>();
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
    camera.position.set(0, 1, 1);
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

    // Ground plane - darker to blend with background
    const groundGeometry = new THREE.PlaneGeometry(20, 20);
    const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x111111 });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.receiveShadow = true;
    scene.add(ground);

    // Dramatic lighting setup like Three.js decals example
    // Low ambient light for dark surroundings
    const ambientLight = new THREE.AmbientLight(0x666666, 0.3);
    scene.add(ambientLight);

    // Warm directional light
    const dirLight1 = new THREE.DirectionalLight(0xffddcc, 3);
    dirLight1.position.set(1, 0.75, 0.5);
    dirLight1.castShadow = true;
    dirLight1.shadow.mapSize.width = 2048;
    dirLight1.shadow.mapSize.height = 2048;
    dirLight1.shadow.camera.near = 0.1;
    dirLight1.shadow.camera.far = 50;
    dirLight1.shadow.camera.left = -10;
    dirLight1.shadow.camera.right = 10;
    dirLight1.shadow.camera.top = 10;
    dirLight1.shadow.camera.bottom = -10;
    scene.add(dirLight1);

    // Cool directional light
    const dirLight2 = new THREE.DirectionalLight(0xccccff, 3);
    dirLight2.position.set(-1, 0.75, -0.5);
    dirLight2.castShadow = true;
    dirLight2.shadow.mapSize.width = 2048;
    dirLight2.shadow.mapSize.height = 2048;
    dirLight2.shadow.camera.near = 0.1;
    dirLight2.shadow.camera.far = 50;
    dirLight2.shadow.camera.left = -10;
    dirLight2.shadow.camera.right = 10;
    dirLight2.shadow.camera.top = 10;
    dirLight2.shadow.camera.bottom = -10;
    scene.add(dirLight2);

    const loader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.6/");
    loader.setDRACOLoader(dracoLoader);
    let model: THREE.Group | null = null;

    loader.load(
      modelPath,
      (gltf) => {
        model = gltf.scene;

        // Get bounding box and center the model
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        // Center the model horizontally and position vertically
        model.position.x = -center.x;
        model.position.z = -center.z;
        model.position.y = -box.min.y + positionY; // Apply Y offset from prop

        // Scale model appropriately
        const maxDim = Math.max(size.x, size.y, size.z);
        const autoScale = 2 / maxDim;
        model.scale.setScalar(autoScale * scale);

        // Apply Y rotation
        model.rotation.y = rotationY;

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
  }, [modelPath, positionY, scale, rotationY]);

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
