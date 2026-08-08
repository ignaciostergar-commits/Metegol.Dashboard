import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { Player, PlayerImportRow } from "@/types/player";
import { slugify } from "@/utils/slug";

function toNumber(value: unknown, fallback = 0): number {
  if (value === undefined || value === null || value === "") return fallback;
  const n = typeof value === "number" ? value : parseFloat(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
}

function toBool(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  const s = String(value ?? "").trim().toLowerCase();
  return s === "true" || s === "1" || s === "si" || s === "sí" || s === "x";
}

// Alias en español -> clave interna en inglés que usa el modelo Player.
// Permite que una plantilla de Excel "amigable" (con encabezados en
// castellano) se importe exactamente igual que el CSV técnico.
//
// Los encabezados se normalizan antes de buscar en este mapa (ver
// normalizeHeaderKey): sin tildes, en minúsculas, con guiones/guiones
// bajos/barras convertidos en espacios y sin el sufijo "(SI/NO)". Por eso
// las claves de acá abajo son simples y no hace falta anotar cada variante
// con o sin guion / con o sin acento.
const HEADER_ALIASES: Record<string, keyof PlayerImportRow> = {
  nombre: "name",
  jugador: "name",
  posicion: "position",
  "llegadas tarde": "late_arrivals",
  impuntualidades: "late_arrivals",
  "ausencias sin aviso": "undisclosed_absences",
  "tarjetas rojas": "red_cards",
  rojas: "red_cards",
  "tarjetas amarillas": "yellow_cards",
  amarillas: "yellow_cards",
  "partidos jugados mes": "matches_played_month",
  "ausencias mes": "absences_month",
  "figura de la fecha": "is_figura_fecha",
  "es figura fecha": "is_figura_fecha",
  "casco blooper": "has_blooper",
  "tiene casco": "has_blooper",
  "aporte caja chica": "caja_chica_paid",
  goles: "goals_month",
  "goles mes": "goals_month",
  "valla invicta": "is_valla_invicta_fecha",
  "arco invicto": "is_valla_invicta_fecha",
  "hat trick": "is_hat_trick_fecha",
  hattrick: "is_hat_trick_fecha",
};

// Deja un encabezado listo para buscar en HEADER_ALIASES: sin tildes, en
// minúsculas, con "-", "_" y "/" convertidos en espacio, espacios dobles
// colapsados, y sin el sufijo "(SI/NO)" (que en la plantilla se usa nada
// más como ayuda visual). Así "Hat-trick (SI/NO)", "hat_trick", "Hat Trick"
// y "HAT-TRICK (Si/No)" terminan todos siendo la misma clave "hat trick".
function normalizeHeaderKey(rawKey: string): string {
  return rawKey
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // saca tildes
    .toLowerCase()
    .replace(/[-_/()]/g, " ") // guiones, barras y paréntesis -> espacio
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s*si\s+no\s*$/, "") // saca el sufijo "si no" (ex "(SI/NO)")
    .trim();
}

function normalizeRow(row: Record<string, unknown>): PlayerImportRow {
  const normalized: Record<string, unknown> = {};
  Object.entries(row).forEach(([rawKey, value]) => {
    const key = normalizeHeaderKey(rawKey);
    const mappedKey = HEADER_ALIASES[key] ?? key;
    normalized[mappedKey] = value;
  });
  return normalized as unknown as PlayerImportRow;
}

/**
 * Normaliza una fila cruda del Excel/CSV (encabezados flexibles)
 * al modelo interno Player que usa el dashboard.
 */
// Slug determinístico a partir del nombre: el mismo jugador siempre saca
// el mismo id entre importaciones (a diferencia de un id basado en el
// índice de fila), así no se pierde el vínculo con su usuario de login
// ni el contador histórico de vallas invictas.
function rowToPlayer(row: PlayerImportRow, index: number): Player {
  const name = (row.name ?? `Jugador ${index + 1}`).toString().trim();
  return {
    id: `imported-${slugify(name) || index}`,
    name,
    avatar_url: "",
    position: row.position ? String(row.position).trim() : "",
    late_arrivals: toNumber(row.late_arrivals),
    undisclosed_absences: toNumber(row.undisclosed_absences),
    red_cards: toNumber(row.red_cards),
    yellow_cards: toNumber(row.yellow_cards),
    matches_played_month: toNumber(row.matches_played_month),
    absences_month: toNumber(row.absences_month),
    is_figura_fecha: toBool(row.is_figura_fecha),
    has_blooper: toBool(row.has_blooper),
    caja_chica_paid: toNumber(row.caja_chica_paid),
    goals_month: toNumber(row.goals_month),
    is_valla_invicta_fecha: toBool(row.is_valla_invicta_fecha),
    is_hat_trick_fecha: toBool(row.is_hat_trick_fecha),
    // El contador histórico de vallas invictas NO se importa del Excel:
    // el store lo acumula solo, comparando con el jugador ya guardado.
    // Se deja en 0 acá y useTeamStore.importPlayers() lo recalcula.
    clean_sheets_total: 0,
  };
}

/**
 * Parsea un archivo CSV usando papaparse.
 */
export function parseCSVFile(file: File): Promise<Player[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const players = results.data
            .map((row) => normalizeRow(row))
            .filter((row) => row && row.name)
            .map((row, i) => rowToPlayer(row, i));
          resolve(players);
        } catch (err) {
          reject(err);
        }
      },
      error: (err) => reject(err),
    });
  });
}

/**
 * Parsea un archivo Excel (.xlsx/.xls) usando la librería xlsx.
 * Toma la primera hoja del libro.
 */
export function parseExcelFile(file: File): Promise<Player[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
          defval: "",
        });

        // normalizamos encabezados (incluye alias en español) antes de mapear
        const normalizedRows: PlayerImportRow[] = rawRows.map((row) => normalizeRow(row));

        const players = normalizedRows
          .filter((row) => row && row.name)
          .map((row, i) => rowToPlayer(row, i));

        resolve(players);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsBinaryString(file);
  });
}

// Columna obligatoria: sin nombre no hay forma de identificar al jugador.
const REQUIRED_COLUMNS: (keyof PlayerImportRow)[] = ["name"];

// Columnas de estadísticas que el dashboard sabe mostrar. Si faltan,
// igual se importa (quedan en 0/false) pero se avisa cuáles faltaron.
const KNOWN_STAT_COLUMNS: (keyof PlayerImportRow)[] = [
  "late_arrivals",
  "undisclosed_absences",
  "red_cards",
  "yellow_cards",
  "matches_played_month",
  "absences_month",
  "is_figura_fecha",
  "has_blooper",
  "caja_chica_paid",
  "goals_month",
  "is_valla_invicta_fecha",
  "is_hat_trick_fecha",
];

const COLUMN_LABELS: Record<string, string> = {
  name: "Nombre",
  late_arrivals: "Llegadas tarde",
  undisclosed_absences: "Ausencias sin aviso",
  red_cards: "Tarjetas rojas",
  yellow_cards: "Tarjetas amarillas",
  matches_played_month: "Partidos jugados (mes)",
  absences_month: "Ausencias (mes)",
  is_figura_fecha: "Figura de la fecha",
  has_blooper: "Casco/blooper",
  caja_chica_paid: "Aporte caja chica",
  goals_month: "Goles",
  is_valla_invicta_fecha: "Valla invicta",
  is_hat_trick_fecha: "Hat-trick",
};

export interface ImportResult {
  players: Player[];
  missingColumns: string[];
}

function validateAndReport(normalizedRows: PlayerImportRow[]): string[] {
  if (normalizedRows.length === 0) {
    throw new Error("El archivo no tiene filas de datos.");
  }

  const presentKeys = new Set<string>();
  normalizedRows.forEach((row) => {
    Object.keys(row).forEach((k) => presentKeys.add(k));
  });

  const missingRequired = REQUIRED_COLUMNS.filter((c) => !presentKeys.has(c));
  if (missingRequired.length > 0) {
    const labels = missingRequired.map((c) => COLUMN_LABELS[c] ?? c).join(", ");
    throw new Error(
      `Faltan columnas obligatorias en el archivo: ${labels}. Revisá los encabezados y volvé a intentar.`
    );
  }

  return KNOWN_STAT_COLUMNS.filter((c) => !presentKeys.has(c)).map(
    (c) => COLUMN_LABELS[c] ?? c
  );
}

/**
 * Punto de entrada único: decide el parser según la extensión del archivo,
 * valida encabezados y devuelve tanto los jugadores como las columnas
 * conocidas que no vinieron en el archivo (para avisar, sin bloquear).
 */
export async function parsePlayersFile(file: File): Promise<ImportResult> {
  const ext = file.name.split(".").pop()?.toLowerCase();

  let rawNormalizedRows: PlayerImportRow[];
  let players: Player[];

  if (ext === "csv") {
    const parsed = await new Promise<{ rows: PlayerImportRow[]; players: Player[] }>(
      (resolve, reject) => {
        Papa.parse<Record<string, unknown>>(file, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            try {
              const rows = results.data.map((row) => normalizeRow(row));
              const filtered = rows.filter((row) => row && row.name);
              resolve({ rows: filtered, players: filtered.map((row, i) => rowToPlayer(row, i)) });
            } catch (err) {
              reject(err);
            }
          },
          error: (err) => reject(err),
        });
      }
    );
    rawNormalizedRows = parsed.rows;
    players = parsed.players;
  } else if (ext === "xlsx" || ext === "xls") {
    const parsed = await new Promise<{ rows: PlayerImportRow[]; players: Player[] }>(
      (resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = e.target?.result;
            const workbook = XLSX.read(data, { type: "binary" });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
              defval: "",
            });
            const rows = rawRows
              .map((row) => normalizeRow(row))
              .filter((row) => row && row.name);
            resolve({ rows, players: rows.map((row, i) => rowToPlayer(row, i)) });
          } catch (err) {
            reject(err);
          }
        };
        reader.onerror = reject;
        reader.readAsBinaryString(file);
      }
    );
    rawNormalizedRows = parsed.rows;
    players = parsed.players;
  } else {
    throw new Error("Formato no soportado. Subí un archivo .csv, .xlsx o .xls");
  }

  const missingColumns = validateAndReport(rawNormalizedRows);
  return { players, missingColumns };
}
