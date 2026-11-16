"use client";

// Хуудас солигдох үед дээд талд гүйх шугам — дарсан нь мэдрэгдэхгүй байх асуудлыг шийднэ
import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [loading, setLoading] = useState(false);

  // Шинэ хуудас ачаалагдмагц шугамыг дуусгана
  useEffect(() => setLoading(false), [pathname, search]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const a = (e.target as HTMLElement).closest("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.pathname.startsWith("/api/")) return;
      if (url.pathname + url.search !== location.pathname + location.search) setLoading(true);
    };
    const onSubmit = (e: SubmitEvent) => {
      const f = e.target as HTMLFormElement;
      // Шүүлтүүрийн (GET) маягт илгээхэд
      if (!e.defaultPrevented && (f.method || "get").toLowerCase() === "get" && !f.getAttribute("action")?.startsWith("/api")) setLoading(true);
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
    };
  }, []);

  return (
    <div className={`pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 transition-opacity ${loading ? "opacity-100" : "opacity-0"}`}>
      <div className={`h-full bg-navy-600 ${loading ? "nav-progress" : ""}`} />
    </div>
  );
}
