import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { JugadoresPage } from "@/components/pages/JugadoresPage";
import { ContratoPage } from "@/components/pages/ContratoPage";
import { HistorialPage } from "@/components/pages/HistorialPage";
import { VotacionPage } from "@/components/pages/VotacionPage";
import { FiguraCascoPage } from "@/components/pages/FiguraCascoPage";
import { ToastManager } from "@/components/ToastManager";
import { Login } from "@/components/Login";
import { useAuthStore } from "@/store/useAuthStore";

export type View = "dashboard" | "jugadores" | "contrato" | "historial" | "votacion" | "figura-casco";

function App() {
  const [view, setView] = useState<View>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const user = useAuthStore((s) => s.user);
  const authLoading = useAuthStore((s) => s.loading);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-base-950">
        <Loader2 className="h-6 w-6 animate-spin text-accent-green" />
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  function handleNavigate(v: View) {
    setView(v);
    setSidebarOpen(false);
  }

  return (
    <div className="flex min-h-screen bg-base-950 text-gray-100">
      <Sidebar
        currentView={view}
        onNavigate={handleNavigate}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex flex-1 flex-col min-w-0">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 min-w-0">
          {view === "dashboard" && <Dashboard />}
          {view === "jugadores" && <JugadoresPage />}
          {view === "contrato" && <ContratoPage />}
          {view === "historial" && <HistorialPage />}
          {view === "votacion" && <VotacionPage onNavigate={handleNavigate} />}
          {view === "figura-casco" && <FiguraCascoPage onNavigate={handleNavigate} />}
        </main>
      </div>

      <ToastManager />
    </div>
  );
}

export default App;
