import { ReactComponent as TwitterIcon } from "@/assets/icons/twitter.svg";
import React from "react";
import Button from "./Button";

interface Props {
  text: string;
  className?: string;
  callToActionText?: string;
}

const TwitterShareButton: React.FC<Props> = ({ text, className, callToActionText }) => {
  const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;

  return (
    <a href={tweetUrl} target="_blank" rel="noopener noreferrer">
      <Button className={`flex flex-row gap-0 sm:gap-5 items-center h-4 sm:h-6 + ${className}`}>
        <div className="w-6 h-6 flex items-center justify-center">
          <TwitterIcon className="h-5 sm:h-7" />
        </div>
        {callToActionText ? callToActionText : `Share to Twitter`}
      </Button>
    </a>
  );
};

export default TwitterShareButton;
