import { useEffect, useState } from "react";
import { Star, HardHat, Lock, ShieldCheck, Play, Square, CheckCircle2, Users } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/store/useAuthStore";
import { useTeamStore } from "@/store/useTeamStore";
import { useMatchFiguraCascoStore } from "@/store/useMatchFiguraCascoStore";
import type { Match, MatchVoteType } from "@/types/match";

interface FiguraCascoFechaProps {
  matchId: string;
  match: Match;
}

// Figura y Casco de UNA fecha puntual (Bloque 3). Vive dentro de
// FechaDetalle (FechasPage.tsx), no reemplaza ni toca la página global de
// Figura/Casco (FiguraCascoPage.tsx / useFiguraCascoVotingStore.ts), que
// sigue siendo una ronda independiente de toda la temporada.
const META: Record<
  MatchVoteType,
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

function AdminControls({ matchId, type, open }: { matchId: string; type: MatchVoteType; open: boolean }) {
  const participation = useMatchFiguraCascoStore((s) =>
    type === "figura" ? s.figuraParticipation : s.cascoParticipation
  );
  const openVoting = useMatchFiguraCascoStore((s) => s.openVoting);
  const closeVoting = useMatchFiguraCascoStore((s) => s.closeVoting);
  const [busy, setBusy] = useState(false);

  async function handleOpen() {
    setBusy(true);
    try {
      await openVoting(matchId, type);
      toast.success("Votación abierta.");
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[fecha ${matchId} - ${type}] no se pudo abrir:`, err);
      const message = err instanceof Error ? err.message : "";
      const code = (err as { code?: string })?.code;
      if (message === "voting-already-started") {
        toast.error("Esta votación ya se abrió antes para esta fecha -no se puede reiniciar.");
      } else if (message === "match-closed" || code === "permission-denied") {
        toast.error("Esta fecha está cerrada -no se puede abrir la votación.");
      } else {
        toast.error("No se pudo abrir la votación.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleClose() {
    setBusy(true);
    try {
      await closeVoting(matchId, type);
      toast.success("Votación cerrada. Ya se puede ver el ganador.");
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[fecha ${matchId} - ${type}] no se pudo cerrar:`, err);
      toast.error("No se pudo cerrar la votación.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-base-700 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-300">
          <ShieldCheck className="h-3.5 w-3.5 text-accent-green" /> Admin
        </span>
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded-lg ${
            open ? "bg-accent-green/10 text-accent-green" : "bg-base-700 text-gray-400"
          }`}
        >
          {open ? "Abierta" : "Cerrada"}
        </span>
      </div>

      {open && (
        <p className="flex items-center gap-1.5 text-xs text-gray-400">
          <Users className="h-3 w-3 text-accent-blue" />
          {participation ? `${participation.votedCount} votaron` : "cargando..."}
        </p>
      )}

      {!open ? (
        <button
          onClick={handleOpen}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-lg bg-accent-green px-3 py-1.5 text-xs font-semibold text-base-950 disabled:opacity-60"
        >
          <Play className="h-3.5 w-3.5" /> Abrir
        </button>
      ) : (
        <button
          onClick={handleClose}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-lg bg-danger px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
        >
          <Square className="h-3.5 w-3.5" /> Cerrar
        </button>
      )}
    </div>
  );
}

function ResultBlock({ type, winnerIds }: { type: MatchVoteType; winnerIds: string[] }) {
  const players = useTeamStore((s) => s.team.players);
  const meta = META[type];
  const winners = winnerIds.map((id) => players.find((p) => p.id === id)?.name ?? id);

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

function BallotForm({ matchId, type }: { matchId: string; type: MatchVoteType }) {
  const players = useTeamStore((s) => s.team.players);
  const castVote = useMatchFiguraCascoStore((s) => s.castVote);
  const [twoVotesId, setTwoVotesId] = useState("");
  const [oneVoteId, setOneVoteId] = useState("");
  const [voting, setVoting] = useState(false);
  const sameChoice = !!twoVotesId && twoVotesId === oneVoteId;

  async function handleSubmit() {
    if (!twoVotesId || !oneVoteId || sameChoice) return;
    setVoting(true);
    try {
      await castVote(matchId, type, twoVotesId, oneVoteId);
      toast.success("Tu voto quedó registrado. ¡Gracias!");
    } catch {
      toast.error("No se pudo registrar tu voto. Probá de nuevo.");
    } finally {
      setVoting(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-accent-blue/30 bg-accent-blue/10 p-3">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-accent-blue mb-1">
          <Lock className="h-3.5 w-3.5" /> VOTACIÓN SECRETA
        </p>
        <p className="text-xs text-gray-300 leading-relaxed">2 votos a un jugador, 1 a otro distinto.</p>
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
        {voting ? "Registrando..." : "Confirmar voto"}
      </button>
    </div>
  );
}

function VoteSection({
  matchId,
  type,
  fechaOpen,
  winnerIds,
}: {
  matchId: string;
  type: MatchVoteType;
  fechaOpen: boolean;
  winnerIds: string[];
}) {
  const user = useAuthStore((s) => s.user);
  const status = useMatchFiguraCascoStore((s) => (type === "figura" ? s.figuraStatus : s.cascoStatus));
  const statusLoaded = useMatchFiguraCascoStore((s) =>
    type === "figura" ? s.figuraStatusLoaded : s.cascoStatusLoaded
  );
  const myVote = useMatchFiguraCascoStore((s) => (type === "figura" ? s.myFiguraVote : s.myCascoVote));
  const myVoteLoaded = useMatchFiguraCascoStore((s) =>
    type === "figura" ? s.myFiguraVoteLoaded : s.myCascoVoteLoaded
  );
  const meta = META[type];
  const Icon = meta.icon;

  // La fecha cerrada manda por sobre cualquier otro estado: aunque
  // status.open siguiera en true (no se fuerza a false en cascada al
  // cerrar la fecha, es una decisión de diseño ya documentada), acá no se
  // muestra ningún control ni papeleta.
  const votingOpen = fechaOpen && status.open;

  return (
    <div className="rounded-xl2 bg-base-850 border border-base-700 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-accent-green" />
        <p className="text-sm font-semibold text-gray-200">{meta.title}</p>
      </div>

      {user?.role === "admin" && fechaOpen && (
        <AdminControls matchId={matchId} type={type} open={status.open} />
      )}

      {(!statusLoaded || !myVoteLoaded) && <p className="text-sm text-gray-500">Cargando...</p>}

      {statusLoaded && myVoteLoaded && (
        <>
          {!votingOpen ? (
            <ResultBlock type={type} winnerIds={winnerIds} />
          ) : myVote ? (
            <div className="flex items-center gap-2 text-sm text-accent-green">
              <CheckCircle2 className="h-4 w-4" /> Ya votaste.
            </div>
          ) : (
            <BallotForm matchId={matchId} type={type} />
          )}
        </>
      )}
    </div>
  );
}

export function FiguraCascoFecha({ matchId, match }: FiguraCascoFechaProps) {
  const setActiveMatch = useMatchFiguraCascoStore((s) => s.setActiveMatch);

  useEffect(() => {
    setActiveMatch(matchId);
    return () => setActiveMatch(null);
  }, [matchId, setActiveMatch]);

  const fechaOpen = match.status === "open";

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <VoteSection matchId={matchId} type="figura" fechaOpen={fechaOpen} winnerIds={match.figuraWinnerIds} />
      <VoteSection matchId={matchId} type="casco" fechaOpen={fechaOpen} winnerIds={match.cascoWinnerIds} />
    </div>
  );
}
