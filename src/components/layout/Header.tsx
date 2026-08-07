import { ShieldCheck, User, Menu, LogOut } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import { ImportButton } from "@/components/ImportButton";

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-base-700 bg-base-900/60 px-4 sm:px-6 py-4 backdrop-blur">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onMenuClick}
          className="lg:hidden shrink-0 text-gray-400 hover:text-white p-1 -ml-1"
          aria-label="Abrir menú"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold text-white truncate">METEGOL FC</h1>
          <p className="text-xs sm:text-sm text-gray-500 truncate">Hola, {user?.name} 👋</p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <div
          className={`flex items-center gap-1.5 rounded-lg border border-base-700 bg-base-850 px-2.5 sm:px-3 py-1.5 text-xs font-medium ${
            user?.role === "admin" ? "text-accent-green" : "text-gray-400"
          }`}
        >
          {user?.role === "admin" ? (
            <ShieldCheck className="h-3.5 w-3.5" />
          ) : (
            <User className="h-3.5 w-3.5" />
          )}
          <span className="hidden sm:inline">
            {user?.role === "admin" ? "Administrador" : "Jugador"}
          </span>
        </div>

        {user?.role === "admin" && <ImportButton />}

        <button
          onClick={logout}
          title="Cerrar sesión"
          className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-base-800 transition-colors"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
