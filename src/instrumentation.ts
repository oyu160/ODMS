// Next.js serwer ehlehed neg udaa ajillana
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startOverdueScheduler } = await import("./lib/overdue");
    startOverdueScheduler();
  }
}
