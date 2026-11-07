
const StatsCards = ({ scheduledCount = 0, sentCount = 0 }) => {
  const stats = [
    {
      label: "Scheduled Emails",
      value: scheduledCount,
      icon: "◷",
      description: "Emails waiting to be sent"
    },
    {
      label: "Sent Emails",
      value: sentCount,
      icon: "✓",
      description: "Successfully processed emails"
    },
    {
      label: "Total Emails",
      value: scheduledCount + sentCount,
      icon: "✉",
      description: "Total tracked emails"
    }
  ];

  return (
    <section className="stats-grid">
      {stats.map((stat) => (
        <article className="stat-card" key={stat.label}>
          <div className="stat-card-top">
            <span>{stat.label}</span>
            <span className="stat-icon">{stat.icon}</span>
          </div>

          <h3>{stat.value}</h3>
          <p>{stat.description}</p>
        </article>
      ))}
    </section>
  );
};

export default StatsCards;
