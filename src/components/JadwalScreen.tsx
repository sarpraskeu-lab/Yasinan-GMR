import React, { useMemo, useState } from 'react';
import {
  Edit3,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import {
  Anggota,
  FeedbackState,
  JadwalArisan,
  PeriodeYasinan,
  StatusPenyerahan,
} from '../types/yasinan';
import { formatRupiah, formatTanggalID, getTodayISO } from '../utils/formatters';
import {
  EmptyState,
  FeedbackBanner,
  StatusText,
  TableSkeleton,
} from './FeedbackBanner';

interface JadwalScreenProps {
  periodes: PeriodeYasinan[];
  anggotas: Anggota[];
  jadwals: JadwalArisan[];
  readOnly?: boolean;
  onSaveJadwal: (
    data: Omit<JadwalArisan, 'JadwalID'>,
    editingJadwalId?: string
  ) => void;
}

interface JadwalFormState {
  PeriodeID: string;
  PertemuanKe: string;
  TanggalAcara: string;
  AnggotaID: string;
  NominalArisanDiterima: string;
  StatusPenyerahan: StatusPenyerahan;
  Catatan: string;
}

export function JadwalScreen({
  periodes,
  anggotas,
  jadwals,
  readOnly = false,
  onSaveJadwal,
}: JadwalScreenProps) {
  const defaultPeriode =
    periodes.find((p) => p.StatusPeriode === 'Aktif') ?? periodes[0];

  const [searchQuery, setSearchQuery] = useState('');
  const [periodeFilter, setPeriodeFilter] = useState<string>(
    defaultPeriode?.PeriodeID ?? 'SEMUA'
  );
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [draftPeriodeFilter, setDraftPeriodeFilter] = useState<string>(
    defaultPeriode?.PeriodeID ?? 'SEMUA'
  );
  const [openMoreId, setOpenMoreId] = useState<string | null>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [formErrors, setFormErrors] = useState<string[]>([]);

  const activeAnggotaList = useMemo(
    () => anggotas.filter((a) => a.StatusAktif === 'Aktif'),
    [anggotas]
  );

  const [form, setForm] = useState<JadwalFormState>({
    PeriodeID: defaultPeriode?.PeriodeID ?? '',
    PertemuanKe: '1',
    TanggalAcara: getTodayISO(),
    AnggotaID: activeAnggotaList[0]?.AnggotaID ?? '',
    NominalArisanDiterima: '100000',
    StatusPenyerahan: 'Belum Diserahkan',
    Catatan: '',
  });

  const memberMap = useMemo(() => {
    const map = new Map<string, Anggota>();
    for (const a of anggotas) {
      map.set(a.AnggotaID, a);
    }
    return map;
  }, [anggotas]);

  const filteredJadwal = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return [...jadwals]
      .filter((j) => {
        if (periodeFilter !== 'SEMUA' && j.PeriodeID !== periodeFilter) {
          return false;
        }
        if (!q) return true;
        const memberName = memberMap.get(j.AnggotaID)?.NamaLengkap ?? '';
        return (
          j.AnggotaID.toLowerCase().includes(q) ||
          memberName.toLowerCase().includes(q) ||
          j.Catatan.toLowerCase().includes(q) ||
          String(j.PertemuanKe).includes(q) ||
          formatTanggalID(j.TanggalAcara).includes(q)
        );
      })
      .sort((a, b) => a.PertemuanKe - b.PertemuanKe);
  }, [jadwals, periodeFilter, searchQuery, memberMap]);

  const openAddForm = () => {
    const targetPeriode =
      periodeFilter !== 'SEMUA'
        ? periodeFilter
        : defaultPeriode?.PeriodeID ?? '';
    const existingForPeriode = jadwals.filter(
      (j) => j.PeriodeID === targetPeriode
    );
    const maxPertemuan = existingForPeriode.reduce(
      (max, j) => (j.PertemuanKe > max ? j.PertemuanKe : max),
      0
    );
    const pObj = periodes.find((p) => p.PeriodeID === targetPeriode);
    const estimasiNominal = pObj
      ? pObj.NominalArisanPerOrang * Math.max(activeAnggotaList.length, 1)
      : 100000;

    setEditingId(undefined);
    setFormErrors([]);
    setForm({
      PeriodeID: targetPeriode,
      PertemuanKe: String(maxPertemuan + 1),
      TanggalAcara: getTodayISO(),
      AnggotaID: activeAnggotaList[0]?.AnggotaID ?? anggotas[0]?.AnggotaID ?? '',
      NominalArisanDiterima: String(estimasiNominal),
      StatusPenyerahan: 'Belum Diserahkan',
      Catatan: '',
    });
    setOpenMoreId(null);
    setIsFormOpen(true);
  };

  const openEditForm = (item: JadwalArisan) => {
    setEditingId(item.JadwalID);
    setFormErrors([]);
    setForm({
      PeriodeID: item.PeriodeID,
      PertemuanKe: String(item.PertemuanKe),
      TanggalAcara: item.TanggalAcara,
      AnggotaID: item.AnggotaID,
      NominalArisanDiterima: String(item.NominalArisanDiterima),
      StatusPenyerahan: item.StatusPenyerahan,
      Catatan: item.Catatan,
    });
    setOpenMoreId(null);
    setIsFormOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: string[] = [];

    const pertemuanNum = Number(form.PertemuanKe);
    const nominalNum = Number(form.NominalArisanDiterima);

    if (!form.PeriodeID) {
      errors.push('Periode yasinan wajib dipilih.');
    }
    if (!Number.isInteger(pertemuanNum) || pertemuanNum <= 0) {
      errors.push('PertemuanKe harus berupa angka bulat positif.');
    }
    if (!form.TanggalAcara) {
      errors.push('TanggalAcara wajib diisi.');
    }
    if (!form.AnggotaID) {
      errors.push('AnggotaID (Tuan Rumah) wajib dipilih.');
    }
    if (!Number.isFinite(nominalNum) || nominalNum < 0) {
      errors.push('NominalArisanDiterima tidak valid.');
    }

    if (errors.length > 0) {
      setFormErrors(errors);
      setFeedback({
        type: 'error',
        message: 'Gagal menyimpan jadwal. Periksa kembali isian formulir.',
      });
      return;
    }

    onSaveJadwal(
      {
        PeriodeID: form.PeriodeID,
        PertemuanKe: pertemuanNum,
        TanggalAcara: form.TanggalAcara,
        AnggotaID: form.AnggotaID,
        NominalArisanDiterima: nominalNum,
        StatusPenyerahan: form.StatusPenyerahan,
        Catatan: form.Catatan.trim(),
      },
      editingId
    );

    setIsFormOpen(false);
    setFormErrors([]);
    setFeedback({
      type: 'success',
      message: editingId
        ? 'Jadwal pertemuan dan penyerahan arisan berhasil diperbarui.'
        : 'Jadwal pertemuan dan penyerahan arisan berhasil ditambahkan.',
    });
  };

  const handleRefresh = () => {
    setIsLoading(true);
    window.setTimeout(() => setIsLoading(false), 300);
  };

  const openMobileFilterSheet = () => {
    setDraftPeriodeFilter(periodeFilter);
    setIsFilterSheetOpen(true);
  };

  const applyMobileFilter = () => {
    setPeriodeFilter(draftPeriodeFilter);
    setIsFilterSheetOpen(false);
  };

  const activePeriodeLabel =
    periodeFilter === 'SEMUA'
      ? 'Semua Periode'
      : periodes.find((p) => p.PeriodeID === periodeFilter)?.NamaPeriode ??
        periodeFilter;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#14532D]">
            Jadwal Penempatan & Penyerahan Arisan
          </h1>
          <p className="text-sm text-[#15803D] mt-1">
            Pengaturan giliran tuan rumah yasinan dan pencatatan penyerahan dana arisan
          </p>
        </div>
        {!readOnly && (
          <button
            type="button"
            onClick={openAddForm}
            className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#16A34A] text-white text-sm font-semibold hover:bg-[#15803D] transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Tambah Jadwal</span>
          </button>
        )}
      </div>

      <FeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      {/* Add / Edit Form: Full-screen sheet on mobile, inline card on md+ */}
      {!readOnly && isFormOpen && (
        <section
          className="fixed inset-0 z-50 bg-[#FFFFFF] flex flex-col md:static md:inset-auto md:z-auto md:rounded-lg md:p-6 md:shadow-[0_1px_3px_rgba(20,83,45,0.06)]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="jadwal-form-title"
        >
          <div className="flex items-center justify-between gap-4 px-4 py-3.5 md:px-0 md:pt-0 md:pb-4 border-b border-[#DCFCE7] shrink-0">
            <h2
              id="jadwal-form-title"
              className="text-base font-semibold text-[#14532D]"
            >
              {editingId ? 'Ubah Jadwal & Penyerahan' : 'Tambah Jadwal & Penyerahan'}
            </h2>
            <button
              type="button"
              onClick={() => {
                setIsFormOpen(false);
                setFormErrors([]);
              }}
              aria-label="Tutup formulir"
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-[#14532D]/70 hover:bg-[#F0FDF4] hover:text-[#14532D] transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto px-4 py-4 md:px-0 md:pt-5 md:pb-0">
              {formErrors.length > 0 && (
                <div className="mb-4 p-3.5 rounded-lg bg-[#FEF2F2] border border-[#DC2626]/30 text-xs text-[#991B1B] space-y-1">
                  {formErrors.map((err, idx) => (
                    <p key={idx}>{err}</p>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label
                    htmlFor="jadwal-periode"
                    className="block text-xs font-semibold text-[#14532D] mb-1.5"
                  >
                    Periode Yasinan
                  </label>
                  <select
                    id="jadwal-periode"
                    value={form.PeriodeID}
                    onChange={(e) => setForm({ ...form, PeriodeID: e.target.value })}
                    className="w-full min-h-[44px] px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#BBF7D0] text-sm text-[#14532D]"
                  >
                    {periodes.map((p) => (
                      <option key={p.PeriodeID} value={p.PeriodeID}>
                        {p.NamaPeriode}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="jadwal-pertemuan"
                    className="block text-xs font-semibold text-[#14532D] mb-1.5"
                  >
                    PertemuanKe
                  </label>
                  <input
                    id="jadwal-pertemuan"
                    type="number"
                    min={1}
                    value={form.PertemuanKe}
                    onChange={(e) => setForm({ ...form, PertemuanKe: e.target.value })}
                    className="w-full min-h-[44px] px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#BBF7D0] text-sm text-[#14532D] tabular-nums"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="jadwal-tanggal"
                    className="block text-xs font-semibold text-[#14532D] mb-1.5"
                  >
                    TanggalAcara
                  </label>
                  <input
                    id="jadwal-tanggal"
                    type="date"
                    value={form.TanggalAcara}
                    onChange={(e) => setForm({ ...form, TanggalAcara: e.target.value })}
                    className="w-full min-h-[44px] px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#BBF7D0] text-sm text-[#14532D] tabular-nums"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="jadwal-anggota"
                    className="block text-xs font-semibold text-[#14532D] mb-1.5"
                  >
                    AnggotaID (Tuan Rumah)
                  </label>
                  <select
                    id="jadwal-anggota"
                    value={form.AnggotaID}
                    onChange={(e) => setForm({ ...form, AnggotaID: e.target.value })}
                    className="w-full min-h-[44px] px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#BBF7D0] text-sm text-[#14532D]"
                    required
                  >
                    <option value="">-- Pilih Anggota --</option>
                    {anggotas.map((a) => (
                      <option key={a.AnggotaID} value={a.AnggotaID}>
                        {a.AnggotaID} — {a.NamaLengkap}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="jadwal-nominal"
                    className="block text-xs font-semibold text-[#14532D] mb-1.5"
                  >
                    NominalArisanDiterima (Rp)
                  </label>
                  <input
                    id="jadwal-nominal"
                    type="number"
                    min={0}
                    step={1000}
                    value={form.NominalArisanDiterima}
                    onChange={(e) =>
                      setForm({ ...form, NominalArisanDiterima: e.target.value })
                    }
                    className="w-full min-h-[44px] px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#BBF7D0] text-sm text-[#14532D] tabular-nums"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="jadwal-status"
                    className="block text-xs font-semibold text-[#14532D] mb-1.5"
                  >
                    StatusPenyerahan
                  </label>
                  <select
                    id="jadwal-status"
                    value={form.StatusPenyerahan}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        StatusPenyerahan: e.target.value as StatusPenyerahan,
                      })
                    }
                    className="w-full min-h-[44px] px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#BBF7D0] text-sm text-[#14532D]"
                  >
                    <option value="Belum Diserahkan">Belum Diserahkan</option>
                    <option value="Sudah Diserahkan">Sudah Diserahkan</option>
                  </select>
                </div>

                <div className="sm:col-span-2 lg:col-span-3">
                  <label
                    htmlFor="jadwal-catatan"
                    className="block text-xs font-semibold text-[#14532D] mb-1.5"
                  >
                    Catatan
                  </label>
                  <input
                    id="jadwal-catatan"
                    type="text"
                    value={form.Catatan}
                    onChange={(e) => setForm({ ...form, Catatan: e.target.value })}
                    placeholder="Contoh: Diserahkan tunai setelah doa penutup"
                    className="w-full min-h-[44px] px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#BBF7D0] text-sm text-[#14532D]"
                  />
                </div>
              </div>
            </div>

            {/* Sticky Bottom Bar on mobile, inline footer on desktop */}
            <div className="sticky bottom-0 bg-[#FFFFFF] border-t border-[#DCFCE7] px-4 py-3 md:border-t-0 md:px-0 md:pt-4 md:pb-0 flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsFormOpen(false);
                  setFormErrors([]);
                }}
                className="min-h-[44px] px-4 py-2 rounded-lg border border-[#BBF7D0] bg-[#FFFFFF] text-sm font-medium text-[#14532D] hover:bg-[#F0FDF4] transition-colors whitespace-nowrap"
              >
                Batal
              </button>
              <button
                type="submit"
                className="flex-1 md:flex-none min-h-[44px] px-5 py-2 rounded-lg bg-[#16A34A] text-white text-sm font-semibold hover:bg-[#15803D] transition-colors whitespace-nowrap"
              >
                Simpan
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Search & Filter Controls */}
      <section className="bg-[#FFFFFF] rounded-lg shadow-[0_1px_3px_rgba(20,83,45,0.06)] overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-[#DCFCE7] flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-2.5 flex-1">
            <div className="relative flex-1 md:max-w-md">
              <Search
                className="h-4 w-4 text-[#15803D] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari tuan rumah atau catatan..."
                aria-label="Cari jadwal"
                className="w-full min-h-[44px] pl-9 pr-3 py-2 rounded-lg bg-[#F0FDF4]/60 border border-[#BBF7D0] text-sm text-[#14532D] placeholder:text-[#15803D]/60"
              />
            </div>

            {/* Mobile Filter Button */}
            <button
              type="button"
              onClick={openMobileFilterSheet}
              className="md:hidden min-h-[44px] inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-[#BBF7D0] bg-[#FFFFFF] text-sm font-semibold text-[#14532D] hover:bg-[#F0FDF4] transition-colors whitespace-nowrap shrink-0"
            >
              <SlidersHorizontal className="h-4 w-4 text-[#15803D]" />
              <span>Filter</span>
            </button>
          </div>

          {/* Mobile active filter caption */}
          <p className="md:hidden text-xs text-[#15803D]">
            Periode: <span className="font-semibold text-[#14532D]">{activePeriodeLabel}</span>
          </p>

          {/* Desktop inline filters */}
          <div className="hidden md:flex flex-wrap items-center gap-3">
            <select
              aria-label="Filter periode"
              value={periodeFilter}
              onChange={(e) => setPeriodeFilter(e.target.value)}
              className="min-h-[44px] px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#BBF7D0] text-sm font-medium text-[#14532D]"
            >
              <option value="SEMUA">Semua Periode</option>
              {periodes.map((p) => (
                <option key={p.PeriodeID} value={p.PeriodeID}>
                  {p.NamaPeriode}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleRefresh}
              disabled={isLoading}
              className="min-h-[44px] inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#BBF7D0] bg-[#FFFFFF] text-sm font-medium text-[#14532D] hover:bg-[#F0FDF4] transition-colors whitespace-nowrap"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Muat Ulang</span>
            </button>
          </div>
        </div>

        {isLoading ? (
          <TableSkeleton columns={6} rows={5} />
        ) : filteredJadwal.length === 0 ? (
          <EmptyState
            title="Jadwal tidak ditemukan"
            description="Tidak ada data jadwal penempatan atau penyerahan yang cocok dengan filter pencarian Anda."
            actionLabel={
              searchQuery || periodeFilter !== 'SEMUA'
                ? 'Reset Filter'
                : !readOnly
                ? 'Tambah Jadwal'
                : undefined
            }
            onAction={
              searchQuery || periodeFilter !== 'SEMUA' || !readOnly
                ? () => {
                    if (searchQuery || periodeFilter !== 'SEMUA') {
                      setSearchQuery('');
                      setPeriodeFilter('SEMUA');
                    } else if (!readOnly) {
                      openAddForm();
                    }
                  }
                : undefined
            }
          />
        ) : (
          <>
            {/* Mobile Stacked Cards (one card per row) */}
            <div className="md:hidden divide-y divide-[#DCFCE7]">
              {filteredJadwal.map((item) => {
                const member = memberMap.get(item.AnggotaID);
                const isMoreOpen = openMoreId === item.JadwalID;
                return (
                  <article
                    key={item.JadwalID}
                    className="p-4 bg-[#FFFFFF] relative space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-xs text-[#15803D] tabular-nums">
                          <span className="font-bold text-[#14532D]">
                            Pertemuan Ke-{item.PertemuanKe}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{formatTanggalID(item.TanggalAcara)}</span>
                        </div>
                        <p className="mt-1 text-base font-bold text-[#14532D] truncate">
                          {member?.NamaLengkap ?? 'Tidak ditemukan'}
                        </p>
                        <p className="text-xs text-[#15803D] tabular-nums">
                          {item.AnggotaID}
                        </p>
                      </div>

                      {!readOnly && (
                        <div className="relative shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              setOpenMoreId(isMoreOpen ? null : item.JadwalID)
                            }
                            aria-label={`Menu lainnya untuk Pertemuan Ke-${item.PertemuanKe}`}
                            aria-expanded={isMoreOpen}
                            className="min-h-[44px] min-w-[44px] -mr-2 -mt-1 inline-flex items-center justify-center rounded-lg text-[#14532D] hover:bg-[#F0FDF4] transition-colors"
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
                                className="absolute right-0 top-11 z-20 w-40 rounded-lg bg-[#FFFFFF] border border-[#BBF7D0] shadow-md py-1"
                                role="menu"
                              >
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => openEditForm(item)}
                                  className="w-full min-h-[44px] px-3.5 py-2 text-left text-sm font-semibold text-[#14532D] hover:bg-[#F0FDF4] inline-flex items-center gap-2"
                                >
                                  <Edit3 className="h-4 w-4 text-[#15803D]" />
                                  <span>Ubah</span>
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-1">
                      <StatusText
                        variant={
                          item.StatusPenyerahan === 'Sudah Diserahkan'
                            ? 'positive'
                            : 'warning'
                        }
                        label={item.StatusPenyerahan}
                      />
                      <span className="text-sm font-bold text-[#14532D] tabular-nums">
                        {formatRupiah(item.NominalArisanDiterima)}
                      </span>
                    </div>

                    {item.Catatan && (
                      <p className="text-xs text-[#14532D]/80 pt-1">
                        {item.Catatan}
                      </p>
                    )}
                  </article>
                );
              })}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F0FDF4]/70 border-b border-[#DCFCE7] text-xs font-semibold text-[#15803D]">
                    <th className="px-5 py-3 whitespace-nowrap">PertemuanKe</th>
                    <th className="px-5 py-3 whitespace-nowrap">TanggalAcara</th>
                    <th className="px-5 py-3 whitespace-nowrap">Tuan Rumah</th>
                    <th className="px-5 py-3 text-right whitespace-nowrap">
                      NominalArisanDiterima
                    </th>
                    <th className="px-5 py-3 whitespace-nowrap">StatusPenyerahan</th>
                    <th className="px-5 py-3">Catatan</th>
                    {!readOnly && (
                      <th className="px-5 py-3 text-right whitespace-nowrap">Aksi</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DCFCE7] text-sm">
                  {filteredJadwal.map((item) => {
                    const member = memberMap.get(item.AnggotaID);
                    return (
                      <tr
                        key={item.JadwalID}
                        className="hover:bg-[#F0FDF4]/50 transition-colors"
                      >
                        <td className="px-5 py-3 font-semibold text-[#14532D] tabular-nums whitespace-nowrap">
                          Ke-{item.PertemuanKe}
                        </td>
                        <td className="px-5 py-3 text-[#14532D] tabular-nums whitespace-nowrap">
                          {formatTanggalID(item.TanggalAcara)}
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap">
                          <span className="font-medium text-[#14532D]">
                            {member?.NamaLengkap ?? 'Tidak ditemukan'}
                          </span>
                          <span className="ml-2 text-xs text-[#15803D] tabular-nums">
                            ({item.AnggotaID})
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right font-semibold text-[#14532D] tabular-nums whitespace-nowrap">
                          {formatRupiah(item.NominalArisanDiterima)}
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap">
                          <StatusText
                            variant={
                              item.StatusPenyerahan === 'Sudah Diserahkan'
                                ? 'positive'
                                : 'warning'
                            }
                            label={item.StatusPenyerahan}
                          />
                        </td>
                        <td className="px-5 py-3 text-xs text-[#14532D]/80 max-w-xs truncate">
                          {item.Catatan || '-'}
                        </td>
                        {!readOnly && (
                          <td className="px-5 py-3 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => openEditForm(item)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#BBF7D0] bg-[#FFFFFF] text-xs font-semibold text-[#15803D] hover:bg-[#F0FDF4] transition-colors whitespace-nowrap"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                              <span>Ubah</span>
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {/* Mobile Filter Bottom Sheet */}
      {isFilterSheetOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end md:hidden bg-[#14532D]/35"
          role="dialog"
          aria-modal="true"
          aria-labelledby="jadwal-filter-sheet-title"
        >
          <div
            className="fixed inset-0"
            onClick={() => setIsFilterSheetOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-10 w-full bg-[#FFFFFF] rounded-t-lg shadow-xl overflow-hidden">
            <div className="w-10 h-1 bg-[#BBF7D0] rounded-full mx-auto mt-3" />
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#DCFCE7]">
              <h2
                id="jadwal-filter-sheet-title"
                className="text-base font-bold text-[#14532D]"
              >
                Filter Jadwal
              </h2>
              <button
                type="button"
                onClick={() => setIsFilterSheetOpen(false)}
                aria-label="Tutup filter"
                className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-[#14532D]/70 hover:bg-[#F0FDF4]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label
                  htmlFor="mobile-jadwal-periode"
                  className="block text-xs font-semibold text-[#14532D] mb-1.5"
                >
                  Periode Yasinan
                </label>
                <select
                  id="mobile-jadwal-periode"
                  value={draftPeriodeFilter}
                  onChange={(e) => setDraftPeriodeFilter(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#BBF7D0] text-sm font-medium text-[#14532D]"
                >
                  <option value="SEMUA">Semua Periode</option>
                  {periodes.map((p) => (
                    <option key={p.PeriodeID} value={p.PeriodeID}>
                      {p.NamaPeriode}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setDraftPeriodeFilter('SEMUA');
                    setPeriodeFilter('SEMUA');
                    setIsFilterSheetOpen(false);
                  }}
                  className="min-h-[44px] px-4 py-2 rounded-lg border border-[#BBF7D0] bg-[#FFFFFF] text-sm font-medium text-[#14532D] hover:bg-[#F0FDF4]"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={applyMobileFilter}
                  className="flex-1 min-h-[44px] px-4 py-2 rounded-lg bg-[#16A34A] text-white text-sm font-semibold hover:bg-[#15803D]"
                >
                  Terapkan Filter
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
