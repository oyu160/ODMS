import Link from "next/link";
import { Plus, Search, Download, Inbox, Pencil } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser, can } from "@/lib/auth";
import { buildOrderBy, buildWhere, readFilter, type DocFilter, type SortKey } from "@/lib/document-filters";
import { DIRECTION_LABELS, fmtDate, shortName } from "@/lib/format";
import { PageHeader, StatusBadge, Pagination, EmptyRow, Tabs, SortTh, FilterChip, makeHref } from "@/components/ui";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 10;

type SP = Promise<Record<string, string | undefined>>;

/** Түгээмэл харагдацууд — нэг даралтаар шүүнэ (төлөв ба «миний» шүүлтүүрийн хослол) */
const VIEWS: { key: string; label: string; status?: string; mine?: string; creatorOnly?: boolean }[] = [
  { key: "all", label: "Бүгд" },
  { key: "mine", label: "Миний үүсгэсэн", mine: "1", creatorOnly: true },
  { key: "review", label: "Хяналтад", status: "IN_REVIEW" },
  { key: "returned", label: "Засварт буцсан", status: "RETURNED", mine: "1", creatorOnly: true },
  { key: "draft", label: "Ноорог", status: "DRAFT", mine: "1", creatorOnly: true },
];

export default async function DocumentsPage({ searchParams }: { searchParams: SP }) {
  const user = await requireUser();
  const sp = await searchParams;
  const f = readFilter(sp);
  const page = Math.max(1, Number(sp.page) || 1);
  const where = buildWhere(user, f);

  // Таб бүрийн тоо нь бусад шүүлтүүрийг (түлхүүр үг, төрөл, огноо) хадгална
  const base: DocFilter = { q: f.q, type: f.type, direction: f.direction, from: f.from, to: f.to, assignee: f.assignee };
  const views = VIEWS.filter((v) => !v.creatorOnly || can(user, "document.create"));
  const activeView = views.find((v) => v.status === f.status && v.mine === f.mine)?.key ?? "";

  const manager = can(user, "document.assign");
  const [total, docs, statuses, types, viewCounts, users, departments] = await Promise.all([
    prisma.document.count({ where }),
    prisma.document.findMany({
      where,
      orderBy: buildOrderBy(f),
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { status: true, documentType: true, createdBy: { include: { employee: true } }, attachments: { where: { isMain: true }, take: 1 } },
    }),
    prisma.documentStatus.findMany({ orderBy: { displayOrder: "asc" } }),
    prisma.documentType.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    Promise.all(views.map((v) => prisma.document.count({ where: buildWhere(user, { ...base, status: v.status, mine: v.mine }) }))),
    manager ? prisma.user.findMany({ where: { isActive: true }, include: { employee: true }, orderBy: { employee: { lastName: "asc" } } }) : [],
    manager ? prisma.department.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }) : [],
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (p: number) => makeHref("/documents", sp, { page: String(p) });
  const exportHref = makeHref("/api/export/documents", { ...f }, {});
  const without = (...keys: string[]) => makeHref("/documents", sp, Object.fromEntries([...keys, "page"].map((k) => [k, undefined])));

  // Эрэмбэ: идэвхтэй багана дээр дахин дарахад чиглэл солигдоно
  const sortKey: SortKey = f.sort ?? "date";
  const sortDir = f.dir ?? (f.sort && f.sort !== "date" ? "asc" : "desc");
  const sortHref = (k: SortKey) => makeHref("/documents", sp, { sort: k, dir: sortKey === k ? (sortDir === "asc" ? "desc" : "asc") : k === "date" ? "desc" : "asc", page: undefined });
  const SORT_LABEL: Record<SortKey, string> = { number: "Дугаараар", title: "Гарчгаар", date: "Огноогоор" };

  // Идэвхтэй шүүлтүүрийн chip-ууд
  const statusName = statuses.find((s) => s.code === f.status)?.name;
  const typeName = types.find((t) => t.id === f.type)?.name;
  const assigneeName =
    f.assignee === "me"
      ? "Надад / миний нэгжид"
      : f.assignee?.startsWith("u:")
        ? (() => { const u = users.find((x) => x.id === f.assignee!.slice(2)); return u ? shortName(u.employee) : undefined; })()
        : departments.find((d) => d.id === f.assignee?.slice(2))?.name;
  const chips: { label: string; href: string }[] = [
    ...(f.q ? [{ label: `Түлхүүр үг: ${f.q}`, href: without("q") }] : []),
    ...(typeName ? [{ label: `Төрөл: ${typeName}`, href: without("type") }] : []),
    ...(statusName ? [{ label: `Төлөв: ${statusName}`, href: without("status") }] : []),
    ...(f.direction ? [{ label: `Чиглэл: ${DIRECTION_LABELS[f.direction] ?? f.direction}`, href: without("direction") }] : []),
    ...(f.from || f.to ? [{ label: `Огноо: ${f.from ?? "…"} – ${f.to ?? "…"}`, href: without("from", "to") }] : []),
    ...(f.mine ? [{ label: "Зөвхөн миний үүсгэсэн", href: without("mine") }] : []),
    ...(assigneeName ? [{ label: `Хариуцагч: ${assigneeName}`, href: without("assignee") }] : []),
  ];

  return (
    <div>
      <PageHeader
        crumbs={[["Баримт бичиг"]]}
        title="Баримт бичиг"
        subtitle="Таны харах эрхтэй бүх баримт. Нууцлалын түвшингээр шүүгдсэн."
        actions={
          <>
            {can(user, "document.register") && (
              <Link href="/documents/new?direction=INCOMING" className="btn-outline"><Inbox size={16} /> Ирсэн бичиг бүртгэх</Link>
            )}
            {can(user, "document.create") && <Link href="/documents/new" className="btn-primary"><Plus size={16} /> Баримт үүсгэх</Link>}
          </>
        }
      />

      <Tabs
        active={activeView}
        tabs={views.map((v, i) => ({
          key: v.key,
          label: <>{v.label} <span className="font-normal text-slate-500">· {viewCounts[i]}</span></>,
          href: makeHref("/documents", { ...base, sort: f.sort, dir: f.dir }, { status: v.status, mine: v.mine }),
        }))}
      />

      <form className="card mb-5 space-y-4 p-5" role="search" aria-label="Баримт шүүх">
        {f.mine && <input type="hidden" name="mine" value={f.mine} />}
        {f.sort && <input type="hidden" name="sort" value={f.sort} />}
        {f.dir && <input type="hidden" name="dir" value={f.dir} />}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr_1fr] xl:items-end">
          <div>
            <label className="label" htmlFor="f-q">Түлхүүр үг</label>
            <div className="relative">
              <input id="f-q" name="q" defaultValue={f.q} placeholder="Дугаар, гарчиг, агуулгаар…" className="input pr-9" />
              <Search size={16} aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="f-type">Төрөл</label>
            <select id="f-type" name="type" defaultValue={f.type ?? ""} className="input">
              <option value="">Бүх төрөл</option>
              {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="f-status">Төлөв</label>
            <select id="f-status" name="status" defaultValue={f.status ?? ""} className="input">
              <option value="">Бүх төлөв</option>
              {statuses.map((s) => <option key={s.id} value={s.code}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="f-dir">Чиглэл</label>
            <select id="f-dir" name="direction" defaultValue={f.direction ?? ""} className="input">
              <option value="">Бүгд</option>
              {Object.entries(DIRECTION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.4fr_1.6fr_auto] xl:items-end">
          <div>
            <label className="label" htmlFor="f-who">Хариуцагч</label>
            <select id="f-who" name="assignee" defaultValue={f.assignee ?? ""} className="input">
              <option value="">Бүгд</option>
              <option value="me">Надад / миний нэгжид</option>
              {manager && <optgroup label="Ажилтан">{users.map((u) => <option key={u.id} value={`u:${u.id}`}>{shortName(u.employee)}</option>)}</optgroup>}
              {manager && <optgroup label="Нэгж">{departments.map((d) => <option key={d.id} value={`d:${d.id}`}>{d.name}</option>)}</optgroup>}
            </select>
          </div>
          <fieldset>
            <legend className="label">Огноо</legend>
            <div className="flex items-center gap-1.5">
              <input type="date" name="from" defaultValue={f.from} aria-label="Эхлэх огноо" className="input px-2" />
              <span className="text-slate-400" aria-hidden>—</span>
              <input type="date" name="to" defaultValue={f.to} aria-label="Дуусах огноо" className="input px-2" />
            </div>
          </fieldset>
          <button className="btn-primary">Шүүх</button>
        </div>
        {chips.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
            <span className="text-xs text-slate-500">Идэвхтэй шүүлтүүр:</span>
            {chips.map((c) => <FilterChip key={c.label} label={c.label} href={c.href} />)}
            <Link href="/documents" className="text-xs font-semibold text-navy-700 hover:underline">Бүгдийг арилгах</Link>
          </div>
        )}
      </form>

      <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-2">
        <span className="text-base font-semibold text-slate-900">{total} баримт олдлоо</span>
        <span className="flex-1 text-sm text-slate-500">· {SORT_LABEL[sortKey]}, {sortDir === "asc" ? "өсөхөөр" : "буурахаар"}</span>
        <a href={exportHref} className="btn-outline py-1.5"><Download size={16} /> Excel татах</a>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-200 bg-slate-50/60">
              <tr>
                <SortTh label="Дугаар" active={sortKey === "number"} dir={sortDir} href={sortHref("number")} />
                <SortTh label="Гарчиг" active={sortKey === "title"} dir={sortDir} href={sortHref("title")} />
                <th className="th">Төрөл</th>
                <th className="th">Чиглэл</th>
                <th className="th">Үүсгэсэн</th>
                <SortTh label="Огноо" active={sortKey === "date"} dir={sortDir} href={sortHref("date")} />
                <th className="th">Төлөв</th>
                <th className="th"><span className="sr-only">Үйлдэл</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {docs.map((d) => {
                const editable = d.createdById === user.id && ["DRAFT", "RETURNED"].includes(d.status.code);
                const file = d.attachments[0];
                return (
                  <tr key={d.id} className="hover:bg-slate-50/70">
                    <td className="td whitespace-nowrap">
                      {d.documentNumber ? <span className="font-semibold">{d.documentNumber}</span> : <span className="text-slate-500">{d.internalNumber}</span>}
                    </td>
                    <td className="td font-medium"><Link href={`/documents/${d.id}`} className="link">{d.title}</Link></td>
                    <td className="td text-slate-600">{d.documentType.name}</td>
                    <td className="td text-slate-600">{DIRECTION_LABELS[d.direction]}</td>
                    <td className="td whitespace-nowrap text-slate-600">{shortName(d.createdBy.employee)}</td>
                    <td className="td whitespace-nowrap text-slate-600">{fmtDate(d.documentDate ?? d.createdAt)}</td>
                    <td className="td"><StatusBadge code={d.status.code} name={d.status.name} /></td>
                    <td className="td">
                      <div className="flex justify-end gap-1">
                        {editable && (
                          <Link href={`/documents/${d.id}/edit`} aria-label={`«${d.title}» засах`} title="Засах" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900"><Pencil size={16} /></Link>
                        )}
                        {file && (
                          <a href={`/api/files/${file.id}?download=1`} aria-label={`«${d.title}» үндсэн файл татах`} title="Татах" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900"><Download size={16} /></a>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {docs.length === 0 && (
                <EmptyRow
                  cols={8}
                  text={chips.length ? "Шүүлтүүрт тохирох баримт олдсонгүй." : "Одоогоор баримт алга."}
                  action={chips.length ? <Link href="/documents" className="link text-sm">Шүүлтүүрийг арилгах</Link> : undefined}
                />
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pages={pages} total={total} from={(page - 1) * PAGE_SIZE + 1} to={Math.min(total, page * PAGE_SIZE)} href={href} />
      </div>
      <p className="mt-3 text-xs text-slate-500">Дугаарлагдаагүй баримтад дотоод дугаар (Д-…) харагдана. Албан дугаар батлагдсаны дараа олгогдоно.</p>
    </div>
  );
}
