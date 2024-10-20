import { Bridge } from "../modules/bridge";
import { Data } from "../modules/data";
import { SeasonPassRow } from "../modules/season-pass-row";
import { Sidebar } from "../modules/sidebar";

export const DashboardLayout = () => {
  return (
    <div className="flex gap-4 p-8">
      <Sidebar />
      <div className="flex-1 p-4 border rounded-lg h-screen">
        <SeasonPassRow />
        <Data />
        <Bridge />
      </div>
    </div>
  );
};
