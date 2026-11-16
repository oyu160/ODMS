import Link from "next/link";
import { Plus, Search, Download, Inbox } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser, can } from "@/lib/auth";
import { buildWhere, readFilter } from "@/lib/document-filters";
import { DIRECTION_LABELS, fmtDate, shortName } from "@/lib/format";
import { PageHeader, StatusBadge, Pagination, EmptyRow, makeHref } from "@/components/ui";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 10;

type SP = Promise<Record<string, string | undefined>>;

export default async function DocumentsPage({ searchParams }: { searchParams: SP }) {
  const user = await requireUser();
  const sp = await searchParams;
  const f = readFilter(sp);
  const page = Math.max(1, Number(sp.page) || 1);
  const where = buildWhere(user, f);

  const [total, docs, statuses, types] = await Promise.all([
    prisma.document.count({ where }),
    prisma.document.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { status: true, documentType: true, createdBy: { include: { employee: true } }, attachments: { where: { isMain: true }, take: 1 } },
    }),
    prisma.documentStatus.findMany({ orderBy: { displayOrder: "asc" } }),
    prisma.documentType.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (p: number) => makeHref("/documents", sp, { page: String(p) });
  const exportHref = makeHref("/api/export/documents", { ...f }, {});

  return (
    <div>
      <PageHeader
        crumbs={[["Баримт бичиг"]]}
        title="Баримт бичиг"
        subtitle="Таны харах эрхтэй баримтууд"
        actions={
          <>
            {can(user, "document.register") && (
              <Link href="/documents/new?direction=INCOMING" className="btn-outline"><Inbox size={16} /> Ирсэн бичиг бүртгэх</Link>
            )}
            {can(user, "document.create") && <Link href="/documents/new" className="btn-primary"><Plus size={16} /> Баримт үүсгэх</Link>}
          </>
        }
      />

      <form className="card mb-6 p-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr_1fr_1.4fr]">
          <div>
            <label className="label text-xs">Түлхүүр үг</label>
            <div className="relative">
              <input name="q" defaultValue={f.q} placeholder="Дугаар, гарчиг, агуулгаар хайх…" className="input pr-9" />
              <Search size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
          </div>
          <div>
            <label className="label text-xs">Төрөл</label>
            <select name="type" defaultValue={f.type ?? ""} className="input">
              <option value="">Бүх төрөл</option>
              {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label text-xs">Төлөв</label>
            <select name="status" defaultValue={f.status ?? ""} className="input">
              <option value="">Бүх төлөв</option>
              {statuses.map((s) => <option key={s.id} value={s.code}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label text-xs">Чиглэл</label>
            <select name="direction" defaultValue={f.direction ?? ""} className="input">
              <option value="">Бүгд</option>
              {Object.entries(DIRECTION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="label text-xs">Огноо</label>
            <div className="flex items-center gap-1.5">
              <input type="date" name="from" defaultValue={f.from} className="input px-2" />
              <span className="text-slate-400">—</span>
              <input type="date" name="to" defaultValue={f.to} className="input px-2" />
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" name="mine" value="1" defaultChecked={!!f.mine} className="h-4 w-4" /> Зөвхөн миний үүсгэсэн</label>
          <span>Дугаарлагдаагүй баримтад дотоод дугаар (Д-…) харагдана</span>
          <div className="flex items-center gap-4">
            <Link href="/documents" className="font-semibold text-slate-700 hover:text-slate-900">Шүүлтүүр цэвэрлэх</Link>
            <button className="btn-primary py-1.5">Шүүх</button>
          </div>
        </div>
      </form>

      <div className="mb-3 flex items-center justify-between">
        <div>
          <span className="text-lg font-bold">Нийт {total} баримт</span>
          <span className="ml-2 text-sm text-slate-500">Эрэмбэ: Огноо, шинэ нь эхэндээ</span>
        </div>
        <a href={exportHref} className="btn-outline py-1.5"><Download size={16} /> Excel татах</a>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-200 bg-slate-50/60">
              <tr>
                <th className="th">Дугаар</th>
                <th className="th">Гарчиг</th>
                <th className="th">Төрөл</th>
                <th className="th">Чиглэл</th>
                <th className="th">Бүртгэсэн</th>
                <th className="th">Огноо</th>
                <th className="th">Төлөв</th>
                <th className="th">Үйлдэл</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {docs.map((d) => {
                const editable = d.createdById === user.id && ["DRAFT", "RETURNED"].includes(d.status.code);
                const file = d.attachments[0];
                return (
                  <tr key={d.id} className="hover:bg-slate-50/70">
                    <td className="td whitespace-nowrap">
                      {d.documentNumber ? <span className="font-semibold">{d.documentNumber}</span> : <span className="text-slate-400">{d.internalNumber}</span>}
                    </td>
                    <td className="td font-medium"><Link href={`/documents/${d.id}`} className="link">{d.title}</Link></td>
                    <td className="td text-slate-700">{d.documentType.name}</td>
                    <td className="td text-slate-700">{DIRECTION_LABELS[d.direction]}</td>
                    <td className="td whitespace-nowrap text-slate-700">{shortName(d.createdBy.employee)}</td>
                    <td className="td whitespace-nowrap text-slate-700">{fmtDate(d.documentDate ?? d.createdAt)}</td>
                    <td className="td"><StatusBadge code={d.status.code} name={d.status.name} /></td>
                    <td className="td whitespace-nowrap font-semibold">
                      {editable && <><Link href={`/documents/${d.id}/edit`} className="link">Засах</Link> · </>}
                      <Link href={`/documents/${d.id}`} className="link">Үзэх</Link>
                      {!editable && file && <> · <a href={`/api/files/${file.id}?download=1`} className="link">Татах</a></>}
                    </td>
                  </tr>
                );
              })}
              {docs.length === 0 && <EmptyRow cols={8} text="Шүүлтүүрт тохирох баримт олдсонгүй" />}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pages={pages} total={total} from={(page - 1) * PAGE_SIZE + 1} to={Math.min(total, page * PAGE_SIZE)} href={href} />
      </div>
    </div>
  );
}
