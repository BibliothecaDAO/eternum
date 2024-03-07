import { useEffect, useState } from "react";

export type TimeoutImageProps = {
  image: string;
  alt?: string;
  imageStyleClass?: string;
  divStyleClass?: string;
  bgColor?: string;
};

const TimeoutImage = ({
  image,
  alt = "",
  imageStyleClass = "",
  divStyleClass = "",
  bgColor = "transparent",
}: TimeoutImageProps) => {
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [_, setLoading] = useState(true);

  const fetchImage = (src: string) => {
    const loadingImage = new Image();
    loadingImage.src = src;
    loadingImage.onload = () => {
      setTimeout(() => {
        setCurrentImage(loadingImage.src);
        setLoading(false);
      }, 2000);
    };
  };

  useEffect(() => {
    fetchImage(image);
  }, []);

  return (
    <div className={divStyleClass} style={{ overflow: "hidden" }}>
      {currentImage && (
        <img
          style={{
            width: "100%",
            background: bgColor,
          }}
          src={currentImage}
          alt={alt}
          className={imageStyleClass}
        />
      )}
      {!currentImage && (
        <img
          style={{
            width: "100%",
            background: bgColor,
          }}
          alt={alt}
          className={imageStyleClass}
        />
      )}
    </div>
  );
};

export default TimeoutImage;
