import { useState, useEffect } from "react";

interface DocumentWithFullscreen extends HTMLDocument {
  mozFullScreenElement?: Element;
  msFullscreenElement?: Element;
  webkitFullscreenElement?: Element;
  msExitFullscreen?: () => void;
  mozCancelFullScreen?: () => void;
  webkitExitFullscreen?: () => void;
}

interface DocumentElementWithFullscreen extends HTMLElement {
  msRequestFullscreen?: () => void;
  mozRequestFullScreen?: () => void;
  webkitRequestFullscreen?: () => void;
}

const getOrientation = () => window.screen?.orientation?.type;

const useScreenOrientation = () => {
  const [orientation, setOrientation] = useState<OrientationType>();

  const updateOrientation = (_event: any) => {
    setOrientation(getOrientation());
  };
  const isFullScreen = () => {
    const doc = document as DocumentWithFullscreen;
    return !!(
      doc.fullscreenElement ||
      doc.mozFullScreenElement ||
      doc.webkitFullscreenElement ||
      doc.msFullscreenElement
    );
  };

  const requestFullScreenLandscape = (
    element: DocumentElementWithFullscreen,
  ) => {
    // (A1) GO INTO FULL SCREEN FIRST
    if (element.requestFullscreen) {
      element.requestFullscreen();
    } else if (element.msRequestFullscreen) {
      element.msRequestFullscreen();
    } else if (element.webkitRequestFullscreen) {
      element.webkitRequestFullscreen();
    } else if (element.mozRequestFullScreen) {
      element.mozRequestFullScreen();
    }

    // (A2) THEN LOCK ORIENTATION
    // screen.orientation.lock("landscape").catch((e: any) => {
    //   console.log(e);
    // });
  };

  const exitFullScreen = (doc: DocumentWithFullscreen) => {
    if (doc.exitFullscreen) {
      doc.exitFullscreen();
    } else if (doc.msExitFullscreen) {
      doc.msExitFullscreen();
    } else if (doc.webkitExitFullscreen) {
      doc.webkitExitFullscreen();
    } else if (doc.mozCancelFullScreen) {
      doc.mozCancelFullScreen();
    }
  };

  const toggleFullScreen = () => {
    if (!isFullScreen()) {
      requestFullScreenLandscape(document.documentElement);
    } else {
      exitFullScreen(document);
    }
  };

  useEffect(() => {
    setOrientation(getOrientation());
    window.addEventListener("orientationchange", updateOrientation);
    return () => {
      window.removeEventListener("orientationchange", updateOrientation);
    };
  }, []);

  return { orientation, toggleFullScreen, isFullScreen };
};

export default useScreenOrientation;
