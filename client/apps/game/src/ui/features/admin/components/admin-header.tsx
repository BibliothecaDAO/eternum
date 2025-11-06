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
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition-colors group font-medium"
        >
          <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Back to Home
        </button>

        <button
          onClick={onReload}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 border-2 border-slate-300 hover:border-slate-400 rounded-xl transition-all shadow-sm hover:shadow"
          title="Clear all loading states and refresh data"
        >
          <RefreshCw className="w-4 h-4" />
          Reload
        </button>
      </div>

      <div className="space-y-4">
        <h1 className="text-6xl font-bold text-slate-900 tracking-tight leading-tight">Charlie's Chocolate Factory</h1>
        <div className="px-4 py-2 w-fit bg-slate-50 rounded-xl border border-slate-200">
          <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">Network: {network}</span>
        </div>
      </div>
    </div>
  );
};
