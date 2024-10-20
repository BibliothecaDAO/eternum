import { Link } from "@tanstack/react-router";

export const Sidebar = () => {
  return (
    <div className="flex flex-col w-48">
      <Link to="/" className="[&.active]:font-bold">
        Dashboard
      </Link>{" "}
      <Link to="/passes" className="[&.active]:font-bold">
        Passes
      </Link>
    </div>
  );
};
