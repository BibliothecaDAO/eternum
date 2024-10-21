import { Link } from "@tanstack/react-router";
import { Button } from "../ui/button";

export const Sidebar = () => {
  return (
    <div className="flex flex-col w-48">
      <Link to="/" className="[&.active]:font-bold">
        <Button variant="ghost">Dashboard</Button>
      </Link>{" "}
      <Link to="/passes" className="[&.active]:font-bold">
        <Button variant="ghost">Passes</Button>
      </Link>
      <Link to="/trade" className="[&.active]:font-bold">
        <Button variant="ghost">Trade</Button>
      </Link>
      <Link to="/bridge" className="[&.active]:font-bold">
        <Button variant="ghost">Bridge</Button>
      </Link>
    </div>
  );
};
