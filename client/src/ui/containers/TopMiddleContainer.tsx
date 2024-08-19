const TopMiddleContainer = ({ children }: { children: React.ReactNode }) => {
  return <div className="absolute flex justify-center top-0 w-full z-20">{children}</div>;
};

export default TopMiddleContainer;
