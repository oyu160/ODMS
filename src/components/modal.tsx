"use client";

// Hurteemjtei tsonh (dialog) ba butsaah bolomjgui uildliin umnuh batalgaajuulalt.
// - role="dialog" / "alertdialog", aria-modal, garchig ba tailbartai holbogdono
// - Neegdehed tsonh dotorh ehnii talbar ruu focus shiljij, Tab tsonhnoos garahgui
// - Esc eswel gadna darahad haagdana; haagdahad umnuh element ruu focus butsna
import { createContext, useContext, useEffect, useId, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { X, TriangleAlert } from "lucide-react";
import { Spinner } from "./feedback";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  iconTone?: "brand" | "danger";
  /** alert — butsaah bolomjgui uildliin batalgaajuulalt (role="alertdialog") */
  variant?: "dialog" | "alert";
  /** Ilgeej baih ued haahiig horiglono */
  busy?: boolean;
  size?: "md" | "lg";
  children?: React.ReactNode;
};

export function Modal({ open, onClose, title, description, icon, iconTone = "brand", variant = "dialog", busy = false, size = "md", children }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current;
    // autoFocus-tei talbar uuruu focus awsan bol heweer uldeene; ugui bol aguulgiin ehnii talbar (eswel haah towch)
    if (el && !el.contains(document.activeElement)) {
      const first = el.querySelector<HTMLElement>(`[data-modal-body] :is(${FOCUSABLE})`) ?? el.querySelector<HTMLElement>(FOCUSABLE);
      first?.focus();
    }
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) {
        e.stopPropagation();
        onClose();
      }
      if (e.key === "Tab" && el) {
        const items = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((n) => n.offsetParent !== null);
        if (items.length === 0) return;
        const a = items[0], b = items[items.length - 1];
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); b.focus(); }
        else if (!e.shiftKey && document.activeElement === b) { e.preventDefault(); a.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
    // onClose-iig hamaarald oruulbal render burt focus userne
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, busy]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div
        ref={ref}
        role={variant === "alert" ? "alertdialog" : "dialog"}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        className={`flex max-h-[calc(100vh-2rem)] w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ${size === "lg" ? "max-w-xl" : "max-w-md"}`}
      >
        <div className="flex items-start gap-4 px-6 pb-4 pt-6">
          {icon && <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${iconTone === "danger" ? "bg-red-50 text-red-600" : "bg-navy-50 text-navy-700"}`}>{icon}</span>}
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-lg font-semibold leading-7 text-slate-900">{title}</h2>
            {description && <div id={descId} className="mt-1 text-sm leading-5 text-slate-600">{description}</div>}
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Цонх хаах" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50">
            <X size={18} />
          </button>
        </div>
        <div data-modal-body className="overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

/** Tsonhnii dood hesgiin towchnuud: «Bolih» zuun, undsen uildel baruun tald */
export function ModalFooter({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 px-6 py-4">{children}</div>;
}

/** Form ilgeegdej duusahad (redirect orson ch) tsonhiig haana */
function CloseWhenDone({ onDone, onPending }: { onDone: () => void; onPending: (p: boolean) => void }) {
  const { pending } = useFormStatus();
  const was = useRef(false);
  useEffect(() => {
    onPending(pending);
    if (was.current && !pending) onDone();
    was.current = pending;
  }, [pending, onDone, onPending]);
  return null;
}

function ConfirmSubmit({ tone, children }: { tone: "danger" | "primary"; children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} aria-busy={pending} className={tone === "danger" ? "inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200 disabled:opacity-60" : "btn-primary"}>
      {pending ? <><Spinner /> Түр хүлээнэ үү…</> : children}
    </button>
  );
}

/**
 * Butsaah bolomjgui uildliin towch: darahad batalgaajuulah tsonh neegdej,
 * «Tiim» darsnii daraa l server action duudagdana.
 */
export function ConfirmButton({
  action,
  fields,
  children,
  className = "link",
  title,
  description,
  confirmLabel,
  tone = "danger",
}: {
  action: (fd: FormData) => void | Promise<void>;
  fields: Record<string, string>;
  children: React.ReactNode;
  className?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  confirmLabel: string;
  tone?: "danger" | "primary";
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>{children}</button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        busy={busy}
        variant="alert"
        title={title}
        description={description}
        icon={tone === "danger" ? <TriangleAlert size={20} /> : undefined}
        iconTone={tone === "danger" ? "danger" : "brand"}
      >
        <form action={action}>
          {Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          <CloseWhenDone onDone={() => setOpen(false)} onPending={setBusy} />
          <ModalFooter>
            <button type="button" onClick={() => setOpen(false)} disabled={busy} className="btn-outline">Болих</button>
            <ConfirmSubmit tone={tone}>{confirmLabel}</ConfirmSubmit>
          </ModalFooter>
        </form>
      </Modal>
    </>
  );
}

/** ModalButton-iin dotor baigaa form hadgalagdaj duusahad tsonhiig haahad ashiglana */
const ModalCloseContext = createContext<(() => void) | null>(null);

/**
 * Towch darahad tsonh neegdej, dotor ni ugsun aguulga (ihewchlen server action form) haragdana.
 * Form dotor <ModalCloser /> bairluulbal hadgalsnii daraa tsonh awtomataar haagdana.
 */
export function ModalButton({
  label,
  title,
  description,
  className = "link",
  size = "md",
  children,
}: {
  label: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
  size?: "md" | "lg";
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>{label}</button>
      <Modal open={open} onClose={() => setOpen(false)} title={title} description={description} size={size}>
        <ModalCloseContext.Provider value={() => setOpen(false)}>
          <div className="px-6 pb-6">{children}</div>
        </ModalCloseContext.Provider>
      </Modal>
    </>
  );
}

/** Form-iin dotor bairluulna: ilgeegdej duusahad eh ModalButton-iin tsonhiig haana (tsonhgui bol yuu ch hiihgui) */
export function ModalCloser() {
  const close = useContext(ModalCloseContext);
  const { pending } = useFormStatus();
  const was = useRef(false);
  useEffect(() => {
    if (was.current && !pending) close?.();
    was.current = pending;
  }, [pending, close]);
  return null;
}
