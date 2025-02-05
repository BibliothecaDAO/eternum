import { Footer } from "@/widgets/footer";
import { Header } from "@/widgets/header";
import { ReactNode } from "react";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 pb-20">{children}</main>
      <Footer />
    </div>
  );
}
