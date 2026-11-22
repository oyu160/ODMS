// Turshiltiin HR API — bodit hunii nuutsiin sistem holbogdoogui ued ashiglana.
// prisma/hr-data.json failaas unshina. Bodit sistemd HR_API_URL-iig .env-d tohiruulna.
import { readFile } from "fs/promises";
import path from "path";

export async function GET(_req: Request, { params }: { params: Promise<{ resource: string }> }) {
  const { resource } = await params;
  const data = JSON.parse(await readFile(path.join(process.cwd(), "prisma", "hr-data.json"), "utf8")) as Record<string, unknown>;
  if (!(resource in data)) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json(data[resource]);
}
