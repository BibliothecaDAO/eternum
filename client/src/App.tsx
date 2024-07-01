import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./index.css";
import { World } from "./ui/layouts/World";

function App() {
  return (
    <>
      <ToastContainer style={{ zIndex: 1100 }} />
      <World />
    </>
  );
}

export default App;
