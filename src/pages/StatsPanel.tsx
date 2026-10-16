import type { StatsSummary } from "../lib/stats";

export function StatsPanel(props: { stats: StatsSummary }): JSX.Element {
  const { stats } = props;
  const maxAverage = Math.max(5, ...stats.byTag.map((tag) => tag.averageLevel));
  return (
    <section className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Attempted" value={String(stats.attempted)} />
        <Stat label="Solved" value={String(stats.solved)} />
        <Stat label="Avg rung" value={stats.averageHintLevel.toFixed(1)} />
        <Stat label="Low-hint streak" value={String(stats.streak)} />
      </div>
      <div>
        <h2 className="font-semibold">Hint level by topic</h2>
        <p className="text-sm text-stone-600 dark:text-stone-300 mt-1">
          A topic is marked weak when more than half of at least two attempts needed rung 3 or higher.
        </p>
        <ul className="mt-3 space-y-2">
          {stats.byTag.length === 0 ? <li className="text-sm text-stone-500">No tags yet.</li> : null}
          {stats.byTag.map((tag) => (
            <li key={tag.tag}>
              <div className="flex justify-between text-sm">
                <span>
                  {tag.tag}
                  {tag.weak ? " · weak" : ""}
                </span>
                <span>{tag.averageLevel.toFixed(1)}</span>
              </div>
              <div className="h-2 rounded-full bg-stone-200 dark:bg-stone-700 mt-1">
                <div
                  className={tag.weak ? "h-2 rounded-full bg-rung" : "h-2 rounded-full bg-amber"}
                  style={{ width: `${Math.max(6, (tag.averageLevel / maxAverage) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h2 className="font-semibold">Recent</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {stats.recent.length === 0 ? <li className="text-stone-500">No history yet.</li> : null}
          {stats.recent.map((entry) => (
            <li key={entry.slug}>
              {entry.title} · rung {entry.maxHintLevel} · {entry.solved ? "solved" : "in progress"}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Stat(props: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded-xl border border-stone-200 dark:border-stone-700 p-3">
      <div className="text-[11px] uppercase tracking-wider text-stone-500">{props.label}</div>
      <div className="text-xl font-semibold">{props.value}</div>
    </div>
  );
}
