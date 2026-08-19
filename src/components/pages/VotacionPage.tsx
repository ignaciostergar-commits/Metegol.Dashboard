import { useMemo, useState } from "react";
import { Lock, Vote, ShieldCheck, Play, Square, CheckCircle2, Users } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/store/useAuthStore";
import { useContractStore } from "@/store/useContractStore";
import { useTeamStore } from "@/store/useTeamStore";
import { useVotingStore } from "@/store/useVotingStore";
import type { View } from "@/App";

interface VotacionPageProps {
  onNavigate: (view: View) => void;
}

function AdminControls() {
  const status = useVotingStore((s) => s.status);
  const participation = useVotingStore((s) => s.participation);
  const openVoting = useVotingStore((s) => s.openVoting);
  const closeVoting = useVotingStore((s) => s.closeVoting);
  const [busy, setBusy] = useState(false);

  async function handleOpen() {
    setBusy(true);
    try {
      await openVoting();
      toast.success("Votación abierta.");
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[votacion] no se pudo abrir la votación:", err);
      const code = (err as { code?: string })?.code;
      toast.error(
        code === "permission-denied"
          ? "No se pudo abrir la votación: faltan permisos. Verificá que firestore.rules esté publicado en Firebase Console."
          : "No se pudo abrir la votación."
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleClose() {
    setBusy(true);
    try {
      await closeVoting();
      toast.success("Votación cerrada. Ya se pueden ver los resultados.");
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[votacion] no se pudo cerrar la votación:", err);
      const code = (err as { code?: string })?.code;
      toast.error(
        code === "permission-denied"
          ? "No se pudo cerrar la votación: faltan permisos. Verificá que firestore.rules esté publicado en Firebase Console."
          : "No se pudo cerrar la votación."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl rounded-xl2 bg-base-850 border border-base-700 p-5 shadow-soft mb-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-accent-green" />
          <p className="text-sm font-semibold text-gray-200">Panel de administración</p>
        </div>
        <span
          className={`text-xs font-medium px-2 py-1 rounded-lg ${
            status.open
              ? "bg-accent-green/10 text-accent-green"
              : "bg-base-700 text-gray-400"
          }`}
        >
          {status.open ? "Votación abierta" : "Votación cerrada"}
        </span>
      </div>

      {status.open && (
        <p className="mt-3 flex items-center gap-1.5 text-sm text-gray-300">
          <Users className="h-3.5 w-3.5 text-accent-blue" />
          Participación: {participation ? `${participation.votedCount} votaron` : "cargando..."}
        </p>
      )}

      <div className="mt-4 flex gap-2">
        {!status.open ? (
          <button
            onClick={handleOpen}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-lg bg-accent-green px-3 py-1.5 text-xs font-semibold text-base-950 disabled:opacity-60"
          >
            <Play className="h-3.5 w-3.5" /> Abrir votación
          </button>
        ) : (
          <button
            onClick={handleClose}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-lg bg-danger px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
          >
            <Square className="h-3.5 w-3.5" /> Cerrar votación
          </button>
        )}
      </div>
      <p className="mt-2 text-[11px] text-gray-500">
        Mientras está abierta, ni vos ni nadie puede ver resultados parciales ni quién va
        ganando: solo cuántos ya votaron. Abrir la votación reinicia los conteos de la ronda
        anterior.
      </p>
    </div>
  );
}

function ResultsPanel() {
  const results = useVotingStore((s) => s.results);
  const players = useTeamStore((s) => s.team.players);

  const nameFor = (id: string) => players.find((p) => p.id === id)?.name ?? id;

  const captainRanking = useMemo(
    () =>
      Object.entries(results?.captainCounts ?? {}).sort((a, b) => b[1] - a[1]),
    [results]
  );
  const subcaptainRanking = useMemo(
    () =>
      Object.entries(results?.subcaptainCounts ?? {}).sort((a, b) => b[1] - a[1]),
    [results]
  );

  if (!results) {
    return <p className="text-sm text-gray-500">Cargando resultados...</p>;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="rounded-lg border border-base-700 p-4">
        <p className="text-sm font-medium text-gray-400 mb-3">Capitán</p>
        {captainRanking.length > 0 ? (
          <ul className="space-y-1.5 text-sm">
            {captainRanking.map(([id, count], i) => (
              <li key={id} className="flex justify-between text-gray-200">
                <span>
                  {i === 0 ? "🥇 " : ""}
                  {nameFor(id)}
                </span>
                <span className="text-accent-green tabular-nums">{count}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-gray-500">Sin votos.</p>
        )}
      </div>
      <div className="rounded-lg border border-base-700 p-4">
        <p className="text-sm font-medium text-gray-400 mb-3">Subcapitán</p>
        {subcaptainRanking.length > 0 ? (
          <ul className="space-y-1.5 text-sm">
            {subcaptainRanking.map(([id, count], i) => (
              <li key={id} className="flex justify-between text-gray-200">
                <span>
                  {i === 0 ? "🥇 " : ""}
                  {nameFor(id)}
                </span>
                <span className="text-accent-blue tabular-nums">{count}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-gray-500">Sin votos.</p>
        )}
      </div>
    </div>
  );
}

function BallotForm() {
  const players = useTeamStore((s) => s.team.players);
  const castVote = useVotingStore((s) => s.castVote);
  const [captainId, setCaptainId] = useState("");
  const [subcaptainId, setSubcaptainId] = useState("");
  const [voting, setVoting] = useState(false);

  const sameChoice = !!captainId && captainId === subcaptainId;

  async function handleSubmit() {
    if (!captainId || !subcaptainId || sameChoice) return;
    setVoting(true);
    try {
      await castVote(captainId, subcaptainId);
      toast.success("Tu voto quedó registrado. ¡Gracias!");
    } catch {
      toast.error("No se pudo registrar tu voto. Probá de nuevo.");
    } finally {
      setVoting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-accent-blue/30 bg-accent-blue/10 p-4">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-accent-blue mb-1">
          <Lock className="h-3.5 w-3.5" /> VOTACIÓN SECRETA
        </p>
        <p className="text-xs text-gray-300 leading-relaxed">
          Tu voto es completamente secreto. Nadie, ni siquiera los administradores, podrá saber a
          quién votaste ni ver los resultados mientras la votación esté abierta. Votá con total
          libertad.
        </p>
      </div>

      <div>
        <label className="text-xs font-medium text-gray-400">Capitán</label>
        <select
          value={captainId}
          onChange={(e) => setCaptainId(e.target.value)}
          className="mt-1 w-full rounded-lg border border-base-700 bg-base-900 px-3 py-2 text-sm text-gray-100 outline-none focus:ring-1 focus:ring-accent-green"
        >
          <option value="">Elegí un jugador</option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-xs font-medium text-gray-400">Subcapitán</label>
        <select
          value={subcaptainId}
          onChange={(e) => setSubcaptainId(e.target.value)}
          className="mt-1 w-full rounded-lg border border-base-700 bg-base-900 px-3 py-2 text-sm text-gray-100 outline-none focus:ring-1 focus:ring-accent-green"
        >
          <option value="">Elegí un jugador</option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {sameChoice && (
        <p className="text-xs text-danger">No podés elegir al mismo jugador para ambos cargos.</p>
      )}

      <button
        onClick={handleSubmit}
        disabled={!captainId || !subcaptainId || sameChoice || voting}
        className="flex items-center gap-1.5 rounded-lg bg-accent-green px-4 py-2 text-sm font-semibold text-base-950 disabled:opacity-50"
      >
        <Vote className="h-4 w-4" /> {voting ? "Registrando..." : "Confirmar voto"}
      </button>
      <p className="text-[11px] text-gray-500">
        Una vez confirmado no vas a poder modificar tu voto.
      </p>
    </div>
  );
}

export function VotacionPage({ onNavigate }: VotacionPageProps) {
  const user = useAuthStore((s) => s.user);
  const hasAcceptedCurrent = useContractStore((s) => s.hasAcceptedCurrent());
  const myAcceptanceLoaded = useContractStore((s) => s.myAcceptanceLoaded);
  const status = useVotingStore((s) => s.status);
  const statusLoaded = useVotingStore((s) => s.statusLoaded);
  const myVote = useVotingStore((s) => s.myVote);
  const myVoteLoaded = useVotingStore((s) => s.myVoteLoaded);

  const gateOnContract = user?.role !== "admin" && myAcceptanceLoaded && !hasAcceptedCurrent;

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="max-w-2xl">
        <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-1">
          <Vote className="h-5 w-5 text-accent-green" /> Votación Capitán / Sub
        </h2>
        <p className="text-sm text-gray-500">Un voto por persona, secreto e irrevocable.</p>
      </div>

      {gateOnContract && (
        <div className="max-w-2xl rounded-xl2 bg-base-850 border border-warn/30 p-5 shadow-soft">
          <p className="text-sm text-gray-200 mb-3">
            Primero tenés que aceptar el contrato vigente para poder votar.
          </p>
          <button
            onClick={() => onNavigate("contrato")}
            className="rounded-lg bg-accent-green px-3 py-1.5 text-xs font-semibold text-base-950"
          >
            Ir al contrato
          </button>
        </div>
      )}

      {!gateOnContract && user?.role === "admin" && <AdminControls />}

      {!gateOnContract && (!statusLoaded || !myVoteLoaded) && (
        <p className="text-sm text-gray-500">Cargando...</p>
      )}

      {!gateOnContract && statusLoaded && myVoteLoaded && (
        <div className="max-w-2xl rounded-xl2 bg-base-850 border border-base-700 p-5 sm:p-6 shadow-soft">
          {!status.open ? (
            <>
              <p className="text-sm font-semibold text-gray-200 mb-4">Resultados</p>
              <ResultsPanel />
            </>
          ) : myVote ? (
            <div className="flex items-center gap-2 text-sm text-accent-green">
              <CheckCircle2 className="h-4 w-4" />
              Ya votaste. Los resultados se muestran cuando se cierre la votación.
            </div>
          ) : (
            <BallotForm />
          )}
        </div>
      )}
    </div>
  );
}
