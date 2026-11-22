import { requireUser } from "@/lib/auth";
import { Avatar, PageHeader } from "@/components/ui";
import { SubmitButton, Toast } from "@/components/feedback";
import { uploadAvatar, removeAvatar } from "./actions";

export const dynamic = "force-dynamic";

type SP = Promise<{ msg?: string; err?: string }>;

export default async function ProfilePage({ searchParams }: { searchParams: SP }) {
  const user = await requireUser();
  const sp = await searchParams;

  return (
    <div className="max-w-2xl">
      <PageHeader crumbs={[["Миний профайл"]]} title="Миний профайл" subtitle="Профайлын зураг бусад хэрэглэгчдэд таныг танихад тусална." />
      <Toast message={sp.msg} />
      <Toast message={sp.err} tone="error" />

      <div className="card p-6">
        <div className="flex items-center gap-5">
          <Avatar text={user.initials} src={user.avatarUrl} size={88} />
          <div>
            <div className="text-lg font-semibold text-slate-900">{user.fullName}</div>
            <div className="text-sm text-slate-600">{user.positionName ?? "Албан тушаал тодорхойгүй"}</div>
            <div className="text-sm text-slate-500">{user.departmentName} · {user.roles.map((r) => r.name).join(", ")}</div>
          </div>
        </div>

        <form action={uploadAvatar} className="mt-6 space-y-3 border-t border-slate-100 pt-5">
          <label htmlFor="avatar" className="block text-sm font-medium text-slate-700">Профайлын зураг</label>
          <input id="avatar" name="avatar" type="file" accept="image/jpeg,image/png,image/webp" required className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-semibold hover:file:bg-slate-200" />
          <p className="text-xs text-slate-500">JPG, PNG эсвэл WEBP, 1 МБ хүртэл.</p>
          <SubmitButton pendingText="Хадгалж байна…">Зураг хадгалах</SubmitButton>
        </form>

        {user.avatarUrl && (
          <form action={removeAvatar} className="mt-3">
            <SubmitButton className="btn-outline" pendingText="Устгаж байна…">Зургийг устгах</SubmitButton>
          </form>
        )}
      </div>
    </div>
  );
}
