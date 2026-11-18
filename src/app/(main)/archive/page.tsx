import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser, can } from "@/lib/auth";
import { fmtDate, shortName, startOfToday, daysBetween } from "@/lib/format";
import { forbidden } from "next/navigation";
import { PageHeader, StatCard, Pagination, EmptyRow, Pill, FilterChip, makeHref } from "@/components/ui";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 15;

type SP = Promise<Record<string, string | undefined>>;

export default async function ArchivePage({ searchParams }: { searchParams: SP }) {
  const user = await requireUser();
  // ФБШ-02: эрхгүй бол 403 хуудас
  if (!can(user, "document.archive") && !can(user, "document.view_all")) forbidden();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const today = startOfToday();
  const in30 = new Date(today.getTime() + 30 * 86400000);

  const and: Prisma.ArchiveWhereInput[] = [];
  if (sp.q) and.push({ document: { OR: [{ title: { contains: sp.q, mode: "insensitive" } }, { documentNumber: { contains: sp.q, mode: "insensitive" } }] } });
  if (sp.category) and.push({ archiveCategory: sp.category });
  if (sp.retention === "expired") and.push({ retentionUntil: { lt: today } });
  if (sp.retention === "soon") and.push({ retentionUntil: { gte: today, lte: in30 } });
  const where: Prisma.ArchiveWhereInput = { AND: and };

  const [all, expired, soon, total, rows, categories] = await Promise.all([
    prisma.archive.count(),
    prisma.archive.count({ where: { retentionUntil: { lt: today } } }),
    prisma.archive.count({ where: { retentionUntil: { gte: today, lte: in30 } } }),
    prisma.archive.count({ where }),
    prisma.archive.findMany({
      where,
      include: { document: { include: { documentType: true } }, archivedBy: { include: { employee: true } } },
      orderBy: { archivedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.archive.findMany({ distinct: ["archiveCategory"], select: { archiveCategory: true } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const without = (...keys: string[]) => makeHref("/archive", sp, Object.fromEntries([...keys, "page"].map((k) => [k, undefined])));
  const RET_LABELS: Record<string, string> = { soon: "30 хоногт дуусах", expired: "Дууссан" };
  const chips = [
    ...(sp.q ? [{ label: `Түлхүүр үг: ${sp.q}`, href: without("q") }] : []),
    ...(sp.category ? [{ label: `Ангилал: ${sp.category}`, href: without("category") }] : []),
    ...(sp.retention ? [{ label: `Хадгалах хугацаа: ${RET_LABELS[sp.retention] ?? sp.retention}`, href: without("retention") }] : []),
  ];

  return (
    <div>
      <PageHeader crumbs={[["Архив"]]} title="Архив" subtitle="Архивлагдсан баримт, хадгалах хугацааны хяналт" />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Архивт байгаа" value={all} hint="Нийт архивлагдсан баримт" href="/archive" />
        <StatCard label="30 хоногт хугацаа дуусах" value={soon} hint="Шийдвэр гаргахад бэлтгэх" href="/archive?retention=soon" />
        <StatCard label="Хадгалах хугацаа дууссан" value={expired} hint="Устгах эсвэл шилжүүлэх шийдвэр хүлээж буй" tone="danger" href="/archive?retention=expired" />
      </div>

      <form className="card mb-5 space-y-4 p-5" role="search" aria-label="Архив шүүх">
        <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_auto] md:items-end">
          <div><label className="label" htmlFor="ar-q">Түлхүүр үг</label><input id="ar-q" name="q" defaultValue={sp.q} className="input" placeholder="Дугаар, гарчгаар…" /></div>
          <div>
            <label className="label" htmlFor="ar-cat">Архивын ангилал</label>
            <select id="ar-cat" name="category" defaultValue={sp.category ?? ""} className="input">
              <option value="">Бүгд</option>
              {categories.map((c) => c.archiveCategory && <option key={c.archiveCategory}>{c.archiveCategory}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="ar-ret">Хадгалах хугацаа</label>
            <select id="ar-ret" name="retention" defaultValue={sp.retention ?? ""} className="input">
              <option value="">Бүгд</option>
              <option value="soon">30 хоногт дуусах</option>
              <option value="expired">Дууссан</option>
            </select>
          </div>
          <button className="btn-primary">Шүүх</button>
        </div>
        {chips.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
            <span className="text-xs text-slate-500">Идэвхтэй шүүлтүүр:</span>
            {chips.map((c) => <FilterChip key={c.label} label={c.label} href={c.href} />)}
            <Link href="/archive" className="text-xs font-semibold text-navy-700 hover:underline">Бүгдийг арилгах</Link>
          </div>
        )}
      </form>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="border-b border-slate-200 bg-slate-50/60">
            <tr><th className="th">Дугаар</th><th className="th">Гарчиг</th><th className="th">Ангилал</th><th className="th">Архивласан</th><th className="th">Хадгалах хугацаа</th><th className="th">Дараах шийдвэр</th><th className="th">Байршил</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => {
              const left = r.retentionUntil ? daysBetween(today, r.retentionUntil) : null;
              return (
                <tr key={r.id} className="hover:bg-slate-50/70">
                  <td className="td font-semibold">{r.document.documentNumber ?? r.document.internalNumber}</td>
                  <td className="td"><Link href={`/documents/${r.documentId}`} className="link">{r.document.title}</Link></td>
                  <td className="td text-slate-600">{r.archiveCategory}</td>
                  <td className="td text-slate-600">{shortName(r.archivedBy.employee)} · {fmtDate(r.archivedAt)}</td>
                  <td className="td">
                    {fmtDate(r.retentionUntil)}{" "}
                    {left !== null && left < 0 && <Pill tone="red">Хугацаа дууссан</Pill>}
                    {left !== null && left >= 0 && left <= 30 && <Pill tone="amber">{left} хоног</Pill>}
                  </td>
                  <td className="td text-slate-600">{r.disposalAction === "TRANSFER" ? "Улсын архивт шилжүүлэх" : "Устгах"}</td>
                  <td className="td text-slate-600">{r.storageLocation ?? "—"}</td>
                </tr>
              );
            })}
            {rows.length === 0 && <EmptyRow cols={7} text={chips.length ? "Шүүлтүүрт тохирох баримт олдсонгүй." : "Архивлагдсан баримт алга."} action={chips.length ? <Link href="/archive" className="link text-sm">Шүүлтүүрийг арилгах</Link> : undefined} />}
          </tbody>
        </table>
        <Pagination page={page} pages={pages} total={total} from={(page - 1) * PAGE_SIZE + 1} to={Math.min(total, page * PAGE_SIZE)} href={(p) => makeHref("/archive", sp, { page: String(p) })} />
      </div>
    </div>
  );
}
