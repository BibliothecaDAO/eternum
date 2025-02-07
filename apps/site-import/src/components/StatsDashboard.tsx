import React from "react";

interface StatCardProps {
  title: string;
  value: string | number;
}

export const StatCard: React.FC<StatCardProps> = ({ title, value }) => {
  return (
    <div className="p-6 backdrop-blur-md bg-black/20 border-white/10 rounded-lg hover:bg-black/30 transition-all duration-300">
      <h3 className="text-lg font-medium text-muted-foreground uppercase tracking-wider pb-4">
        {title}
      </h3>
      <p className="text-5xl font-bold">{value}</p>
    </div>
  );
};

export const StatsDashboard: React.FC = () => {
  // Example dynamic stats; replace these with actual data as needed.
  const stats = [
    { title: "Users", value: 2042 },
    { title: "Revenue", value: "$12,345" },
    { title: "Orders", value: 128 },
    { title: "Visits", value: 5432 },
    { title: "Conversions", value: "8%" },
    { title: "Feedback", value: 76 },
    { title: "Subscribers", value: 305 },
    { title: "Pageviews", value: 7890 },
  ];

  return (
    <div className="p-4 space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <StatCard key={index} title={stat.title} value={stat.value} />
        ))}
      </div>
    </div>
  );
};
