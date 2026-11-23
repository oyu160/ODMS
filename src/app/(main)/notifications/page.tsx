import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { fmtDateTime } from "@/lib/format";
import { PageHeader, Pill, Tabs } from "@/components/ui";
import { SubmitButton } from "@/components/feedback";
import { markAllRead } from "./actions";

export const dynamic = "force-dynamic";

/** Medegdliin turul — barimtiin tuluwiin ungutei uyaldana */
const TYPE: Record<string, { label: string; tone: "amber" | "teal" | "orange" | "navy" | "violet" | "green" | "red" | "slate" }> = {
  REVIEW_REQUESTED: { label: "Хяналт", tone: "amber" },
  APPROVED: { label: "Батлагдсан", tone: "teal" },
  RETURNED: { label: "Засварт буцсан", tone: "orange" },
  FORWARDED: { label: "Шилжүүлсэн", tone: "navy" },
  ASSIGNED: { label: "Хуваарилалт", tone: "violet" },
  RESOLVED: { label: "Шийдвэрлэгдсэн", tone: "green" },
  SENT: { label: "Илгээсэн", tone: "teal" },
  REMINDER: { label: "Сануулга", tone: "amber" },
  OVERDUE: { label: "Хугацаа хэтэрсэн", tone: "red" },
  REVIEWER_EDIT: { label: "Хянагчийн засвар", tone: "navy" },
};

type SP = Promise<{ filter?: string }>;

export default async function NotificationsPage({ searchParams }: { searchParams: SP }) {
  const user = await requireUser();
  const { filter } = await searchParams;
  const unreadOnly = filter === "unread";
  const [items, total, unread] = await Promise.all([
    prisma.notification.findMany({ where: { userId: user.id, ...(unreadOnly ? { isRead: false } : {}) }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.notification.count({ where: { userId: user.id } }),
    prisma.notification.count({ where: { userId: user.id, isRead: false } }),
  ]);

  return (
    <div className="max-w-3xl">
      <PageHeader
        crumbs={[["Мэдэгдэл"]]}
        title="Мэдэгдэл"
        subtitle="Танд ирсэн сүүлийн 100 мэдэгдэл. Дарахад уншсан болж, холбогдох баримт нээгдэнэ."
        actions={unread > 0 && <form action={markAllRead}><SubmitButton className="btn-outline" pendingText="Тэмдэглэж байна…">Бүгдийг уншсан болгох</SubmitButton></form>}
      />
      <Tabs
        active={unreadOnly ? "unread" : "all"}
        tabs={[
          { key: "all", label: <>Бүгд <span className="font-normal text-slate-500">· {total}</span></>, href: "/notifications" },
          { key: "unread", label: <>Уншаагүй <span className="font-normal text-slate-500">· {unread}</span></>, href: "/notifications?filter=unread" },
        ]}
      />
      <ul className="card divide-y divide-slate-100 overflow-hidden">
        {items.length === 0 && (
          <li className="px-5 py-12 text-center text-sm text-slate-500">{unreadOnly ? "Уншаагүй мэдэгдэл алга." : "Мэдэгдэл алга."}</li>
        )}
        {items.map((n) => {
          const t = TYPE[n.type];
          return (
            <li key={n.id}>
              <a href={`/api/notifications/${n.id}`} className={`flex items-start gap-3 px-5 py-4 hover:bg-slate-50 ${n.isRead ? "" : "bg-navy-50/40"}`}>
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.isRead ? "bg-transparent" : "bg-red-500"}`} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    {t && <Pill tone={t.tone}>{t.label}</Pill>}
                    {!n.isRead && <span className="sr-only">Уншаагүй.</span>}
                    <span className="text-xs text-slate-500">{fmtDateTime(n.createdAt)}</span>
                  </span>
                  <span className={`mt-1 block text-sm ${n.isRead ? "text-slate-700" : "font-medium text-slate-900"}`}>{n.message}</span>
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
