import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./index.css";
import { World } from "./ui/layouts/World";

function App({ backgroundImage }: { backgroundImage: string }) {
  return (
    <>
      <ToastContainer style={{ zIndex: 1100 }} />
      <World backgroundImage={backgroundImage} />
    </>
  );
}

export default App;
