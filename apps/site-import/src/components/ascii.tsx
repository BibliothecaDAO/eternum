import React, { useEffect, useMemo, useRef, useState } from "react";

interface AsciiArtProps {
  width?: number;
  height?: number;
  className?: string;
}

const CHAR_SETS: Record<string, string[]> = {
  minimal: [" ", ".", "·", "•", "○", "●"],
  geometric: [" ", "░", "▒", "▓", "█", "▪", "▫", "◆", "◇"],
  classic: [" ", ".", ":", "-", "=", "+", "*", "#", "%", "@"],
  complex: [" ", "·", "∴", "∵", "∷", "∶", "⋮", "⋯", "⋰", "⋱"],
  organic: [" ", "~", "≈", "∼", "∽", "∾", "∿", "≀", "≁", "≂"],
  matrix: [" ", "0", "1", "╱", "╲", "╳", "│", "─", "┼", "█"],
  runic: [" ", "ᚠ", "ᚢ", "ᚦ", "ᚨ", "ᚱ", "ᚲ", "ᚷ", "ᚹ", "ᚺ"],
  cosmic: [" ", "✦", "✧", "★", "☆", "✪", "✫", "✬", "✭", "✮"],
};

const PALETTES: Record<string, string[]> = {
  neon: ["#FF006E", "#FB5607", "#FFBE0B", "#8338EC", "#3A86FF"],
  sunset: ["#FF6B6B", "#F7B731", "#5F27CD", "#00D2D3", "#EE5A24"],
  ocean: ["#0A3D62", "#3C6382", "#60A3BC", "#82CCDD", "#B8E994"],
  cyberpunk: ["#00FF41", "#FF0080", "#00FFFF", "#FF00FF", "#FFFF00"],
  monochrome: ["#222", "#444", "#666", "#888", "#AAA", "#CCC", "#EEE"],
  fire: ["#FF0000", "#FF4500", "#FF6347", "#FF7F50", "#FFA500"],
  aurora: ["#00FF00", "#00FFFF", "#0080FF", "#8000FF", "#FF00FF"],
  void: ["#0A0A0A", "#1A1A1A", "#2A2A2A", "#3A3A3A", "#4A4A4A"],
};

const AsciiArt: React.FC<AsciiArtProps> = ({
  width = 80,
  height = 40,
  className = "",
}) => {
  const [art, setArt] = useState<string[][]>([]);
  const [colorMap, setColorMap] = useState<string[][]>([]);
  const [algorithm, setAlgorithm] = useState<string>("");
  const canvasRef = useRef<HTMLPreElement>(null);

  // Procedural generation algorithms
  const algorithms = useMemo(
    () => ({
    // Perlin-like noise simulation
    noise: () => {
      const chars =
        CHAR_SETS[
          Object.keys(CHAR_SETS)[
            Math.floor(Math.random() * Object.keys(CHAR_SETS).length)
          ]
        ];
      const palette =
        PALETTES[
          Object.keys(PALETTES)[
            Math.floor(Math.random() * Object.keys(PALETTES).length)
          ]
        ];
      const grid: string[][] = [];
      const colors: string[][] = [];
      const scale = 0.1 + Math.random() * 0.2;
      const time = Date.now() * 0.001;

      for (let y = 0; y < height; y++) {
        grid[y] = [];
        colors[y] = [];
        for (let x = 0; x < width; x++) {
          const noise =
            Math.sin(x * scale + time) * Math.cos(y * scale + time) +
            Math.sin((x + y) * scale * 0.5) * 0.5;
          const index = Math.floor((noise + 1) * 0.5 * chars.length);
          grid[y][x] = chars[Math.max(0, Math.min(chars.length - 1, index))];
          colors[y][x] = palette[Math.floor(Math.random() * palette.length)];
        }
      }
      return { grid, colors };
    },

    // Cellular automaton
    cellular: () => {
      const chars = CHAR_SETS.geometric;
      const palette =
        PALETTES[
          Object.keys(PALETTES)[
            Math.floor(Math.random() * Object.keys(PALETTES).length)
          ]
        ];
      const grid: string[][] = [];
      const colors: string[][] = [];

      // Initialize with random state
      for (let y = 0; y < height; y++) {
        grid[y] = [];
        colors[y] = [];
        for (let x = 0; x < width; x++) {
          grid[y][x] = Math.random() > 0.7 ? chars[chars.length - 1] : chars[0];
          colors[y][x] = palette[Math.floor(Math.random() * palette.length)];
        }
      }

      // Apply cellular automaton rules
      const iterations = 3 + Math.floor(Math.random() * 3);
      for (let i = 0; i < iterations; i++) {
        const newGrid = grid.map((row) => [...row]);
        for (let y = 1; y < height - 1; y++) {
          for (let x = 1; x < width - 1; x++) {
            let neighbors = 0;
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                if (grid[y + dy][x + dx] !== chars[0]) neighbors++;
              }
            }
            if (neighbors < 2 || neighbors > 3) {
              newGrid[y][x] = chars[0];
            } else if (neighbors === 3) {
              newGrid[y][x] =
                chars[Math.floor(Math.random() * (chars.length - 1)) + 1];
            }
          }
        }
        grid.forEach((row, y) =>
          row.forEach((_, x) => (grid[y][x] = newGrid[y][x]))
        );
      }
      return { grid, colors };
    },

    // Fractal patterns
    fractal: () => {
      const chars =
        CHAR_SETS[
          Object.keys(CHAR_SETS)[
            Math.floor(Math.random() * Object.keys(CHAR_SETS).length)
          ]
        ];
      const palette =
        PALETTES[
          Object.keys(PALETTES)[
            Math.floor(Math.random() * Object.keys(PALETTES).length)
          ]
        ];
      const grid: string[][] = [];
      const colors: string[][] = [];
      const cx = -0.7 + Math.random() * 0.4;
      const cy = 0.27015 + Math.random() * 0.1;
      const zoom = 0.004 + Math.random() * 0.002;

      for (let y = 0; y < height; y++) {
        grid[y] = [];
        colors[y] = [];
        for (let x = 0; x < width; x++) {
          let zx = (x - width / 2) * zoom;
          let zy = (y - height / 2) * zoom;
          let i = 0;
          const maxIter = 50 + Math.floor(Math.random() * 50);

          while (zx * zx + zy * zy < 4 && i < maxIter) {
            const tmp = zx * zx - zy * zy + cx;
            zy = 2 * zx * zy + cy;
            zx = tmp;
            i++;
          }

          const charIndex = Math.floor((i / maxIter) * chars.length);
          grid[y][x] = chars[Math.min(charIndex, chars.length - 1)];
          colors[y][x] = palette[Math.floor((i / maxIter) * palette.length)];
        }
      }
      return { grid, colors };
    },

    // Wave interference patterns
    waves: () => {
      const chars =
        CHAR_SETS[
          Object.keys(CHAR_SETS)[
            Math.floor(Math.random() * Object.keys(CHAR_SETS).length)
          ]
        ];
      const palette =
        PALETTES[
          Object.keys(PALETTES)[
            Math.floor(Math.random() * Object.keys(PALETTES).length)
          ]
        ];
      const grid: string[][] = [];
      const colors: string[][] = [];
      const sources = Array.from(
        { length: 2 + Math.floor(Math.random() * 3) },
        () => ({
          x: Math.random() * width,
          y: Math.random() * height,
          frequency: 0.1 + Math.random() * 0.3,
          amplitude: 0.5 + Math.random() * 0.5,
          phase: Math.random() * Math.PI * 2,
        })
      );

      for (let y = 0; y < height; y++) {
        grid[y] = [];
        colors[y] = [];
        for (let x = 0; x < width; x++) {
          let value = 0;
          sources.forEach((source) => {
            const distance = Math.sqrt(
              (x - source.x) ** 2 + (y - source.y) ** 2
            );
            value +=
              source.amplitude *
              Math.sin(distance * source.frequency + source.phase);
          });
          value = (value / sources.length + 1) * 0.5;
          const charIndex = Math.floor(value * chars.length);
          grid[y][x] =
            chars[Math.max(0, Math.min(chars.length - 1, charIndex))];
          colors[y][x] = palette[Math.floor(value * palette.length)];
        }
      }
      return { grid, colors };
    },

    // Voronoi diagram
    voronoi: () => {
      const chars =
        CHAR_SETS[
          Object.keys(CHAR_SETS)[
            Math.floor(Math.random() * Object.keys(CHAR_SETS).length)
          ]
        ];
      const palette =
        PALETTES[
          Object.keys(PALETTES)[
            Math.floor(Math.random() * Object.keys(PALETTES).length)
          ]
        ];
      const grid: string[][] = [];
      const colors: string[][] = [];
      const points = Array.from(
        { length: 10 + Math.floor(Math.random() * 20) },
        () => ({
          x: Math.random() * width,
          y: Math.random() * height,
          char: chars[Math.floor(Math.random() * chars.length)],
          color: palette[Math.floor(Math.random() * palette.length)],
        })
      );

      for (let y = 0; y < height; y++) {
        grid[y] = [];
        colors[y] = [];
        for (let x = 0; x < width; x++) {
          let minDist = Infinity;
          let closestPoint = points[0];

          points.forEach((point) => {
            const dist = Math.sqrt((x - point.x) ** 2 + (y - point.y) ** 2);
            if (dist < minDist) {
              minDist = dist;
              closestPoint = point;
            }
          });

          const edgeDist = points.reduce((min, point) => {
            if (point === closestPoint) return min;
            const dist = Math.sqrt((x - point.x) ** 2 + (y - point.y) ** 2);
            return Math.min(min, dist - minDist);
          }, Infinity);

          if (edgeDist < 1.5) {
            grid[y][x] = chars[chars.length - 1];
            colors[y][x] = "#FFFFFF";
          } else {
            grid[y][x] = closestPoint.char;
            colors[y][x] = closestPoint.color;
          }
        }
      }
      return { grid, colors };
    },

    // Spiral galaxy
    spiral: () => {
      const chars = CHAR_SETS.cosmic;
      const palette = PALETTES.aurora;
      const grid: string[][] = [];
      const colors: string[][] = [];
      const centerX = width / 2;
      const centerY = height / 2;
      const arms = 2 + Math.floor(Math.random() * 4);
      const tightness = 0.1 + Math.random() * 0.3;

      for (let y = 0; y < height; y++) {
        grid[y] = [];
        colors[y] = [];
        for (let x = 0; x < width; x++) {
          const dx = x - centerX;
          const dy = y - centerY;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const angle = Math.atan2(dy, dx);

          let intensity = 0;
          for (let arm = 0; arm < arms; arm++) {
            const armAngle = (arm * 2 * Math.PI) / arms + distance * tightness;
            const angleDiff = Math.abs(
              ((angle - armAngle + Math.PI) % (2 * Math.PI)) - Math.PI
            );
            const armIntensity =
              Math.exp(-angleDiff * angleDiff * 10) *
              Math.exp(-distance * 0.05);
            intensity += armIntensity;
          }

          intensity += Math.exp(-distance * 0.1) * 0.5; // Central bulge
          intensity *= 1 + Math.random() * 0.3; // Add some noise

          const charIndex = Math.floor(intensity * chars.length);
          grid[y][x] =
            chars[Math.max(0, Math.min(chars.length - 1, charIndex))];
          colors[y][x] =
            palette[Math.floor(intensity * palette.length) % palette.length];
        }
      }
      return { grid, colors };
    },
    }),
    [height, width]
  );

  useEffect(() => {
    // Select random algorithm
    const algorithmNames = Object.keys(algorithms);
    const selectedAlgorithm =
      algorithmNames[Math.floor(Math.random() * algorithmNames.length)];
    setAlgorithm(selectedAlgorithm);

    // Generate art
    const { grid, colors } =
      algorithms[selectedAlgorithm as keyof typeof algorithms]();
    setArt(grid);
    setColorMap(colors);
  }, [algorithms]);

  // Animate on hover
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / (rect.width / width));
    const y = Math.floor((e.clientY - rect.top) / (rect.height / height));

    if (x >= 0 && x < width && y >= 0 && y < height && art[y] && art[y][x]) {
      const newArt = [...art];
      const chars = art[y][x] === " " ? "·" : " ";
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const ny = y + dy;
          const nx = x + dx;
          if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
            newArt[ny][nx] = chars;
          }
        }
      }
      setArt(newArt);
    }
  };

  return (
    <div className={`relative ${className}`}>
      <pre
        ref={canvasRef}
        className="font-mono text-xs leading-none select-none cursor-crosshair overflow-hidden"
        onMouseMove={handleMouseMove}
        style={{
          lineHeight: "1",
          letterSpacing: "0.1em",
        }}
      >
        {art.map((row, y) => (
          <div key={y} className="whitespace-pre">
            {row.map((char, x) => (
              <span
                key={x}
                style={{
                  color: colorMap[y]?.[x] || "#888",
                  textShadow: colorMap[y]?.[x]
                    ? `0 0 10px ${colorMap[y][x]}`
                    : "none",
                }}
              >
                {char}
              </span>
            ))}
          </div>
        ))}
      </pre>
      <div className="absolute bottom-2 right-2 text-xs opacity-50">
        {algorithm}
      </div>
    </div>
  );
};

export default AsciiArt;
