import { AssetRarity } from "@/utils/cosmetics";
import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { DRACOLoader, GLTFLoader, OrbitControls } from "three-stdlib";

// Mobile device detection  - TODO: move to utils
const isMobileDevice = () => {
  return (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    window.innerWidth <= 768
  );
};

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
  const smokeParticlesRef = useRef<THREE.Mesh[]>([]);
  const startTimeRef = useRef<number>(Date.now());
  const basePositionYRef = useRef<number>(0);
  const baseScaleRef = useRef<number>(1);
  const modelRotationRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const targetRotationRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isDraggingRef = useRef<boolean>(false);
  const previousMouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isSceneInitializedRef = useRef<boolean>(false);
  const dracoLoaderRef = useRef<DRACOLoader | null>(null);

  // Initialize scene, camera, renderer, lights, and smoke particles (runs once)
  useEffect(() => {
    if (!mountRef.current || isSceneInitializedRef.current) return;

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

    // Renderer setup with mobile optimization
    const isMobile = isMobileDevice();
    const renderer = new THREE.WebGLRenderer({ antialias: !isMobile, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
    renderer.shadowMap.enabled = !isMobile; // Disable shadows on mobile
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    rendererRef.current = renderer;

    mount.appendChild(renderer.domElement);

    // OrbitControls setup - only for zoom, no rotation
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1, 0);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.enableRotate = false; // Disable camera rotation
    controls.minDistance = isMobile ? 2.5 : 2; // Closer view on mobile
    controls.maxDistance = isMobile ? 4 : 3.5;
    controlsRef.current = controls;

    // Enhanced lighting setup with rarity-based ambient light
    const rarityColor = getRarityAmbientColor(rarity);
    const ambientLight = new THREE.AmbientLight(rarityColor, 0.6);
    ambientLightRef.current = ambientLight;
    scene.add(ambientLight);

    // Key light - main directional light from front-top
    const keyLight = new THREE.DirectionalLight(0xffffff, 4);
    keyLight.position.set(2, 3, 2);
    keyLight.castShadow = !isMobile;
    keyLight.shadow.mapSize.width = isMobile ? 1024 : 2048;
    keyLight.shadow.mapSize.height = isMobile ? 1024 : 2048;
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

    // Create smoke effect with mobile optimization
    const createSmokeEffect = () => {
      // Detect mobile device for performance optimization
      const isMobile = isMobileDevice();
      // Create smoke texture using canvas (since we can't load external images in this context)
      const canvas = document.createElement("canvas");
      canvas.width = 64;
      canvas.height = 64;
      const context = canvas.getContext("2d");

      if (context) {
        // Create a circular gradient for smoke texture
        const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
        gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
        gradient.addColorStop(0.2, "rgba(255, 255, 255, 0.8)");
        gradient.addColorStop(0.5, "rgba(255, 255, 255, 0.3)");
        gradient.addColorStop(1, "rgba(255, 255, 255, 0)");

        context.fillStyle = gradient;
        context.fillRect(0, 0, 64, 64);
      }

      const smokeTexture = new THREE.CanvasTexture(canvas);
      const smokeMaterial = new THREE.MeshLambertMaterial({
        color: 0xffffff,
        map: smokeTexture,
        transparent: true,
        opacity: 0.3,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });

      const smokeGeo = new THREE.PlaneGeometry(1, 1); // Scaled for our smaller scene
      const smokeParticles: THREE.Mesh[] = [];

      // Create fewer smoke particles on mobile for better performance
      const particleCount = isMobile ? 15 : 30;
      for (let p = 0; p < particleCount; p++) {
        const particle = new THREE.Mesh(smokeGeo, smokeMaterial);

        // Position particles around the scene (scaled for 2-4 unit scene)
        particle.position.set(
          Math.random() * 4 - 2, // -2 to 2
          Math.random() * 4 - 2, // -2 to 2
          Math.random() * 4 - 2, // -2 to 2
        );

        particle.rotation.z = Math.random() * Math.PI * 2;
        scene.add(particle);
        smokeParticles.push(particle);
      }

      smokeParticlesRef.current = smokeParticles;
    };

    createSmokeEffect();

    // Custom mouse rotation handlers with smooth damping
    const handleMouseDown = (event: MouseEvent) => {
      isDraggingRef.current = true;
      previousMouseRef.current = { x: event.clientX, y: event.clientY };
      event.preventDefault();
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (!isDraggingRef.current) return;

      const deltaX = event.clientX - previousMouseRef.current.x;
      const deltaY = event.clientY - previousMouseRef.current.y;

      // Convert mouse movement to rotation with improved sensitivity
      const rotationSpeed = 0.005;
      targetRotationRef.current.y += deltaX * rotationSpeed;
      targetRotationRef.current.x += deltaY * rotationSpeed; // Drag down = see top of model

      // Clamp X rotation to prevent flipping
      targetRotationRef.current.x = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, targetRotationRef.current.x));

      previousMouseRef.current = { x: event.clientX, y: event.clientY };
      event.preventDefault();
    };

    const handleMouseUp = (event: MouseEvent) => {
      isDraggingRef.current = false;
      event.preventDefault();
    };

    // Add mouse event listeners
    renderer.domElement.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    renderer.domElement.addEventListener("mouseleave", handleMouseUp); // Handle mouse leaving canvas

    // Touch events for mobile support
    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length === 1) {
        isDraggingRef.current = true;
        const touch = event.touches[0];
        previousMouseRef.current = { x: touch.clientX, y: touch.clientY };
        event.preventDefault();
      }
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (!isDraggingRef.current || event.touches.length !== 1) return;

      const touch = event.touches[0];
      const deltaX = touch.clientX - previousMouseRef.current.x;
      const deltaY = touch.clientY - previousMouseRef.current.y;

      // Higher rotation speed for touch to make mobile interaction more responsive
      const rotationSpeed = 0.012;
      targetRotationRef.current.y += deltaX * rotationSpeed;
      targetRotationRef.current.x += deltaY * rotationSpeed;

      targetRotationRef.current.x = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, targetRotationRef.current.x));

      previousMouseRef.current = { x: touch.clientX, y: touch.clientY };
      event.preventDefault();
    };

    const handleTouchEnd = (event: TouchEvent) => {
      isDraggingRef.current = false;
      event.preventDefault();
    };

    // Add touch event listeners
    renderer.domElement.addEventListener("touchstart", handleTouchStart, { passive: false });
    renderer.domElement.addEventListener("touchmove", handleTouchMove, { passive: false });
    renderer.domElement.addEventListener("touchend", handleTouchEnd, { passive: false });

    // Animation loop
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
        // Smooth rotation interpolation with damping
        const dampingFactor = 0.1; // Lower = smoother but slower response
        modelRotationRef.current.x += (targetRotationRef.current.x - modelRotationRef.current.x) * dampingFactor;
        modelRotationRef.current.y += (targetRotationRef.current.y - modelRotationRef.current.y) * dampingFactor;

        // Apply smoothed rotation to model
        modelRef.current.rotation.x = modelRotationRef.current.x;
        modelRef.current.rotation.y = modelRotationRef.current.y;

        // Very subtle floating motion - gentle up-down movement based on base position
        const floatAmplitude = 0.02; // Small, uniform amplitude for all rarities
        const floatSpeed = 1.2; // Gentle, consistent speed
        const floatOffset = Math.sin(time * floatSpeed) * floatAmplitude;
        modelRef.current.position.y = basePositionYRef.current + floatOffset;
      }

      // Animate smoke particles (reduce animation on mobile)
      const smokeParticles = smokeParticlesRef.current;
      const isMobileDevice = window.innerWidth < 768;
      if (smokeParticles.length > 0 && (!isMobileDevice || frameIdRef.current! % 2 === 0)) {
        // Skip every other frame on mobile
        for (let i = 0; i < smokeParticles.length; i++) {
          const particle = smokeParticles[i];

          // Make particles always face the camera
          particle.lookAt(cameraRef.current!.position);

          // Keep particles same size regardless of zoom
          const distance = camera.position.distanceTo(particle.position);
          const scale = distance * (isMobileDevice ? 0.2 : 0.3); // Smaller particles on mobile
          particle.scale.setScalar(scale);

          // Add some gentle floating motion to smoke (reduced on mobile)
          const motionScale = isMobileDevice ? 0.5 : 1;
          particle.position.y += Math.sin(time * 0.5 + i) * 0.002 * motionScale;
          particle.position.x += Math.cos(time * 0.3 + i) * 0.001 * motionScale;

          // Keep particles visible at all times (reduced opacity on mobile)
          const material = particle.material as THREE.MeshLambertMaterial;
          material.opacity = isMobileDevice ? 0.15 : 0.25;
        }
      }

      renderer.render(scene, camera);
    };

    animate();

    // Resize handler
    const handleResize = () => {
      if (!mount || !renderer || !camera) return;

      const newWidth = mount.clientWidth;
      const newHeight = mount.clientHeight;

      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };

    window.addEventListener("resize", handleResize);

    // Mark scene as initialized
    isSceneInitializedRef.current = true;

    // Cleanup function
    return () => {
      if (frameIdRef.current) {
        cancelAnimationFrame(frameIdRef.current);
      }

      window.removeEventListener("resize", handleResize);

      // Clean up event listeners
      if (renderer && renderer.domElement) {
        renderer.domElement.removeEventListener("mousedown", handleMouseDown);
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
        renderer.domElement.removeEventListener("mouseleave", handleMouseUp);
        renderer.domElement.removeEventListener("touchstart", handleTouchStart);
        renderer.domElement.removeEventListener("touchmove", handleTouchMove);
        renderer.domElement.removeEventListener("touchend", handleTouchEnd);
      }

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

      isSceneInitializedRef.current = false;
    };
  }, []); // Empty dependency array - runs once

  // Update ambient light color when rarity changes
  useEffect(() => {
    if (ambientLightRef.current) {
      const rarityColor = getRarityAmbientColor(rarity);
      ambientLightRef.current.color = new THREE.Color(rarityColor);
    }
  }, [rarity]);

  // Handle model loading separately
  useEffect(() => {
    if (!sceneRef.current || !isSceneInitializedRef.current) return;

    const scene = sceneRef.current;
    let isMounted = true;

    const loadModel = async () => {
      setError(null);
      setIsLoading(true);

      // Create loaders
      if (!dracoLoaderRef.current) {
        dracoLoaderRef.current = new DRACOLoader();
        dracoLoaderRef.current.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.6/");
      }
      const loader = new GLTFLoader();
      loader.setDRACOLoader(dracoLoaderRef.current);

      // Start loading the new model immediately
      const loadPromise = new Promise<THREE.Group>((resolve, reject) => {
        loader.load(
          modelPath,
          (gltf) => {
            if (!isMounted) {
              gltf.scene.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                  child.geometry.dispose();
                  if (Array.isArray(child.material)) {
                    child.material.forEach((material) => material.dispose());
                  } else {
                    child.material.dispose();
                  }
                }
              });
              return;
            }
            resolve(gltf.scene);
          },
          (progress) => {
            console.log("Loading progress:", (progress.loaded / progress.total) * 100 + "%");
          },
          (error) => {
            console.error("Error loading model:", error);
            setError("Failed to load 3D model");
            setIsLoading(false);
            reject(error);
          },
        );
      });

      // If there's an existing model, animate it out while new model loads
      const existingModel = modelRef.current;
      if (existingModel) {
        // Scale down the existing model
        const scaleDownDuration = 100; // ms - faster
        const startScale = existingModel.scale.x;
        const startTime = Date.now();

        const scaleDown = () => {
          if (!isMounted) return;

          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / scaleDownDuration, 1);
          const scale = startScale * (1 - progress);

          existingModel.scale.setScalar(scale);

          if (progress < 1) {
            requestAnimationFrame(scaleDown);
          } else {
            // Remove the model from scene
            scene.remove(existingModel);
            existingModel.traverse((child) => {
              if (child instanceof THREE.Mesh) {
                child.geometry.dispose();
                if (Array.isArray(child.material)) {
                  child.material.forEach((material) => material.dispose());
                } else {
                  child.material.dispose();
                }
              }
            });
          }
        };

        scaleDown();
      }

      // Wait for model to load
      try {
        const model = await loadPromise;

        if (!isMounted) return;

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
        model.scale.setScalar(0); // Start at scale 0
        baseScaleRef.current = finalScale;

        // Apply initial rotations and store base rotation
        model.rotation.y = rotationY;
        model.rotation.x = rotationX;
        model.rotation.z = rotationZ;

        // Initialize model rotation ref with initial values
        modelRotationRef.current = { x: rotationX, y: rotationY };
        targetRotationRef.current = { x: rotationX, y: rotationY };

        // Enable shadows (only on desktop)
        const isMobileDevice = window.innerWidth < 768;
        model.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = !isMobileDevice;
            child.receiveShadow = !isMobileDevice;
          }
        });

        scene.add(model);

        // Animate scale up
        const scaleUpDuration = 100; // ms - faster
        const startTime = Date.now();

        const scaleUp = () => {
          if (!isMounted) return;

          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / scaleUpDuration, 1);
          const easeOutQuad = 1 - (1 - progress) * (1 - progress);
          const currentScale = finalScale * easeOutQuad;

          model.scale.setScalar(currentScale);

          if (progress < 1) {
            requestAnimationFrame(scaleUp);
          }
        };

        scaleUp();
        setIsLoading(false);
      } catch (error) {
        console.error("Failed to load model:", error);
        if (isMounted) {
          setError("Failed to load 3D model");
          setIsLoading(false);
        }
      }
    };

    loadModel();

    return () => {
      isMounted = false;
    };
  }, [modelPath, positionY, scale, rotationY, rotationX, rotationZ]); // Model-specific dependencies

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
