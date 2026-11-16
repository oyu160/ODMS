// Туршилтын HR API — бодит хүний нөөцийн систем холбогдоогүй үед ашиглана.
// prisma/hr-data.json файлаас уншина. Бодит системд HR_API_URL-ийг .env-д тохируулна.
import { readFile } from "fs/promises";
import path from "path";

export async function GET(_req: Request, { params }: { params: Promise<{ resource: string }> }) {
  const { resource } = await params;
  const data = JSON.parse(await readFile(path.join(process.cwd(), "prisma", "hr-data.json"), "utf8")) as Record<string, unknown>;
  if (!(resource in data)) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json(data[resource]);
}
