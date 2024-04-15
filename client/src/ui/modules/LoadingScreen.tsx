import "../../index.css";

export const LoadingScreen = () => {
  return (
    <div className="relative h-screen w-screen">
      <img className="absolute h-screen w-screen object-cover" src="/images/cover-3.jpeg" alt="" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-2xl  text-center bg-brown p-10 text-gold border-y-2 border-gradient">
        World Loading
        <span className="dot">.</span>
        <span className="dot">.</span>
        <span className="dot">.</span>
      </div>
    </div>
  );
};
