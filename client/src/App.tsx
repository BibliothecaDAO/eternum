import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./index.css";
import { World } from "./ui/layouts/World";

import GameRenderer from "./three/GameRenderer";

// function App() {
function App({ graphic }: { graphic: GameRenderer }) {
  return (
    <>
      <ToastContainer style={{ zIndex: 1100 }} />
      {/* <World /> */}
      <World graphic={graphic} />
    </>
  );
}

export default App;
