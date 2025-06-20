import { ReactComponent as TwitterIcon } from "@/assets/icons/twitter.svg";
import Button from "@/ui/design-system/atoms/button";
import React from "react";

interface Props {
  text: string;
  className?: string;
  callToActionText?: string;
  buttonSize?: "xs" | "md";
  variant?: "primary" | "secondary" | "success" | "red" | "danger" | "default" | "outline" | "opaque";
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
          <TwitterIcon className={`${hover ? "animate-pulse" : ""} transition-all duration-300`} />
        </div>
        <span>{callToActionText ? callToActionText : "Share"}</span>
      </Button>
    </a>
  );
};

export default TwitterShareButton;
