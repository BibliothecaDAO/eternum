import { TypeH1 } from "../typography/type-h1";
import { Button } from "../ui/button";

export const TopNavigation = () => {
  return (
    <div className="flex justify-between items-center">
      <TypeH1>Season 0</TypeH1>
      <div className="flex gap-2">
        <Button> Login</Button>
        <Button> Login</Button>
      </div>
    </div>
  );
};
