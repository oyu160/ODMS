import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { fmtDateTime } from "@/lib/format";
import { PageHeader } from "@/components/ui";
import { markAllRead } from "./actions";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const user = await requireUser();
  const items = await prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100 });

  return (
    <div className="max-w-3xl">
      <PageHeader
        crumbs={[["Мэдэгдэл"]]}
        title="Мэдэгдэл"
        subtitle="Танд ирсэн сүүлийн 100 мэдэгдэл"
        actions={<form action={markAllRead}><button className="btn-outline">Бүгдийг уншсан болгох</button></form>}
      />
      <div className="card divide-y divide-slate-100">
        {items.length === 0 && <p className="px-5 py-10 text-center text-sm text-slate-500">Мэдэгдэл алга</p>}
        {items.map((n) => (
          <a key={n.id} href={`/api/notifications/${n.id}`} className={`flex items-start gap-3 px-5 py-4 hover:bg-slate-50 ${n.isRead ? "" : "bg-navy-50/40"}`}>
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.isRead ? "bg-slate-300" : "bg-red-500"}`} />
            <span className="flex-1 text-sm text-slate-800">{n.message}</span>
            <span className="text-xs text-slate-500">{fmtDateTime(n.createdAt)}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
