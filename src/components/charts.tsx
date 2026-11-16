// Энгийн SVG график — нэмэлт сан шаардахгүй

export function Donut({ data, total, label }: { data: { name: string; value: number; color: string }[]; total: number; label: string }) {
  const r = 70;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg viewBox="0 0 200 200" className="h-48 w-48 shrink-0">
      <circle cx="100" cy="100" r={r} fill="none" stroke="#f1f5f9" strokeWidth="26" />
      {total > 0 &&
        data.filter((d) => d.value > 0).map((d) => {
          const len = (d.value / total) * c;
          const el = (
            <circle
              key={d.name}
              cx="100"
              cy="100"
              r={r}
              fill="none"
              stroke={d.color}
              strokeWidth="26"
              strokeDasharray={`${Math.max(len - 1.5, 0.5)} ${c}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 100 100)"
            />
          );
          offset += len;
          return el;
        })}
      <text x="100" y="100" textAnchor="middle" className="fill-slate-900" style={{ fontSize: 34, fontWeight: 700 }}>{total}</text>
      <text x="100" y="124" textAnchor="middle" className="fill-slate-500" style={{ fontSize: 12 }}>{label}</text>
    </svg>
  );
}

export function GroupedBars({ labels, series }: { labels: string[]; series: { name: string; color: string; values: number[] }[] }) {
  const W = 520, H = 210, top = 22, bottom = 30;
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const group = W / labels.length;
  const bw = Math.min(26, (group - 24) / series.length);
  const y = (v: number) => top + (H - top - bottom) * (1 - v / max);
  return (
    <div>
      <div className="mb-2 flex gap-5 text-xs text-slate-600">
        {series.map((s) => (
          <span key={s.name} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />{s.name}</span>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        <line x1="0" x2={W} y1={H - bottom} y2={H - bottom} stroke="#e2e8f0" />
        {labels.map((l, i) => {
          const gx = i * group + (group - bw * series.length - 4) / 2;
          return (
            <g key={l}>
              {series.map((s, j) => {
                const v = s.values[i];
                const x = gx + j * (bw + 4);
                return (
                  <g key={s.name}>
                    <rect x={x} y={y(v)} width={bw} height={H - bottom - y(v)} rx="3" fill={s.color} />
                    <text x={x + bw / 2} y={y(v) - 5} textAnchor="middle" style={{ fontSize: 10 }} className="fill-slate-600">{v}</text>
                  </g>
                );
              })}
              <text x={i * group + group / 2} y={H - 10} textAnchor="middle" style={{ fontSize: 11 }} className="fill-slate-500">{l}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
