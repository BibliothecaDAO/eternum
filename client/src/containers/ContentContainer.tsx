const ContentContainer = ({ children }: { children: React.ReactNode }) => {
  return <div className="absolute w-[420px] left-6 bottom-10 h-[calc(100vh-14.5rem)] root-container">{children}</div>;
};

export default ContentContainer;
