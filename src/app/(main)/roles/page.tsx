import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/feedback";

export const dynamic = "force-dynamic";

async function savePermissions(fd: FormData) {
  "use server";
  const admin = await requirePermission("user.manage");
  const pairs = fd.getAll("rp").map(String).map((x) => x.split(":") as [string, string]);
  const roles = await prisma.role.findMany();
  await prisma.$transaction([
    // Администраторын эрх удирдах эрхийг хасвал системд хэн ч нэвтэрч засах боломжгүй болно — хамгаална
    prisma.rolePermission.deleteMany({ where: { NOT: { role: { code: "ADMIN" }, permission: { code: "user.manage" } } } }),
    prisma.rolePermission.createMany({ data: pairs.map(([roleId, permissionId]) => ({ roleId, permissionId })), skipDuplicates: true }),
  ]);
  await writeAudit({ userId: admin.id, entityType: "role_permission", action: "SETTINGS", newValue: { roles: roles.length, pairs: pairs.length } });
  revalidatePath("/roles");
}

export default async function RolesPage() {
  await requirePermission("user.manage");
  const [roles, perms] = await Promise.all([
    prisma.role.findMany({ include: { permissions: true, _count: { select: { users: true } } }, orderBy: { name: "asc" } }),
    prisma.permission.findMany({ orderBy: { code: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader crumbs={[["Тохиргоо"], ["Эрх ба зөвшөөрөл"]]} title="Эрх ба зөвшөөрөл" subtitle="Үүрэг бүрт олгох эрхийг тохируулна (role_permissions хүснэгт)" />
      <form action={savePermissions} className="card overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-slate-200 bg-slate-50/60">
            <tr>
              <th className="th">Эрх</th>
              {roles.map((r) => <th key={r.id} className="th text-center">{r.name}<div className="font-normal text-slate-400">{r._count.users} хэрэглэгч</div></th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {perms.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50/70">
                <td className="td"><div className="font-medium">{p.name}</div><div className="font-mono text-xs text-slate-500">{p.code}</div></td>
                {roles.map((r) => (
                  <td key={r.id} className="td text-center">
                    <input type="checkbox" name="rp" value={`${r.id}:${p.id}`} defaultChecked={r.permissions.some((x) => x.permissionId === p.id)} className="h-4 w-4" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="border-t border-slate-100 p-4"><SubmitButton pendingText="Хадгалж байна…">Хадгалах</SubmitButton></div>
      </form>
    </div>
  );
}
