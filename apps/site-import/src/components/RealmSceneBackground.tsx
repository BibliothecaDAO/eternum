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
    scene.fog = new THREE.Fog(0x09070a, 10, 40);

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

    const sceneTarget = new THREE.WebGLRenderTarget(
      window.innerWidth,
      window.innerHeight,
      {
        depthBuffer: true,
        stencilBuffer: false,
      }
    );
    sceneTarget.texture.minFilter = THREE.LinearFilter;
    sceneTarget.texture.magFilter = THREE.LinearFilter;

    const postScene = new THREE.Scene();
    const postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const asciiPassMaterial = new THREE.ShaderMaterial({
      transparent: true,
      uniforms: {
        tScene: { value: sceneTarget.texture },
        resolution: {
          value: new THREE.Vector2(window.innerWidth, window.innerHeight),
        },
        asciiCellSize: { value: isSmallViewport ? 8.5 : 10.5 },
        tint: { value: new THREE.Color("#f0c98d") },
        bgTint: { value: new THREE.Color("#09070a") },
        time: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;

        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;

        uniform sampler2D tScene;
        uniform vec2 resolution;
        uniform float asciiCellSize;
        uniform vec3 tint;
        uniform vec3 bgTint;
        uniform float time;

        float stroke(vec2 p, vec2 a, vec2 b, float width) {
          vec2 pa = p - a;
          vec2 ba = b - a;
          float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
          float dist = length(pa - ba * h);
          return 1.0 - smoothstep(width, width + 0.015, dist);
        }

        float glyphMask(float lum, vec2 p) {
          float mask = 0.0;

          if (lum < 0.18) {
            mask = max(mask, stroke(p, vec2(0.14, 0.12), vec2(0.86, 0.88), 0.055));
            mask = max(mask, stroke(p, vec2(0.86, 0.12), vec2(0.14, 0.88), 0.055));
            mask = max(mask, stroke(p, vec2(0.16, 0.35), vec2(0.84, 0.35), 0.055));
            mask = max(mask, stroke(p, vec2(0.16, 0.65), vec2(0.84, 0.65), 0.055));
          } else if (lum < 0.36) {
            mask = max(mask, stroke(p, vec2(0.18, 0.2), vec2(0.82, 0.8), 0.05));
            mask = max(mask, stroke(p, vec2(0.82, 0.2), vec2(0.18, 0.8), 0.05));
            mask = max(mask, stroke(p, vec2(0.2, 0.5), vec2(0.8, 0.5), 0.05));
          } else if (lum < 0.58) {
            mask = max(mask, stroke(p, vec2(0.2, 0.5), vec2(0.8, 0.5), 0.05));
            mask = max(mask, stroke(p, vec2(0.5, 0.2), vec2(0.5, 0.8), 0.05));
          } else if (lum < 0.78) {
            mask = max(mask, stroke(p, vec2(0.2, 0.25), vec2(0.8, 0.75), 0.045));
          } else {
            mask = 1.0 - smoothstep(0.08, 0.1, distance(p, vec2(0.5)));
          }

          return mask;
        }

        void main() {
          vec2 pixel = vUv * resolution;
          vec2 cell = floor(pixel / asciiCellSize);
          vec2 center = (cell + 0.5) * asciiCellSize;
          vec2 sampleUv = center / resolution;

          vec4 sceneSample = texture2D(tScene, sampleUv);
          float lum = dot(sceneSample.rgb, vec3(0.2126, 0.7152, 0.0722));

          vec2 local = fract(pixel / asciiCellSize);
          float glyph = glyphMask(lum, local);
          float scan = 0.92 + 0.08 * sin((cell.y + time * 8.0) * 0.35);

          vec3 shaded = mix(bgTint, sceneSample.rgb * tint, 0.7);
          vec3 glyphColor = shaded * (0.45 + 0.55 * scan);
          vec3 finalColor = mix(bgTint * 0.85, glyphColor, glyph * sceneSample.a);
          float alpha = max(sceneSample.a * 0.62, glyph * sceneSample.a);

          gl_FragColor = vec4(finalColor, alpha);
        }
      `,
    });

    const asciiPassQuad = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      asciiPassMaterial
    );
    postScene.add(asciiPassQuad);

    const ambient = new THREE.AmbientLight(0xc9b189, 0.78);
    scene.add(ambient);

    const rim = new THREE.DirectionalLight(0xd19a48, 1.15);
    rim.position.set(4, 8, 6);
    scene.add(rim);

    const fill = new THREE.DirectionalLight(0x5d6b9a, 0.4);
    fill.position.set(-6, -2, -4);
    scene.add(fill);

    const starsGeometry = new THREE.BufferGeometry();
    const starsPosition = new Float32Array(particleCount * 3);
    const starsColor = new Float32Array(particleCount * 3);
    const ember = new THREE.Color("#e4a34a");
    const ash = new THREE.Color("#8fa0cf");

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      starsPosition[i3] = (Math.random() - 0.5) * 28;
      starsPosition[i3 + 1] = (Math.random() - 0.5) * 14;
      starsPosition[i3 + 2] = (Math.random() - 0.5) * 32;

      const mix = Math.random();
      const tint = ember.clone().lerp(ash, mix);
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
      color: "#b28a57",
      emissive: "#2d1508",
      roughness: 0.32,
      metalness: 0.75,
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
      color: "#d8893d",
      transparent: true,
      opacity: 0.72,
    });
    const mobiusEdges = new THREE.LineSegments(
      mobiusEdgesGeometry,
      mobiusEdgesMaterial
    );
    mobiusStrip.add(mobiusEdges);

    const runeRingGeometry = new THREE.RingGeometry(2.8, 3.05, 80);
    const runeRingMaterial = new THREE.MeshBasicMaterial({
      color: "#7f5a2e",
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide,
    });
    const runeRing = new THREE.Mesh(runeRingGeometry, runeRingMaterial);
    runeRing.rotation.set(-0.95, 0.2, 0.18);
    runeRing.position.set(0, -0.2, -0.45);
    centerpieceGroup.add(runeRing);

    const warHaloGeometry = new THREE.TorusGeometry(3.1, 0.03, 12, 180);
    const warHaloMaterial = new THREE.MeshBasicMaterial({
      color: "#cb7d2e",
      transparent: true,
      opacity: 0.4,
    });
    const warHalo = new THREE.Mesh(warHaloGeometry, warHaloMaterial);
    warHalo.rotation.set(1.02, 0.2, 0.05);
    centerpieceGroup.add(warHalo);

    const arcaneHaloGeometry = new THREE.TorusGeometry(3.45, 0.025, 10, 160);
    const arcaneHaloMaterial = new THREE.MeshBasicMaterial({
      color: "#6b79b8",
      transparent: true,
      opacity: 0.3,
    });
    const arcaneHalo = new THREE.Mesh(arcaneHaloGeometry, arcaneHaloMaterial);
    arcaneHalo.rotation.set(0.6, -0.15, 1.12);
    centerpieceGroup.add(arcaneHalo);

    const glyphShardCount = isSmallViewport ? 32 : 72;
    const glyphShardGeometry = new THREE.TetrahedronGeometry(
      isSmallViewport ? 0.045 : 0.06,
      0
    );
    const glyphShardMaterial = new THREE.MeshStandardMaterial({
      color: "#d89a52",
      emissive: "#2b1306",
      roughness: 0.28,
      metalness: 0.55,
      transparent: true,
      opacity: 0.88,
    });
    const glyphShards = new THREE.InstancedMesh(
      glyphShardGeometry,
      glyphShardMaterial,
      glyphShardCount
    );
    const glyphShardData = Array.from({ length: glyphShardCount }, () => ({
      radius: 2.85 + Math.random() * 1.25,
      angle: Math.random() * Math.PI * 2,
      speed: 0.12 + Math.random() * 0.22,
      height: (Math.random() - 0.5) * 2.3,
      tilt: (Math.random() - 0.5) * 1.1,
    }));
    const glyphShardDummy = new THREE.Object3D();
    centerpieceGroup.add(glyphShards);

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
      runeRing.rotation.z = elapsed * 0.05 * motionScale;
      warHalo.rotation.z = elapsed * 0.12 * motionScale;
      arcaneHalo.rotation.z = -elapsed * 0.09 * motionScale;

      for (let i = 0; i < glyphShardCount; i++) {
        const shard = glyphShardData[i];
        const angle = shard.angle + elapsed * shard.speed * motionScale;
        glyphShardDummy.position.set(
          Math.cos(angle) * shard.radius,
          shard.height + Math.sin(elapsed * 0.9 + i * 0.13) * 0.2 * motionScale,
          Math.sin(angle) * shard.radius
        );
        glyphShardDummy.rotation.set(
          angle * 0.6,
          angle + shard.tilt,
          Math.sin(elapsed * 0.7 + i * 0.17) * 0.6
        );
        glyphShardDummy.updateMatrix();
        glyphShards.setMatrixAt(i, glyphShardDummy.matrix);
      }
      glyphShards.instanceMatrix.needsUpdate = true;

      camera.position.x += (pointer.x * 0.45 - camera.position.x) * 0.035;
      camera.position.y += (-pointer.y * 0.28 + 1.4 - camera.position.y) * 0.035;
      camera.lookAt(0, 0, 0);

      asciiPassMaterial.uniforms.time.value = elapsed;

      renderer.setRenderTarget(sceneTarget);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      renderer.render(postScene, postCamera);
      rafId = window.requestAnimationFrame(animate);
    };
    animate();

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      sceneTarget.setSize(window.innerWidth, window.innerHeight);
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      asciiPassMaterial.uniforms.resolution.value.set(
        window.innerWidth,
        window.innerHeight
      );
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
      runeRingGeometry.dispose();
      runeRingMaterial.dispose();
      warHaloGeometry.dispose();
      warHaloMaterial.dispose();
      arcaneHaloGeometry.dispose();
      arcaneHaloMaterial.dispose();
      glyphShardGeometry.dispose();
      glyphShardMaterial.dispose();
      sceneTarget.dispose();
      asciiPassQuad.geometry.dispose();
      asciiPassMaterial.dispose();
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
