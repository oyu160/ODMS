// Next.js сервер эхлэхэд нэг удаа ажиллана
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startOverdueScheduler } = await import("./lib/overdue");
    startOverdueScheduler();
  }
}
