import { useEffect, useRef } from "react";
import * as THREE from "three";

/* ── Font atlas: real ASCII characters rendered to canvas ── */
const ASCII_CHARS = " .:-=+*#%@";
const CHAR_COUNT = ASCII_CHARS.length;

function createFontAtlas(): HTMLCanvasElement {
  const cW = 32;
  const cH = 48;
  const canvas = document.createElement("canvas");
  canvas.width = cW * CHAR_COUNT;
  canvas.height = cH;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#fff";
  ctx.font = `bold 38px "Courier New", "Courier", monospace`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  for (let i = 0; i < CHAR_COUNT; i++) {
    ctx.fillText(ASCII_CHARS[i], i * cW + cW / 2, cH / 2);
  }
  return canvas;
}

export function RealmSceneBackground() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const isSmall = window.innerWidth < 768;
    const motionScale = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches
      ? 0.15
      : 1;

    const W = window.innerWidth;
    const H = window.innerHeight;

    /* ── Renderer ── */
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020805);
    scene.fog = new THREE.FogExp2(0x020805, 0.014);

    const camera = new THREE.PerspectiveCamera(65, W / H, 0.1, 200);
    camera.position.set(0, 0.3, 5);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSmall,
      alpha: false,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(W, H);
    container.appendChild(renderer.domElement);

    /* ── Off-screen render target ── */
    const sceneTarget = new THREE.WebGLRenderTarget(W, H, {
      depthBuffer: true,
      stencilBuffer: false,
    });
    sceneTarget.texture.minFilter = THREE.LinearFilter;
    sceneTarget.texture.magFilter = THREE.LinearFilter;

    /* ── Font atlas texture ── */
    const fontTexture = new THREE.CanvasTexture(createFontAtlas());
    fontTexture.minFilter = THREE.LinearFilter;
    fontTexture.magFilter = THREE.LinearFilter;

    /* ── ASCII post-processing ── */
    const postScene = new THREE.Scene();
    const postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const cellW = isSmall ? 5.0 : 7.0;
    const cellAspect = 1.7; // height / width

    const asciiMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tScene: { value: sceneTarget.texture },
        tFont: { value: fontTexture },
        resolution: { value: new THREE.Vector2(W, H) },
        cellSize: { value: cellW },
        charCount: { value: CHAR_COUNT },
        cellAspect: { value: cellAspect },
        time: { value: 0 },
        fadeIn: { value: 0 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec2 vUv;
        uniform sampler2D tScene;
        uniform sampler2D tFont;
        uniform vec2 resolution;
        uniform float cellSize;
        uniform float charCount;
        uniform float cellAspect;
        uniform float time;
        uniform float fadeIn;

        void main() {
          float cW = cellSize;
          float cH = cellSize * cellAspect;
          vec2 pixel = vUv * resolution;
          vec2 cell = floor(pixel / vec2(cW, cH));

          // Scene sample at cell center
          vec2 center = (cell + 0.5) * vec2(cW, cH);
          vec4 sc = texture2D(tScene, center / resolution);
          float lum = dot(sc.rgb, vec3(0.2126, 0.7152, 0.0722));

          // Bloom: average neighboring cells
          float bloom = 0.0;
          for (float ox = -1.0; ox <= 1.0; ox += 1.0) {
            for (float oy = -1.0; oy <= 1.0; oy += 1.0) {
              vec2 nUv = (center + vec2(ox * cW, oy * cH)) / resolution;
              bloom += dot(texture2D(tScene, nUv).rgb, vec3(0.2126, 0.7152, 0.0722));
            }
          }
          bloom /= 9.0;
          float bloomGlow = smoothstep(0.08, 0.45, bloom) * 0.6;

          // Character index from luminance
          float charIdx = floor(clamp(lum * (charCount - 1.0), 0.0, charCount - 1.0));

          // Glitch: ~2% of cells show random character
          float glitchSeed = fract(sin(dot(cell, vec2(12.9898, 78.233)) + floor(time * 6.0)) * 43758.5453);
          float glitchActive = step(0.98, glitchSeed);
          float glitchChar = floor(fract(sin(dot(cell, vec2(63.7, 97.2)) + time) * 43758.5453) * charCount);
          charIdx = mix(charIdx, glitchChar, glitchActive);

          // Local UV within cell
          vec2 local = fract(pixel / vec2(cW, cH));

          // Sample font atlas
          vec2 fontUv = vec2(
            (charIdx + local.x) / charCount,
            local.y
          );
          float charMask = texture2D(tFont, fontUv).r;

          // Suppress in very dark areas
          charMask *= smoothstep(0.02, 0.06, lum);

          // Scan lines
          float scanH = 0.85 + 0.15 * sin(cell.y * 0.6 + time * 2.5);
          float scanV = 0.95 + 0.05 * sin(cell.x * 0.3 + time * 1.8);

          // Color from scene with bloom
          vec3 charColor = sc.rgb * (0.8 + lum * 0.8) * scanH * scanV;
          charColor += sc.rgb * bloomGlow;

          // Subtle cell grid
          float border = smoothstep(0.94, 1.0, max(local.x, local.y));
          vec3 bgColor = vec3(0.008, 0.016, 0.012) + vec3(0.004) * border;

          vec3 finalColor = mix(bgColor, charColor, charMask);

          // Vignette
          vec2 vc = vUv - 0.5;
          float vignette = 1.0 - dot(vc, vc) * 0.5;
          finalColor *= vignette;

          // Slight dim for text readability
          finalColor *= 1.0;

          gl_FragColor = vec4(finalColor * fadeIn, 1.0);
        }
      `,
    });

    const asciiQuad = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      asciiMaterial
    );
    postScene.add(asciiQuad);

    /* ══════════════════════════════════════════
       3D SCENE: Agent Consciousness Tunnel
       ══════════════════════════════════════════ */

    // Lighting
    const ambient = new THREE.AmbientLight(0x112222, 0.4);
    scene.add(ambient);

    /* ── Tunnel rings ── */
    const ringCount = isSmall ? 18 : 30;
    const tunnelLength = 65;
    const tunnelRadius = 4.2;

    const rings: {
      mesh: THREE.Mesh;
      mat: THREE.MeshBasicMaterial;
      z: number;
      speed: number;
    }[] = [];

    for (let i = 0; i < ringCount; i++) {
      const t = i / (ringCount - 1);
      const z = -2 - t * tunnelLength;

      const geo = new THREE.TorusGeometry(
        tunnelRadius,
        0.06 + (1 - t) * 0.04, // thicker near camera
        4,
        isSmall ? 32 : 64
      );

      // Color: warm amber near → cool cyan far
      const color = new THREE.Color().lerpColors(
        new THREE.Color("#c08030"),
        new THREE.Color("#30a0b0"),
        t
      );

      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.7 + (1 - t) * 0.3,
      });

      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.z = z;
      scene.add(mesh);
      rings.push({
        mesh,
        mat,
        z,
        speed: 0.08 + Math.random() * 0.25,
      });
    }

    /* ── Data particles streaming through tunnel ── */
    const particleCount = isSmall ? 500 : 1000;
    const pGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(particleCount * 3);
    const pCol = new Float32Array(particleCount * 3);
    const pSize = new Float32Array(particleCount);

    const colGreen = new THREE.Color("#00ff88");
    const colCyan = new THREE.Color("#00ccff");
    const colAmber = new THREE.Color("#ff8800");

    interface ParticleData {
      progress: number;
      speed: number;
      angle: number;
      angleSpeed: number;
      radius: number;
    }

    const pData: ParticleData[] = [];
    for (let i = 0; i < particleCount; i++) {
      const p: ParticleData = {
        progress: Math.random(),
        speed: 0.002 + Math.random() * 0.007,
        angle: Math.random() * Math.PI * 2,
        angleSpeed: 0.5 + Math.random() * 2.0,
        radius: 0.3 + Math.random() * (tunnelRadius - 0.8),
      };
      pData.push(p);

      const rnd = Math.random();
      const color =
        rnd < 0.5
          ? colGreen.clone().lerp(colCyan, Math.random())
          : rnd < 0.85
            ? colCyan.clone()
            : colAmber.clone();
      pCol[i * 3] = color.r;
      pCol[i * 3 + 1] = color.g;
      pCol[i * 3 + 2] = color.b;
      pSize[i] = 0.02 + Math.random() * 0.06;
    }

    pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
    pGeo.setAttribute("color", new THREE.BufferAttribute(pCol, 3));
    pGeo.setAttribute("size", new THREE.BufferAttribute(pSize, 1));

    const pMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
      uniforms: {
        pixelRatio: { value: renderer.getPixelRatio() },
        time: { value: 0 },
      },
      vertexShader: /* glsl */ `
        attribute float size;
        varying vec3 vColor;
        uniform float pixelRatio;
        void main() {
          vColor = color;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * pixelRatio * (160.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vColor;
        uniform float time;
        void main() {
          float d = length(gl_PointCoord - vec2(0.5));
          if (d > 0.5) discard;
          float glow = 1.0 - smoothstep(0.0, 0.5, d);
          glow = pow(glow, 1.5);
          gl_FragColor = vec4(vColor * glow * 2.0, glow * 0.95);
        }
      `,
    });

    const particles = new THREE.Points(pGeo, pMat);
    scene.add(particles);

    /* ── Neural core ── */
    const coreGroup = new THREE.Group();
    coreGroup.position.z = -tunnelLength * 0.5;
    scene.add(coreGroup);

    const coreSphereGeo = new THREE.IcosahedronGeometry(0.7, 2);
    const coreSphereMat = new THREE.MeshBasicMaterial({
      color: "#00ffcc",
      transparent: true,
      opacity: 0.5,
    });
    const coreSphere = new THREE.Mesh(coreSphereGeo, coreSphereMat);
    coreGroup.add(coreSphere);

    const coreWireGeo = new THREE.IcosahedronGeometry(1.1, 1);
    const coreWireMat = new THREE.MeshBasicMaterial({
      color: "#00ddff",
      wireframe: true,
      transparent: true,
      opacity: 0.4,
    });
    const coreWire = new THREE.Mesh(coreWireGeo, coreWireMat);
    coreGroup.add(coreWire);

    // Outer orbit ring around core
    const coreRingGeo = new THREE.TorusGeometry(1.8, 0.025, 4, 48);
    const coreRingMat = new THREE.MeshBasicMaterial({
      color: "#40ffaa",
      transparent: true,
      opacity: 0.35,
    });
    const coreRing = new THREE.Mesh(coreRingGeo, coreRingMat);
    coreGroup.add(coreRing);

    const coreLight = new THREE.PointLight(0x00ff88, 4.0, 60, 1.2);
    coreGroup.add(coreLight);

    /* ── Pulse waves (travel from core toward camera) ── */
    const pulseCount = isSmall ? 3 : 5;
    const pulses: {
      mesh: THREE.Mesh;
      mat: THREE.MeshBasicMaterial;
      progress: number;
      speed: number;
    }[] = [];

    for (let i = 0; i < pulseCount; i++) {
      const geo = new THREE.TorusGeometry(
        tunnelRadius * 0.7,
        0.04,
        4,
        isSmall ? 32 : 64
      );
      const mat = new THREE.MeshBasicMaterial({
        color: "#00ffaa",
        transparent: true,
        opacity: 0,
      });
      const mesh = new THREE.Mesh(geo, mat);
      scene.add(mesh);
      pulses.push({
        mesh,
        mat,
        progress: i / pulseCount,
        speed: 0.06 + Math.random() * 0.04,
      });
    }

    /* ── Pointer tracking ── */
    const pointer = new THREE.Vector2(0, 0);
    const onPointerMove = (e: PointerEvent) => {
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
    };

    /* ── Animation ── */
    let rafId = 0;
    const clock = new THREE.Clock();

    const animate = () => {
      const t = clock.getElapsedTime();
      const fadeIn = Math.min(t / 2.0, 1);

      asciiMaterial.uniforms.time.value = t;
      asciiMaterial.uniforms.fadeIn.value = fadeIn;
      pMat.uniforms.time.value = t;

      // Tunnel rings: rotate + breathe
      for (const ring of rings) {
        ring.mesh.rotation.z = t * ring.speed * motionScale;
        const breathe = 1 + Math.sin(t * 0.5 + ring.z * 0.08) * 0.03;
        ring.mesh.scale.set(breathe, breathe, 1);
      }

      // Particles: spiral flow through tunnel
      const posAttr = pGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < particleCount; i++) {
        const pd = pData[i];
        pd.progress += pd.speed * motionScale;
        if (pd.progress > 1) pd.progress -= 1;

        const z = -2 - pd.progress * tunnelLength;
        const angle = pd.angle + pd.progress * pd.angleSpeed * 4;
        const r = pd.radius * (1 - pd.progress * 0.35);

        posAttr.array[i * 3] = Math.cos(angle) * r;
        posAttr.array[i * 3 + 1] = Math.sin(angle) * r;
        posAttr.array[i * 3 + 2] = z;
      }
      posAttr.needsUpdate = true;

      // Core animation
      coreGroup.rotation.y = t * 0.4 * motionScale;
      coreGroup.rotation.x = Math.sin(t * 0.25) * 0.15 * motionScale;
      const corePulse = 0.8 + Math.sin(t * 1.0) * 0.3;
      coreSphere.scale.setScalar(corePulse);
      coreSphereMat.opacity = 0.35 + Math.sin(t * 1.0) * 0.25;
      coreWire.rotation.y = t * 0.6 * motionScale;
      coreWire.rotation.z = t * 0.35 * motionScale;
      coreRing.rotation.z = t * 0.8 * motionScale;
      coreRing.rotation.x = Math.sin(t * 0.3) * 0.2;
      coreLight.intensity = 3.5 + Math.sin(t * 1.0) * 2.0;

      // Core light color cycle: green → cyan
      const lc = (Math.sin(t * 0.2) + 1) * 0.5;
      coreLight.color.setRGB(0, 1 - lc * 0.3, 0.53 + lc * 0.47);

      // Pulse waves: travel from core toward camera
      for (const pulse of pulses) {
        pulse.progress += pulse.speed * 0.008 * motionScale;
        if (pulse.progress > 1) pulse.progress -= 1;

        const coreZ = -tunnelLength * 0.5;
        const pz = coreZ + pulse.progress * (tunnelLength * 0.55);
        pulse.mesh.position.z = pz;

        const fade =
          pulse.progress < 0.1
            ? pulse.progress / 0.1
            : Math.max(0, 1 - (pulse.progress - 0.1) / 0.9);
        pulse.mat.opacity = fade * 0.35;

        // Color shift: cyan → green as it approaches
        pulse.mat.color.setHSL(
          0.42 + pulse.progress * 0.08,
          0.85,
          0.5
        );

        const scale = 0.4 + pulse.progress * 0.7;
        pulse.mesh.scale.set(scale, scale, 1);
      }

      // Camera: subtle response to pointer + auto drift
      const autoX = Math.sin(t * 0.12) * 0.4 * motionScale;
      const autoY = Math.cos(t * 0.1) * 0.2 * motionScale;
      const targetX = pointer.x * 1.0 + autoX;
      const targetY = -pointer.y * 0.6 + 0.3 + autoY;
      camera.position.x += (targetX - camera.position.x) * 0.025;
      camera.position.y += (targetY - camera.position.y) * 0.025;
      camera.lookAt(0, 0, -25);

      // Render
      renderer.setRenderTarget(sceneTarget);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      renderer.render(postScene, postCamera);
      rafId = requestAnimationFrame(animate);
    };

    animate();

    /* ── Resize ── */
    const onResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      sceneTarget.setSize(w, h);
      const dpr = Math.min(window.devicePixelRatio, 1.5);
      renderer.setPixelRatio(dpr);
      pMat.uniforms.pixelRatio.value = dpr;
      asciiMaterial.uniforms.resolution.value.set(w, h);
    };

    window.addEventListener("resize", onResize);
    window.addEventListener("pointermove", onPointerMove);

    /* ── Cleanup ── */
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onPointerMove);

      for (const ring of rings) {
        ring.mesh.geometry.dispose();
        ring.mat.dispose();
      }
      pGeo.dispose();
      pMat.dispose();
      coreSphereGeo.dispose();
      coreSphereMat.dispose();
      coreWireGeo.dispose();
      coreWireMat.dispose();
      coreRingGeo.dispose();
      coreRingMat.dispose();
      for (const pulse of pulses) {
        pulse.mesh.geometry.dispose();
        pulse.mat.dispose();
      }
      sceneTarget.dispose();
      fontTexture.dispose();
      asciiQuad.geometry.dispose();
      asciiMaterial.dispose();
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
