export const TopContainer = ({ children }: { children: React.ReactNode }) => {
  return <div className="absolute flex justify-center top-0 w-full">{children}</div>;
};

export default TopContainer;
