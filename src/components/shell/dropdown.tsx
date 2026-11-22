"use client";

// Unjdag tsonh (medegdel, hereglegchiin tses): gadna darah, Esc darah,
// dotor ni holboos darah eswel huudas soligdohod awtomataar haagdana
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export function Dropdown({ trigger, children, className = "" }: { trigger: React.ReactNode; children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();
  const close = () => ref.current?.removeAttribute("open");

  useEffect(close, [pathname]);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (ref.current?.open && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <details ref={ref} className={`relative ${className}`}>
      <summary className="list-none [&::-webkit-details-marker]:hidden">{trigger}</summary>
      {/* Dotor ni holboos eswel towch darahad haagdana */}
      <div onClick={(e) => (e.target as HTMLElement).closest("a,button") && setTimeout(close, 0)}>{children}</div>
    </details>
  );
}
