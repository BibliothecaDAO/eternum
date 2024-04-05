export const TopContainer = ({ children }: { children: React.ReactNode }) => {
  return <div className="absolute z-20  h-32 top-6 left-8 right-8 root-container">{children}</div>;
};

export default TopContainer;
