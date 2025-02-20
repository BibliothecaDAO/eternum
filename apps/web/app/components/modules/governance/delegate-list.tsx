import { DelegateCard } from "./delegate-card";

function DelegateList({ delegates }: { delegates: any[] }) {
  return (
    <div className="grid grid-cols-1 gap-6 p-4 md:grid-cols-2 lg:grid-cols-3">
      {delegates.map((delegate) => (
        <DelegateCard key={delegate.id} delegate={delegate} />
      ))}
    </div>
  );
}

export default DelegateList;
