export const TypeH1 = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  return (
    <h1 className={`scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl ${className || ""}`}>{children}</h1>
  );
};
