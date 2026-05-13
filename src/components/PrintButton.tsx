"use client";

export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="text-sm px-4 py-2 rounded-lg bg-accent text-white hover:bg-accent-dark print:hidden"
    >
      📄 Drucken / als PDF speichern
    </button>
  );
}
