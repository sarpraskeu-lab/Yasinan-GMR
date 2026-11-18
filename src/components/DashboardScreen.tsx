import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  MapPin,
  Phone,
  RefreshCw,
  UserCheck,
} from 'lucide-react';
import {
  Anggota,
  JadwalArisan,
  PeriodeYasinan,
  ScreenId,
  SetoranAnggota,
  TransaksiKas,
  TunggakanAwal,
} from '../types/yasinan';
import { formatRupiah, formatTanggalID } from '../utils/formatters';
import { EmptyState, StatusText } from './FeedbackBanner';

interface DashboardScreenProps {
  periodes: PeriodeYasinan[];
  anggotas: Anggota[];
  jadwals: JadwalArisan[];
  setorans: SetoranAnggota[];
  transaksiKas: TransaksiKas[];
  tunggakanAwals: TunggakanAwal[];
  readOnly?: boolean;
  onNavigate: (screen: ScreenId) => void;
}

export function DashboardScreen({
  periodes,
  anggotas,
  jadwals,
  setorans,
  transaksiKas,
  tunggakanAwals,
  readOnly = false,
  onNavigate,
}: DashboardScreenProps) {
  const defaultPeriode =
    periodes.find((p) => p.StatusPeriode === 'Aktif') ?? periodes[0];
  const [selectedPeriodeId, setSelectedPeriodeId] = useState<string>(
    defaultPeriode?.PeriodeID ?? ''
  );
  const [isLoading, setIsLoading] = useState(false);

  const activePeriode = useMemo(
    () => periodes.find((p) => p.PeriodeID === selectedPeriodeId) ?? defaultPeriode,
    [periodes, selectedPeriodeId, defaultPeriode]
  );

  const memberMap = useMemo(() => {
    const map = new Map<string, Anggota>();
    for (const a of anggotas) {
      map.set(a.AnggotaID, a);
    }
    return map;
  }, [anggotas]);

  const stats = useMemo(() => {
    const periodeId = activePeriode?.PeriodeID ?? '';
    const periodeSetoran = setorans.filter((s) => s.PeriodeID === periodeId);
    const periodeJadwal = jadwals.filter((j) => j.PeriodeID === periodeId);
    const periodeTunggakanAwal = tunggakanAwals.filter(
      (t) => t.PeriodeID === periodeId
    );

    const saldoAwal = activePeriode?.SaldoAwalPeriode ?? 0;
    const saldoAwalKambing = activePeriode?.SaldoAwalKambing ?? 0;
    const saldoAwalAmalan = activePeriode?.SaldoAwalAmalan ?? 0;

    const totalTerkumpulArisan = periodeSetoran
      .filter((s) => s.StatusArisan === 'Lunas')
      .reduce((sum, s) => sum + s.NominalArisan, 0);

    const setoranKambingTerkumpul = periodeSetoran
      .filter((s) => s.StatusKambing === 'Lunas')
      .reduce((sum, s) => sum + s.NominalKambing, 0);

    const kasKambingMasuk = transaksiKas
      .filter((t) => t.KategoriKas === 'Iuran Kambing' && t.JenisTransaksi === 'Masuk')
      .reduce((sum, t) => sum + t.Nominal, 0);

    const kasKambingKeluar = transaksiKas
      .filter((t) => t.KategoriKas === 'Iuran Kambing' && t.JenisTransaksi === 'Keluar')
      .reduce((sum, t) => sum + t.Nominal, 0);

    const totalKasKambing =
      saldoAwalKambing + setoranKambingTerkumpul + kasKambingMasuk - kasKambingKeluar;

    const amalanMasuk = transaksiKas
      .filter((t) => t.KategoriKas === 'Uang Amalan' && t.JenisTransaksi === 'Masuk')
      .reduce((sum, t) => sum + t.Nominal, 0);

    const amalanKeluar = transaksiKas
      .filter((t) => t.KategoriKas === 'Uang Amalan' && t.JenisTransaksi === 'Keluar')
      .reduce((sum, t) => sum + t.Nominal, 0);

    const totalUangAmalan = saldoAwalAmalan + amalanMasuk - amalanKeluar;

    const tunggakanArisan = periodeSetoran
      .filter((s) => s.StatusArisan === 'Belum Lunas')
      .reduce((sum, s) => sum + s.NominalArisan, 0);

    const tunggakanKambing = periodeSetoran
      .filter((s) => s.StatusKambing === 'Belum Lunas')
      .reduce((sum, s) => sum + s.NominalKambing, 0);

    const tunggakanSebelumnya = periodeTunggakanAwal
      .filter((t) => t.StatusBayar === 'Belum Lunas')
      .reduce((sum, t) => sum + t.Nominal, 0);

    const totalTunggakan =
      tunggakanArisan + tunggakanKambing + tunggakanSebelumnya;

    // Progress metrics
    const totalSetoranRows = periodeSetoran.length;
    const arisanLunasCount = periodeSetoran.filter(
      (s) => s.StatusArisan === 'Lunas'
    ).length;
    const kambingRows = periodeSetoran.filter((s) => s.NominalKambing > 0);
    const totalKambingRows = kambingRows.length;
    const kambingLunasCount = kambingRows.filter(
      (s) => s.StatusKambing === 'Lunas'
    ).length;
    const totalJadwalCount = periodeJadwal.length;
    const jadwalSelesaiCount = periodeJadwal.filter(
      (j) => j.StatusPenyerahan === 'Sudah Diserahkan'
    ).length;

    const arisanPct =
      totalSetoranRows > 0 ? Math.round((arisanLunasCount / totalSetoranRows) * 100) : 0;
    const kambingPct =
      totalKambingRows > 0 ? Math.round((kambingLunasCount / totalKambingRows) * 100) : 0;
    const jadwalPct =
      totalJadwalCount > 0 ? Math.round((jadwalSelesaiCount / totalJadwalCount) * 100) : 0;

    // Overall payment compliance percentage (Arisan + Kambing combined)
    const totalObligations = totalSetoranRows + totalKambingRows;
    const paidObligations = arisanLunasCount + kambingLunasCount;
    const overallPct =
      totalObligations > 0 ? Math.round((paidObligations / totalObligations) * 100) : 0;

    // Next host schedule: earliest meeting with StatusPenyerahan === 'Belum Diserahkan'
    const nextHost = [...periodeJadwal]
      .filter((j) => j.StatusPenyerahan === 'Belum Diserahkan')
      .sort((a, b) => a.PertemuanKe - b.PertemuanKe)[0] ?? null;

    return {
      saldoAwal,
      saldoAwalKambing,
      saldoAwalAmalan,
      totalTerkumpulArisan,
      totalKasKambing,
      totalUangAmalan,
      totalTunggakan,
      tunggakanArisan,
      tunggakanKambing,
      tunggakanSebelumnya,
      totalSetoranRows,
      totalKambingRows,
      arisanLunasCount,
      kambingLunasCount,
      arisanPct,
      kambingPct,
      totalJadwalCount,
      jadwalSelesaiCount,
      jadwalPct,
      overallPct,
      paidObligations,
      totalObligations,
      nextHost,
    };
  }, [activePeriode, setorans, jadwals, transaksiKas, tunggakanAwals]);

  const handleRefresh = () => {
    setIsLoading(true);
    window.setTimeout(() => {
      setIsLoading(false);
    }, 300);
  };

  const nextHostMember = stats.nextHost
    ? memberMap.get(stats.nextHost.AnggotaID)
    : undefined;

  return (
    <div className="space-y-6">
      {/* Header & Period Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#14532D]">
            Dashboard Ringkasan Kas & Jadwal
          </h1>
          <p className="text-sm text-[#15803D] mt-1">
            {activePeriode
              ? `${activePeriode.NamaPeriode} · ${formatTanggalID(activePeriode.TanggalMulai)} - ${formatTanggalID(activePeriode.TanggalSelesai)}`
              : 'Belum ada periode yasinan yang terdaftar'}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3">
          {periodes.length > 0 && (
            <select
              aria-label="Pilih Periode Yasinan"
              value={activePeriode?.PeriodeID ?? ''}
              onChange={(e) => setSelectedPeriodeId(e.target.value)}
              className="w-full sm:w-auto min-h-[44px] px-3.5 py-2 rounded-lg bg-[#FFFFFF] border border-[#BBF7D0] text-sm font-medium text-[#14532D] focus:border-[#16A34A]"
            >
              {periodes.map((p) => (
                <option key={p.PeriodeID} value={p.PeriodeID}>
                  {p.NamaPeriode} ({p.StatusPeriode})
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isLoading}
            className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg bg-[#FFFFFF] border border-[#BBF7D0] text-sm font-medium text-[#14532D] hover:bg-[#F0FDF4] transition-colors whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Perbarui</span>
          </button>
        </div>
      </div>

      {/* 5 Summary Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="bg-[#FFFFFF] rounded-lg p-5 shadow-[0_1px_3px_rgba(20,83,45,0.06)] space-y-3"
            >
              <div className="h-3.5 w-28 bg-[#DCFCE7] rounded animate-pulse" />
              <div className="h-7 w-36 bg-[#DCFCE7] rounded animate-pulse" />
              <div className="h-3 w-24 bg-[#DCFCE7] rounded animate-pulse" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
          <div className="bg-[#FFFFFF] rounded-lg p-5 shadow-[0_1px_3px_rgba(20,83,45,0.06)]">
            <p className="text-xs font-medium text-[#15803D]">Saldo Awal Periode</p>
            <p className="mt-2 text-2xl font-bold tracking-tight text-[#14532D] tabular-nums">
              {formatRupiah(stats.saldoAwal)}
            </p>
            <p className="mt-1.5 text-xs text-[#14532D]/70 tabular-nums">
              {activePeriode ? activePeriode.PeriodeID : '-'}
            </p>
          </div>

          <div className="bg-[#FFFFFF] rounded-lg p-5 shadow-[0_1px_3px_rgba(20,83,45,0.06)]">
            <p className="text-xs font-medium text-[#15803D]">Total Terkumpul Arisan</p>
            <p className="mt-2 text-2xl font-bold tracking-tight text-[#14532D] tabular-nums">
              {formatRupiah(stats.totalTerkumpulArisan)}
            </p>
            <p className="mt-1.5 text-xs text-[#14532D]/70 tabular-nums">
              {stats.arisanLunasCount} dari {stats.totalSetoranRows} setoran lunas
            </p>
          </div>

          <div className="bg-[#FFFFFF] rounded-lg p-5 shadow-[0_1px_3px_rgba(20,83,45,0.06)]">
            <p className="text-xs font-medium text-[#15803D]">Total Kas Kambing</p>
            <p className="mt-2 text-2xl font-bold tracking-tight text-[#14532D] tabular-nums">
              {formatRupiah(stats.totalKasKambing)}
            </p>
            <p className="mt-1.5 text-xs text-[#14532D]/70 tabular-nums">
              Termasuk saldo awal {formatRupiah(stats.saldoAwalKambing)}
            </p>
          </div>

          <div className="bg-[#FFFFFF] rounded-lg p-5 shadow-[0_1px_3px_rgba(20,83,45,0.06)]">
            <p className="text-xs font-medium text-[#15803D]">Total Uang Amalan</p>
            <p className="mt-2 text-2xl font-bold tracking-tight text-[#14532D] tabular-nums">
              {formatRupiah(stats.totalUangAmalan)}
            </p>
            <p className="mt-1.5 text-xs text-[#14532D]/70 tabular-nums">
              Termasuk saldo awal {formatRupiah(stats.saldoAwalAmalan)}
            </p>
          </div>

          <div
            className={`rounded-lg p-5 shadow-[0_1px_3px_rgba(20,83,45,0.06)] ${
              stats.totalTunggakan > 0
                ? 'bg-[#FEFCE8] ring-1 ring-[#FACC15]'
                : 'bg-[#FFFFFF]'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-[#14532D]">Total Tunggakan</p>
              {stats.totalTunggakan > 0 && (
                <AlertTriangle
                  className="h-4 w-4 text-[#CA8A04] shrink-0"
                  aria-hidden="true"
                />
              )}
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight text-[#14532D] tabular-nums">
              {formatRupiah(stats.totalTunggakan)}
            </p>
            <p className="mt-1.5 text-xs text-[#14532D]/80 tabular-nums">
              Periode ini {formatRupiah(stats.tunggakanArisan + stats.tunggakanKambing)} ·
              Sebelumnya {formatRupiah(stats.tunggakanSebelumnya)}
            </p>
          </div>
        </div>
      )}

      {/* Progress Chart & Next Host Schedule Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Payment Status Progress Chart */}
        <section className="lg:col-span-7 bg-[#FFFFFF] rounded-lg p-4 sm:p-6 shadow-[0_1px_3px_rgba(20,83,45,0.06)] flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-4 border-b border-[#DCFCE7]">
              <div>
                <h2 className="text-lg font-semibold text-[#14532D]">
                  Grafik Status Pembayaran
                </h2>
                <p className="text-xs text-[#15803D] mt-0.5">
                  Persentase pelunasan iuran dan realisasi penyerahan periode berjalan
                </p>
              </div>
              <div className="text-left sm:text-right">
                <span className="text-2xl font-bold text-[#16A34A] tabular-nums">
                  {stats.overallPct}%
                </span>
                <p className="text-xs text-[#14532D]/70 tabular-nums">
                  {stats.paidObligations} / {stats.totalObligations} item lunas
                </p>
              </div>
            </div>

            {stats.totalSetoranRows === 0 && stats.totalJadwalCount === 0 ? (
              <EmptyState
                title="Belum ada data setoran pada periode ini"
                description="Tambahkan jadwal pertemuan dan catat setoran anggota untuk melihat grafik perkembangan pembayaran."
                actionLabel="Kelola Setoran"
                onAction={() => onNavigate('setoran')}
              />
            ) : (
              <div className="mt-6 space-y-6">
                {/* Bar 1: Setoran Arisan */}
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-sm mb-2">
                    <span className="font-medium text-[#14532D]">
                      Setoran Arisan Anggota
                    </span>
                    <span className="font-semibold text-[#14532D] tabular-nums">
                      {stats.arisanLunasCount}/{stats.totalSetoranRows} Lunas ({stats.arisanPct}%)
                    </span>
                  </div>
                  <div
                    className="h-3.5 w-full rounded-lg bg-[#FEF9C3] overflow-hidden flex"
                    role="progressbar"
                    aria-valuenow={stats.arisanPct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Persentase setoran arisan lunas"
                  >
                    <div
                      className="h-full bg-[#16A34A] transition-all duration-300"
                      style={{ width: `${stats.arisanPct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-[#14532D]/70 mt-1.5 tabular-nums">
                    <span>Lunas: {stats.arisanLunasCount} catatan</span>
                    <span>
                      Belum Lunas: {stats.totalSetoranRows - stats.arisanLunasCount} catatan
                    </span>
                  </div>
                </div>

                {/* Bar 2: Iuran Kambing */}
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-sm mb-2">
                    <span className="font-medium text-[#14532D]">
                      Iuran Kas Kambing
                    </span>
                    <span className="font-semibold text-[#14532D] tabular-nums">
                      {stats.kambingLunasCount}/{stats.totalKambingRows} Lunas ({stats.kambingPct}%)
                    </span>
                  </div>
                  <div
                    className="h-3.5 w-full rounded-lg bg-[#FEF9C3] overflow-hidden flex"
                    role="progressbar"
                    aria-valuenow={stats.kambingPct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Persentase iuran kambing lunas"
                  >
                    <div
                      className="h-full bg-[#15803D] transition-all duration-300"
                      style={{ width: `${stats.kambingPct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-[#14532D]/70 mt-1.5 tabular-nums">
                    <span>Lunas: {stats.kambingLunasCount} catatan</span>
                    <span>
                      Belum Lunas: {stats.totalKambingRows - stats.kambingLunasCount} catatan
                    </span>
                  </div>
                </div>

                {/* Bar 3: Penyerahan Arisan Tuan Rumah */}
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-sm mb-2">
                    <span className="font-medium text-[#14532D]">
                      Penyerahan Arisan Tuan Rumah
                    </span>
                    <span className="font-semibold text-[#14532D] tabular-nums">
                      {stats.jadwalSelesaiCount}/{stats.totalJadwalCount} Diserahkan ({stats.jadwalPct}%)
                    </span>
                  </div>
                  <div
                    className="h-3.5 w-full rounded-lg bg-[#FEF9C3] overflow-hidden flex"
                    role="progressbar"
                    aria-valuenow={stats.jadwalPct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Persentase penyerahan arisan tuan rumah"
                  >
                    <div
                      className="h-full bg-[#16A34A] transition-all duration-300"
                      style={{ width: `${stats.jadwalPct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-[#14532D]/70 mt-1.5 tabular-nums">
                    <span>Sudah Diserahkan: {stats.jadwalSelesaiCount} pertemuan</span>
                    <span>
                      Belum Diserahkan: {stats.totalJadwalCount - stats.jadwalSelesaiCount} pertemuan
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-[#DCFCE7] flex flex-wrap items-center justify-between gap-4 text-xs text-[#14532D]/80">
            <div className="flex items-center gap-4">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-[#16A34A]" aria-hidden="true" />
                <span>Lunas / Diserahkan</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-[#FACC15]" aria-hidden="true" />
                <span>Belum Lunas / Menunggu</span>
              </span>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('setoran')}
              className="min-h-[44px] inline-flex items-center gap-1 font-semibold text-[#15803D] hover:text-[#14532D] transition-colors whitespace-nowrap"
            >
              <span>Lihat rincian setoran</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </section>

        {/* Next Host Schedule Info Card */}
        <section className="lg:col-span-5 bg-[#FFFFFF] rounded-lg p-4 sm:p-6 shadow-[0_1px_3px_rgba(20,83,45,0.06)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 pb-4 border-b border-[#DCFCE7]">
              <div>
                <h2 className="text-lg font-semibold text-[#14532D]">
                  Jadwal Tuan Rumah Berikutnya
                </h2>
                <p className="text-xs text-[#15803D] mt-0.5">
                  Informasi pertemuan yasinan terdekat
                </p>
              </div>
              {stats.nextHost && (
                <span className="px-2.5 py-1 rounded-lg bg-[#FEF9C3] text-xs font-semibold text-[#854D0E] tabular-nums whitespace-nowrap">
                  Pertemuan Ke-{stats.nextHost.PertemuanKe}
                </span>
              )}
            </div>

            {stats.nextHost ? (
              <div className="mt-5 space-y-4">
                <div className="rounded-lg bg-[#F0FDF4] p-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <UserCheck
                        className="h-5 w-5 text-[#16A34A] shrink-0"
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                        <p className="text-base font-bold text-[#14532D] truncate">
                          {nextHostMember?.NamaLengkap ?? stats.nextHost.AnggotaID}
                        </p>
                        <p className="text-xs text-[#15803D] tabular-nums">
                          {stats.nextHost.AnggotaID}
                        </p>
                      </div>
                    </div>
                    <StatusText
                      variant={
                        stats.nextHost.StatusPenyerahan === 'Sudah Diserahkan'
                          ? 'positive'
                          : 'warning'
                      }
                      label={stats.nextHost.StatusPenyerahan}
                    />
                  </div>

                  {nextHostMember && (
                    <div className="pt-2 border-t border-[#DCFCE7] space-y-1.5 text-xs text-[#14532D]/85">
                      <div className="flex items-start gap-2">
                        <MapPin className="h-3.5 w-3.5 text-[#15803D] mt-0.5 shrink-0" />
                        <span>{nextHostMember.Alamat}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5 text-[#15803D] shrink-0" />
                        <span className="tabular-nums">{nextHostMember.NoTelepon}</span>
                      </div>
                    </div>
                  )}
                </div>

                <dl className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="text-xs text-[#15803D]">Tanggal Acara</dt>
                    <dd className="mt-1 font-semibold text-[#14532D] flex items-center gap-1.5 tabular-nums">
                      <Calendar className="h-3.5 w-3.5 text-[#16A34A]" aria-hidden="true" />
                      <span>{formatTanggalID(stats.nextHost.TanggalAcara)}</span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[#15803D]">Nominal Arisan</dt>
                    <dd className="mt-1 font-semibold text-[#14532D] tabular-nums">
                      {formatRupiah(stats.nextHost.NominalArisanDiterima)}
                    </dd>
                  </div>
                </dl>

                {stats.nextHost.Catatan && (
                  <div className="text-xs text-[#14532D]/80 bg-[#F0FDF4]/60 rounded-lg px-3.5 py-2.5">
                    <span className="font-semibold text-[#14532D]">Catatan: </span>
                    {stats.nextHost.Catatan}
                  </div>
                )}
              </div>
            ) : (
              <EmptyState
                title="Tidak ada jadwal tuan rumah tertunda"
                description="Semua jadwal pertemuan pada periode ini telah diserahkan atau belum dibuat."
                actionLabel="Buka Jadwal & Penyerahan"
                onAction={() => onNavigate('jadwal')}
              />
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-[#DCFCE7] flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2.5 sm:gap-3">
            <button
              type="button"
              onClick={() => onNavigate('surat-yasin')}
              className="w-full sm:w-auto min-h-[44px] px-4 py-2 rounded-lg border border-[#BBF7D0] bg-[#FFFFFF] text-sm font-semibold text-[#15803D] hover:bg-[#F0FDF4] transition-colors whitespace-nowrap"
            >
              Baca Surat Yasin
            </button>
            <button
              type="button"
              onClick={() => onNavigate('jadwal')}
              className="w-full sm:w-auto min-h-[44px] px-4 py-2 rounded-lg bg-[#16A34A] text-white text-sm font-semibold hover:bg-[#15803D] transition-colors whitespace-nowrap"
            >
              {readOnly ? 'Lihat Jadwal Yasinan' : 'Kelola Jadwal & Penyerahan'}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
