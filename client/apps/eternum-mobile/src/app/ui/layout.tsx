import { Footer } from "@/widgets/footer";
import { Header } from "@/widgets/header";
import { Outlet } from "@tanstack/react-router";

export function Layout() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 pb-20">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
