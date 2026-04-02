import { useNavigate } from "react-router-dom";
import { useBootDocumentState } from "@/ui/modules/boot-loader";
import { FactoryV2Content } from "../components/factory-v2-content";
import { FactoryV2Header } from "../components/factory-v2-header";
import { FactoryV2Shell } from "../components/factory-v2-shell";

export const FactoryV2Page = () => {
  useBootDocumentState("app-ready");

  const navigate = useNavigate();

  return (
    <FactoryV2Shell>
      <FactoryV2Header onBack={() => navigate("/")} onOpenLegacy={() => navigate("/factory")} />
      <FactoryV2Content />
    </FactoryV2Shell>
  );
};
