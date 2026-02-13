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

    const particleCount = isSmallViewport ? 600 : 1600;
    const streamCount = isSmallViewport ? 140 : 350;
    const pulseRingCount = isSmallViewport ? 3 : 5;
    const motionScale = prefersReducedMotion ? 0.15 : 1;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x09070a, 12, 45);

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
      { depthBuffer: true, stencilBuffer: false }
    );
    sceneTarget.texture.minFilter = THREE.LinearFilter;
    sceneTarget.texture.magFilter = THREE.LinearFilter;

    const postScene = new THREE.Scene();
    const postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // --- Enhanced ASCII shader with richer glyphs + bloom ---
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
        fadeIn: { value: 0 },
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
        uniform float fadeIn;

        float stroke(vec2 p, vec2 a, vec2 b, float width) {
          vec2 pa = p - a;
          vec2 ba = b - a;
          float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
          float dist = length(pa - ba * h);
          return 1.0 - smoothstep(width, width + 0.015, dist);
        }

        float box(vec2 p, vec2 center, vec2 half_size) {
          vec2 d = abs(p - center) - half_size;
          return 1.0 - smoothstep(0.0, 0.04, max(d.x, d.y));
        }

        float circle(vec2 p, vec2 center, float r, float width) {
          float d = abs(length(p - center) - r);
          return 1.0 - smoothstep(width, width + 0.02, d);
        }

        float glyphMask(float lum, vec2 p) {
          float mask = 0.0;

          if (lum < 0.12) {
            // Dense: hash/grid
            mask = max(mask, stroke(p, vec2(0.14, 0.12), vec2(0.86, 0.88), 0.05));
            mask = max(mask, stroke(p, vec2(0.86, 0.12), vec2(0.14, 0.88), 0.05));
            mask = max(mask, stroke(p, vec2(0.16, 0.35), vec2(0.84, 0.35), 0.05));
            mask = max(mask, stroke(p, vec2(0.16, 0.65), vec2(0.84, 0.65), 0.05));
            mask = max(mask, stroke(p, vec2(0.5, 0.1), vec2(0.5, 0.9), 0.04));
          } else if (lum < 0.24) {
            // Runic: angular brackets
            mask = max(mask, stroke(p, vec2(0.2, 0.15), vec2(0.5, 0.5), 0.048));
            mask = max(mask, stroke(p, vec2(0.5, 0.5), vec2(0.2, 0.85), 0.048));
            mask = max(mask, stroke(p, vec2(0.8, 0.15), vec2(0.5, 0.5), 0.048));
            mask = max(mask, stroke(p, vec2(0.5, 0.5), vec2(0.8, 0.85), 0.048));
          } else if (lum < 0.38) {
            // X cross
            mask = max(mask, stroke(p, vec2(0.18, 0.2), vec2(0.82, 0.8), 0.048));
            mask = max(mask, stroke(p, vec2(0.82, 0.2), vec2(0.18, 0.8), 0.048));
            mask = max(mask, stroke(p, vec2(0.2, 0.5), vec2(0.8, 0.5), 0.048));
          } else if (lum < 0.50) {
            // Diamond
            mask = max(mask, stroke(p, vec2(0.5, 0.12), vec2(0.88, 0.5), 0.044));
            mask = max(mask, stroke(p, vec2(0.88, 0.5), vec2(0.5, 0.88), 0.044));
            mask = max(mask, stroke(p, vec2(0.5, 0.88), vec2(0.12, 0.5), 0.044));
            mask = max(mask, stroke(p, vec2(0.12, 0.5), vec2(0.5, 0.12), 0.044));
          } else if (lum < 0.62) {
            // Plus
            mask = max(mask, stroke(p, vec2(0.2, 0.5), vec2(0.8, 0.5), 0.048));
            mask = max(mask, stroke(p, vec2(0.5, 0.2), vec2(0.5, 0.8), 0.048));
          } else if (lum < 0.76) {
            // Slash
            mask = max(mask, stroke(p, vec2(0.2, 0.25), vec2(0.8, 0.75), 0.044));
          } else if (lum < 0.88) {
            // Small circle
            mask = circle(p, vec2(0.5), 0.18, 0.045);
          } else {
            // Dot
            mask = 1.0 - smoothstep(0.06, 0.09, distance(p, vec2(0.5)));
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

          // Bloom: sample neighbors and add soft glow
          float bloom = 0.0;
          for (float ox = -1.0; ox <= 1.0; ox += 1.0) {
            for (float oy = -1.0; oy <= 1.0; oy += 1.0) {
              vec2 nUv = (center + vec2(ox, oy) * asciiCellSize) / resolution;
              vec4 ns = texture2D(tScene, nUv);
              bloom += dot(ns.rgb, vec3(0.2126, 0.7152, 0.0722)) * ns.a;
            }
          }
          bloom = bloom / 9.0;
          float bloomStrength = smoothstep(0.25, 0.7, bloom) * 0.35;

          vec2 local = fract(pixel / asciiCellSize);
          float glyph = glyphMask(lum, local);

          // Dual scan: horizontal + vertical subtle
          float scanH = 0.90 + 0.10 * sin((cell.y + time * 8.0) * 0.35);
          float scanV = 0.96 + 0.04 * sin((cell.x + time * 5.0) * 0.25);
          float scan = scanH * scanV;

          vec3 shaded = mix(bgTint, sceneSample.rgb * tint, 0.72);
          vec3 glyphColor = shaded * (0.42 + 0.58 * scan);
          // Bloom adds warm haze around bright areas
          vec3 bloomColor = tint * bloomStrength;
          vec3 finalColor = mix(bgTint * 0.85, glyphColor + bloomColor, glyph * sceneSample.a);
          float alpha = max(sceneSample.a * 0.62, glyph * sceneSample.a);
          // Bloom also slightly lifts alpha in bright zones
          alpha = min(1.0, alpha + bloomStrength * 0.2);

          gl_FragColor = vec4(finalColor, alpha * fadeIn);
        }
      `,
    });

    const asciiPassQuad = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      asciiPassMaterial
    );
    postScene.add(asciiPassQuad);

    // --- Lighting ---
    const ambient = new THREE.AmbientLight(0xc9b189, 0.78);
    scene.add(ambient);

    const rim = new THREE.DirectionalLight(0xd19a48, 1.15);
    rim.position.set(4, 8, 6);
    scene.add(rim);

    const fill = new THREE.DirectionalLight(0x5d6b9a, 0.4);
    fill.position.set(-6, -2, -4);
    scene.add(fill);

    // --- Point light at center for inner glow ---
    const coreLight = new THREE.PointLight(0xe4a34a, 0.6, 8, 2);
    coreLight.position.set(0, 0, 0);
    scene.add(coreLight);

    // --- Star particles with vortex motion ---
    const starsGeometry = new THREE.BufferGeometry();
    const starsPosition = new Float32Array(particleCount * 3);
    const starsColor = new Float32Array(particleCount * 3);
    const starsSizes = new Float32Array(particleCount);
    const starsAngles = new Float32Array(particleCount); // for vortex
    const starsRadii = new Float32Array(particleCount);
    const starsHeights = new Float32Array(particleCount);
    const starsVortexSpeed = new Float32Array(particleCount);
    const emberColor = new THREE.Color("#e4a34a");
    const ashColor = new THREE.Color("#8fa0cf");

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      const r = 2.5 + Math.random() * 16;
      const a = Math.random() * Math.PI * 2;
      const h = (Math.random() - 0.5) * 14;

      starsPosition[i3] = Math.cos(a) * r;
      starsPosition[i3 + 1] = h;
      starsPosition[i3 + 2] = Math.sin(a) * r;

      starsAngles[i] = a;
      starsRadii[i] = r;
      starsHeights[i] = h;
      // Closer stars orbit faster — vortex feel
      starsVortexSpeed[i] = (0.02 + 0.06 / (1 + r * 0.3)) * (0.8 + Math.random() * 0.4);

      const mix = Math.random();
      const tintColor = emberColor.clone().lerp(ashColor, mix);
      starsColor[i3] = tintColor.r;
      starsColor[i3 + 1] = tintColor.g;
      starsColor[i3 + 2] = tintColor.b;

      starsSizes[i] = 0.02 + Math.pow(Math.random(), 3) * 0.14;
    }

    starsGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(starsPosition, 3)
    );
    starsGeometry.setAttribute("color", new THREE.BufferAttribute(starsColor, 3));
    starsGeometry.setAttribute("size", new THREE.BufferAttribute(starsSizes, 1));

    const starsMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
      uniforms: {
        time: { value: 0 },
        pixelRatio: { value: renderer.getPixelRatio() },
      },
      vertexShader: `
        attribute float size;
        varying vec3 vColor;
        varying float vSize;
        uniform float time;
        uniform float pixelRatio;

        void main() {
          vColor = color;
          vSize = size;
          vec3 pos = position;
          pos.y += sin(time * 0.3 + position.x * 0.5) * 0.1;
          pos.x += cos(time * 0.2 + position.z * 0.3) * 0.08;
          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          gl_PointSize = size * pixelRatio * (200.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vSize;
        uniform float time;

        void main() {
          float d = length(gl_PointCoord - vec2(0.5));
          if (d > 0.5) discard;
          float glow = 1.0 - smoothstep(0.0, 0.5, d);
          glow = pow(glow, 1.6);
          float twinkle = 0.7 + 0.3 * sin(time * 2.5 + vSize * 500.0);
          gl_FragColor = vec4(vColor * glow * twinkle * 1.1, glow * 0.9);
        }
      `,
    });

    const stars = new THREE.Points(starsGeometry, starsMaterial);
    scene.add(stars);

    // --- Energy stream particles spiraling inward ---
    const streamGeometry = new THREE.BufferGeometry();
    const streamPositions = new Float32Array(streamCount * 3);
    const streamColors = new Float32Array(streamCount * 3);
    const streamSizes = new Float32Array(streamCount);
    const hotEmber = new THREE.Color("#f5a623");
    const coolBrass = new THREE.Color("#c9935a");
    const arcaneBlue = new THREE.Color("#7b8fd4");

    const streamData = Array.from({ length: streamCount }, () => ({
      progress: Math.random(),
      speed: 0.07 + Math.random() * 0.12,
      angle: Math.random() * Math.PI * 2,
      angleSpeed: 1.0 + Math.random() * 1.5,
      height: (Math.random() - 0.5) * 1.8,
      outerRadius: 4.5 + Math.random() * 4.0,
      colorType: Math.random(), // 0-0.6 ember, 0.6-1.0 arcane
    }));

    for (let i = 0; i < streamCount; i++) {
      const s = streamData[i];
      const color =
        s.colorType < 0.6
          ? hotEmber.clone().lerp(coolBrass, Math.random())
          : arcaneBlue.clone().lerp(coolBrass, Math.random() * 0.4);
      streamColors[i * 3] = color.r;
      streamColors[i * 3 + 1] = color.g;
      streamColors[i * 3 + 2] = color.b;
      streamSizes[i] = 0.03 + Math.random() * 0.07;
    }

    streamGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(streamPositions, 3)
    );
    streamGeometry.setAttribute(
      "color",
      new THREE.BufferAttribute(streamColors, 3)
    );
    streamGeometry.setAttribute(
      "size",
      new THREE.BufferAttribute(streamSizes, 1)
    );

    const streamMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
      uniforms: {
        pixelRatio: { value: renderer.getPixelRatio() },
        time: { value: 0 },
      },
      vertexShader: `
        attribute float size;
        varying vec3 vColor;
        varying float vAlpha;
        uniform float pixelRatio;

        void main() {
          vColor = color;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          float dist = length(position.xz);
          vAlpha = smoothstep(0.3, 2.5, dist);
          gl_PointSize = size * pixelRatio * (140.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;
        uniform float time;

        void main() {
          float d = length(gl_PointCoord - vec2(0.5));
          if (d > 0.5) discard;
          float glow = 1.0 - smoothstep(0.0, 0.5, d);
          glow = pow(glow, 1.8);
          // Streaky elongation feel via slight pulse
          float pulse = 0.85 + 0.15 * sin(time * 6.0 + gl_PointCoord.x * 8.0);
          gl_FragColor = vec4(vColor * 1.5 * pulse, glow * vAlpha * 0.75);
        }
      `,
    });

    const streamPoints = new THREE.Points(streamGeometry, streamMaterial);
    scene.add(streamPoints);

    // --- Pulse rings that expand outward from center ---
    const pulseRings: {
      mesh: THREE.Mesh;
      material: THREE.MeshBasicMaterial;
      progress: number;
      speed: number;
      delay: number;
    }[] = [];

    for (let i = 0; i < pulseRingCount; i++) {
      const geo = new THREE.TorusGeometry(1, 0.015, 8, 120);
      const mat = new THREE.MeshBasicMaterial({
        color: "#e4a34a",
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(geo, mat);
      ring.rotation.set(-0.6, 0.1, 0);
      scene.add(ring);
      pulseRings.push({
        mesh: ring,
        material: mat,
        progress: i / pulseRingCount, // Stagger start
        speed: 0.15 + Math.random() * 0.05,
        delay: i * (1 / pulseRingCount),
      });
    }

    // --- Centerpiece ---
    const centerpieceGroup = new THREE.Group();
    scene.add(centerpieceGroup);

    const mobiusGeometry = createMobiusStripGeometry(
      isSmallViewport ? 120 : 180,
      isSmallViewport ? 12 : 20,
      2.25,
      isSmallViewport ? 0.28 : 0.36
    );

    // Color cycling targets
    const mobiusEmissiveA = new THREE.Color("#4a2008"); // deep ember
    const mobiusEmissiveB = new THREE.Color("#1a2848"); // deep arcane
    const mobiusColorA = new THREE.Color("#b28a57"); // warm brass
    const mobiusColorB = new THREE.Color("#8a95b8"); // cool steel

    const mobiusMaterial = new THREE.MeshStandardMaterial({
      color: mobiusColorA.clone(),
      emissive: mobiusEmissiveA.clone(),
      emissiveIntensity: 0.5,
      roughness: 0.28,
      metalness: 0.8,
      transparent: true,
      opacity: 0.85,
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

    const warHaloGeometry = new THREE.TorusGeometry(3.1, 0.035, 12, 180);
    const warHaloMaterial = new THREE.MeshBasicMaterial({
      color: "#cb7d2e",
      transparent: true,
      opacity: 0.4,
    });
    const warHalo = new THREE.Mesh(warHaloGeometry, warHaloMaterial);
    warHalo.rotation.set(1.02, 0.2, 0.05);
    centerpieceGroup.add(warHalo);

    const arcaneHaloGeometry = new THREE.TorusGeometry(3.45, 0.03, 10, 160);
    const arcaneHaloMaterial = new THREE.MeshBasicMaterial({
      color: "#6b79b8",
      transparent: true,
      opacity: 0.3,
    });
    const arcaneHalo = new THREE.Mesh(arcaneHaloGeometry, arcaneHaloMaterial);
    arcaneHalo.rotation.set(0.6, -0.15, 1.12);
    centerpieceGroup.add(arcaneHalo);

    const glyphShardCount = isSmallViewport ? 40 : 90;
    const glyphShardGeometry = new THREE.TetrahedronGeometry(
      isSmallViewport ? 0.05 : 0.065,
      0
    );
    const glyphShardMaterial = new THREE.MeshStandardMaterial({
      color: "#d89a52",
      emissive: "#3a1a08",
      emissiveIntensity: 0.4,
      roughness: 0.25,
      metalness: 0.6,
      transparent: true,
      opacity: 0.9,
    });
    const glyphShards = new THREE.InstancedMesh(
      glyphShardGeometry,
      glyphShardMaterial,
      glyphShardCount
    );
    const glyphShardData = Array.from({ length: glyphShardCount }, () => ({
      radius: 2.6 + Math.random() * 1.5,
      angle: Math.random() * Math.PI * 2,
      speed: 0.14 + Math.random() * 0.26,
      height: (Math.random() - 0.5) * 2.8,
      tilt: (Math.random() - 0.5) * 1.2,
      phase: Math.random() * Math.PI * 2,
    }));
    const glyphShardDummy = new THREE.Object3D();
    centerpieceGroup.add(glyphShards);

    // --- Pointer & camera state ---
    const pointer = new THREE.Vector2(0, 0);
    const onPointerMove = (event: PointerEvent) => {
      pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
      pointer.y = (event.clientY / window.innerHeight) * 2 - 1;
    };

    // --- Animation loop ---
    let rafId = 0;
    const clock = new THREE.Clock();
    const lerpColor = (a: THREE.Color, b: THREE.Color, t: number, out: THREE.Color) => {
      out.r = a.r + (b.r - a.r) * t;
      out.g = a.g + (b.g - a.g) * t;
      out.b = a.b + (b.b - a.b) * t;
    };

    const animate = () => {
      const elapsed = clock.getElapsedTime();

      // Cinematic fade-in over 2.5s
      const fadeIn = Math.min(elapsed / 2.5, 1);
      asciiPassMaterial.uniforms.fadeIn.value = fadeIn;
      asciiPassMaterial.uniforms.time.value = elapsed;

      // --- Vortex star field ---
      starsMaterial.uniforms.time.value = elapsed;
      const starPosAttr = starsGeometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < particleCount; i++) {
        starsAngles[i] += starsVortexSpeed[i] * motionScale;
        const r = starsRadii[i];
        const a = starsAngles[i];
        const i3 = i * 3;
        starPosAttr.array[i3] = Math.cos(a) * r;
        starPosAttr.array[i3 + 1] = starsHeights[i] + Math.sin(elapsed * 0.2 + i * 0.01) * 0.15;
        starPosAttr.array[i3 + 2] = Math.sin(a) * r;
      }
      starPosAttr.needsUpdate = true;

      // --- Energy streams ---
      streamMaterial.uniforms.time.value = elapsed;
      const streamPosAttr = streamGeometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < streamCount; i++) {
        const s = streamData[i];
        s.progress += s.speed * 0.009 * motionScale;
        if (s.progress > 1) {
          s.progress = 0;
          s.angle = Math.random() * Math.PI * 2;
          s.height = (Math.random() - 0.5) * 1.8;
        }
        const t = s.progress;
        const radius = s.outerRadius * (1 - t * t);
        const angle = s.angle + t * s.angleSpeed * 5;
        const i3 = i * 3;
        streamPosAttr.array[i3] = Math.cos(angle) * radius;
        streamPosAttr.array[i3 + 1] =
          s.height * (1 - t) + Math.sin(elapsed * 0.9 + i * 0.08) * 0.18;
        streamPosAttr.array[i3 + 2] = Math.sin(angle) * radius;
      }
      streamPosAttr.needsUpdate = true;

      // --- Pulse rings ---
      for (const pr of pulseRings) {
        pr.progress += pr.speed * 0.008 * motionScale;
        if (pr.progress > 1) pr.progress = 0;

        const t = pr.progress;
        const scale = 0.5 + t * 6; // expand from 0.5 to 6.5
        pr.mesh.scale.set(scale, scale, scale);
        // Fade: rise quickly, fall slowly
        const fade = t < 0.15 ? t / 0.15 : Math.max(0, 1 - (t - 0.15) / 0.85);
        pr.material.opacity = fade * 0.35;
        // Shift color from ember → arcane as ring expands
        const hue = t;
        pr.material.color.setRGB(
          0.89 * (1 - hue) + 0.42 * hue,
          0.64 * (1 - hue) + 0.56 * hue,
          0.14 * (1 - hue) + 0.83 * hue
        );
      }

      // --- Centerpiece ---
      centerpieceGroup.rotation.y = elapsed * 0.22 * motionScale;
      centerpieceGroup.rotation.z =
        Math.sin(elapsed * 0.34) * 0.12 * motionScale;

      // Möbius color cycling: ember ↔ arcane
      const colorCycle = (Math.sin(elapsed * 0.15) + 1) * 0.5; // 0-1, ~20s period
      lerpColor(mobiusColorA, mobiusColorB, colorCycle, mobiusMaterial.color);
      lerpColor(mobiusEmissiveA, mobiusEmissiveB, colorCycle, mobiusMaterial.emissive);

      // Breathing glow
      const breathe = 0.5 + Math.sin(elapsed * 0.6) * 0.3;
      mobiusMaterial.emissiveIntensity = breathe;

      // Edge brightness pulse synced with breathe
      mobiusEdgesMaterial.opacity = 0.5 + Math.sin(elapsed * 0.6) * 0.3;

      mobiusStrip.rotation.x =
        baseRotation.x + Math.sin(elapsed * 0.55) * 0.1 * motionScale;
      mobiusStrip.rotation.y =
        baseRotation.y + Math.cos(elapsed * 0.45) * 0.09 * motionScale;
      mobiusStrip.rotation.z =
        baseRotation.z + Math.sin(elapsed * 0.75) * 0.08 * motionScale;
      mobiusStrip.position.y = Math.sin(elapsed * 0.72) * 0.1 * motionScale;

      // Halo pulse
      warHaloMaterial.opacity = 0.3 + Math.sin(elapsed * 0.8) * 0.2;
      arcaneHaloMaterial.opacity = 0.2 + Math.sin(elapsed * 0.6 + 1.5) * 0.15;
      runeRingMaterial.opacity = 0.15 + Math.sin(elapsed * 0.4) * 0.1;

      runeRing.rotation.z = elapsed * 0.06 * motionScale;
      warHalo.rotation.z = elapsed * 0.14 * motionScale;
      arcaneHalo.rotation.z = -elapsed * 0.1 * motionScale;

      // Core light pulse
      coreLight.intensity = 0.5 + Math.sin(elapsed * 0.6) * 0.35;
      // Core light color shift matching Möbius
      lerpColor(
        new THREE.Color("#e4a34a"),
        new THREE.Color("#7b8fd4"),
        colorCycle,
        coreLight.color
      );

      // Glyph shards
      glyphShardMaterial.emissiveIntensity = 0.4 + Math.sin(elapsed * 0.9) * 0.25;

      for (let i = 0; i < glyphShardCount; i++) {
        const shard = glyphShardData[i];
        const angle = shard.angle + elapsed * shard.speed * motionScale;
        // Bob height with individual phase
        const bob = Math.sin(elapsed * 0.9 + shard.phase) * 0.25 * motionScale;
        glyphShardDummy.position.set(
          Math.cos(angle) * shard.radius,
          shard.height + bob,
          Math.sin(angle) * shard.radius
        );
        glyphShardDummy.rotation.set(
          angle * 0.7,
          angle + shard.tilt,
          Math.sin(elapsed * 0.7 + shard.phase) * 0.7
        );
        glyphShardDummy.updateMatrix();
        glyphShards.setMatrixAt(i, glyphShardDummy.matrix);
      }
      glyphShards.instanceMatrix.needsUpdate = true;

      // Camera: auto-orbit + pointer
      const autoOrbitX = Math.sin(elapsed * 0.1) * 0.7 * motionScale;
      const autoOrbitY = Math.cos(elapsed * 0.08) * 0.3 * motionScale;
      const targetX = pointer.x * 0.5 + autoOrbitX;
      const targetY = -pointer.y * 0.3 + 1.4 + autoOrbitY;
      camera.position.x += (targetX - camera.position.x) * 0.035;
      camera.position.y += (targetY - camera.position.y) * 0.035;
      camera.lookAt(0, 0, 0);

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
      const dpr = Math.min(window.devicePixelRatio, 1.5);
      renderer.setPixelRatio(dpr);
      starsMaterial.uniforms.pixelRatio.value = dpr;
      streamMaterial.uniforms.pixelRatio.value = dpr;
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
      streamGeometry.dispose();
      streamMaterial.dispose();
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
      for (const pr of pulseRings) {
        pr.mesh.geometry.dispose();
        pr.material.dispose();
      }
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
