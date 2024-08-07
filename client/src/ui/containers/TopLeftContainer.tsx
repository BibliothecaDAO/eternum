const TopLeftContainer = ({ children }: { children: React.ReactNode }) => {
  return <div className="absolute top-0 left-0 pointer-events-auto">{children}</div>;
};

export default TopLeftContainer;
