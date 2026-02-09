import { gltfLoader } from "@/three/utils/utils";
import { useEffect, useRef } from "react";
import * as THREE from "three";

type CosmeticModelViewerVariant = "card" | "showcase";

interface CosmeticModelViewerProps {
  modelPath: string;
  variant?: CosmeticModelViewerVariant;
  autoRotate?: boolean;
  /** For card variant: whether the tile is being hovered (triggers RAF) */
  isHovered?: boolean;
}

const CAMERA_PRESETS: Record<
  CosmeticModelViewerVariant,
  {
    fov: number;
    positionOffset: [number, number, number];
    focusOffset?: number;
    fitSize: number;
    lift?: number;
  }
> = {
  card: {
    fov: 30,
    positionOffset: [3.2, 2.8, 25],
    focusOffset: 0.2,
    fitSize: 9,
    lift: 0.15,
  },
  showcase: {
    fov: 28,
    positionOffset: [4.5, 3.2, 25],
    focusOffset: 0.2,
    fitSize: 9,
    lift: 0.4,
  },
};

/**
 * Lightweight viewer that normalises scale/centering for cosmetics and exposes optional rotation controls.
 *
 * Performance optimization: RAF loop only runs when:
 * - variant="showcase" (always needs interaction support)
 * - variant="card" AND (isHovered OR autoRotate is true)
 * Otherwise renders once after model loads, then stops.
 */
export const CosmeticModelViewer = ({
  modelPath,
  variant = "card",
  autoRotate = false,
  isHovered = false,
}: CosmeticModelViewerProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const autoRotateRef = useRef(autoRotate);
  const isHoveredRef = useRef(isHovered);

  // Track whether RAF should be running
  // For showcase: always run (needs drag support)
  // For card: only run when hovered or autoRotating
  const shouldAnimate = variant === "showcase" || isHovered || autoRotate;
  const shouldAnimateRef = useRef(shouldAnimate);

  useEffect(() => {
    autoRotateRef.current = autoRotate;
    isHoveredRef.current = isHovered;
    shouldAnimateRef.current = variant === "showcase" || isHovered || autoRotate;
  }, [autoRotate, isHovered, variant]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const container = containerRef.current;
    if (!container) return;

    const preset = CAMERA_PRESETS[variant];

    const scene = new THREE.Scene();
    scene.background = null;

    const camera = new THREE.PerspectiveCamera(preset.fov, 1, 0.1, 100);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.shadowMap.enabled = false;
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    renderer.domElement.style.touchAction = variant === "showcase" ? "none" : "auto";
    container.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, variant === "card" ? 1.2 : 1.4);
    const keyLight = new THREE.DirectionalLight(0xffffff, variant === "card" ? 1.5 : 1.8);
    keyLight.position.set(6, 10, 8);
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.7);
    fillLight.position.set(-6, 5, -4);
    const rimLight = new THREE.DirectionalLight(0x88bbff, 0.5);
    rimLight.position.set(-8, 9, 10);

    scene.add(ambientLight, keyLight, fillLight, rimLight);

    let mounted = true;
    let animationFrame: number = 0;
    let model: THREE.Object3D | null = null;
    let isDragging = false;

    const configureCameraFocus = (focus: THREE.Vector3) => {
      const offset = new THREE.Vector3(...preset.positionOffset);
      const target = new THREE.Vector3(focus.x, focus.y + (preset.focusOffset ?? 0), focus.z);
      camera.position.copy(target.clone().add(offset));
      camera.lookAt(target);
    };

    const loadModel = async () => {
      try {
        const gltf = await gltfLoader.loadAsync(modelPath);
        if (!mounted) return;

        model = gltf.scene.clone(true);
        model.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = false;
            child.receiveShadow = false;
          }
        });

        const initialBox = new THREE.Box3().setFromObject(model);
        const size = initialBox.getSize(new THREE.Vector3());
        const center = initialBox.getCenter(new THREE.Vector3());

        model.position.sub(center);

        const maxDimension = Math.max(size.x, size.y, size.z) || 1;
        const scaleFactor = preset.fitSize / maxDimension;
        model.scale.multiplyScalar(scaleFactor);

        const adjustedBox = new THREE.Box3().setFromObject(model);
        const minY = adjustedBox.min.y;
        model.position.y -= minY;
        if (preset.lift) {
          model.position.y += preset.lift;
        }

        const focusBox = new THREE.Box3().setFromObject(model);
        const focus = focusBox.getCenter(new THREE.Vector3());
        configureCameraFocus(focus);

        model.rotation.y = Math.PI / 6;

        scene.add(model);

        // Render multiple frames after model loads to ensure proper display
        // This handles cases where the container might not have final dimensions yet
        renderer.render(scene, camera);
        requestAnimationFrame(() => {
          if (mounted) {
            handleResize();
            renderer.render(scene, camera);
          }
        });
      } catch (error) {
        console.error("Failed to load cosmetic model", error);
      }
    };

    // Defer resize to next frame to ensure container has dimensions
    const handleResize = () => {
      const width = container.clientWidth || 1;
      const height = container.clientHeight || 1;
      if (width <= 1 || height <= 1) return; // Skip if container not sized yet
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    };

    loadModel();

    // Defer initial resize to next frame to ensure container has dimensions
    requestAnimationFrame(() => {
      if (mounted) handleResize();
    });

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => handleResize());
      resizeObserver.observe(container);
    } else {
      window.addEventListener("resize", handleResize);
    }

    let pointerId: number | null = null;
    const interactionElement = renderer.domElement;

    const pointerDown = (event: PointerEvent) => {
      if (variant !== "showcase" || !model) return;
      isDragging = true;
      pointerId = event.pointerId;
      interactionElement.setPointerCapture(pointerId);
      interactionElement.style.cursor = "grabbing";
      lastPointerPosition.set(event.clientX, event.clientY);
    };

    const pointerMove = (event: PointerEvent) => {
      if (!isDragging || !model || pointerId !== event.pointerId) return;
      const deltaX = event.clientX - lastPointerPosition.x;
      const deltaY = event.clientY - lastPointerPosition.y;
      lastPointerPosition.set(event.clientX, event.clientY);

      model.rotation.y += deltaX * 0.01;
      const nextX = model.rotation.x + deltaY * 0.006;
      model.rotation.x = THREE.MathUtils.clamp(nextX, -Math.PI / 6, Math.PI / 6);
    };

    const pointerUp = (event: PointerEvent) => {
      if (pointerId !== event.pointerId) return;
      isDragging = false;
      pointerId = null;
      if (interactionElement.hasPointerCapture(event.pointerId)) {
        interactionElement.releasePointerCapture(event.pointerId);
      }
      interactionElement.style.cursor = variant === "showcase" ? "grab" : "default";
    };

    const lastPointerPosition = new THREE.Vector2();
    if (variant === "showcase") {
      interactionElement.style.cursor = "grab";
      interactionElement.addEventListener("pointerdown", pointerDown);
      interactionElement.addEventListener("pointermove", pointerMove);
      interactionElement.addEventListener("pointerup", pointerUp);
      interactionElement.addEventListener("pointerleave", pointerUp);
      interactionElement.addEventListener("pointercancel", pointerUp);
    }

    // Single render function
    const render = () => {
      if (autoRotateRef.current && model && !isDragging) {
        model.rotation.y += variant === "showcase" ? 0.004 : 0.006;
      }
      renderer.render(scene, camera);
    };

    // RAF loop - only runs when shouldAnimate is true
    const renderLoop = () => {
      if (!mounted) return;

      render();

      // Only continue loop if we should be animating
      if (shouldAnimateRef.current) {
        animationFrame = window.requestAnimationFrame(renderLoop);
      } else {
        animationFrame = 0;
      }
    };

    // Start/restart RAF loop when shouldAnimate becomes true
    const startLoop = () => {
      if (animationFrame === 0 && mounted) {
        animationFrame = window.requestAnimationFrame(renderLoop);
      }
    };

    // Check periodically if we should start the loop (for when hover/autoRotate changes)
    // This is needed because the effect closure captures initial values
    const checkInterval = window.setInterval(() => {
      if (shouldAnimateRef.current && animationFrame === 0 && mounted) {
        startLoop();
      }
    }, 100);

    // Start loop if we should animate from the beginning, otherwise just wait for model load
    if (shouldAnimate) {
      animationFrame = window.requestAnimationFrame(renderLoop);
    }

    return () => {
      mounted = false;
      window.clearInterval(checkInterval);
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      if (resizeObserver) {
        resizeObserver.disconnect();
      } else {
        window.removeEventListener("resize", handleResize);
      }

      if (variant === "showcase") {
        if (pointerId !== null && interactionElement.hasPointerCapture(pointerId)) {
          interactionElement.releasePointerCapture(pointerId);
        }
        interactionElement.removeEventListener("pointerdown", pointerDown);
        interactionElement.removeEventListener("pointermove", pointerMove);
        interactionElement.removeEventListener("pointerup", pointerUp);
        interactionElement.removeEventListener("pointerleave", pointerUp);
        interactionElement.removeEventListener("pointercancel", pointerUp);
        interactionElement.style.cursor = "default";
      }

      if (model) {
        scene.remove(model);
      }

      renderer.dispose();
      if (renderer.domElement.parentElement) {
        renderer.domElement.parentElement.removeChild(renderer.domElement);
      }
    };
  }, [modelPath, variant]);

  return <div ref={containerRef} className="relative z-10 h-full w-full" />;
};
