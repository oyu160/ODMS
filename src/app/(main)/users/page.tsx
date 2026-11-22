import Link from "next/link";
import { RefreshCw, AlertTriangle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { orphanedAssignments } from "@/lib/hr";
import { fmtDateTime, shortName, initials, avatarUrl } from "@/lib/format";
import { PageHeader, Card, Tabs, Pill, Avatar } from "@/components/ui";
import { toggleUser, setRoles, resetPassword, createUser, runHrSync } from "./actions";
import { SubmitButton, Toast } from "@/components/feedback";
import { ConfirmButton } from "@/components/modal";

export const dynamic = "force-dynamic";

type SP = Promise<{ tab?: string; msg?: string; err?: string }>;

export default async function UsersPage({ searchParams }: { searchParams: SP }) {
  await requirePermission("user.manage");
  const { tab = "users", msg, err } = await searchParams;

  const [users, roles, departments, noUser, orphans, lastSync] = await Promise.all([
    prisma.user.findMany({ include: { employee: { include: { department: true } }, roles: { include: { role: true } } }, orderBy: { employee: { lastName: "asc" } } }),
    prisma.role.findMany({ orderBy: { name: "asc" } }),
    prisma.department.findMany({ include: { parent: true, _count: { select: { employees: { where: { employmentStatus: "ACTIVE" } } } } }, orderBy: { name: "asc" } }),
    prisma.employee.findMany({ where: { user: null, employmentStatus: "ACTIVE" }, include: { department: true }, orderBy: { lastName: "asc" } }),
    orphanedAssignments(),
    prisma.employee.aggregate({ _max: { syncedAt: true } }),
  ]);

  return (
    <div>
      <PageHeader
        crumbs={[["Тохиргоо"], ["Хэрэглэгч ба хэлтэс"]]}
        title="Хэрэглэгч ба хэлтэс"
        subtitle={`Ажилтан, нэгжийн мэдээлэл хүний нөөцийн системээс синхрончлогдоно · Сүүлд: ${fmtDateTime(lastSync._max.syncedAt)}`}
        actions={<form action={runHrSync}><SubmitButton pendingText="Синхрончилж байна…"><RefreshCw size={16} /> HR-аас синхрончлох</SubmitButton></form>}
      />
      {msg && <p className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-2.5 text-sm text-green-800">{msg}</p>}
      <Toast message={msg} />
      {err && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{err}</p>}
      <Toast message={err} tone="error" />

      {orphans.length > 0 && (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          <div className="flex items-center gap-2 font-semibold"><AlertTriangle size={16} /> Ажлаас гарсан / идэвхгүй хариуцагчтай {orphans.length} хуваарилалт байна (БД-11)</div>
          <ul className="mt-2 space-y-1">
            {orphans.map((a) => (
              <li key={a.id}>
                <Link href={`/documents/${a.documentId}`} className="underline">{a.document.documentNumber ?? a.document.internalNumber} · {a.document.title}</Link> — {a.assigneeUser && shortName(a.assigneeUser.employee)} → дахин хуваарилах
              </li>
            ))}
          </ul>
        </div>
      )}

      <Tabs
        active={tab}
        tabs={[
          { key: "users", label: `Хэрэглэгч (${users.length})`, href: "/users" },
          { key: "departments", label: `Нэгж (${departments.length})`, href: "/users?tab=departments" },
          { key: "new", label: `Шинэ хэрэглэгч (${noUser.length})`, href: "/users?tab=new" },
        ]}
      />

      {tab === "users" && (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="border-b border-slate-200 bg-slate-50/60"><tr><th className="th">Ажилтан</th><th className="th">Нэвтрэх нэр</th><th className="th">Нэгж</th><th className="th">Үүрэг</th><th className="th">Сүүлд нэвтэрсэн</th><th className="th">Төлөв</th><th className="th">Үйлдэл</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id} className={u.isActive ? "" : "bg-slate-50 text-slate-400"}>
                  <td className="td">
                    <div className="flex items-center gap-3">
                      <Avatar text={initials(u.employee)} size={32} src={avatarUrl(u)} />
                      <div><div className="font-medium">{shortName(u.employee)}</div><div className="text-xs text-slate-500">{u.employee.positionName ?? ""} · {u.employee.code}</div></div>
                    </div>
                  </td>
                  <td className="td font-mono text-xs">{u.username}</td>
                  <td className="td">{u.employee.department.name}</td>
                  <td className="td">
                    <details>
                      <summary className="cursor-pointer list-none">{u.roles.map((r) => <span key={r.roleId} className="mr-1"><Pill tone="navy">{r.role.name}</Pill></span>)}</summary>
                      <form action={setRoles} className="mt-2 space-y-1 rounded-lg border border-slate-200 bg-white p-3">
                        <input type="hidden" name="id" value={u.id} />
                        {roles.map((r) => (
                          <label key={r.id} className="flex items-center gap-2 text-xs"><input type="checkbox" name="roleId" value={r.id} defaultChecked={u.roles.some((x) => x.roleId === r.id)} /> {r.name}</label>
                        ))}
                        <button className="btn-primary mt-1 py-1 text-xs">Хадгалах</button>
                      </form>
                    </details>
                  </td>
                  <td className="td text-xs text-slate-500">{fmtDateTime(u.lastLoginAt)}</td>
                  <td className="td">{u.employee.employmentStatus === "LEFT" ? <Pill tone="red">Ажлаас гарсан</Pill> : u.isActive ? <Pill tone="green">Идэвхтэй</Pill> : <Pill>Идэвхгүй</Pill>}</td>
                  <td className="td whitespace-nowrap text-xs font-semibold">
                    {u.isActive ? (
                      <ConfirmButton
                        action={toggleUser}
                        fields={{ id: u.id }}
                        title={`${shortName(u.employee)}-ийн эрхийг хаах уу?`}
                        description="Хэрэглэгч системд нэвтэрч чадахгүй болно. Түүнд хуваарилагдсан идэвхтэй ажлыг дахин хуваарилах шаардлагатай. Дараа нь «Идэвхжүүлэх»-ээр сэргээж болно."
                        confirmLabel="Эрхийг хаах"
                      >
                        Хаах
                      </ConfirmButton>
                    ) : (
                      <form action={toggleUser} className="inline"><input type="hidden" name="id" value={u.id} /><button className="link">Идэвхжүүлэх</button></form>
                    )}
                    <span className="mx-1.5 text-slate-300" aria-hidden>·</span>
                    <ConfirmButton
                      action={resetPassword}
                      fields={{ id: u.id }}
                      tone="primary"
                      title={`${shortName(u.employee)}-ийн нууц үгийг сэргээх үү?`}
                      description="Одоогийн нууц үг ажиллахаа больж, түр нууц үг үүснэ. Түр нууц үгийг хэрэглэгчид аюулгүй замаар дамжуулна уу."
                      confirmLabel="Нууц үг сэргээх"
                    >
                      Нууц үг сэргээх
                    </ConfirmButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "departments" && (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="border-b border-slate-200 bg-slate-50/60"><tr><th className="th">Код</th><th className="th">Нэгжийн нэр</th><th className="th">Дээд нэгж</th><th className="th">Ажилтан</th><th className="th">HR код</th><th className="th">Төлөв</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {departments.map((d) => (
                <tr key={d.id}>
                  <td className="td font-mono text-xs">{d.code}</td>
                  <td className="td font-medium">{d.name}</td>
                  <td className="td text-slate-600">{d.parent?.name ?? "—"}</td>
                  <td className="td">{d._count.employees}</td>
                  <td className="td font-mono text-xs text-slate-500">{d.hrRefId ?? "—"}</td>
                  <td className="td">{d.isActive ? <Pill tone="green">Идэвхтэй</Pill> : <Pill>Идэвхгүй</Pill>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "new" && (
        <Card title="Системийн эрхгүй ажилтанд хэрэглэгч үүсгэх">
          {noUser.length === 0 && <p className="text-sm text-slate-500">Бүх идэвхтэй ажилтан хэрэглэгчтэй байна.</p>}
          <ul className="divide-y divide-slate-100">
            {noUser.map((e) => (
              <li key={e.id} className="py-3">
                <form action={createUser} className="grid items-center gap-3 md:grid-cols-[1fr_200px_220px_120px]">
                  <input type="hidden" name="employeeId" value={e.id} />
                  <div><div className="font-medium">{shortName(e)}</div><div className="text-xs text-slate-500">{e.department.name} · {e.positionName ?? ""} · {e.code}</div></div>
                  <input name="username" placeholder="Нэвтрэх нэр" defaultValue={e.email?.split("@")[0] ?? ""} className="input" />
                  <select name="roleId" className="input" defaultValue={roles.find((r) => r.code === "EMPLOYEE")?.id}>
                    {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                  <button className="btn-primary py-1.5">Үүсгэх</button>
                </form>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
