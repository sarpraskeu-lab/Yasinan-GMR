import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  AlertTriangle,
  CheckCircle2,
  CloudUpload,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FolderOpen,
  HardDrive,
  LogOut,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  Anggota,
  AppDataState,
  FeedbackState,
  TransaksiKas,
} from '../types/yasinan';
import { formatTanggalID, getTodayISO, nextId } from '../utils/formatters';
import { EmptyState, FeedbackBanner, TableSkeleton } from './FeedbackBanner';
import { GoogleSignInButton } from './GoogleSignInButton';
import {
  clearAccessToken,
  getAccessToken,
  googleSignIn,
  initAuth,
  logout,
} from '../services/googleWorkspaceAuth';
import {
  createYasinanSpreadsheet,
  deleteDriveFile,
  downloadDriveJsonFile,
  DriveFileItem,
  getSpreadsheetMetadata,
  listDriveFiles,
  overwriteYasinanSpreadsheet,
  readSheetValues,
  SPREADSHEET_MIME,
  SpreadsheetMetadata,
  uploadJsonBackupToDrive,
  WorkspaceApiError,
  YASINAN_SHEET_TABS,
} from '../services/googleDriveSheetsApi';

interface GoogleWorkspaceScreenProps {
  data: AppDataState;
  onReplaceAllData: (nextData: AppDataState) => void;
  onImportAnggotaRows: (newMembers: Anggota[]) => void;
  onImportKasRows: (newTransactions: TransaksiKas[]) => void;
}

type WorkspaceTab = 'sheets' | 'drive';
type DriveFilterType = 'ALL' | 'SPREADSHEET' | 'JSON';

interface PendingConfirmAction {
  title: string;
  description: string;
  details: string[];
  confirmLabel: string;
  variant: 'warning' | 'danger';
  execute: () => Promise<void>;
}

function formatFileSize(sizeStr?: string): string {
  const bytes = Number(sizeStr);
  if (!Number.isFinite(bytes) || bytes <= 0) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileTypeLabel(mimeType: string, name: string): string {
  if (mimeType === SPREADSHEET_MIME) return 'Google Sheets';
  if (mimeType === 'application/json' || name.endsWith('.json')) {
    return 'Cadangan JSON';
  }
  if (mimeType.includes('document')) return 'Google Docs';
  if (mimeType.includes('pdf')) return 'PDF';
  return 'Berkas Drive';
}

export function GoogleWorkspaceScreen({
  data,
  onReplaceAllData,
  onImportAnggotaRows,
  onImportKasRows,
}: GoogleWorkspaceScreenProps) {
  const [needsAuth, setNeedsAuth] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('sheets');
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  // Drive files state
  const [driveFiles, setDriveFiles] = useState<DriveFileItem[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [driveSearch, setDriveSearch] = useState('');
  const [driveFilter, setDriveFilter] = useState<DriveFilterType>('ALL');
  const [openMoreId, setOpenMoreId] = useState<string | null>(null);

  // Backup JSON upload state
  const [backupFileName, setBackupFileName] = useState(
    `cadangan-yasinan-${getTodayISO()}.json`
  );
  const [isUploadingBackup, setIsUploadingBackup] = useState(false);

  // Sheets state: Create new
  const activePeriode =
    data.periodes.find((p) => p.StatusPeriode === 'Aktif') ?? data.periodes[0];
  const [newSheetTitle, setNewSheetTitle] = useState(
    `Laporan Kas & Jadwal Yasinan - ${activePeriode?.NamaPeriode ?? 'Aktif'}`
  );
  const [isCreatingSheet, setIsCreatingSheet] = useState(false);
  const [lastCreatedSheet, setLastCreatedSheet] =
    useState<SpreadsheetMetadata | null>(null);

  // Sheets state: Inspect / Overwrite / Read existing spreadsheet
  const [selectedSpreadsheetId, setSelectedSpreadsheetId] = useState('');
  const [manualSpreadsheetId, setManualSpreadsheetId] = useState('');
  const [inspectedMeta, setInspectedMeta] =
    useState<SpreadsheetMetadata | null>(null);
  const [selectedSheetTab, setSelectedSheetTab] = useState('');
  const [isInspectingSheet, setIsInspectingSheet] = useState(false);
  const [isReadingSheet, setIsReadingSheet] = useState(false);
  const [sheetPreviewRows, setSheetPreviewRows] = useState<string[][]>([]);
  const [isMutating, setIsMutating] = useState(false);

  // Mandatory Confirmation Dialog State
  const [pendingConfirm, setPendingConfirm] =
    useState<PendingConfirmAction | null>(null);

  const handleApiError = useCallback((err: unknown, fallbackMessage: string) => {
    if (err instanceof WorkspaceApiError && err.isAuthError) {
      clearAccessToken();
      setNeedsAuth(true);
      setFeedback({
        type: 'error',
        message:
          'Sesi akses Google telah berakhir. Silakan masuk kembali dengan Google.',
      });
      return;
    }
    const msg = err instanceof Error ? err.message : fallbackMessage;
    setFeedback({ type: 'error', message: `${fallbackMessage} (${msg})` });
  }, []);

  const loadDriveFiles = useCallback(
    async (tokenOverride?: string) => {
      const token = tokenOverride ?? (await getAccessToken());
      if (!token) {
        setNeedsAuth(true);
        return;
      }
      setIsLoadingFiles(true);
      try {
        const files = await listDriveFiles(token, { pageSize: 50 });
        setDriveFiles(files);
        const firstSheet = files.find((f) => f.mimeType === SPREADSHEET_MIME);
        if (firstSheet && !selectedSpreadsheetId) {
          setSelectedSpreadsheetId(firstSheet.id);
        }
      } catch (err) {
        handleApiError(err, 'Gagal memuat daftar berkas Google Drive.');
      } finally {
        setIsLoadingFiles(false);
      }
    },
    [handleApiError, selectedSpreadsheetId]
  );

  useEffect(() => {
    const unsubscribe = initAuth(
      (authUser, token) => {
        setUser(authUser);
        setNeedsAuth(false);
        void loadDriveFiles(token);
      },
      (authUser) => {
        setUser(authUser);
        setNeedsAuth(true);
      }
    );
    return () => unsubscribe();
  }, [loadDriveFiles]);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setFeedback(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setNeedsAuth(false);
        setFeedback({
          type: 'success',
          message: `Berhasil terhubung dengan akun ${result.user.email ?? 'Google'}.`,
        });
        await loadDriveFiles(result.accessToken);
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Autentikasi Google dibatalkan.';
      setFeedback({
        type: 'error',
        message: `Gagal masuk dengan Google: ${msg}`,
      });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setNeedsAuth(true);
    setDriveFiles([]);
    setInspectedMeta(null);
    setSheetPreviewRows([]);
    setLastCreatedSheet(null);
    setFeedback({
      type: 'success',
      message: 'Akun Google telah diputuskan dari sesi ini.',
    });
  };

  const spreadsheetFiles = useMemo(
    () => driveFiles.filter((f) => f.mimeType === SPREADSHEET_MIME),
    [driveFiles]
  );

  const filteredDriveFiles = useMemo(() => {
    const q = driveSearch.trim().toLowerCase();
    return driveFiles.filter((f) => {
      if (driveFilter === 'SPREADSHEET' && f.mimeType !== SPREADSHEET_MIME) {
        return false;
      }
      if (
        driveFilter === 'JSON' &&
        f.mimeType !== 'application/json' &&
        !f.name.toLowerCase().endsWith('.json')
      ) {
        return false;
      }
      if (!q) return true;
      return f.name.toLowerCase().includes(q);
    });
  }, [driveFiles, driveSearch, driveFilter]);

  const targetSpreadsheetId =
    manualSpreadsheetId.trim() || selectedSpreadsheetId;

  const handleInspectSpreadsheet = async (overrideId?: string) => {
    const idToUse = overrideId ?? targetSpreadsheetId;
    if (!idToUse) {
      setFeedback({
        type: 'error',
        message: 'Pilih atau masukkan ID Google Spreadsheet terlebih dahulu.',
      });
      return;
    }
    const token = await getAccessToken();
    if (!token) {
      setNeedsAuth(true);
      return;
    }
    setIsInspectingSheet(true);
    setSheetPreviewRows([]);
    try {
      const meta = await getSpreadsheetMetadata(token, idToUse);
      setInspectedMeta(meta);
      setSelectedSheetTab(meta.sheets[0]?.title ?? '');
    } catch (err) {
      setInspectedMeta(null);
      handleApiError(err, 'Gagal membaca metadata Google Spreadsheet.');
    } finally {
      setIsInspectingSheet(false);
    }
  };

  const handleCreateSpreadsheet = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = await getAccessToken();
    if (!token) {
      setNeedsAuth(true);
      return;
    }
    setIsCreatingSheet(true);
    try {
      const created = await createYasinanSpreadsheet(token, newSheetTitle, data);
      setLastCreatedSheet(created);
      setSelectedSpreadsheetId(created.spreadsheetId);
      setInspectedMeta(created);
      setSelectedSheetTab(created.sheets[0]?.title ?? '');
      setFeedback({
        type: 'success',
        message: `Spreadsheet "${created.title}" berhasil dibuat dan diisi data Yasinan.`,
      });
      await loadDriveFiles(token);
    } catch (err) {
      handleApiError(err, 'Gagal membuat Google Spreadsheet baru.');
    } finally {
      setIsCreatingSheet(false);
    }
  };

  const handleRequestOverwriteSpreadsheet = () => {
    if (!inspectedMeta) {
      setFeedback({
        type: 'error',
        message: 'Periksa metadata spreadsheet tujuan terlebih dahulu.',
      });
      return;
    }

    setPendingConfirm({
      title: 'Konfirmasi Pembaruan Google Sheets',
      description: `Apakah Anda yakin ingin menimpa isi spreadsheet "${inspectedMeta.title}" dengan data Kas & Jadwal Yasinan saat ini? Data pada tab tujuan akan dibersihkan dan ditulis ulang.`,
      details: [
        `Spreadsheet: ${inspectedMeta.title}`,
        `Tab yang akan diperbarui: ${YASINAN_SHEET_TABS.join(', ')}`,
        `Total data: ${data.anggotas.length} anggota, ${data.jadwals.length} jadwal, ${data.transaksiKas.length} transaksi kas`,
      ],
      confirmLabel: 'Ya, Perbarui Spreadsheet',
      variant: 'warning',
      execute: async () => {
        const token = await getAccessToken();
        if (!token) {
          setNeedsAuth(true);
          return;
        }
        const updated = await overwriteYasinanSpreadsheet(
          token,
          inspectedMeta.spreadsheetId,
          data
        );
        setInspectedMeta(updated);
        setFeedback({
          type: 'success',
          message: `Spreadsheet "${updated.title}" berhasil diperbarui dengan data terbaru.`,
        });
      },
    });
  };

  const handleReadSheetTab = async () => {
    if (!inspectedMeta || !selectedSheetTab) {
      setFeedback({
        type: 'error',
        message: 'Pilih spreadsheet dan nama tab lembar kerja terlebih dahulu.',
      });
      return;
    }
    const token = await getAccessToken();
    if (!token) {
      setNeedsAuth(true);
      return;
    }
    setIsReadingSheet(true);
    try {
      const rows = await readSheetValues(
        token,
        inspectedMeta.spreadsheetId,
        selectedSheetTab
      );
      setSheetPreviewRows(rows);
      if (rows.length === 0) {
        setFeedback({
          type: 'error',
          message: `Tab "${selectedSheetTab}" tidak memiliki baris data.`,
        });
      }
    } catch (err) {
      handleApiError(err, `Gagal membaca data dari tab "${selectedSheetTab}".`);
    } finally {
      setIsReadingSheet(false);
    }
  };

  const handleRequestImportAnggota = () => {
    if (sheetPreviewRows.length < 2) {
      setFeedback({
        type: 'error',
        message:
          'Minimal harus ada 1 baris header dan 1 baris data untuk diimpor.',
      });
      return;
    }
    const dataRows = sheetPreviewRows.slice(1).filter((r) => r.some((c) => c?.trim()));
    if (dataRows.length === 0) {
      setFeedback({ type: 'error', message: 'Tidak ada baris anggota yang valid.' });
      return;
    }

    setPendingConfirm({
      title: 'Konfirmasi Impor Data Anggota',
      description: `Tambahkan ${dataRows.length} baris anggota dari tab "${selectedSheetTab}" (${inspectedMeta?.title ?? 'Google Sheets'}) ke Data Anggota aplikasi?`,
      details: [
        'Urutan kolom yang dibaca: [AnggotaID/opsional], NamaLengkap, Alamat, NoTelepon, StatusAktif, IkutIuranKambing',
        `Jumlah baris terdeteksi: ${dataRows.length} anggota`,
      ],
      confirmLabel: 'Impor Data Anggota',
      variant: 'warning',
      execute: async () => {
        const runningIds = data.anggotas.map((a) => a.AnggotaID);
        const imported: Anggota[] = [];

        for (const row of dataRows) {
          const looksLikeId = /^ANG-\d+/i.test((row[0] ?? '').trim());
          const nama = (looksLikeId ? row[1] : row[0])?.trim();
          if (!nama) continue;

          const alamat = (looksLikeId ? row[2] : row[1])?.trim() || '-';
          const telp = (looksLikeId ? row[3] : row[2])?.trim() || '-';
          const statusRaw = (looksLikeId ? row[4] : row[3])?.trim().toLowerCase();
          const kambingRaw = (looksLikeId ? row[5] : row[4])?.trim().toLowerCase();

          const newId = nextId('ANG', runningIds, 3);
          runningIds.push(newId);

          imported.push({
            AnggotaID: newId,
            NamaLengkap: nama,
            Alamat: alamat,
            NoTelepon: telp,
            StatusAktif: statusRaw === 'nonaktif' ? 'Nonaktif' : 'Aktif',
            IkutIuranKambing:
              kambingRaw === 'tidak' || kambingRaw === 'false' || kambingRaw === '0'
                ? false
                : true,
          });
        }

        if (imported.length === 0) {
          setFeedback({
            type: 'error',
            message: 'Tidak ditemukan kolom nama anggota yang dapat diimpor.',
          });
          return;
        }

        onImportAnggotaRows(imported);
        setFeedback({
          type: 'success',
          message: `${imported.length} data anggota berhasil diimpor dari Google Sheets.`,
        });
      },
    });
  };

  const handleRequestImportKas = () => {
    if (sheetPreviewRows.length < 2) {
      setFeedback({
        type: 'error',
        message:
          'Minimal harus ada 1 baris header dan 1 baris data untuk diimpor.',
      });
      return;
    }
    const dataRows = sheetPreviewRows.slice(1).filter((r) => r.some((c) => c?.trim()));
    if (dataRows.length === 0) {
      setFeedback({
        type: 'error',
        message: 'Tidak ada baris transaksi kas yang valid.',
      });
      return;
    }

    setPendingConfirm({
      title: 'Konfirmasi Impor Transaksi Kas',
      description: `Tambahkan ${dataRows.length} baris transaksi kas dari tab "${selectedSheetTab}" ke buku Kas Amalan?`,
      details: [
        'Urutan kolom: [TransaksiID/opsional], Tanggal (DD/MM/YYYY atau YYYY-MM-DD), KategoriKas, JenisTransaksi, Nominal, Keterangan',
        `Jumlah baris terdeteksi: ${dataRows.length} transaksi`,
      ],
      confirmLabel: 'Impor Transaksi Kas',
      variant: 'warning',
      execute: async () => {
        const runningIds = data.transaksiKas.map((t) => t.TransaksiID);
        const imported: TransaksiKas[] = [];

        for (const row of dataRows) {
          const looksLikeId = /^KAS-\d+/i.test((row[0] ?? '').trim());
          const offset = looksLikeId ? 1 : 0;
          const rawDate = (row[offset] ?? '').trim();
          const rawKategori = (row[offset + 1] ?? '').trim();
          const rawJenis = (row[offset + 2] ?? '').trim();
          const rawNominal = (row[offset + 3] ?? '').replace(/[^\d.-]/g, '');
          const rawKet = (row[offset + 4] ?? '').trim();

          const nominal = Number(rawNominal);
          if (!Number.isFinite(nominal) || nominal <= 0) continue;

          // Normalize DD/MM/YYYY -> YYYY-MM-DD if needed
          let isoDate = getTodayISO();
          if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
            isoDate = rawDate;
          } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(rawDate)) {
            const [dd, mm, yyyy] = rawDate.split('/');
            isoDate = `${yyyy}-${mm}-${dd}`;
          }

          const newId = nextId('KAS', runningIds, 3);
          runningIds.push(newId);

          imported.push({
            TransaksiID: newId,
            TanggalTransaksi: isoDate,
            KategoriKas:
              rawKategori.toLowerCase().includes('kambing')
                ? 'Iuran Kambing'
                : 'Uang Amalan',
            JenisTransaksi:
              rawJenis.toLowerCase() === 'keluar' ? 'Keluar' : 'Masuk',
            Nominal: nominal,
            Keterangan: rawKet || 'Impor dari Google Sheets',
          });
        }

        if (imported.length === 0) {
          setFeedback({
            type: 'error',
            message:
              'Tidak ditemukan baris transaksi dengan nominal valid untuk diimpor.',
          });
          return;
        }

        onImportKasRows(imported);
        setFeedback({
          type: 'success',
          message: `${imported.length} transaksi kas berhasil diimpor dari Google Sheets.`,
        });
      },
    });
  };

  const handleUploadBackup = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = await getAccessToken();
    if (!token) {
      setNeedsAuth(true);
      return;
    }
    setIsUploadingBackup(true);
    try {
      const uploaded = await uploadJsonBackupToDrive(
        token,
        backupFileName.trim() || `cadangan-yasinan-${getTodayISO()}.json`,
        data
      );
      setFeedback({
        type: 'success',
        message: `Cadangan "${uploaded.name}" berhasil disimpan ke folder "Kas & Jadwal Yasinan" di Google Drive.`,
      });
      await loadDriveFiles(token);
    } catch (err) {
      handleApiError(err, 'Gagal menyimpan berkas cadangan ke Google Drive.');
    } finally {
      setIsUploadingBackup(false);
    }
  };

  const handleRequestRestoreBackup = (file: DriveFileItem) => {
    setOpenMoreId(null);
    setPendingConfirm({
      title: 'Konfirmasi Pulihkan Cadangan Data',
      description: `Apakah Anda yakin ingin memulihkan seluruh data aplikasi dari berkas "${file.name}"? Data lokal saat ini akan diganti dengan isi berkas cadangan tersebut.`,
      details: [
        `Nama Berkas: ${file.name}`,
        `Diubah Terakhir: ${
          file.modifiedTime ? formatTanggalID(file.modifiedTime.slice(0, 10)) : '-'
        }`,
      ],
      confirmLabel: 'Ya, Pulihkan Data',
      variant: 'warning',
      execute: async () => {
        const token = await getAccessToken();
        if (!token) {
          setNeedsAuth(true);
          return;
        }
        const raw = (await downloadDriveJsonFile(
          token,
          file.id
        )) as Partial<AppDataState>;
        if (
          !raw ||
          !Array.isArray(raw.periodes) ||
          !Array.isArray(raw.anggotas) ||
          !Array.isArray(raw.jadwals) ||
          !Array.isArray(raw.setorans) ||
          !Array.isArray(raw.transaksiKas)
        ) {
          throw new Error(
            'Format berkas JSON tidak sesuai dengan struktur data Kas & Jadwal Yasinan.'
          );
        }

        onReplaceAllData({
          periodes: raw.periodes,
          anggotas: raw.anggotas,
          jadwals: raw.jadwals,
          setorans: raw.setorans,
          transaksiKas: raw.transaksiKas,
          tunggakanAwals: Array.isArray(raw.tunggakanAwals)
            ? raw.tunggakanAwals
            : [],
        });

        setFeedback({
          type: 'success',
          message: `Data aplikasi berhasil dipulihkan dari berkas "${file.name}".`,
        });
      },
    });
  };

  const handleRequestDeleteDriveFile = (file: DriveFileItem) => {
    setOpenMoreId(null);
    setPendingConfirm({
      title: 'Konfirmasi Hapus Berkas Google Drive',
      description: `Apakah Anda yakin ingin menghapus berkas "${file.name}" secara permanen dari Google Drive? Tindakan ini tidak dapat dibatalkan.`,
      details: [
        `Nama Berkas: ${file.name}`,
        `Jenis: ${getFileTypeLabel(file.mimeType, file.name)}`,
      ],
      confirmLabel: 'Hapus Berkas',
      variant: 'danger',
      execute: async () => {
        const token = await getAccessToken();
        if (!token) {
          setNeedsAuth(true);
          return;
        }
        await deleteDriveFile(token, file.id);
        setDriveFiles((prev) => prev.filter((f) => f.id !== file.id));
        if (inspectedMeta?.spreadsheetId === file.id) {
          setInspectedMeta(null);
          setSheetPreviewRows([]);
        }
        setFeedback({
          type: 'success',
          message: `Berkas "${file.name}" berhasil dihapus dari Google Drive.`,
        });
      },
    });
  };

  const handleExecuteConfirm = async () => {
    if (!pendingConfirm) return;
    setIsMutating(true);
    try {
      await pendingConfirm.execute();
      setPendingConfirm(null);
    } catch (err) {
      setPendingConfirm(null);
      handleApiError(err, 'Operasi Google Workspace gagal dijalankan.');
    } finally {
      setIsMutating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#14532D]">
            Integrasi Google Sheets & Drive
          </h1>
          <p className="text-sm text-[#15803D] mt-1">
            Sinkronisasi laporan ke Google Sheets serta simpan dan pulihkan cadangan data di Google Drive
          </p>
        </div>

        {!needsAuth && (
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => void loadDriveFiles()}
              disabled={isLoadingFiles}
              className="min-h-[44px] inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg border border-[#BBF7D0] bg-[#FFFFFF] text-sm font-semibold text-[#14532D] hover:bg-[#F0FDF4] transition-colors whitespace-nowrap"
            >
              <RefreshCw
                className={`h-4 w-4 text-[#15803D] ${
                  isLoadingFiles ? 'animate-spin' : ''
                }`}
              />
              <span>Muat Ulang Berkas</span>
            </button>
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="min-h-[44px] inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg border border-[#BBF7D0] bg-[#FFFFFF] text-sm font-semibold text-[#15803D] hover:bg-[#F0FDF4] transition-colors whitespace-nowrap"
            >
              <LogOut className="h-4 w-4" />
              <span>Keluar Google</span>
            </button>
          </div>
        )}
      </div>

      <FeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      {/* Google Account Status / Sign-in Card */}
      {needsAuth ? (
        <section className="bg-[#FFFFFF] rounded-lg p-5 sm:p-6 shadow-[0_1px_3px_rgba(20,83,45,0.06)] space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#F0FDF4] text-[#16A34A]">
              <HardDrive className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#14532D]">
                Hubungkan Akun Google Anda
              </h2>
              <p className="text-sm text-[#15803D] mt-1">
                Masuk dengan akun Google untuk membuat atau memperbarui laporan Google Sheets serta menyimpan dan memulihkan cadangan berkas di Google Drive. Token akses hanya disimpan sementara di memori sesi ini.
              </p>
            </div>
          </div>

          <div className="pt-1">
            <GoogleSignInButton
              onClick={() => void handleLogin()}
              loading={isLoggingIn}
            />
          </div>
        </section>
      ) : (
        <>
          {/* Connected Account Strip */}
          <section className="bg-[#FFFFFF] rounded-lg px-4 py-3.5 sm:px-5 shadow-[0_1px_3px_rgba(20,83,45,0.06)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <CheckCircle2
                className="h-5 w-5 text-[#16A34A] shrink-0"
                aria-hidden="true"
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#14532D] truncate">
                  Terhubung sebagai {user?.displayName || user?.email || 'Pengguna Google'}
                </p>
                {user?.email && (
                  <p className="text-xs text-[#15803D] truncate">{user.email}</p>
                )}
              </div>
            </div>
            <span className="text-xs font-semibold text-[#15803D] bg-[#F0FDF4] px-2.5 py-1 rounded-lg border border-[#BBF7D0] self-start sm:self-auto whitespace-nowrap">
              {driveFiles.length} berkas Drive dimuat
            </span>
          </section>

          {/* Sub-navigation Tabs */}
          <div
            className="grid grid-cols-2 gap-2 p-1 rounded-lg bg-[#FFFFFF] border border-[#DCFCE7] max-w-md"
            role="tablist"
            aria-label="Pilih layanan Google"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'sheets'}
              onClick={() => setActiveTab('sheets')}
              className={`min-h-[44px] inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                activeTab === 'sheets'
                  ? 'bg-[#16A34A] text-white'
                  : 'text-[#14532D] hover:bg-[#F0FDF4]'
              }`}
            >
              <FileSpreadsheet className="h-4 w-4 shrink-0" />
              <span>Google Sheets</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'drive'}
              onClick={() => setActiveTab('drive')}
              className={`min-h-[44px] inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                activeTab === 'drive'
                  ? 'bg-[#16A34A] text-white'
                  : 'text-[#14532D] hover:bg-[#F0FDF4]'
              }`}
            >
              <FolderOpen className="h-4 w-4 shrink-0" />
              <span>Google Drive</span>
            </button>
          </div>

          {activeTab === 'sheets' ? (
            <div className="space-y-6">
              {/* Create New Spreadsheet Card */}
              <section className="bg-[#FFFFFF] rounded-lg p-4 sm:p-6 shadow-[0_1px_3px_rgba(20,83,45,0.06)] space-y-4">
                <div>
                  <h2 className="text-base font-bold text-[#14532D]">
                    Buat Laporan Google Sheets Baru
                  </h2>
                  <p className="text-xs text-[#15803D] mt-0.5">
                    Mengekspor seluruh data periode, anggota, jadwal, setoran, kas amalan/kambing, dan tunggakan awal ke file Google Sheets baru.
                  </p>
                </div>

                <form
                  onSubmit={handleCreateSpreadsheet}
                  className="flex flex-col sm:flex-row gap-3"
                >
                  <input
                    type="text"
                    value={newSheetTitle}
                    onChange={(e) => setNewSheetTitle(e.target.value)}
                    placeholder="Judul Google Spreadsheet baru..."
                    aria-label="Judul Google Spreadsheet baru"
                    className="flex-1 min-h-[44px] px-3.5 py-2 rounded-lg bg-[#FFFFFF] border border-[#BBF7D0] text-sm text-[#14532D]"
                    required
                  />
                  <button
                    type="submit"
                    disabled={isCreatingSheet}
                    className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#16A34A] text-white text-sm font-semibold hover:bg-[#15803D] disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
                  >
                    <Plus className="h-4 w-4" />
                    <span>
                      {isCreatingSheet ? 'Membuat...' : 'Buat Spreadsheet Baru'}
                    </span>
                  </button>
                </form>

                {lastCreatedSheet && (
                  <div className="p-3.5 rounded-lg bg-[#F0FDF4] border border-[#BBF7D0] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[#14532D] truncate">
                        Spreadsheet dibuat: {lastCreatedSheet.title}
                      </p>
                      <p className="text-xs text-[#15803D] truncate tabular-nums">
                        ID: {lastCreatedSheet.spreadsheetId}
                      </p>
                    </div>
                    {lastCreatedSheet.spreadsheetUrl && (
                      <a
                        href={lastCreatedSheet.spreadsheetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[44px] inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#BBF7D0] text-xs font-semibold text-[#15803D] hover:bg-[#F0FDF4] whitespace-nowrap shrink-0"
                      >
                        <span>Buka di Google Sheets</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                )}
              </section>

              {/* Inspect / Update / Read Existing Spreadsheet */}
              <section className="bg-[#FFFFFF] rounded-lg p-4 sm:p-6 shadow-[0_1px_3px_rgba(20,83,45,0.06)] space-y-5">
                <div>
                  <h2 className="text-base font-bold text-[#14532D]">
                    Kelola & Baca Google Spreadsheet yang Ada
                  </h2>
                  <p className="text-xs text-[#15803D] mt-0.5">
                    Pilih spreadsheet dari Google Drive atau masukkan ID spreadsheet untuk melihat daftar tab, membaca isi baris, mengimpor data, atau memperbarui laporan.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="select-drive-sheet"
                      className="block text-xs font-semibold text-[#14532D] mb-1.5"
                    >
                      Pilih Spreadsheet dari Google Drive
                    </label>
                    <select
                      id="select-drive-sheet"
                      value={selectedSpreadsheetId}
                      onChange={(e) => {
                        setSelectedSpreadsheetId(e.target.value);
                        setManualSpreadsheetId('');
                      }}
                      className="w-full min-h-[44px] px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#BBF7D0] text-sm text-[#14532D]"
                    >
                      <option value="">-- Pilih Google Spreadsheet --</option>
                      {spreadsheetFiles.map((file) => (
                        <option key={file.id} value={file.id}>
                          {file.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="manual-sheet-id"
                      className="block text-xs font-semibold text-[#14532D] mb-1.5"
                    >
                      Atau Masukkan Spreadsheet ID
                    </label>
                    <input
                      id="manual-sheet-id"
                      type="text"
                      value={manualSpreadsheetId}
                      onChange={(e) => setManualSpreadsheetId(e.target.value)}
                      placeholder="Contoh: 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                      className="w-full min-h-[44px] px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#BBF7D0] text-sm text-[#14532D]"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => void handleInspectSpreadsheet()}
                    disabled={isInspectingSheet || !targetSpreadsheetId}
                    className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-[#BBF7D0] bg-[#FFFFFF] text-sm font-semibold text-[#14532D] hover:bg-[#F0FDF4] disabled:opacity-50 transition-colors"
                  >
                    <Search className="h-4 w-4 text-[#15803D]" />
                    <span>
                      {isInspectingSheet
                        ? 'Memeriksa...'
                        : 'Periksa Tab Spreadsheet'}
                    </span>
                  </button>

                  {inspectedMeta && (
                    <button
                      type="button"
                      onClick={handleRequestOverwriteSpreadsheet}
                      className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#16A34A] text-white text-sm font-semibold hover:bg-[#15803D] transition-colors"
                    >
                      <CloudUpload className="h-4 w-4" />
                      <span>Perbarui Spreadsheet Ini</span>
                    </button>
                  )}
                </div>

                {inspectedMeta && (
                  <div className="border-t border-[#DCFCE7] pt-5 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-[#14532D]">
                          {inspectedMeta.title}
                        </p>
                        <p className="text-xs text-[#15803D]">
                          Ditemukan {inspectedMeta.sheets.length} tab lembar kerja
                        </p>
                      </div>
                      {inspectedMeta.spreadsheetUrl && (
                        <a
                          href={inspectedMeta.spreadsheetUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="min-h-[44px] inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#BBF7D0] text-xs font-semibold text-[#15803D] hover:bg-[#F0FDF4] self-start sm:self-auto"
                        >
                          <span>Buka File</span>
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                      <div className="flex-1 max-w-sm">
                        <label
                          htmlFor="select-sheet-tab"
                          className="block text-xs font-semibold text-[#14532D] mb-1.5"
                        >
                          Pilih Tab Lembar Kerja
                        </label>
                        <select
                          id="select-sheet-tab"
                          value={selectedSheetTab}
                          onChange={(e) => setSelectedSheetTab(e.target.value)}
                          className="w-full min-h-[44px] px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#BBF7D0] text-sm text-[#14532D]"
                        >
                          {inspectedMeta.sheets.map((s) => (
                            <option key={s.sheetId} value={s.title}>
                              {s.title}
                            </option>
                          ))}
                        </select>
                      </div>

                      <button
                        type="button"
                        onClick={() => void handleReadSheetTab()}
                        disabled={isReadingSheet || !selectedSheetTab}
                        className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#15803D] text-white text-sm font-semibold hover:bg-[#14532D] disabled:opacity-50 transition-colors whitespace-nowrap"
                      >
                        <Download className="h-4 w-4" />
                        <span>
                          {isReadingSheet ? 'Membaca...' : 'Tampilkan Data Tab'}
                        </span>
                      </button>
                    </div>

                    {sheetPreviewRows.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="text-xs font-semibold text-[#15803D] tabular-nums">
                            Menampilkan {sheetPreviewRows.length} baris dari tab &quot;
                            {selectedSheetTab}&quot;
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={handleRequestImportAnggota}
                              className="min-h-[44px] px-3 py-2 rounded-lg border border-[#BBF7D0] bg-[#F0FDF4] text-xs font-semibold text-[#15803D] hover:bg-[#DCFCE7] transition-colors"
                            >
                              Impor sebagai Data Anggota
                            </button>
                            <button
                              type="button"
                              onClick={handleRequestImportKas}
                              className="min-h-[44px] px-3 py-2 rounded-lg border border-[#BBF7D0] bg-[#F0FDF4] text-xs font-semibold text-[#15803D] hover:bg-[#DCFCE7] transition-colors"
                            >
                              Impor sebagai Transaksi Kas
                            </button>
                          </div>
                        </div>

                        <div className="overflow-x-auto border border-[#DCFCE7] rounded-lg">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-[#F0FDF4] border-b border-[#DCFCE7] text-[#15803D]">
                                {sheetPreviewRows[0].map((cell, idx) => (
                                  <th
                                    key={idx}
                                    className="px-3 py-2.5 font-semibold whitespace-nowrap"
                                  >
                                    {cell || `Kolom ${idx + 1}`}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#DCFCE7]">
                              {sheetPreviewRows.slice(1, 26).map((row, rIdx) => (
                                <tr key={rIdx} className="hover:bg-[#F0FDF4]/50">
                                  {sheetPreviewRows[0].map((_, cIdx) => (
                                    <td
                                      key={cIdx}
                                      className="px-3 py-2 text-[#14532D] whitespace-nowrap"
                                    >
                                      {row[cIdx] ?? ''}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </section>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Upload Backup Card */}
              <section className="bg-[#FFFFFF] rounded-lg p-4 sm:p-6 shadow-[0_1px_3px_rgba(20,83,45,0.06)] space-y-4">
                <div>
                  <h2 className="text-base font-bold text-[#14532D]">
                    Simpan Cadangan Data ke Google Drive
                  </h2>
                  <p className="text-xs text-[#15803D] mt-0.5">
                    Menyimpan salinan lengkap data aplikasi dalam format JSON ke folder &quot;Kas &amp; Jadwal Yasinan&quot; di Google Drive Anda.
                  </p>
                </div>

                <form
                  onSubmit={handleUploadBackup}
                  className="flex flex-col sm:flex-row gap-3"
                >
                  <input
                    type="text"
                    value={backupFileName}
                    onChange={(e) => setBackupFileName(e.target.value)}
                    placeholder="Nama berkas cadangan (.json)"
                    aria-label="Nama berkas cadangan JSON"
                    className="flex-1 min-h-[44px] px-3.5 py-2 rounded-lg bg-[#FFFFFF] border border-[#BBF7D0] text-sm text-[#14532D]"
                    required
                  />
                  <button
                    type="submit"
                    disabled={isUploadingBackup}
                    className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#16A34A] text-white text-sm font-semibold hover:bg-[#15803D] disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
                  >
                    <CloudUpload className="h-4 w-4" />
                    <span>
                      {isUploadingBackup
                        ? 'Menyimpan...'
                        : 'Simpan Cadangan ke Drive'}
                    </span>
                  </button>
                </form>
              </section>

              {/* Drive Files List */}
              <section className="bg-[#FFFFFF] rounded-lg shadow-[0_1px_3px_rgba(20,83,45,0.06)] overflow-hidden">
                <div className="p-4 sm:p-5 border-b border-[#DCFCE7] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="relative flex-1 max-w-sm">
                    <Search
                      className="h-4 w-4 text-[#15803D] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                      aria-hidden="true"
                    />
                    <input
                      type="search"
                      value={driveSearch}
                      onChange={(e) => setDriveSearch(e.target.value)}
                      placeholder="Cari berkas di Google Drive..."
                      aria-label="Cari berkas Google Drive"
                      className="w-full min-h-[44px] pl-9 pr-3 py-2 rounded-lg bg-[#F0FDF4]/60 border border-[#BBF7D0] text-sm text-[#14532D] placeholder:text-[#15803D]/60"
                    />
                  </div>

                  <select
                    aria-label="Filter jenis berkas Drive"
                    value={driveFilter}
                    onChange={(e) =>
                      setDriveFilter(e.target.value as DriveFilterType)
                    }
                    className="min-h-[44px] px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#BBF7D0] text-sm font-medium text-[#14532D]"
                  >
                    <option value="ALL">Semua Berkas</option>
                    <option value="SPREADSHEET">Google Sheets</option>
                    <option value="JSON">Cadangan JSON</option>
                  </select>
                </div>

                {isLoadingFiles ? (
                  <TableSkeleton columns={5} rows={5} />
                ) : filteredDriveFiles.length === 0 ? (
                  <EmptyState
                    title="Belum ada berkas yang ditemukan"
                    description="Tidak ada berkas Google Drive yang cocok dengan kata kunci atau filter jenis berkas Anda."
                    actionLabel={
                      driveSearch || driveFilter !== 'ALL'
                        ? 'Reset Filter'
                        : undefined
                    }
                    onAction={
                      driveSearch || driveFilter !== 'ALL'
                        ? () => {
                            setDriveSearch('');
                            setDriveFilter('ALL');
                          }
                        : undefined
                    }
                  />
                ) : (
                  <>
                    {/* Mobile Stacked Cards */}
                    <div className="md:hidden divide-y divide-[#DCFCE7]">
                      {filteredDriveFiles.map((file) => {
                        const isMoreOpen = openMoreId === file.id;
                        const isJson =
                          file.mimeType === 'application/json' ||
                          file.name.toLowerCase().endsWith('.json');
                        const isSheet = file.mimeType === SPREADSHEET_MIME;

                        return (
                          <article
                            key={file.id}
                            className="p-4 bg-[#FFFFFF] space-y-2"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-[#14532D] break-words">
                                  {file.name}
                                </p>
                                <p className="text-xs text-[#15803D] mt-0.5 tabular-nums">
                                  {getFileTypeLabel(file.mimeType, file.name)} ·{' '}
                                  {file.modifiedTime
                                    ? formatTanggalID(file.modifiedTime.slice(0, 10))
                                    : '-'}
                                </p>
                              </div>

                              <div className="relative shrink-0">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setOpenMoreId(isMoreOpen ? null : file.id)
                                  }
                                  aria-label={`Menu lainnya untuk ${file.name}`}
                                  aria-expanded={isMoreOpen}
                                  className="min-h-[44px] min-w-[44px] -mr-2 -mt-1 inline-flex items-center justify-center rounded-lg text-[#14532D] hover:bg-[#F0FDF4]"
                                >
                                  <MoreVertical className="h-5 w-5" />
                                </button>

                                {isMoreOpen && (
                                  <>
                                    <div
                                      className="fixed inset-0 z-10"
                                      onClick={() => setOpenMoreId(null)}
                                      aria-hidden="true"
                                    />
                                    <div
                                      className="absolute right-0 top-11 z-20 w-48 rounded-lg bg-[#FFFFFF] border border-[#BBF7D0] shadow-md py-1"
                                      role="menu"
                                    >
                                      {isSheet && (
                                        <button
                                          type="button"
                                          role="menuitem"
                                          onClick={() => {
                                            setOpenMoreId(null);
                                            setActiveTab('sheets');
                                            setSelectedSpreadsheetId(file.id);
                                            void handleInspectSpreadsheet(file.id);
                                          }}
                                          className="w-full min-h-[44px] px-3.5 py-2 text-left text-sm font-semibold text-[#14532D] hover:bg-[#F0FDF4] inline-flex items-center gap-2"
                                        >
                                          <FileSpreadsheet className="h-4 w-4 text-[#15803D]" />
                                          <span>Buka di Tab Sheets</span>
                                        </button>
                                      )}
                                      {isJson && (
                                        <button
                                          type="button"
                                          role="menuitem"
                                          onClick={() =>
                                            handleRequestRestoreBackup(file)
                                          }
                                          className="w-full min-h-[44px] px-3.5 py-2 text-left text-sm font-semibold text-[#15803D] hover:bg-[#F0FDF4] inline-flex items-center gap-2"
                                        >
                                          <Download className="h-4 w-4" />
                                          <span>Pulihkan Cadangan</span>
                                        </button>
                                      )}
                                      {file.webViewLink && (
                                        <a
                                          href={file.webViewLink}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          role="menuitem"
                                          onClick={() => setOpenMoreId(null)}
                                          className="w-full min-h-[44px] px-3.5 py-2 text-left text-sm font-medium text-[#14532D] hover:bg-[#F0FDF4] inline-flex items-center gap-2"
                                        >
                                          <ExternalLink className="h-4 w-4 text-[#15803D]" />
                                          <span>Lihat di Drive</span>
                                        </a>
                                      )}
                                      <button
                                        type="button"
                                        role="menuitem"
                                        onClick={() =>
                                          handleRequestDeleteDriveFile(file)
                                        }
                                        className="w-full min-h-[44px] px-3.5 py-2 text-left text-sm font-semibold text-[#991B1B] hover:bg-[#FEF2F2] inline-flex items-center gap-2"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                        <span>Hapus Berkas</span>
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>

                    {/* Desktop Table */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-[#F0FDF4]/70 border-b border-[#DCFCE7] text-xs font-semibold text-[#15803D]">
                            <th className="px-5 py-3">Nama Berkas</th>
                            <th className="px-5 py-3 whitespace-nowrap">Jenis</th>
                            <th className="px-5 py-3 whitespace-nowrap">
                              Diubah Terakhir
                            </th>
                            <th className="px-5 py-3 text-right whitespace-nowrap">
                              Ukuran
                            </th>
                            <th className="px-5 py-3 text-right whitespace-nowrap">
                              Aksi
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#DCFCE7] text-sm">
                          {filteredDriveFiles.map((file) => {
                            const isJson =
                              file.mimeType === 'application/json' ||
                              file.name.toLowerCase().endsWith('.json');
                            const isSheet = file.mimeType === SPREADSHEET_MIME;
                            return (
                              <tr
                                key={file.id}
                                className="hover:bg-[#F0FDF4]/50 transition-colors"
                              >
                                <td className="px-5 py-3 font-medium text-[#14532D]">
                                  {file.name}
                                </td>
                                <td className="px-5 py-3 text-xs text-[#15803D] whitespace-nowrap">
                                  {getFileTypeLabel(file.mimeType, file.name)}
                                </td>
                                <td className="px-5 py-3 text-[#14532D] tabular-nums whitespace-nowrap">
                                  {file.modifiedTime
                                    ? formatTanggalID(file.modifiedTime.slice(0, 10))
                                    : '-'}
                                </td>
                                <td className="px-5 py-3 text-right text-xs text-[#14532D]/80 tabular-nums whitespace-nowrap">
                                  {formatFileSize(file.size)}
                                </td>
                                <td className="px-5 py-3 text-right whitespace-nowrap">
                                  <div className="inline-flex items-center justify-end gap-2">
                                    {isSheet && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setActiveTab('sheets');
                                          setSelectedSpreadsheetId(file.id);
                                          void handleInspectSpreadsheet(file.id);
                                        }}
                                        className="px-2.5 py-1.5 rounded-lg border border-[#BBF7D0] bg-[#FFFFFF] text-xs font-semibold text-[#15803D] hover:bg-[#F0FDF4] transition-colors"
                                      >
                                        Pilih Sheet
                                      </button>
                                    )}
                                    {isJson && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleRequestRestoreBackup(file)
                                        }
                                        className="px-2.5 py-1.5 rounded-lg border border-[#BBF7D0] bg-[#F0FDF4] text-xs font-semibold text-[#15803D] hover:bg-[#DCFCE7] transition-colors"
                                      >
                                        Pulihkan
                                      </button>
                                    )}
                                    {file.webViewLink && (
                                      <a
                                        href={file.webViewLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-2.5 py-1.5 rounded-lg border border-[#BBF7D0] bg-[#FFFFFF] text-xs font-medium text-[#14532D] hover:bg-[#F0FDF4] inline-flex items-center gap-1"
                                      >
                                        <span>Buka</span>
                                        <ExternalLink className="h-3 w-3" />
                                      </a>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleRequestDeleteDriveFile(file)
                                      }
                                      className="px-2.5 py-1.5 rounded-lg border border-[#DC2626]/30 bg-[#FEF2F2] text-xs font-semibold text-[#991B1B] hover:bg-[#FEE2E2] transition-colors"
                                    >
                                      Hapus
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </section>
            </div>
          )}
        </>
      )}

      {/* Mandatory Confirmation Dialog for Destructive / Mutating Operations */}
      {pendingConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-[#14532D]/40"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-workspace-title"
        >
          <div className="w-full sm:max-w-md bg-[#FFFFFF] rounded-t-lg sm:rounded-lg shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#DCFCE7]">
              <div className="flex items-center gap-2.5 min-w-0">
                <AlertTriangle
                  className={`h-5 w-5 shrink-0 ${
                    pendingConfirm.variant === 'danger'
                      ? 'text-[#DC2626]'
                      : 'text-[#CA8A04]'
                  }`}
                  aria-hidden="true"
                />
                <h2
                  id="confirm-workspace-title"
                  className="text-base font-bold text-[#14532D] truncate"
                >
                  {pendingConfirm.title}
                </h2>
              </div>
              <button
                type="button"
                disabled={isMutating}
                onClick={() => setPendingConfirm(null)}
                aria-label="Tutup dialog konfirmasi"
                className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-[#14532D]/70 hover:bg-[#F0FDF4]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-sm text-[#14532D] leading-relaxed">
                {pendingConfirm.description}
              </p>

              {pendingConfirm.details.length > 0 && (
                <ul className="rounded-lg bg-[#F0FDF4] border border-[#DCFCE7] p-3.5 space-y-1.5 text-xs text-[#14532D]">
                  {pendingConfirm.details.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              )}

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#DCFCE7]">
                <button
                  type="button"
                  disabled={isMutating}
                  onClick={() => setPendingConfirm(null)}
                  className="min-h-[44px] px-4 py-2 rounded-lg border border-[#BBF7D0] bg-[#FFFFFF] text-sm font-medium text-[#14532D] hover:bg-[#F0FDF4] disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={isMutating}
                  onClick={() => void handleExecuteConfirm()}
                  className={`flex-1 sm:flex-none min-h-[44px] px-4 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-60 transition-colors whitespace-nowrap ${
                    pendingConfirm.variant === 'danger'
                      ? 'bg-[#DC2626] hover:bg-[#B91C1C]'
                      : 'bg-[#16A34A] hover:bg-[#15803D]'
                  }`}
                >
                  {isMutating ? 'Memproses...' : pendingConfirm.confirmLabel}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
