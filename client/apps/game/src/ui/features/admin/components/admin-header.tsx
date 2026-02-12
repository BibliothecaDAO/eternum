import ChevronLeft from "lucide-react/dist/esm/icons/chevron-left";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";

interface AdminHeaderProps {
  network: string;
  onBack: () => void;
  onReload: () => void | Promise<void>;
}

export const AdminHeader = ({ network, onBack, onReload }: AdminHeaderProps) => {
  return (
    <div className="mb-16">
      <div className="flex items-center justify-between mb-12">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm text-gold/70 hover:text-gold transition-colors group font-medium"
        >
          <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Back to Home
        </button>

        <button
          onClick={onReload}
          className="button-wood inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-gold bg-black/40 hover:bg-gold/10 border border-gold/30 rounded-xl transition-all shadow-sm hover:shadow"
          title="Clear all loading states and refresh data"
        >
          <RefreshCw className="w-4 h-4" />
          Reload
        </button>
      </div>

      <div className="space-y-4">
        <h1 className="text-5xl md:text-6xl font-cinzel font-bold text-gold tracking-tight leading-tight">
          Charlie&apos;s Chocolate Factory
        </h1>
        <div className="panel-wood px-4 py-2 w-fit rounded-xl border border-gold/20">
          <span className="text-xs font-bold text-gold/70 uppercase tracking-wide">Network: {network}</span>
        </div>
      </div>
    </div>
  );
};
