"use client";

export function PrintButton() {
  return (
    <button onClick={() => window.print()} className="btn-primary">
      Хэвлэх / PDF болгох
    </button>
  );
}
