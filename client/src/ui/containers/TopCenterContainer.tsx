const TopCenterContainer = ({ children }: { children: React.ReactNode }) => {
  return <div className="absolute w-screen top-10 flex pointer-events-none z-20">{children}</div>;
};

export default TopCenterContainer;
