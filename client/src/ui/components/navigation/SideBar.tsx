interface SideBarProps {
  children: React.ReactNode;
}

export const SideBar = ({ children }: SideBarProps) => {
  return <div className="h-screen w-72 bg-white">{children}</div>;
};
