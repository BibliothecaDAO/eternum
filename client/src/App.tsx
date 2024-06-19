import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./index.css";
import { World } from "./ui/layouts/World";

function App() {
  return (
    <div className="relative w-screen h-screen bg-brown">
      <ToastContainer style={{ zIndex: 1100 }} />
      <World />
    </div>
  );
}

export default App;
