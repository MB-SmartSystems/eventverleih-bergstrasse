/**
 * Baserow REST API client — Database-Token-Auth (Row CRUD only).
 * Schema-Operationen (Tabellen/Felder) sind hier NICHT moeglich.
 *
 * ENV:
 *   BASEROW_BASE_URL   = https://baserow.mb-smartsystems.de
 *   BASEROW_TOKEN      = <Database Token mit RW-Rechten auf DB 267>
 */

const BASE = process.env.BASEROW_BASE_URL || "https://baserow.mb-smartsystems.de";
const TOKEN = process.env.BASEROW_TOKEN;

export const TABLES = {
  Kunden: 949,
  Buchungen: 951,
  Angebote: 952,
  Rechnungen: 950,
  EmailLog: 953,
  Aufgaben: 954,
  Artikel: 957,
  System_Konfiguration: 955,
  ELSTER_Zeile_Mapping: 956,
  Einnahmen: 961,
  Ausgaben: 962,
  Fahrten: 963,
  Member_Account: 967,
  Buchungs_Position: 968,
  MailQueue: 969,
  Audit_Log: 970,
  Pakete: 971,
} as const;

function authHeaders(): HeadersInit {
  if (!TOKEN) throw new Error("BASEROW_TOKEN missing");
  return {
    Authorization: `Token ${TOKEN}`,
    "Content-Type": "application/json",
  };
}

export async function getRow<T = Record<string, unknown>>(
  tableId: number,
  rowId: number
): Promise<T> {
  const url = `${BASE}/api/database/rows/table/${tableId}/${rowId}/?user_field_names=true`;
  const r = await fetch(url, { headers: authHeaders(), cache: "no-store" });
  if (!r.ok) throw new Error(`Baserow get ${tableId}/${rowId} failed: HTTP ${r.status}`);
  return r.json();
}

export async function listRows<T = Record<string, unknown>>(
  tableId: number,
  opts: { search?: string; size?: number; page?: number } = {}
): Promise<{ count: number; results: T[] }> {
  const params = new URLSearchParams({ user_field_names: "true" });
  if (opts.search) params.set("search", opts.search);
  if (opts.size) params.set("size", String(opts.size));
  if (opts.page) params.set("page", String(opts.page));
  const url = `${BASE}/api/database/rows/table/${tableId}/?${params}`;
  const r = await fetch(url, { headers: authHeaders(), cache: "no-store" });
  if (!r.ok) throw new Error(`Baserow list ${tableId} failed: HTTP ${r.status}`);
  return r.json();
}

export async function createRow<T = Record<string, unknown>>(
  tableId: number,
  data: Record<string, unknown>
): Promise<T> {
  const url = `${BASE}/api/database/rows/table/${tableId}/?user_field_names=true`;
  const r = await fetch(url, { method: "POST", headers: authHeaders(), body: JSON.stringify(data) });
  if (!r.ok) {
    const errBody = await r.text();
    throw new Error(`Baserow create ${tableId} failed: HTTP ${r.status} ${errBody.slice(0, 200)}`);
  }
  return r.json();
}

export async function deleteRow(tableId: number, rowId: number): Promise<void> {
  const url = `${BASE}/api/database/rows/table/${tableId}/${rowId}/`;
  const r = await fetch(url, { method: "DELETE", headers: authHeaders() });
  if (!r.ok && r.status !== 404) {
    throw new Error(`Baserow delete ${tableId}/${rowId} failed: HTTP ${r.status}`);
  }
}

export async function updateRow<T = Record<string, unknown>>(
  tableId: number,
  rowId: number,
  data: Record<string, unknown>
): Promise<T> {
  const url = `${BASE}/api/database/rows/table/${tableId}/${rowId}/?user_field_names=true`;
  const r = await fetch(url, { method: "PATCH", headers: authHeaders(), body: JSON.stringify(data) });
  if (!r.ok) {
    const errBody = await r.text();
    throw new Error(`Baserow update ${tableId}/${rowId} failed: HTTP ${r.status} ${errBody.slice(0, 200)}`);
  }
  return r.json();
}
