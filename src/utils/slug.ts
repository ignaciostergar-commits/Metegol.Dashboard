// Convierte texto libre (nombres de jugador, etiquetas de mes, etc.) en un
// slug apto para usar como id de documento en Firestore: minúsculas, sin
// acentos, sin espacios ni símbolos.
export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
