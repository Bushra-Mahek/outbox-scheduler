
const StatsCards = ({ scheduledCount, sentCount }) => {
  const stats = [
    { label: "Scheduled emails", value: scheduledCount },
    { label: "Successfully sent", value: sentCount },
    { label: "Total emails", value: scheduledCount + sentCount }
  ];

  return (
    <section className="stats">
      {stats.map((stat) => (
        <div className="stat-card" key={stat.label}>
          <span>{stat.label}</span>
          <h2>{stat.value}</h2>
        </div>
      ))}
    </section>
  );
};

export default StatsCards;
