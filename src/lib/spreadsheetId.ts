/**
 * Extrai o ID de uma planilha Google a partir de URL completa ou texto colado.
 */
export function extractSpreadsheetId(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const fromUrl = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (fromUrl?.[1]) return fromUrl[1];

  // ID típico: alfanumérico e hífen, comprimento suficiente
  if (/^[a-zA-Z0-9-_]{30,128}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}
