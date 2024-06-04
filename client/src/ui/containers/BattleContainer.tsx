export const BattleContainer = ({ children }: { children: React.ReactNode }) => {
  return <div className="w-screen h-screen z-[200] bg-transparent top-0 left-0 absolute">{children}</div>;
};
