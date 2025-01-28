import { ReactComponent as HomeIcon } from "@/assets/icons/home.svg";
import Button from "@/ui/elements/button";
import { useNavigate } from "react-router-dom";

export const HomeButton = () => {
  const navigate = useNavigate();

  const handleHomeClick = () => {
    navigate("/");
  };

  return (
    <Button
      onClick={handleHomeClick}
      className="!h-8 !w-10 normal-case font-normal flex items-center justify-center rounded-md !text-md !px-3 !text-black shadow-[0px_4px_4px_0px_#00000040] border border-[0.5px] !border-[#F5C2971F] backdrop-blur-xs !text-gold !bg-[#0000007A] hover:scale-105 hover:-translate-y-1 hover:!opacity-80"
      variant="default"
    >
      <HomeIcon className="!w-5 !h-5 fill-gold text-gold" />
    </Button>
  );
};
