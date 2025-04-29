import React, { useEffect, useRef, useState } from "react";
import { hexToPixel, pixelToHex } from "../lib/hex-utils";
import { HexLocation } from "../model/types";

interface HexagonCanvasProps {
  width: number;
  height: number;
  hexSize: number;
  availableLocations: HexLocation[];
  occupiedLocations: HexLocation[];
  selectedLocation: HexLocation | null;
  onHexClick: (col: number, row: number) => void;
  center?: [number, number];
}

export function HexagonCanvas({
  width,
  height,
  hexSize,
  availableLocations,
  occupiedLocations,
  selectedLocation,
  onHexClick,
  center = [0, 0],
}: HexagonCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [hoveredHex, setHoveredHex] = useState<HexLocation | null>(null);
  const [images, setImages] = useState<{
    neutral: HTMLImageElement;
    selected: HTMLImageElement;
    occupied: HTMLImageElement;
    hovered: HTMLImageElement;
  } | null>(null);

  // Canvas offset for panning
  const [offset, setOffset] = useState(() => {
    const [centerCol, centerRow] = center;
    const { x, y } = hexToPixel({ col: centerCol, row: centerRow }, hexSize);
    return { x: -x, y: -y };
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Gap factor between hexes (0.9 means 10% gap, 0.95 means 5% gap, etc.)
  const gapFactor = 1.1;
  const imgSize = hexSize * 2 * gapFactor;

  console.log(occupiedLocations);

  // Load images
  useEffect(() => {
    const loadImages = async () => {
      const neutralImg = new Image();
      const selectedImg = new Image();
      const occupiedImg = new Image();
      const hoveredImg = new Image();

      const loadPromise = Promise.all([
        new Promise((resolve) => {
          neutralImg.onload = resolve;
          neutralImg.src = "/images/hexes/neutral.png";
        }),
        new Promise((resolve) => {
          selectedImg.onload = resolve;
          selectedImg.src = "/images/hexes/selected.png";
        }),
        new Promise((resolve) => {
          occupiedImg.onload = resolve;
          occupiedImg.src = "/images/hexes/occupied.png";
        }),
        new Promise((resolve) => {
          hoveredImg.onload = resolve;
          hoveredImg.src = "/images/hexes/hovered.png";
        }),
      ]);

      await loadPromise;
      setImages({
        neutral: neutralImg,
        selected: selectedImg,
        occupied: occupiedImg,
        hovered: hoveredImg,
      });
    };

    loadImages();
  }, []);

  // Mouse down handler to start dragging
  const handleMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    event.stopPropagation();

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    setIsDragging(true);
    setDragStart({ x, y });
  };

  // Mouse move handler for dragging and hover
  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    if (isDragging) {
      event.stopPropagation();
      event.preventDefault();

      const dx = x - dragStart.x;
      const dy = y - dragStart.y;

      setOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
      setDragStart({ x, y });
    } else {
      // Handle hover
      const adjustedX = x - width / 2 - offset.x;
      const adjustedY = y - height / 2 - offset.y;
      const hex = pixelToHex(adjustedX, adjustedY, hexSize);

      // Check if the hex is available and not occupied
      const isAvailable = availableLocations.some((loc) => loc.col === hex.col && loc.row === hex.row);
      const isOccupied = occupiedLocations.some((loc) => loc.col === hex.col && loc.row === hex.row);

      if (isAvailable && !isOccupied) {
        setHoveredHex(hex);
      } else {
        setHoveredHex(null);
      }
    }
  };

  // Mouse up and leave handlers
  const handleMouseUp = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging) {
      event.stopPropagation();
      event.preventDefault();
    }
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
    setHoveredHex(null);
  };

  // Touch event handlers
  const handleTouchStart = (event: React.TouchEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || event.touches.length !== 1) return;
    event.stopPropagation();

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const touch = event.touches[0];

    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    setIsDragging(true);
    setDragStart({ x, y });
  };

  const handleTouchMove = (event: React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDragging || !canvasRef.current || event.touches.length !== 1) return;
    event.stopPropagation();

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const touch = event.touches[0];

    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    const dx = x - dragStart.x;
    const dy = y - dragStart.y;

    setOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
    setDragStart({ x, y });
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLCanvasElement>) => {
    if (isDragging) {
      event.stopPropagation();
    }
    setIsDragging(false);
  };

  // Click handler
  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging) {
      event.stopPropagation();
      return;
    }

    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const adjustedX = x - width / 2 - offset.x;
    const adjustedY = y - height / 2 - offset.y;

    const hex = pixelToHex(adjustedX, adjustedY, hexSize);

    const isAvailable = availableLocations.some((loc) => loc.col === hex.col && loc.row === hex.row);
    const isOccupied = occupiedLocations.some((loc) => loc.col === hex.col && loc.row === hex.row);

    if (isAvailable && !isOccupied) {
      onHexClick(hex.col, hex.row);
    }
  };

  // Draw the hexagon grid
  const drawHexGrid = () => {
    const canvas = canvasRef.current;
    if (!canvas || !images) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Center the grid and apply offset
    ctx.translate(width / 2 + offset.x, height / 2 + offset.y);

    // Draw hexagons
    availableLocations.forEach((hex) => {
      const { x, y } = hexToPixel(hex, hexSize);
      const isSelected = selectedLocation && hex.col === selectedLocation.col && hex.row === selectedLocation.row;
      const isOccupied = occupiedLocations.some((loc) => loc.col === hex.col && loc.row === hex.row);
      const isHovered = hoveredHex && hex.col === hoveredHex.col && hex.row === hoveredHex.row;

      // Select the appropriate image based on the hex state
      let image: HTMLImageElement;
      if (isSelected) {
        image = images.selected;
      } else if (isOccupied) {
        image = images.occupied;
      } else if (isHovered) {
        image = images.hovered;
      } else {
        image = images.neutral;
      }

      // Draw the image
      ctx.drawImage(image, x - imgSize / 2, y - imgSize / 2, imgSize, imgSize);

      // Draw coordinates
      ctx.fillStyle = "#ffffff";
      ctx.font = `${hexSize / 4}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${hex.col},${hex.row}`, x, y);
    });

    // Reset transformation
    ctx.resetTransform();

    // Draw drag indicator when dragging
    if (isDragging) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.1)";
      ctx.fillRect(0, 0, 60, 30);
      ctx.fillStyle = "#fff";
      ctx.font = "12px Arial";
      ctx.fillText("Dragging", 30, 20);
    }
  };

  // Animation loop
  const animate = () => {
    drawHexGrid();
    animationFrameRef.current = requestAnimationFrame(animate);
  };

  // Setup and cleanup
  useEffect(() => {
    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [
    availableLocations,
    occupiedLocations,
    selectedLocation,
    width,
    height,
    hexSize,
    offset,
    isDragging,
    hoveredHex,
    images,
  ]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      onClick={handleCanvasClick}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className={`border border-gray-300 rounded-md ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
      style={{ touchAction: "none" }}
    />
  );
}
