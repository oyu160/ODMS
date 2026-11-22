import Link from "next/link";
import { ShieldX } from "lucide-react";

// FBSh-02: erhgui huselted HTTP 403 tuluwtei ene huudas haragdana
export default function Forbidden() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600"><ShieldX size={28} /></span>
      <p className="mt-4 text-sm font-semibold text-red-700">403</p>
      <h1 className="mt-1 text-2xl font-bold text-slate-900">Хандах эрхгүй байна</h1>
      <p className="mt-2 max-w-md text-sm text-slate-500">Танд энэ хуудас эсвэл баримтыг харах эрх олгогдоогүй байна. Эрх шаардлагатай бол администраторт хандана уу.</p>
      <Link href="/documents" className="btn-primary mt-6">Баримтын жагсаалт руу буцах</Link>
    </div>
  );
}
