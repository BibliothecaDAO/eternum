import { ChevronLeft, RefreshCw } from "lucide-react";

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
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-gold bg-brown/50 hover:bg-brown/70 border border-gold/30 hover:border-gold/50 rounded-xl transition-all"
          title="Clear all loading states and refresh data"
        >
          <RefreshCw className="w-4 h-4" />
          Reload
        </button>
      </div>

      <div className="space-y-4">
        <h1 className="text-6xl font-bold text-gold tracking-tight leading-tight">Charlie's Chocolate Factory</h1>
        <div className="px-4 py-2 w-fit bg-brown/50 rounded-xl border border-gold/30">
          <span className="text-xs font-bold text-gold/70 uppercase tracking-wide">Network: {network}</span>
        </div>
      </div>
    </div>
  );
};
