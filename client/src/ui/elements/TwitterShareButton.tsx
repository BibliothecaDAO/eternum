import { ReactComponent as TwitterIcon } from "@/assets/icons/twitter.svg";
import React from "react";
import Button from "./Button";

interface Props {
  text: string;
  className?: string;
  callToActionText?: string;
  buttonSize?: "xs" | "md";
  variant?: "primary" | "secondary" | "opaque";
}

const TwitterShareButton: React.FC<Props> = ({
  text,
  className,
  callToActionText,
  buttonSize = "md",
  variant = "primary",
}) => {
  const [hover, setHover] = React.useState(false);

  const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;

  const iconSizeClasses = {
    xs: "h-3 w-3",
    md: "h-4 w-4",
  };

  return (
    <a href={tweetUrl} target="_blank" rel="noopener noreferrer">
      <Button
        className={className}
        size={buttonSize}
        onPointerEnter={() => setHover(true)}
        onPointerLeave={() => setHover(false)}
        variant={variant}
      >
        <div className={`flex items-center justify-center mr-2 ${iconSizeClasses[buttonSize]}`}>
          <TwitterIcon className={`${hover ? "text-brown" : "text-gold"} transition-all duration-300`} />
        </div>
        <span>{callToActionText ? callToActionText : "Share on X"}</span>
      </Button>
    </a>
  );
};

export default TwitterShareButton;
