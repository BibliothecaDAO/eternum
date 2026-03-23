import { Tabs } from "@/ui/design-system/atoms";
import { AmmPoolList } from "./amm-pool-list";
import { AmmSwap } from "./amm-swap";
import { AmmAddLiquidity } from "./amm-add-liquidity";
import { AmmRemoveLiquidity } from "./amm-remove-liquidity";
import { AmmTradeHistory } from "./amm-trade-history";
import { AmmPriceChart } from "./amm-price-chart";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

const AmmDashboardInner = () => {
  const [selectedTab, setSelectedTab] = useState(0);

  const tabs = useMemo(
    () => [
      {
        key: "swap",
        label: (
          <div className="flex relative group flex-col items-center">
            <div>Swap</div>
          </div>
        ),
        component: <AmmSwap />,
      },
      {
        key: "liquidity",
        label: (
          <div className="flex relative group flex-col items-center">
            <div>Liquidity</div>
          </div>
        ),
        component: (
          <div>
            <AmmAddLiquidity />
            <AmmRemoveLiquidity />
          </div>
        ),
      },
      {
        key: "history",
        label: (
          <div className="flex relative group flex-col items-center">
            <div>History</div>
          </div>
        ),
        component: <AmmTradeHistory />,
      },
    ],
    [],
  );

  return (
    <div className="min-h-screen bg-dark text-gold">
      <header className="flex items-center justify-between p-4 border-b border-gold/20">
        <Link to="/" className="text-gold hover:text-gold/80 transition-colors">
          &larr; Back
        </Link>
        <h1 className="text-xl font-bold">Eternum AMM</h1>
        <div>{/* wallet connect placeholder */}</div>
      </header>

      <div className="flex h-[calc(100vh-64px)]">
        <aside className="w-64 border-r border-gold/20 overflow-y-auto">
          <AmmPoolList />
        </aside>

        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl mx-auto">
            <Tabs selectedIndex={selectedTab} onChange={(index: number) => setSelectedTab(index)} className="h-full">
              <Tabs.List>
                {tabs.map((tab, index) => (
                  <Tabs.Tab key={index}>{tab.label}</Tabs.Tab>
                ))}
              </Tabs.List>
              <Tabs.Panels className="overflow-hidden mt-4">
                {tabs.map((tab, index) => (
                  <Tabs.Panel key={index} className="h-full">
                    {tab.component}
                  </Tabs.Panel>
                ))}
              </Tabs.Panels>
            </Tabs>

            <div className="mt-6">
              <AmmPriceChart />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

const AmmDashboard = () => {
  const queryClient = useMemo(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }), []);

  return (
    <QueryClientProvider client={queryClient}>
      <AmmDashboardInner />
    </QueryClientProvider>
  );
};

export default AmmDashboard;
