import React, { useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Edit3,
  MoreVertical,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import {
  FeedbackState,
  JenisTransaksi,
  KategoriKas,
  PeriodeYasinan,
  SetoranAnggota,
  TransaksiKas,
} from '../types/yasinan';
import { formatRupiah, formatTanggalID, getTodayISO } from '../utils/formatters';
import { EmptyState, FeedbackBanner, TableSkeleton } from './FeedbackBanner';

interface KasAmalanScreenProps {
  periodes: PeriodeYasinan[];
  setorans: SetoranAnggota[];
  transaksiKas: TransaksiKas[];
  onAddTransaksi: (data: Omit<TransaksiKas, 'TransaksiID'>) => void;
  onUpdateTransaksi: (
    transaksiId: string,
    data: Omit<TransaksiKas, 'TransaksiID'>
  ) => void;
  onUpdateSaldoAwalKas: (
    periodeId: string,
    saldoAwalKambing: number,
    saldoAwalAmalan: number
  ) => void;
}

export function KasAmalanScreen({
  periodes,
  setorans,
  transaksiKas,
  onAddTransaksi,
  onUpdateTransaksi,
  onUpdateSaldoAwalKas,
}: KasAmalanScreenProps) {
  const activePeriode =
    periodes.find((p) => p.StatusPeriode === 'Aktif') ?? periodes[0];

  const [kategoriFilter, setKategoriFilter] = useState<'SEMUA' | KategoriKas>(
    'SEMUA'
  );
  const [jenisFilter, setJenisFilter] = useState<'SEMUA' | JenisTransaksi>(
    'SEMUA'
  );
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  // Mobile Filter Bottom Sheet & More Menu
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [draftKategori, setDraftKategori] = useState<'SEMUA' | KategoriKas>(
    'SEMUA'
  );
  const [draftJenis, setDraftJenis] = useState<'SEMUA' | JenisTransaksi>(
    'SEMUA'
  );
  const [openMoreId, setOpenMoreId] = useState<string | null>(null);

  // Add / Edit Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTransaksiId, setEditingTransaksiId] = useState<
    string | undefined
  >(undefined);
  const [formErrors, setFormErrors] = useState<string[]>([]);

  const [tanggalTransaksi, setTanggalTransaksi] = useState(getTodayISO());
  const [kategoriKas, setKategoriKas] = useState<KategoriKas>('Uang Amalan');
  const [jenisTransaksi, setJenisTransaksi] = useState<JenisTransaksi>('Masuk');
  const [nominal, setNominal] = useState('');
  const [keterangan, setKeterangan] = useState('');

  // Saldo Awal Modal State
  const [isSaldoModalOpen, setIsSaldoModalOpen] = useState(false);
  const [saldoPeriodeId, setSaldoPeriodeId] = useState<string>(
    activePeriode?.PeriodeID ?? ''
  );
  const [inputSaldoKambing, setInputSaldoKambing] = useState<string>('0');
  const [inputSaldoAmalan, setInputSaldoAmalan] = useState<string>('0');
  const [saldoError, setSaldoError] = useState<string | null>(null);

  const saldoSummary = useMemo(() => {
    const pId = activePeriode?.PeriodeID ?? '';
    const awalAmalan = activePeriode?.SaldoAwalAmalan ?? 0;
    const awalKambing = activePeriode?.SaldoAwalKambing ?? 0;

    const amalanMasuk = transaksiKas
      .filter((t) => t.KategoriKas === 'Uang Amalan' && t.JenisTransaksi === 'Masuk')
      .reduce((sum, t) => sum + t.Nominal, 0);
    const amalanKeluar = transaksiKas
      .filter((t) => t.KategoriKas === 'Uang Amalan' && t.JenisTransaksi === 'Keluar')
      .reduce((sum, t) => sum + t.Nominal, 0);

    const setoranKambing = setorans
      .filter((s) => s.PeriodeID === pId && s.StatusKambing === 'Lunas')
      .reduce((sum, s) => sum + s.NominalKambing, 0);
    const kambingMasuk = transaksiKas
      .filter((t) => t.KategoriKas === 'Iuran Kambing' && t.JenisTransaksi === 'Masuk')
      .reduce((sum, t) => sum + t.Nominal, 0);
    const kambingKeluar = transaksiKas
      .filter((t) => t.KategoriKas === 'Iuran Kambing' && t.JenisTransaksi === 'Keluar')
      .reduce((sum, t) => sum + t.Nominal, 0);

    return {
      awalAmalan,
      totalAmalan: awalAmalan + amalanMasuk - amalanKeluar,
      awalKambing,
      totalKambing: awalKambing + setoranKambing + kambingMasuk - kambingKeluar,
    };
  }, [activePeriode, transaksiKas, setorans]);

  const filteredTransaksi = useMemo(() => {
    return [...transaksiKas]
      .filter((t) => {
        if (kategoriFilter !== 'SEMUA' && t.KategoriKas !== kategoriFilter) {
          return false;
        }
        if (jenisFilter !== 'SEMUA' && t.JenisTransaksi !== jenisFilter) {
          return false;
        }
        return true;
      })
      .sort((a, b) => b.TanggalTransaksi.localeCompare(a.TanggalTransaksi));
  }, [transaksiKas, kategoriFilter, jenisFilter]);

  const openAddForm = () => {
    setEditingTransaksiId(undefined);
    setTanggalTransaksi(getTodayISO());
    setKategoriKas('Uang Amalan');
    setJenisTransaksi('Masuk');
    setNominal('');
    setKeterangan('');
    setFormErrors([]);
    setOpenMoreId(null);
    setIsFormOpen(true);
  };

  const openEditForm = (item: TransaksiKas) => {
    setEditingTransaksiId(item.TransaksiID);
    setTanggalTransaksi(item.TanggalTransaksi);
    setKategoriKas(item.KategoriKas);
    setJenisTransaksi(item.JenisTransaksi);
    setNominal(String(item.Nominal));
    setKeterangan(item.Keterangan);
    setFormErrors([]);
    setOpenMoreId(null);
    setIsFormOpen(true);
  };

  const openSaldoAwalModal = () => {
    const target = activePeriode ?? periodes[0];
    if (!target) {
      setFeedback({
        type: 'error',
        message:
          'Buat Periode Yasinan terlebih dahulu di menu Periode Yasinan sebelum mengatur saldo awal kas.',
      });
      return;
    }
    setSaldoPeriodeId(target.PeriodeID);
    setInputSaldoKambing(String(target.SaldoAwalKambing ?? 0));
    setInputSaldoAmalan(String(target.SaldoAwalAmalan ?? 0));
    setSaldoError(null);
    setIsSaldoModalOpen(true);
  };

  const handleSaldoPeriodeChange = (newId: string) => {
    setSaldoPeriodeId(newId);
    const found = periodes.find((p) => p.PeriodeID === newId);
    if (found) {
      setInputSaldoKambing(String(found.SaldoAwalKambing ?? 0));
      setInputSaldoAmalan(String(found.SaldoAwalAmalan ?? 0));
    }
  };

  const handleSaveSaldoAwal = (e: React.FormEvent) => {
    e.preventDefault();
    const kNum = Number(inputSaldoKambing);
    const aNum = Number(inputSaldoAmalan);
    if (!saldoPeriodeId) {
      setSaldoError('Periode wajib dipilih.');
      return;
    }
    if (!Number.isFinite(kNum) || kNum < 0 || !Number.isFinite(aNum) || aNum < 0) {
      setSaldoError('Nominal saldo awal tidak boleh negatif.');
      return;
    }
    onUpdateSaldoAwalKas(saldoPeriodeId, kNum, aNum);
    setIsSaldoModalOpen(false);
    setSaldoError(null);
    setFeedback({
      type: 'success',
      message: 'Saldo awal uang kambing dan kas amalan berhasil diperbarui.',
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: string[] = [];
    const nominalNum = Number(nominal);

    if (!tanggalTransaksi) {
      errors.push('TanggalTransaksi wajib diisi.');
    }
    if (!Number.isFinite(nominalNum) || nominalNum <= 0) {
      errors.push('Nominal harus lebih besar dari Rp0.');
    }
    if (!keterangan.trim()) {
      errors.push('Keterangan transaksi wajib diisi.');
    }

    if (errors.length > 0) {
      setFormErrors(errors);
      setFeedback({
        type: 'error',
        message: 'Transaksi gagal disimpan. Lengkapi isian yang diperlukan.',
      });
      return;
    }

    const payload = {
      TanggalTransaksi: tanggalTransaksi,
      KategoriKas: kategoriKas,
      JenisTransaksi: jenisTransaksi,
      Nominal: nominalNum,
      Keterangan: keterangan.trim(),
    };

    if (editingTransaksiId) {
      onUpdateTransaksi(editingTransaksiId, payload);
    } else {
      onAddTransaksi(payload);
    }

    setNominal('');
    setKeterangan('');
    setFormErrors([]);
    setEditingTransaksiId(undefined);
    setIsFormOpen(false);
    setFeedback({
      type: 'success',
      message: editingTransaksiId
        ? 'Transaksi kas berhasil diperbarui.'
        : 'Transaksi kas berhasil dicatat.',
    });
  };

  const handleRefresh = () => {
    setIsLoading(true);
    window.setTimeout(() => setIsLoading(false), 300);
  };

  const openMobileFilterSheet = () => {
    setDraftKategori(kategoriFilter);
    setDraftJenis(jenisFilter);
    setIsFilterSheetOpen(true);
  };

  const applyMobileFilters = () => {
    setKategoriFilter(draftKategori);
    setJenisFilter(draftJenis);
    setIsFilterSheetOpen(false);
  };

  const activeFilterCount =
    (kategoriFilter !== 'SEMUA' ? 1 : 0) + (jenisFilter !== 'SEMUA' ? 1 : 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#14532D]">
            Kas Uang Amalan
          </h1>
          <p className="text-sm text-[#15803D] mt-1">
            Buku pencatatan pemasukan dan pengeluaran kas uang amalan serta iuran kambing
          </p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
          <button
            type="button"
            onClick={openSaldoAwalModal}
            className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg border border-[#BBF7D0] bg-[#FFFFFF] text-sm font-semibold text-[#15803D] hover:bg-[#F0FDF4] transition-colors whitespace-nowrap shrink-0"
          >
            <Edit3 className="h-4 w-4" />
            <span>Input Saldo Awal</span>
          </button>
          <button
            type="button"
            onClick={openAddForm}
            className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#16A34A] text-white text-sm font-semibold hover:bg-[#15803D] transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Tambah Transaksi</span>
          </button>
        </div>
      </div>

      {/* Saldo Awal & Akhir Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-[#FFFFFF] rounded-lg p-5 shadow-[0_1px_3px_rgba(20,83,45,0.06)]">
          <p className="text-xs font-medium text-[#15803D]">
            Saldo Kas Uang Amalan ({activePeriode?.NamaPeriode ?? '-'})
          </p>
          <p className="mt-1.5 text-2xl font-bold text-[#14532D] tabular-nums">
            {formatRupiah(saldoSummary.totalAmalan)}
          </p>
          <p className="mt-1 text-xs text-[#14532D]/70 tabular-nums">
            Saldo awal periode: {formatRupiah(saldoSummary.awalAmalan)}
          </p>
        </div>

        <div className="bg-[#FFFFFF] rounded-lg p-5 shadow-[0_1px_3px_rgba(20,83,45,0.06)]">
          <p className="text-xs font-medium text-[#15803D]">
            Saldo Kas Iuran Kambing ({activePeriode?.NamaPeriode ?? '-'})
          </p>
          <p className="mt-1.5 text-2xl font-bold text-[#14532D] tabular-nums">
            {formatRupiah(saldoSummary.totalKambing)}
          </p>
          <p className="mt-1 text-xs text-[#14532D]/70 tabular-nums">
            Saldo awal periode: {formatRupiah(saldoSummary.awalKambing)}
          </p>
        </div>
      </div>

      <FeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      {/* Add / Edit Transaction Form: Full-screen sheet on mobile, inline card on md+ */}
      {isFormOpen && (
        <section
          className="fixed inset-0 z-50 bg-[#FFFFFF] flex flex-col md:static md:inset-auto md:z-auto md:rounded-lg md:p-6 md:shadow-[0_1px_3px_rgba(20,83,45,0.06)]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="kas-form-title"
        >
          <div className="flex items-center justify-between gap-4 px-4 py-3.5 md:px-0 md:pt-0 md:pb-4 border-b border-[#DCFCE7] shrink-0">
            <h2
              id="kas-form-title"
              className="text-base font-semibold text-[#14532D]"
            >
              {editingTransaksiId ? 'Ubah Transaksi Kas' : 'Tambah Transaksi Kas'}
            </h2>
            <button
              type="button"
              onClick={() => {
                setIsFormOpen(false);
                setFormErrors([]);
              }}
              aria-label="Tutup formulir transaksi"
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-[#14532D]/70 hover:bg-[#F0FDF4] transition-colors"
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

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label
                    htmlFor="kas-tanggal"
                    className="block text-xs font-semibold text-[#14532D] mb-1.5"
                  >
                    TanggalTransaksi
                  </label>
                  <input
                    id="kas-tanggal"
                    type="date"
                    value={tanggalTransaksi}
                    onChange={(e) => setTanggalTransaksi(e.target.value)}
                    className="w-full min-h-[44px] px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#BBF7D0] text-sm text-[#14532D] tabular-nums"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="kas-kategori"
                    className="block text-xs font-semibold text-[#14532D] mb-1.5"
                  >
                    KategoriKas
                  </label>
                  <select
                    id="kas-kategori"
                    value={kategoriKas}
                    onChange={(e) => setKategoriKas(e.target.value as KategoriKas)}
                    className="w-full min-h-[44px] px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#BBF7D0] text-sm text-[#14532D]"
                  >
                    <option value="Uang Amalan">Uang Amalan</option>
                    <option value="Iuran Kambing">Iuran Kambing</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="kas-jenis"
                    className="block text-xs font-semibold text-[#14532D] mb-1.5"
                  >
                    JenisTransaksi
                  </label>
                  <select
                    id="kas-jenis"
                    value={jenisTransaksi}
                    onChange={(e) =>
                      setJenisTransaksi(e.target.value as JenisTransaksi)
                    }
                    className="w-full min-h-[44px] px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#BBF7D0] text-sm text-[#14532D]"
                  >
                    <option value="Masuk">Masuk</option>
                    <option value="Keluar">Keluar</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="kas-nominal"
                    className="block text-xs font-semibold text-[#14532D] mb-1.5"
                  >
                    Nominal (Rp)
                  </label>
                  <input
                    id="kas-nominal"
                    type="number"
                    min={1}
                    step={500}
                    value={nominal}
                    onChange={(e) => setNominal(e.target.value)}
                    placeholder="Contoh: 50000"
                    className="w-full min-h-[44px] px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#BBF7D0] text-sm text-[#14532D] tabular-nums"
                    required
                  />
                </div>

                <div className="sm:col-span-2 lg:col-span-4">
                  <label
                    htmlFor="kas-keterangan"
                    className="block text-xs font-semibold text-[#14532D] mb-1.5"
                  >
                    Keterangan
                  </label>
                  <input
                    id="kas-keterangan"
                    type="text"
                    value={keterangan}
                    onChange={(e) => setKeterangan(e.target.value)}
                    placeholder="Contoh: Kotak amalan pertemuan ke-6 atau santunan warga"
                    className="w-full min-h-[44px] px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#BBF7D0] text-sm text-[#14532D]"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Sticky Simpan Bar on Mobile */}
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

      {/* Filter & Ledger Card */}
      <section className="bg-[#FFFFFF] rounded-lg shadow-[0_1px_3px_rgba(20,83,45,0.06)] overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-[#DCFCE7]">
          {/* Mobile Collapsed Filter Trigger */}
          <div className="flex md:hidden items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#14532D] tabular-nums">
                Daftar Transaksi ({filteredTransaksi.length})
              </p>
              <p className="text-xs text-[#15803D] truncate">
                {kategoriFilter === 'SEMUA' ? 'Semua Kategori' : kategoriFilter} ·{' '}
                {jenisFilter === 'SEMUA' ? 'Semua Jenis' : jenisFilter}
              </p>
            </div>
            <button
              type="button"
              onClick={openMobileFilterSheet}
              className="min-h-[44px] inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-[#BBF7D0] bg-[#FFFFFF] text-sm font-semibold text-[#14532D] hover:bg-[#F0FDF4] transition-colors whitespace-nowrap shrink-0"
            >
              <SlidersHorizontal className="h-4 w-4 text-[#15803D]" />
              <span>
                Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
              </span>
            </button>
          </div>

          {/* Desktop Filter Controls */}
          <div className="hidden md:flex items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <select
                aria-label="Filter kategori kas"
                value={kategoriFilter}
                onChange={(e) =>
                  setKategoriFilter(e.target.value as 'SEMUA' | KategoriKas)
                }
                className="min-h-[44px] px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#BBF7D0] text-sm font-medium text-[#14532D]"
              >
                <option value="SEMUA">Semua Kategori</option>
                <option value="Uang Amalan">Uang Amalan</option>
                <option value="Iuran Kambing">Iuran Kambing</option>
              </select>

              <select
                aria-label="Filter jenis transaksi"
                value={jenisFilter}
                onChange={(e) =>
                  setJenisFilter(e.target.value as 'SEMUA' | JenisTransaksi)
                }
                className="min-h-[44px] px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#BBF7D0] text-sm font-medium text-[#14532D]"
              >
                <option value="SEMUA">Semua Jenis</option>
                <option value="Masuk">Masuk</option>
                <option value="Keluar">Keluar</option>
              </select>
            </div>

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
          <TableSkeleton columns={5} rows={5} />
        ) : filteredTransaksi.length === 0 ? (
          <EmptyState
            title="Belum ada transaksi kas"
            description="Tidak ada catatan transaksi kas yang sesuai dengan filter kategori dan jenis transaksi yang dipilih."
            actionLabel={
              kategoriFilter !== 'SEMUA' || jenisFilter !== 'SEMUA'
                ? 'Reset Filter'
                : 'Tambah Transaksi'
            }
            onAction={() => {
              if (kategoriFilter !== 'SEMUA' || jenisFilter !== 'SEMUA') {
                setKategoriFilter('SEMUA');
                setJenisFilter('SEMUA');
              } else {
                openAddForm();
              }
            }}
          />
        ) : (
          <>
            {/* Mobile Stacked Cards (one card per row) */}
            <div className="md:hidden divide-y divide-[#DCFCE7]">
              {filteredTransaksi.map((item) => {
                const isMasuk = item.JenisTransaksi === 'Masuk';
                const isMoreOpen = openMoreId === item.TransaksiID;
                return (
                  <article
                    key={item.TransaksiID}
                    className="p-4 bg-[#FFFFFF] space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-xs text-[#15803D] tabular-nums">
                          <span className="font-semibold text-[#14532D]">
                            {item.KategoriKas}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{formatTanggalID(item.TanggalTransaksi)}</span>
                        </div>
                        <p className="mt-1 text-sm font-medium text-[#14532D]">
                          {item.Keterangan}
                        </p>
                      </div>

                      <div className="relative shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            setOpenMoreId(isMoreOpen ? null : item.TransaksiID)
                          }
                          aria-label={`Menu lainnya untuk transaksi ${item.TransaksiID}`}
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
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-1">
                      {isMasuk ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#15803D]">
                          <ArrowDownLeft
                            className="h-3.5 w-3.5 text-[#16A34A]"
                            aria-hidden="true"
                          />
                          <span>Masuk</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#FEF9C3] text-xs font-semibold text-[#854D0E]">
                          <ArrowUpRight
                            className="h-3.5 w-3.5 text-[#CA8A04]"
                            aria-hidden="true"
                          />
                          <span>Keluar</span>
                        </span>
                      )}

                      <span
                        className={`text-sm font-bold tabular-nums ${
                          isMasuk ? 'text-[#15803D]' : 'text-[#854D0E]'
                        }`}
                      >
                        {isMasuk ? '+' : '-'}
                        {formatRupiah(item.Nominal)}
                      </span>
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
                    <th className="px-5 py-3 whitespace-nowrap">TanggalTransaksi</th>
                    <th className="px-5 py-3 whitespace-nowrap">KategoriKas</th>
                    <th className="px-5 py-3 whitespace-nowrap">JenisTransaksi</th>
                    <th className="px-5 py-3 text-right whitespace-nowrap">Nominal</th>
                    <th className="px-5 py-3">Keterangan</th>
                    <th className="px-5 py-3 text-right whitespace-nowrap">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DCFCE7] text-sm">
                  {filteredTransaksi.map((item) => {
                    const isMasuk = item.JenisTransaksi === 'Masuk';
                    return (
                      <tr
                        key={item.TransaksiID}
                        className="hover:bg-[#F0FDF4]/50 transition-colors"
                      >
                        <td className="px-5 py-3 text-[#14532D] tabular-nums whitespace-nowrap">
                          {formatTanggalID(item.TanggalTransaksi)}
                        </td>
                        <td className="px-5 py-3 font-medium text-[#14532D] whitespace-nowrap">
                          {item.KategoriKas}
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap">
                          {isMasuk ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#15803D]">
                              <ArrowDownLeft
                                className="h-3.5 w-3.5 text-[#16A34A]"
                                aria-hidden="true"
                              />
                              <span>Masuk</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#FEF9C3] text-xs font-semibold text-[#854D0E]">
                              <ArrowUpRight
                                className="h-3.5 w-3.5 text-[#CA8A04]"
                                aria-hidden="true"
                              />
                              <span>Keluar</span>
                            </span>
                          )}
                        </td>
                        <td
                          className={`px-5 py-3 text-right font-semibold tabular-nums whitespace-nowrap ${
                            isMasuk ? 'text-[#15803D]' : 'text-[#854D0E]'
                          }`}
                        >
                          {isMasuk ? '+' : '-'}
                          {formatRupiah(item.Nominal)}
                        </td>
                        <td className="px-5 py-3 text-[#14532D]/90">
                          {item.Keterangan}
                        </td>
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
          aria-labelledby="kas-filter-sheet-title"
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
                id="kas-filter-sheet-title"
                className="text-base font-bold text-[#14532D]"
              >
                Filter Kas
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
                  htmlFor="mobile-kas-kategori"
                  className="block text-xs font-semibold text-[#14532D] mb-1.5"
                >
                  KategoriKas
                </label>
                <select
                  id="mobile-kas-kategori"
                  value={draftKategori}
                  onChange={(e) =>
                    setDraftKategori(e.target.value as 'SEMUA' | KategoriKas)
                  }
                  className="w-full min-h-[44px] px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#BBF7D0] text-sm font-medium text-[#14532D]"
                >
                  <option value="SEMUA">Semua Kategori</option>
                  <option value="Uang Amalan">Uang Amalan</option>
                  <option value="Iuran Kambing">Iuran Kambing</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="mobile-kas-jenis"
                  className="block text-xs font-semibold text-[#14532D] mb-1.5"
                >
                  JenisTransaksi
                </label>
                <select
                  id="mobile-kas-jenis"
                  value={draftJenis}
                  onChange={(e) =>
                    setDraftJenis(e.target.value as 'SEMUA' | JenisTransaksi)
                  }
                  className="w-full min-h-[44px] px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#BBF7D0] text-sm font-medium text-[#14532D]"
                >
                  <option value="SEMUA">Semua Jenis</option>
                  <option value="Masuk">Masuk</option>
                  <option value="Keluar">Keluar</option>
                </select>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setDraftKategori('SEMUA');
                    setDraftJenis('SEMUA');
                    setKategoriFilter('SEMUA');
                    setJenisFilter('SEMUA');
                    setIsFilterSheetOpen(false);
                  }}
                  className="min-h-[44px] px-4 py-2 rounded-lg border border-[#BBF7D0] bg-[#FFFFFF] text-sm font-medium text-[#14532D] hover:bg-[#F0FDF4]"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={applyMobileFilters}
                  className="flex-1 min-h-[44px] px-4 py-2 rounded-lg bg-[#16A34A] text-white text-sm font-semibold hover:bg-[#15803D]"
                >
                  Terapkan Filter
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Input Saldo Awal Uang Kambing & Kas Amalan */}
      {isSaldoModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-[#14532D]/35"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-saldo-awal-title"
        >
          <div className="w-full sm:max-w-md bg-[#FFFFFF] rounded-t-lg sm:rounded-lg shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#DCFCE7]">
              <div>
                <h2
                  id="modal-saldo-awal-title"
                  className="text-base font-bold text-[#14532D]"
                >
                  Input Saldo Awal Kas
                </h2>
                <p className="text-xs text-[#15803D] mt-0.5">
                  Atur saldo pindahan uang kambing dan kas amalan dari periode sebelumnya
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsSaldoModalOpen(false)}
                aria-label="Tutup dialog saldo awal"
                className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-[#14532D]/70 hover:bg-[#F0FDF4] transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSaldoAwal} className="p-5 space-y-4">
              {saldoError && (
                <div className="p-3 rounded-lg bg-[#FEF2F2] border border-[#DC2626]/30 text-xs text-[#991B1B]">
                  {saldoError}
                </div>
              )}

              <div>
                <label
                  htmlFor="saldo-periode"
                  className="block text-xs font-semibold text-[#14532D] mb-1.5"
                >
                  Periode Yasinan
                </label>
                <select
                  id="saldo-periode"
                  value={saldoPeriodeId}
                  onChange={(e) => handleSaldoPeriodeChange(e.target.value)}
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
                  htmlFor="saldo-awal-kambing"
                  className="block text-xs font-semibold text-[#14532D] mb-1.5"
                >
                  Saldo Awal Uang Kambing (Rp)
                </label>
                <input
                  id="saldo-awal-kambing"
                  type="number"
                  min={0}
                  step={1000}
                  value={inputSaldoKambing}
                  onChange={(e) => setInputSaldoKambing(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#BBF7D0] text-sm text-[#14532D] tabular-nums"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="saldo-awal-amalan"
                  className="block text-xs font-semibold text-[#14532D] mb-1.5"
                >
                  Saldo Awal Kas Amalan (Rp)
                </label>
                <input
                  id="saldo-awal-amalan"
                  type="number"
                  min={0}
                  step={1000}
                  value={inputSaldoAmalan}
                  onChange={(e) => setInputSaldoAmalan(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#BBF7D0] text-sm text-[#14532D] tabular-nums"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#DCFCE7]">
                <button
                  type="button"
                  onClick={() => setIsSaldoModalOpen(false)}
                  className="min-h-[44px] px-4 py-2 rounded-lg border border-[#BBF7D0] bg-[#FFFFFF] text-sm font-medium text-[#14532D] hover:bg-[#F0FDF4] transition-colors whitespace-nowrap"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 sm:flex-none min-h-[44px] px-5 py-2 rounded-lg bg-[#16A34A] text-white text-sm font-semibold hover:bg-[#15803D] transition-colors whitespace-nowrap"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
