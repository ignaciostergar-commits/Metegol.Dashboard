import { LayoutGrid, FileText, Users, Trophy, Vote, X } from "lucide-react";
import type { View } from "@/App";
import escudo from "@/assets/escudo.jpeg";

const navItems: { icon: typeof LayoutGrid; label: string; view: View }[] = [
  { icon: LayoutGrid, label: "Dashboard", view: "dashboard" },
  { icon: Users, label: "Jugadores", view: "jugadores" },
  { icon: FileText, label: "Contrato", view: "contrato" },
  { icon: Vote, label: "Votación Capitán / Sub", view: "votacion" },
  { icon: Trophy, label: "Historial", view: "historial" },
];

interface SidebarProps {
  currentView: View;
  onNavigate: (view: View) => void;
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ currentView, onNavigate, open, onClose }: SidebarProps) {
  const content = (
    <>
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2.5 min-w-0">
          <img
            src={escudo}
            alt="Escudo Metegol FC"
            className="h-10 w-10 shrink-0 rounded-lg object-contain bg-white/95 p-0.5 ring-1 ring-accent-green/30"
          />
          <div className="min-w-0">
            <p className="text-sm font-bold text-white leading-tight truncate">Metegol FC</p>
            <p className="text-xs text-gray-500 leading-tight truncate">Panel de control</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="lg:hidden shrink-0 text-gray-400 hover:text-white p-1"
          aria-label="Cerrar menú"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="mt-8 flex flex-col gap-1">
        {navItems.map(({ icon: Icon, label, view }) => {
          const active = currentView === view;
          return (
            <button
              key={label}
              onClick={() => onNavigate(view)}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-accent-green/10 text-accent-green ring-1 ring-accent-green/20"
                  : "text-gray-400 hover:bg-base-800 hover:text-gray-200"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto rounded-xl2 bg-base-850 border border-base-700 p-4">
        <p className="text-xs text-gray-500">Temporada 2026</p>
        <p className="text-sm font-semibold text-gray-200 mt-1">AREIA — Torneo activo</p>
      </div>
    </>
  );

  return (
    <>
      {/* Sidebar fijo en desktop */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-base-700 bg-base-900 p-5">
        {content}
      </aside>

      {/* Overlay + drawer en mobile/tablet */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/60"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={`lg:hidden fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-base-700 bg-base-900 p-5 transition-transform duration-200 ease-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {content}
      </aside>
    </>
  );
}
