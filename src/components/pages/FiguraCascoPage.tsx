import { useState } from "react";
import {
  Star,
  HardHat,
  Lock,
  ShieldCheck,
  Play,
  Square,
  CheckCircle2,
  Users,
  Vote as VoteIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/store/useAuthStore";
import { useContractStore } from "@/store/useContractStore";
import { useTeamStore } from "@/store/useTeamStore";
import { useFiguraCascoVotingStore } from "@/store/useFiguraCascoVotingStore";
import type { FiguraCascoVoteType } from "@/types/figuraCasco";
import type { View } from "@/App";

interface FiguraCascoPageProps {
  onNavigate: (view: View) => void;
}

const META: Record<
  FiguraCascoVoteType,
  { title: string; icon: typeof Star; emoji: string; singular: string; plural: string }
> = {
  figura: {
    title: "Figura de la Fecha",
    icon: Star,
    emoji: "🏆",
    singular: "Figura de la Fecha",
    plural: "Figuras de la Fecha",
  },
  casco: {
    title: "Casco de la Fecha",
    icon: HardHat,
    emoji: "🪖",
    singular: "Casco de la Fecha",
    plural: "Cascos de la Fecha",
  },
};

function AdminControls({ type }: { type: FiguraCascoVoteType }) {
  const status = useFiguraCascoVotingStore((s) => (type === "figura" ? s.figuraStatus : s.cascoStatus));
  const participation = useFiguraCascoVotingStore((s) =>
    type === "figura" ? s.figuraParticipation : s.cascoParticipation
  );
  const openVoting = useFiguraCascoVotingStore((s) =>
    type === "figura" ? s.openFiguraVoting : s.openCascoVoting
  );
  const closeVoting = useFiguraCascoVotingStore((s) =>
    type === "figura" ? s.closeFiguraVoting : s.closeCascoVoting
  );
  const [busy, setBusy] = useState(false);

  async function handleOpen() {
    setBusy(true);
    try {
      await openVoting();
      toast.success("Votación abierta.");
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[${type}] no se pudo abrir la votación:`, err);
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
      toast.success("Votación cerrada. Ya se puede ver el ganador.");
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[${type}] no se pudo cerrar la votación:`, err);
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
    <div className="rounded-xl2 bg-base-850 border border-base-700 p-5 shadow-soft">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-accent-green" />
          <p className="text-sm font-semibold text-gray-200">Panel de administración</p>
        </div>
        <span
          className={`text-xs font-medium px-2 py-1 rounded-lg ${
            status.open ? "bg-accent-green/10 text-accent-green" : "bg-base-700 text-gray-400"
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
        Mientras está abierta, nadie puede ver resultados parciales ni quién va ganando: solo cuántos ya
        votaron. Abrir la votación reinicia los votos de la ronda anterior.
      </p>
    </div>
  );
}

function ResultPanel({ type }: { type: FiguraCascoVoteType }) {
  const status = useFiguraCascoVotingStore((s) => (type === "figura" ? s.figuraStatus : s.cascoStatus));
  const players = useTeamStore((s) => s.team.players);
  const meta = META[type];

  const winners = status.winnerIds.map((id) => players.find((p) => p.id === id)?.name ?? id);

  if (winners.length === 0) {
    return <p className="text-sm text-gray-500">Nadie votó todavía en esta ronda.</p>;
  }

  return (
    <div className="flex items-start gap-2">
      <span className="text-lg leading-none">{meta.emoji}</span>
      <div>
        <p className="text-xs font-medium text-gray-400">
          {winners.length > 1 ? meta.plural : meta.singular}
        </p>
        <p className="text-gray-100 font-semibold">{winners.join(" y ")}</p>
      </div>
    </div>
  );
}

function BallotForm({ type }: { type: FiguraCascoVoteType }) {
  const players = useTeamStore((s) => s.team.players);
  const castVote = useFiguraCascoVotingStore((s) =>
    type === "figura" ? s.castFiguraVote : s.castCascoVote
  );
  const [twoVotesId, setTwoVotesId] = useState("");
  const [oneVoteId, setOneVoteId] = useState("");
  const [voting, setVoting] = useState(false);

  const sameChoice = !!twoVotesId && twoVotesId === oneVoteId;

  async function handleSubmit() {
    if (!twoVotesId || !oneVoteId || sameChoice) return;
    setVoting(true);
    try {
      await castVote(twoVotesId, oneVoteId);
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
          Tenés 3 votos para repartir: 2 para un jugador y 1 para otro distinto. Tu voto es secreto; nadie
          ve resultados parciales mientras la votación esté abierta.
        </p>
      </div>

      <div>
        <label className="text-xs font-medium text-gray-400">2 votos</label>
        <select
          value={twoVotesId}
          onChange={(e) => setTwoVotesId(e.target.value)}
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
        <label className="text-xs font-medium text-gray-400">1 voto</label>
        <select
          value={oneVoteId}
          onChange={(e) => setOneVoteId(e.target.value)}
          className="mt-1 w-full rounded-lg border border-base-700 bg-base-900 px-3 py-2 text-sm text-gray-100 outline-none focus:ring-1 focus:ring-accent-green"
        >
          <option value="">Elegí un jugador</option>
          {players
            .filter((p) => p.id !== twoVotesId)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
        </select>
      </div>

      {sameChoice && (
        <p className="text-xs text-danger">No podés elegir al mismo jugador para los dos votos.</p>
      )}

      <button
        onClick={handleSubmit}
        disabled={!twoVotesId || !oneVoteId || sameChoice || voting}
        className="flex items-center gap-1.5 rounded-lg bg-accent-green px-4 py-2 text-sm font-semibold text-base-950 disabled:opacity-50"
      >
        <VoteIcon className="h-4 w-4" /> {voting ? "Registrando..." : "Confirmar voto"}
      </button>
      <p className="text-[11px] text-gray-500">Una vez confirmado no vas a poder modificar tu voto.</p>
    </div>
  );
}

function VoteTypeSection({ type }: { type: FiguraCascoVoteType }) {
  const user = useAuthStore((s) => s.user);
  const status = useFiguraCascoVotingStore((s) => (type === "figura" ? s.figuraStatus : s.cascoStatus));
  const statusLoaded = useFiguraCascoVotingStore((s) =>
    type === "figura" ? s.figuraStatusLoaded : s.cascoStatusLoaded
  );
  const myVote = useFiguraCascoVotingStore((s) => (type === "figura" ? s.myFiguraVote : s.myCascoVote));
  const myVoteLoaded = useFiguraCascoVotingStore((s) =>
    type === "figura" ? s.myFiguraVoteLoaded : s.myCascoVoteLoaded
  );
  const meta = META[type];
  const Icon = meta.icon;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5 text-accent-green" />
        <h3 className="text-base font-bold text-white">{meta.title}</h3>
      </div>

      {user?.role === "admin" && <AdminControls type={type} />}

      {(!statusLoaded || !myVoteLoaded) && <p className="text-sm text-gray-500">Cargando...</p>}

      {statusLoaded && myVoteLoaded && (
        <div className="rounded-xl2 bg-base-850 border border-base-700 p-5 sm:p-6 shadow-soft">
          {!status.open ? (
            <>
              <p className="text-sm font-semibold text-gray-200 mb-4">Resultado</p>
              <ResultPanel type={type} />
            </>
          ) : myVote ? (
            <div className="flex items-center gap-2 text-sm text-accent-green">
              <CheckCircle2 className="h-4 w-4" />
              Ya votaste. El resultado se muestra cuando se cierre la votación.
            </div>
          ) : (
            <BallotForm type={type} />
          )}
        </div>
      )}
    </div>
  );
}

export function FiguraCascoPage({ onNavigate }: FiguraCascoPageProps) {
  const user = useAuthStore((s) => s.user);
  const hasAcceptedCurrent = useContractStore((s) => s.hasAcceptedCurrent());
  const myAcceptanceLoaded = useContractStore((s) => s.myAcceptanceLoaded);

  const gateOnContract = user?.role !== "admin" && myAcceptanceLoaded && !hasAcceptedCurrent;

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="max-w-2xl">
        <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-1">
          <VoteIcon className="h-5 w-5 text-accent-green" /> Figura y Casco de la Fecha
        </h2>
        <p className="text-sm text-gray-500">
          3 votos por persona en cada votación: 2 a un jugador, 1 a otro. Secreto e irrevocable.
        </p>
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

      {!gateOnContract && (
        <div className="grid gap-5 lg:grid-cols-2 max-w-5xl">
          <VoteTypeSection type="figura" />
          <VoteTypeSection type="casco" />
        </div>
      )}
    </div>
  );
}
