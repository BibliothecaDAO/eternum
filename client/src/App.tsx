import "./index.css";
import "react-toastify/dist/ReactToastify.css";
import { World } from "./ui/layouts/World";
import { ToastContainer } from "react-toastify";
import useUIStore from "./hooks/store/useUIStore";
import { useEffect } from "react";
import { Hexagon } from "./types";

function App() {
  return (
    <div className="relative w-screen h-screen bg-brown">
      <ToastContainer style={{ zIndex: 1100 }} />
      <World />
    </div>
  );
}

export default App;
