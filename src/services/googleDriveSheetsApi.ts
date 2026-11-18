import { AppDataState } from '../types/yasinan';
import { formatTanggalID } from '../utils/formatters';

export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  size?: string;
  webViewLink?: string;
}

export interface SheetTabInfo {
  sheetId: number;
  title: string;
  index: number;
  rowCount?: number;
  columnCount?: number;
}

export interface SpreadsheetMetadata {
  spreadsheetId: string;
  title: string;
  spreadsheetUrl?: string;
  sheets: SheetTabInfo[];
}

export class WorkspaceApiError extends Error {
  status: number;
  isAuthError: boolean;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'WorkspaceApiError';
    this.status = status;
    this.isAuthError = status === 401;
  }
}

async function handleApiResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `Permintaan gagal dengan status ${res.status}`;
    try {
      const errBody = await res.json();
      if (errBody?.error?.message) {
        message = errBody.error.message;
      }
    } catch {
      // Ignore JSON parse error
    }
    throw new WorkspaceApiError(message, res.status);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

function escapeSheetTitle(sheetTitle: string): string {
  return `'${sheetTitle.replace(/'/g, "''")}'`;
}

export const SPREADSHEET_MIME = 'application/vnd.google-apps.spreadsheet';
export const FOLDER_MIME = 'application/vnd.google-apps.folder';

export async function listDriveFiles(
  accessToken: string,
  options: {
    searchQuery?: string;
    mimeFilter?: 'ALL' | 'SPREADSHEET' | 'JSON';
    pageSize?: number;
  } = {}
): Promise<DriveFileItem[]> {
  const { searchQuery = '', mimeFilter = 'ALL', pageSize = 30 } = options;
  const clauses: string[] = ['trashed = false'];

  if (mimeFilter === 'SPREADSHEET') {
    clauses.push(`mimeType = '${SPREADSHEET_MIME}'`);
  } else if (mimeFilter === 'JSON') {
    clauses.push(`(mimeType = 'application/json' or name contains '.json')`);
  } else {
    clauses.push(`mimeType != '${FOLDER_MIME}'`);
  }

  const trimmed = searchQuery.trim().replace(/'/g, "\\'");
  if (trimmed) {
    clauses.push(`name contains '${trimmed}'`);
  }

  const params = new URLSearchParams({
    q: clauses.join(' and '),
    fields: 'files(id,name,mimeType,modifiedTime,size,webViewLink)',
    orderBy: 'modifiedTime desc',
    pageSize: String(pageSize),
  });

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  const data = await handleApiResponse<{ files?: DriveFileItem[] }>(res);
  return data.files ?? [];
}

export async function ensureYasinanFolder(accessToken: string): Promise<string> {
  const params = new URLSearchParams({
    q: `name = 'Kas & Jadwal Yasinan' and mimeType = '${FOLDER_MIME}' and trashed = false`,
    fields: 'files(id,name)',
    pageSize: '1',
  });

  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  const searchData = await handleApiResponse<{ files?: { id: string }[] }>(
    searchRes
  );
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'Kas & Jadwal Yasinan',
      mimeType: FOLDER_MIME,
    }),
  });
  const created = await handleApiResponse<{ id: string }>(createRes);
  return created.id;
}

export async function uploadJsonBackupToDrive(
  accessToken: string,
  fileName: string,
  payload: AppDataState
): Promise<DriveFileItem> {
  const folderId = await ensureYasinanFolder(accessToken);
  const safeName = fileName.endsWith('.json') ? fileName : `${fileName}.json`;

  const metadata = {
    name: safeName,
    mimeType: 'application/json',
    parents: [folderId],
  };

  const boundary = 'yasinan_drive_multipart_boundary';
  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(payload, null, 2),
    `--${boundary}--`,
  ].join('\r\n');

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,modifiedTime,size,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );
  return handleApiResponse<DriveFileItem>(res);
}

export async function downloadDriveJsonFile(
  accessToken: string,
  fileId: string
): Promise<unknown> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  return handleApiResponse<unknown>(res);
}

export async function deleteDriveFile(
  accessToken: string,
  fileId: string
): Promise<void> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  await handleApiResponse<void>(res);
}

export async function getSpreadsheetMetadata(
  accessToken: string,
  spreadsheetId: string
): Promise<SpreadsheetMetadata> {
  const params = new URLSearchParams({
    fields:
      'spreadsheetId,properties.title,spreadsheetUrl,sheets.properties(sheetId,title,index,gridProperties)',
  });

  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?${params.toString()}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  const raw = await handleApiResponse<{
    spreadsheetId: string;
    properties?: { title?: string };
    spreadsheetUrl?: string;
    sheets?: Array<{
      properties?: {
        sheetId: number;
        title: string;
        index: number;
        gridProperties?: { rowCount?: number; columnCount?: number };
      };
    }>;
  }>(res);

  return {
    spreadsheetId: raw.spreadsheetId,
    title: raw.properties?.title ?? 'Tanpa Judul',
    spreadsheetUrl: raw.spreadsheetUrl,
    sheets: (raw.sheets ?? [])
      .map((s) => ({
        sheetId: s.properties?.sheetId ?? 0,
        title: s.properties?.title ?? '',
        index: s.properties?.index ?? 0,
        rowCount: s.properties?.gridProperties?.rowCount,
        columnCount: s.properties?.gridProperties?.columnCount,
      }))
      .filter((s) => s.title.length > 0),
  };
}

export async function readSheetValues(
  accessToken: string,
  spreadsheetId: string,
  sheetTitle: string,
  rangeSuffix = 'A1:Z500'
): Promise<string[][]> {
  const range = `${escapeSheetTitle(sheetTitle)}!${rangeSuffix}`;
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values/${encodeURIComponent(range)}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  const data = await handleApiResponse<{ values?: string[][] }>(res);
  return data.values ?? [];
}

export const YASINAN_SHEET_TABS = [
  'Periode',
  'Data Anggota',
  'Jadwal & Penyerahan',
  'Setoran Anggota',
  'Kas Amalan & Kambing',
  'Tunggakan Awal',
] as const;

function buildExportSheetRows(
  data: AppDataState
): Array<{ title: string; values: (string | number)[][] }> {
  const memberMap = new Map(
    data.anggotas.map((a) => [a.AnggotaID, a.NamaLengkap])
  );
  const jadwalMap = new Map(
    data.jadwals.map((j) => [j.JadwalID, `Pertemuan Ke-${j.PertemuanKe}`])
  );

  const periodeRows: (string | number)[][] = [
    [
      'PeriodeID',
      'NamaPeriode',
      'TanggalMulai',
      'TanggalSelesai',
      'SaldoAwalPeriode',
      'SaldoAwalKambing',
      'SaldoAwalAmalan',
      'NominalArisanPerOrang',
      'NominalKambingPerOrang',
      'StatusPeriode',
    ],
    ...data.periodes.map((p) => [
      p.PeriodeID,
      p.NamaPeriode,
      formatTanggalID(p.TanggalMulai),
      formatTanggalID(p.TanggalSelesai),
      p.SaldoAwalPeriode,
      p.SaldoAwalKambing,
      p.SaldoAwalAmalan,
      p.NominalArisanPerOrang,
      p.NominalKambingPerOrang,
      p.StatusPeriode,
    ]),
  ];

  const anggotaRows: (string | number)[][] = [
    [
      'AnggotaID',
      'NamaLengkap',
      'Alamat',
      'NoTelepon',
      'StatusAktif',
      'IkutIuranKambing',
    ],
    ...data.anggotas.map((a) => [
      a.AnggotaID,
      a.NamaLengkap,
      a.Alamat,
      a.NoTelepon,
      a.StatusAktif,
      a.IkutIuranKambing ? 'Ya' : 'Tidak',
    ]),
  ];

  const jadwalRows: (string | number)[][] = [
    [
      'JadwalID',
      'PeriodeID',
      'PertemuanKe',
      'TanggalAcara',
      'AnggotaID',
      'TuanRumah',
      'NominalArisanDiterima',
      'StatusPenyerahan',
      'Catatan',
    ],
    ...data.jadwals.map((j) => [
      j.JadwalID,
      j.PeriodeID,
      j.PertemuanKe,
      formatTanggalID(j.TanggalAcara),
      j.AnggotaID,
      memberMap.get(j.AnggotaID) ?? '-',
      j.NominalArisanDiterima,
      j.StatusPenyerahan,
      j.Catatan,
    ]),
  ];

  const setoranRows: (string | number)[][] = [
    [
      'SetoranID',
      'PeriodeID',
      'JadwalID',
      'Pertemuan',
      'AnggotaID',
      'NamaAnggota',
      'NominalArisan',
      'StatusArisan',
      'NominalKambing',
      'StatusKambing',
      'TanggalBayar',
    ],
    ...data.setorans.map((s) => [
      s.SetoranID,
      s.PeriodeID,
      s.JadwalID,
      jadwalMap.get(s.JadwalID) ?? s.JadwalID,
      s.AnggotaID,
      memberMap.get(s.AnggotaID) ?? '-',
      s.NominalArisan,
      s.StatusArisan,
      s.NominalKambing,
      s.StatusKambing,
      s.TanggalBayar ? formatTanggalID(s.TanggalBayar) : '-',
    ]),
  ];

  const kasRows: (string | number)[][] = [
    [
      'TransaksiID',
      'TanggalTransaksi',
      'KategoriKas',
      'JenisTransaksi',
      'Nominal',
      'Keterangan',
    ],
    ...data.transaksiKas.map((k) => [
      k.TransaksiID,
      formatTanggalID(k.TanggalTransaksi),
      k.KategoriKas,
      k.JenisTransaksi,
      k.Nominal,
      k.Keterangan,
    ]),
  ];

  const tunggakanRows: (string | number)[][] = [
    [
      'TunggakanID',
      'PeriodeID',
      'AnggotaID',
      'NamaAnggota',
      'Nominal',
      'StatusBayar',
      'TanggalBayar',
      'Keterangan',
    ],
    ...data.tunggakanAwals.map((t) => [
      t.TunggakanID,
      t.PeriodeID,
      t.AnggotaID,
      memberMap.get(t.AnggotaID) ?? '-',
      t.Nominal,
      t.StatusBayar,
      t.TanggalBayar ? formatTanggalID(t.TanggalBayar) : '-',
      t.Keterangan,
    ]),
  ];

  return [
    { title: 'Periode', values: periodeRows },
    { title: 'Data Anggota', values: anggotaRows },
    { title: 'Jadwal & Penyerahan', values: jadwalRows },
    { title: 'Setoran Anggota', values: setoranRows },
    { title: 'Kas Amalan & Kambing', values: kasRows },
    { title: 'Tunggakan Awal', values: tunggakanRows },
  ];
}

export async function createYasinanSpreadsheet(
  accessToken: string,
  title: string,
  data: AppDataState
): Promise<SpreadsheetMetadata> {
  const sheetData = buildExportSheetRows(data);

  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: { title: title.trim() || 'Laporan Kas & Jadwal Yasinan' },
      sheets: sheetData.map((tab, idx) => ({
        properties: { title: tab.title, index: idx },
      })),
    }),
  });

  const created = await handleApiResponse<{
    spreadsheetId: string;
    properties?: { title?: string };
    spreadsheetUrl?: string;
    sheets?: Array<{
      properties?: { sheetId: number; title: string; index: number };
    }>;
  }>(createRes);

  // Write values into each created sheet tab
  const batchRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      created.spreadsheetId
    )}/values:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: sheetData.map((tab) => ({
          range: `${escapeSheetTitle(tab.title)}!A1`,
          values: tab.values,
        })),
      }),
    }
  );
  await handleApiResponse<unknown>(batchRes);

  return {
    spreadsheetId: created.spreadsheetId,
    title: created.properties?.title ?? title,
    spreadsheetUrl: created.spreadsheetUrl,
    sheets: (created.sheets ?? []).map((s) => ({
      sheetId: s.properties?.sheetId ?? 0,
      title: s.properties?.title ?? '',
      index: s.properties?.index ?? 0,
    })),
  };
}

export async function overwriteYasinanSpreadsheet(
  accessToken: string,
  spreadsheetId: string,
  data: AppDataState
): Promise<SpreadsheetMetadata> {
  // Always inspect actual existing tab names first (never assume Sheet1)
  const meta = await getSpreadsheetMetadata(accessToken, spreadsheetId);
  const existingTitles = new Set(meta.sheets.map((s) => s.title));
  const sheetData = buildExportSheetRows(data);

  const missingTabs = sheetData.filter((t) => !existingTitles.has(t.title));
  if (missingTabs.length > 0) {
    const addRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
        spreadsheetId
      )}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: missingTabs.map((t) => ({
            addSheet: { properties: { title: t.title } },
          })),
        }),
      }
    );
    await handleApiResponse<unknown>(addRes);
  }

  // Clear existing target tabs before writing updated rows
  const clearRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values:batchClear`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ranges: sheetData.map((t) => `${escapeSheetTitle(t.title)}!A1:Z2000`),
      }),
    }
  );
  await handleApiResponse<unknown>(clearRes);

  const updateRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: sheetData.map((tab) => ({
          range: `${escapeSheetTitle(tab.title)}!A1`,
          values: tab.values,
        })),
      }),
    }
  );
  await handleApiResponse<unknown>(updateRes);

  return getSpreadsheetMetadata(accessToken, spreadsheetId);
}
