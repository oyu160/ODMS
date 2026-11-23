// Sistemiin logo: davhar barimt + tamganii temdeg (baталгаажсан баримт)
export function Logo({ size = 44, tone = "navy" }: { size?: number; tone?: "navy" | "light" }) {
  const bg = tone === "navy" ? "#115e59" : "rgba(255,255,255,0.12)";
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label="Баримт бичгийн удирдлагын систем">
      <rect width="48" height="48" rx="12" fill={bg} />
      <path d="M16 11h12l6 6v17a3 3 0 0 1-3 3H16a3 3 0 0 1-3-3V14a3 3 0 0 1 3-3Z" fill="#ffffff" opacity="0.35" transform="translate(-3 -2)" />
      <path d="M17 12h11.5L34 17.5V35a3 3 0 0 1-3 3H17a3 3 0 0 1-3-3V15a3 3 0 0 1 3-3Z" fill="#ffffff" />
      <path d="M28.5 12v4a1.5 1.5 0 0 0 1.5 1.5h4" fill="none" stroke="#b9ddd6" strokeWidth="1.6" />
      <path d="M18.5 20h7M18.5 24h11M18.5 28h6" stroke="#8cc7bd" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="31" cy="33" r="6.5" fill="#c2410c" />
      <path d="m28.2 33.1 1.9 1.9 3.8-3.9" fill="none" stroke="#ffffff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
