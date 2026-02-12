import { useEffect, useRef } from "react";
import * as THREE from "three";

function createMobiusStripGeometry(
  segmentsU: number,
  segmentsV: number,
  radius: number,
  halfWidth: number
) {
  const vertexCount = (segmentsU + 1) * (segmentsV + 1);
  const positions = new Float32Array(vertexCount * 3);
  const indices: number[] = [];

  let cursor = 0;
  for (let i = 0; i <= segmentsU; i++) {
    const u = (i / segmentsU) * Math.PI * 2;
    const cosU = Math.cos(u);
    const sinU = Math.sin(u);
    const cosHalfU = Math.cos(u * 0.5);
    const sinHalfU = Math.sin(u * 0.5);

    for (let j = 0; j <= segmentsV; j++) {
      const v = ((j / segmentsV) * 2 - 1) * halfWidth;
      const radial = radius + v * cosHalfU;

      positions[cursor++] = radial * cosU;
      positions[cursor++] = v * sinHalfU;
      positions[cursor++] = radial * sinU;
    }
  }

  for (let i = 0; i < segmentsU; i++) {
    for (let j = 0; j < segmentsV; j++) {
      const a = i * (segmentsV + 1) + j;
      const b = a + 1;
      const c = (i + 1) * (segmentsV + 1) + j;
      const d = c + 1;

      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return geometry;
}

export function RealmSceneBackground() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const isSmallViewport = window.innerWidth < 768;

    // Keep motion subtle on constrained devices.
    const particleCount = isSmallViewport ? 500 : 1400;
    const motionScale = prefersReducedMotion ? 0.15 : 1;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x0b0d13, 12, 42);

    const camera = new THREE.PerspectiveCamera(
      58,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    camera.position.set(0, 1.4, 8);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSmallViewport,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0xf4ead8, 0.85);
    scene.add(ambient);

    const rim = new THREE.DirectionalLight(0xf6cf8b, 1.1);
    rim.position.set(4, 8, 6);
    scene.add(rim);

    const fill = new THREE.DirectionalLight(0x9eb4ff, 0.45);
    fill.position.set(-6, -2, -4);
    scene.add(fill);

    const starsGeometry = new THREE.BufferGeometry();
    const starsPosition = new Float32Array(particleCount * 3);
    const starsColor = new Float32Array(particleCount * 3);
    const warm = new THREE.Color("#f4ddc0");
    const cool = new THREE.Color("#88a2ff");

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      starsPosition[i3] = (Math.random() - 0.5) * 28;
      starsPosition[i3 + 1] = (Math.random() - 0.5) * 14;
      starsPosition[i3 + 2] = (Math.random() - 0.5) * 32;

      const mix = Math.random();
      const tint = warm.clone().lerp(cool, mix);
      starsColor[i3] = tint.r;
      starsColor[i3 + 1] = tint.g;
      starsColor[i3 + 2] = tint.b;
    }

    starsGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(starsPosition, 3)
    );
    starsGeometry.setAttribute("color", new THREE.BufferAttribute(starsColor, 3));

    const starsMaterial = new THREE.PointsMaterial({
      size: isSmallViewport ? 0.028 : 0.038,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
    });

    const stars = new THREE.Points(starsGeometry, starsMaterial);
    scene.add(stars);

    const centerpieceGroup = new THREE.Group();
    scene.add(centerpieceGroup);

    const mobiusGeometry = createMobiusStripGeometry(
      isSmallViewport ? 120 : 180,
      isSmallViewport ? 12 : 20,
      2.25,
      isSmallViewport ? 0.28 : 0.36
    );
    const mobiusMaterial = new THREE.MeshStandardMaterial({
      color: "#d4b07a",
      emissive: "#251608",
      roughness: 0.35,
      metalness: 0.7,
      transparent: true,
      opacity: 0.82,
      side: THREE.DoubleSide,
    });
    const mobiusStrip = new THREE.Mesh(mobiusGeometry, mobiusMaterial);
    const baseRotation = new THREE.Euler(0.82, 0.2, 0.38);
    mobiusStrip.rotation.copy(baseRotation);
    centerpieceGroup.add(mobiusStrip);

    const mobiusEdgesGeometry = new THREE.EdgesGeometry(mobiusGeometry, 24);
    const mobiusEdgesMaterial = new THREE.LineBasicMaterial({
      color: "#a6bcff",
      transparent: true,
      opacity: 0.76,
    });
    const mobiusEdges = new THREE.LineSegments(
      mobiusEdgesGeometry,
      mobiusEdgesMaterial
    );
    mobiusStrip.add(mobiusEdges);

    const pointer = new THREE.Vector2(0, 0);
    const onPointerMove = (event: PointerEvent) => {
      pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
      pointer.y = (event.clientY / window.innerHeight) * 2 - 1;
    };

    let rafId = 0;
    const clock = new THREE.Clock();
    const animate = () => {
      const elapsed = clock.getElapsedTime();
      const drift = elapsed * 0.08 * motionScale;

      stars.rotation.y = drift * 0.45;
      stars.rotation.x = Math.sin(elapsed * 0.23) * 0.04 * motionScale;

      centerpieceGroup.rotation.y = elapsed * 0.2 * motionScale;
      centerpieceGroup.rotation.z = Math.sin(elapsed * 0.34) * 0.1 * motionScale;

      mobiusStrip.rotation.x =
        baseRotation.x + Math.sin(elapsed * 0.55) * 0.09 * motionScale;
      mobiusStrip.rotation.y =
        baseRotation.y + Math.cos(elapsed * 0.45) * 0.08 * motionScale;
      mobiusStrip.rotation.z =
        baseRotation.z + Math.sin(elapsed * 0.75) * 0.07 * motionScale;
      mobiusStrip.position.y = Math.sin(elapsed * 0.72) * 0.09 * motionScale;

      camera.position.x += (pointer.x * 0.45 - camera.position.x) * 0.035;
      camera.position.y += (-pointer.y * 0.28 + 1.4 - camera.position.y) * 0.035;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
      rafId = window.requestAnimationFrame(animate);
    };
    animate();

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    };

    window.addEventListener("resize", onResize);
    window.addEventListener("pointermove", onPointerMove);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onPointerMove);

      starsGeometry.dispose();
      starsMaterial.dispose();
      mobiusGeometry.dispose();
      mobiusMaterial.dispose();
      mobiusEdgesGeometry.dispose();
      mobiusEdgesMaterial.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="absolute inset-0 pointer-events-none"
    />
  );
}
