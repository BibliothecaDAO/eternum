const BottomMiddleContainer = ({ children }: { children: React.ReactNode }) => {
  return <div className="absolute w-screen bottom-1 flex pointer-events-none">{children}</div>;
};

export default BottomMiddleContainer;
