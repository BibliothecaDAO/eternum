import React, { useEffect, useState } from "react";
import { Blurhash } from "react-blurhash";

export type BlurryLoadingImageProps = {
  src: string;
  blurhash: string;
  height?: string;
  width?: string;
  imageStyleClass?: string;
  divStyleClass?: string;
  bgColor?: string;
};

const BlurryLoadingImage = ({
  src,
  blurhash,
  height,
  width,
  imageStyleClass = "",
  divStyleClass = "",
  bgColor = "transparent",
}: BlurryLoadingImageProps) => {
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchImage = (src: string) => {
    const loadingImage = new Image();
    loadingImage.src = src;
    loadingImage.onload = () => {
      setCurrentImage(src);
      setLoading(false);
    };
  };

  useEffect(() => {
    fetchImage(src);
  }, [src]); // Add src as a dependency to re-run effect if src changes

  return (
    <div className={divStyleClass} style={{ overflow: "hidden", backgroundColor: bgColor }}>
      {loading || !currentImage ? (
        <Blurhash hash={blurhash} width={width} height={height} className={imageStyleClass} />
      ) : (
        <img
          src={currentImage}
          style={{
            width: width,
            height: height,
            transition: "1s filter linear",
          }}
          className={imageStyleClass}
          alt=""
        />
      )}
    </div>
  );
};

export default BlurryLoadingImage;
