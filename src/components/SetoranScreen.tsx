import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CreditCard,
  Eye,
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
  SetoranAnggota,
  StatusBayar,
  TunggakanAwal,
} from '../types/yasinan';
import { formatRupiah, formatTanggalID, getTodayISO } from '../utils/formatters';
import {
  EmptyState,
  FeedbackBanner,
  StatusText,
  TableSkeleton,
} from './FeedbackBanner';

export interface MeetingPaymentDraft {
  JadwalID: string;
  StatusArisan: StatusBayar;
  StatusKambing: StatusBayar;
}

export interface TunggakanAwalDraft {
  TunggakanID: string;
  StatusBayar: StatusBayar;
}

interface SetoranScreenProps {
  periodes: PeriodeYasinan[];
  anggotas: Anggota[];
  jadwals: JadwalArisan[];
  setorans: SetoranAnggota[];
  tunggakanAwals: TunggakanAwal[];
  readOnly?: boolean;
  onSaveMemberPayments: (params: {
    periodeId: string;
    anggotaId: string;
    tanggalBayar: string;
    meetingDrafts: MeetingPaymentDraft[];
    tunggakanDrafts: TunggakanAwalDraft[];
  }) => void;
  onAddTunggakanAwal: (data: Omit<TunggakanAwal, 'TunggakanID'>) => void;
}

type StatusFilterOption = 'SEMUA' | 'LUNAS' | 'ADA_TUNGGAKAN';

export function SetoranScreen({
  periodes,
  anggotas,
  jadwals,
  setorans,
  tunggakanAwals,
  readOnly = false,
  onSaveMemberPayments,
  onAddTunggakanAwal,
}: SetoranScreenProps) {
  const defaultPeriode =
    periodes.find((p) => p.StatusPeriode === 'Aktif') ?? periodes[0];

  const [selectedPeriodeId, setSelectedPeriodeId] = useState<string>(
    defaultPeriode?.PeriodeID ?? ''
  );
  const [statusFilter, setStatusFilter] = useState<StatusFilterOption>('SEMUA');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  // Mobile Filter Sheet & More Menu
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [draftPeriodeId, setDraftPeriodeId] = useState<string>(
    defaultPeriode?.PeriodeID ?? ''
  );
  const [draftStatusFilter, setDraftStatusFilter] =
    useState<StatusFilterOption>('SEMUA');
  const [openMoreId, setOpenMoreId] = useState<string | null>(null);

  // Payment Popup State
  const [payingMember, setPayingMember] = useState<Anggota | null>(null);
  const [draftMeetings, setDraftMeetings] = useState<
    Record<string, { arisan: StatusBayar; kambing: StatusBayar }>
  >({});
  const [draftTunggakan, setDraftTunggakan] = useState<
    Record<string, StatusBayar>
  >({});
  const [initialUnpaidKeys, setInitialUnpaidKeys] = useState<Set<string>>(
    new Set()
  );
  const [paymentDate, setPaymentDate] = useState<string>(getTodayISO());
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Previous-period Arrears Input Popup State
  const [isTunggakanModalOpen, setIsTunggakanModalOpen] = useState(false);
  const [tPeriodeId, setTPeriodeId] = useState<string>(
    defaultPeriode?.PeriodeID ?? ''
  );
  const [tAnggotaId, setTAnggotaId] = useState<string>(
    anggotas[0]?.AnggotaID ?? ''
  );
  const [tNominal, setTNominal] = useState<string>('');
  const [tKeterangan, setTKeterangan] = useState<string>('');
  const [tStatus, setTStatus] = useState<StatusBayar>('Belum Lunas');
  const [tErrors, setTErrors] = useState<string[]>([]);

  const activePeriode = useMemo(
    () => periodes.find((p) => p.PeriodeID === selectedPeriodeId) ?? defaultPeriode,
    [periodes, selectedPeriodeId, defaultPeriode]
  );

  const periodeJadwals = useMemo(() => {
    if (!activePeriode) return [];
    return [...jadwals]
      .filter((j) => j.PeriodeID === activePeriode.PeriodeID)
      .sort((a, b) => a.PertemuanKe - b.PertemuanKe);
  }, [jadwals, activePeriode]);

  // Summarize per member for the selected period
  const memberSummaries = useMemo(() => {
    const periodeId = activePeriode?.PeriodeID ?? '';
    return anggotas
      .filter((a) => a.StatusAktif === 'Aktif')
      .map((member) => {
        const memberSetorans = setorans.filter(
          (s) => s.PeriodeID === periodeId && s.AnggotaID === member.AnggotaID
        );
        const memberTunggakanAwal = tunggakanAwals.filter(
          (t) => t.PeriodeID === periodeId && t.AnggotaID === member.AnggotaID
        );

        const unpaidArisan = memberSetorans
          .filter((s) => s.StatusArisan === 'Belum Lunas')
          .reduce((sum, s) => sum + s.NominalArisan, 0);

        const unpaidKambing = member.IkutIuranKambing
          ? memberSetorans
              .filter((s) => s.StatusKambing === 'Belum Lunas')
              .reduce((sum, s) => sum + s.NominalKambing, 0)
          : 0;

        const unpaidPrev = memberTunggakanAwal
          .filter((t) => t.StatusBayar === 'Belum Lunas')
          .reduce((sum, t) => sum + t.Nominal, 0);

        const totalTunggakan = unpaidArisan + unpaidKambing + unpaidPrev;

        const unpaidMeetingCount = memberSetorans.filter(
          (s) =>
            s.StatusArisan === 'Belum Lunas' ||
            (member.IkutIuranKambing && s.StatusKambing === 'Belum Lunas')
        ).length;

        return {
          member,
          totalTunggakan,
          unpaidPrev,
          unpaidMeetingCount,
          hasArrears: totalTunggakan > 0,
        };
      });
  }, [anggotas, setorans, tunggakanAwals, activePeriode]);

  const filteredMembers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return memberSummaries.filter((item) => {
      if (statusFilter === 'LUNAS' && item.hasArrears) return false;
      if (statusFilter === 'ADA_TUNGGAKAN' && !item.hasArrears) return false;
      if (!q) return true;
      return item.member.NamaLengkap.toLowerCase().includes(q);
    });
  }, [memberSummaries, statusFilter, searchQuery]);

  const openPaymentPopup = (member: Anggota) => {
    if (!activePeriode) return;
    setOpenMoreId(null);
    const periodeId = activePeriode.PeriodeID;
    const nextMeetings: Record<
      string,
      { arisan: StatusBayar; kambing: StatusBayar }
    > = {};
    const nextTunggakan: Record<string, StatusBayar> = {};
    const unpaidKeys = new Set<string>();

    for (const j of periodeJadwals) {
      const existing = setorans.find(
        (s) =>
          s.PeriodeID === periodeId &&
          s.JadwalID === j.JadwalID &&
          s.AnggotaID === member.AnggotaID
      );
      const arisanStatus: StatusBayar = existing?.StatusArisan ?? 'Belum Lunas';
      const kambingStatus: StatusBayar = member.IkutIuranKambing
        ? existing?.StatusKambing ?? 'Belum Lunas'
        : 'Lunas';

      nextMeetings[j.JadwalID] = {
        arisan: arisanStatus,
        kambing: kambingStatus,
      };
      if (arisanStatus === 'Belum Lunas') {
        unpaidKeys.add(`M:${j.JadwalID}:arisan`);
      }
      if (member.IkutIuranKambing && kambingStatus === 'Belum Lunas') {
        unpaidKeys.add(`M:${j.JadwalID}:kambing`);
      }
    }

    const memberPrevTunggakan = tunggakanAwals.filter(
      (t) => t.PeriodeID === periodeId && t.AnggotaID === member.AnggotaID
    );
    for (const t of memberPrevTunggakan) {
      nextTunggakan[t.TunggakanID] = t.StatusBayar;
      if (t.StatusBayar === 'Belum Lunas') {
        unpaidKeys.add(`T:${t.TunggakanID}`);
      }
    }

    setPayingMember(member);
    setDraftMeetings(nextMeetings);
    setDraftTunggakan(nextTunggakan);
    setInitialUnpaidKeys(unpaidKeys);
    setPaymentDate(getTodayISO());
    setPaymentError(null);
  };

  // Compute totals inside the payment popup
  const popupTotals = useMemo(() => {
    if (!payingMember || !activePeriode) {
      return {
        totalTunggakanAwal: 0,
        totalTunggakanSaatIni: 0,
        totalYangHarusDibayar: 0,
        sisaTunggakan: 0,
      };
    }

    const periodeId = activePeriode.PeriodeID;
    const memberPrevTunggakan = tunggakanAwals.filter(
      (t) => t.PeriodeID === periodeId && t.AnggotaID === payingMember.AnggotaID
    );

    let totalTunggakanSaatIni = 0;
    let totalYangHarusDibayar = 0;
    let sisaTunggakan = 0;

    // 1. Previous period arrears
    for (const t of memberPrevTunggakan) {
      const wasUnpaid = initialUnpaidKeys.has(`T:${t.TunggakanID}`);
      const draftStatus = draftTunggakan[t.TunggakanID] ?? t.StatusBayar;
      if (wasUnpaid) {
        totalTunggakanSaatIni += t.Nominal;
        if (draftStatus === 'Lunas') {
          totalYangHarusDibayar += t.Nominal;
        }
      }
      if (draftStatus === 'Belum Lunas') {
        sisaTunggakan += t.Nominal;
      }
    }

    // 2. Meetings in selected period
    for (const j of periodeJadwals) {
      const existing = setorans.find(
        (s) =>
          s.PeriodeID === periodeId &&
          s.JadwalID === j.JadwalID &&
          s.AnggotaID === payingMember.AnggotaID
      );
      const nomArisan =
        existing?.NominalArisan ?? activePeriode.NominalArisanPerOrang;
      const nomKambing = payingMember.IkutIuranKambing
        ? existing?.NominalKambing ?? activePeriode.NominalKambingPerOrang
        : 0;

      const draft = draftMeetings[j.JadwalID] ?? {
        arisan: existing?.StatusArisan ?? 'Belum Lunas',
        kambing: payingMember.IkutIuranKambing
          ? existing?.StatusKambing ?? 'Belum Lunas'
          : 'Lunas',
      };

      const wasArisanUnpaid = initialUnpaidKeys.has(`M:${j.JadwalID}:arisan`);
      const wasKambingUnpaid =
        payingMember.IkutIuranKambing &&
        initialUnpaidKeys.has(`M:${j.JadwalID}:kambing`);

      // Arrears only count meetings that already have an unpaid setoran record
      if (existing) {
        if (wasArisanUnpaid) totalTunggakanSaatIni += nomArisan;
        if (wasKambingUnpaid) totalTunggakanSaatIni += nomKambing;
        if (draft.arisan === 'Belum Lunas') sisaTunggakan += nomArisan;
        if (payingMember.IkutIuranKambing && draft.kambing === 'Belum Lunas') {
          sisaTunggakan += nomKambing;
        }
      }

      if (wasArisanUnpaid && draft.arisan === 'Lunas') {
        totalYangHarusDibayar += nomArisan;
      }
      if (wasKambingUnpaid && draft.kambing === 'Lunas') {
        totalYangHarusDibayar += nomKambing;
      }
    }

    return {
      totalTunggakanAwal: memberPrevTunggakan
        .filter((t) => t.StatusBayar === 'Belum Lunas')
        .reduce((sum, t) => sum + t.Nominal, 0),
      totalTunggakanSaatIni,
      totalYangHarusDibayar,
      sisaTunggakan,
    };
  }, [
    payingMember,
    activePeriode,
    periodeJadwals,
    setorans,
    tunggakanAwals,
    draftMeetings,
    draftTunggakan,
    initialUnpaidKeys,
  ]);

  const handleCheckAllArrears = () => {
    if (!payingMember || !activePeriode) return;
    const periodeId = activePeriode.PeriodeID;

    setDraftTunggakan((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        next[key] = 'Lunas';
      }
      return next;
    });

    setDraftMeetings((prev) => {
      const next = { ...prev };
      for (const j of periodeJadwals) {
        const existing = setorans.find(
          (s) =>
            s.PeriodeID === periodeId &&
            s.JadwalID === j.JadwalID &&
            s.AnggotaID === payingMember.AnggotaID
        );
        if (existing) {
          next[j.JadwalID] = { arisan: 'Lunas', kambing: 'Lunas' };
        }
      }
      return next;
    });
  };

  const handleSavePaymentPopup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingMember || !activePeriode) return;

    const anyLunas =
      Object.values(draftMeetings).some(
        (m) => m.arisan === 'Lunas' || m.kambing === 'Lunas'
      ) || Object.values(draftTunggakan).some((s) => s === 'Lunas');

    if (anyLunas && !paymentDate) {
      setPaymentError('Tanggal bayar wajib diisi.');
      return;
    }

    const meetingDrafts: MeetingPaymentDraft[] = periodeJadwals.map((j) => {
      const d = draftMeetings[j.JadwalID] ?? {
        arisan: 'Belum Lunas',
        kambing: 'Belum Lunas',
      };
      return {
        JadwalID: j.JadwalID,
        StatusArisan: d.arisan,
        StatusKambing: d.kambing,
      };
    });

    const tunggakanDrafts: TunggakanAwalDraft[] = Object.entries(
      draftTunggakan
    ).map(([TunggakanID, StatusBayar]) => ({
      TunggakanID,
      StatusBayar,
    }));

    onSaveMemberPayments({
      periodeId: activePeriode.PeriodeID,
      anggotaId: payingMember.AnggotaID,
      tanggalBayar: paymentDate,
      meetingDrafts,
      tunggakanDrafts,
    });

    const memberName = payingMember.NamaLengkap;
    setPayingMember(null);
    setPaymentError(null);
    setFeedback({
      type: 'success',
      message: `Pembayaran setoran & tunggakan ${memberName} berhasil disimpan.`,
    });
  };

  const openTunggakanModal = () => {
    setTPeriodeId(activePeriode?.PeriodeID ?? periodes[0]?.PeriodeID ?? '');
    setTAnggotaId(anggotas[0]?.AnggotaID ?? '');
    setTNominal('');
    setTKeterangan('Sisa tunggakan periode sebelumnya');
    setTStatus('Belum Lunas');
    setTErrors([]);
    setIsTunggakanModalOpen(true);
  };

  const handleSubmitTunggakanAwal = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: string[] = [];
    const nominalNum = Number(tNominal);

    if (!tPeriodeId) errors.push('Periode tujuan wajib dipilih.');
    if (!tAnggotaId) errors.push('Anggota wajib dipilih.');
    if (!Number.isFinite(nominalNum) || nominalNum <= 0) {
      errors.push('Nominal tunggakan harus lebih dari Rp0.');
    }
    if (!tKeterangan.trim()) {
      errors.push('Keterangan tunggakan wajib diisi.');
    }

    if (errors.length > 0) {
      setTErrors(errors);
      return;
    }

    onAddTunggakanAwal({
      PeriodeID: tPeriodeId,
      AnggotaID: tAnggotaId,
      Nominal: nominalNum,
      StatusBayar: tStatus,
      TanggalBayar: tStatus === 'Lunas' ? getTodayISO() : '',
      Keterangan: tKeterangan.trim(),
    });

    const memberName =
      anggotas.find((a) => a.AnggotaID === tAnggotaId)?.NamaLengkap ?? tAnggotaId;
    setIsTunggakanModalOpen(false);
    setTErrors([]);
    setFeedback({
      type: 'success',
      message: `Tunggakan periode sebelumnya untuk ${memberName} berhasil dicatat.`,
    });
  };

  const handleRefresh = () => {
    setIsLoading(true);
    window.setTimeout(() => setIsLoading(false), 300);
  };

  const openMobileFilterSheet = () => {
    setDraftPeriodeId(activePeriode?.PeriodeID ?? '');
    setDraftStatusFilter(statusFilter);
    setIsFilterSheetOpen(true);
  };

  const applyMobileFilters = () => {
    setSelectedPeriodeId(draftPeriodeId);
    setStatusFilter(draftStatusFilter);
    setIsFilterSheetOpen(false);
  };

  const memberPrevTunggakanList = useMemo(() => {
    if (!payingMember || !activePeriode) return [];
    return tunggakanAwals.filter(
      (t) =>
        t.PeriodeID === activePeriode.PeriodeID &&
        t.AnggotaID === payingMember.AnggotaID
    );
  }, [payingMember, activePeriode, tunggakanAwals]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#14532D]">
            Setoran & Tunggakan Anggota
          </h1>
          <p className="text-sm text-[#15803D] mt-1">
            {readOnly
              ? 'Daftar status setoran dan tunggakan anggota (tampilan lihat saja).'
              : 'Daftar ringkas status pembayaran per anggota. Pilih Bayar untuk mencatat setoran pertemuan atau melunasi tunggakan.'}
          </p>
        </div>

        {!readOnly && (
          <button
            type="button"
            onClick={openTunggakanModal}
            className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#16A34A] text-white text-sm font-semibold hover:bg-[#15803D] transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Input Tunggakan Sebelumnya</span>
          </button>
        )}
      </div>

      <FeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      {/* Filters & Concise Member Table */}
      <section className="bg-[#FFFFFF] rounded-lg shadow-[0_1px_3px_rgba(20,83,45,0.06)] overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-[#DCFCE7] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="flex items-center gap-2.5 flex-1">
            <div className="relative flex-1 lg:max-w-sm">
              <Search
                className="h-4 w-4 text-[#15803D] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama anggota..."
                aria-label="Cari nama anggota"
                className="w-full min-h-[44px] pl-9 pr-3 py-2 rounded-lg bg-[#F0FDF4]/60 border border-[#BBF7D0] text-sm text-[#14532D] placeholder:text-[#15803D]/60"
              />
            </div>

            <button
              type="button"
              onClick={openMobileFilterSheet}
              className="md:hidden min-h-[44px] inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-[#BBF7D0] bg-[#FFFFFF] text-sm font-semibold text-[#14532D] hover:bg-[#F0FDF4] transition-colors whitespace-nowrap shrink-0"
            >
              <SlidersHorizontal className="h-4 w-4 text-[#15803D]" />
              <span>Filter</span>
            </button>
          </div>

          <p className="md:hidden text-xs text-[#15803D] truncate">
            {activePeriode?.NamaPeriode ?? '-'} ·{' '}
            {statusFilter === 'SEMUA'
              ? 'Semua Status'
              : statusFilter === 'LUNAS'
              ? 'Lunas'
              : 'Ada Tunggakan'}
          </p>

          <div className="hidden md:flex flex-wrap items-center gap-3">
            <select
              aria-label="Filter periode"
              value={activePeriode?.PeriodeID ?? ''}
              onChange={(e) => setSelectedPeriodeId(e.target.value)}
              className="min-h-[44px] px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#BBF7D0] text-sm font-medium text-[#14532D]"
            >
              {periodes.map((p) => (
                <option key={p.PeriodeID} value={p.PeriodeID}>
                  {p.NamaPeriode}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter status pembayaran"
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as StatusFilterOption)
              }
              className="min-h-[44px] px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#BBF7D0] text-sm font-medium text-[#14532D]"
            >
              <option value="SEMUA">Semua Status</option>
              <option value="LUNAS">Lunas</option>
              <option value="ADA_TUNGGAKAN">Ada Tunggakan</option>
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
          <TableSkeleton columns={4} rows={6} />
        ) : filteredMembers.length === 0 ? (
          <EmptyState
            title="Tidak ada anggota yang sesuai"
            description="Tidak ditemukan anggota dengan nama atau status tunggakan yang dipilih."
            actionLabel="Reset Filter"
            onAction={() => {
              setSearchQuery('');
              setStatusFilter('SEMUA');
            }}
          />
        ) : (
          <>
            {/* Mobile Stacked Cards */}
            <div className="md:hidden divide-y divide-[#DCFCE7]">
              {filteredMembers.map((item) => {
                const isMoreOpen = openMoreId === item.member.AnggotaID;
                return (
                  <article
                    key={item.member.AnggotaID}
                    className="p-4 bg-[#FFFFFF] space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-base font-bold text-[#14532D] truncate">
                          {item.member.NamaLengkap}
                        </p>
                        <div className="mt-1">
                          {item.hasArrears ? (
                            <StatusText
                              variant="warning"
                              label={
                                item.unpaidMeetingCount > 0 && item.unpaidPrev > 0
                                  ? `${item.unpaidMeetingCount} pertemuan + tunggakan lalu`
                                  : item.unpaidMeetingCount > 0
                                  ? `${item.unpaidMeetingCount} pertemuan belum lunas`
                                  : 'Ada tunggakan periode lalu'
                              }
                            />
                          ) : (
                            <StatusText variant="positive" label="Lunas" />
                          )}
                        </div>
                      </div>

                      <div className="relative shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            setOpenMoreId(
                              isMoreOpen ? null : item.member.AnggotaID
                            )
                          }
                          aria-label={`Menu lainnya untuk ${item.member.NamaLengkap}`}
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
                              className="absolute right-0 top-11 z-20 w-44 rounded-lg bg-[#FFFFFF] border border-[#BBF7D0] shadow-md py-1"
                              role="menu"
                            >
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => openPaymentPopup(item.member)}
                                className="w-full min-h-[44px] px-3.5 py-2 text-left text-sm font-semibold text-[#14532D] hover:bg-[#F0FDF4] inline-flex items-center gap-2"
                              >
                                {readOnly ? (
                                  <>
                                    <Eye className="h-4 w-4 text-[#15803D]" />
                                    <span>Lihat Rincian</span>
                                  </>
                                ) : (
                                  <>
                                    <CreditCard className="h-4 w-4 text-[#16A34A]" />
                                    <span>Bayar</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-1">
                      <span className="text-xs text-[#15803D]">
                        Total Tunggakan
                      </span>
                      <span
                        className={`text-sm font-bold tabular-nums ${
                          item.totalTunggakan > 0
                            ? 'text-[#854D0E]'
                            : 'text-[#15803D]'
                        }`}
                      >
                        {formatRupiah(item.totalTunggakan)}
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
                    <th className="px-5 py-3 whitespace-nowrap">Nama Anggota</th>
                    <th className="px-5 py-3 whitespace-nowrap">Status Pembayaran</th>
                    <th className="px-5 py-3 text-right whitespace-nowrap">
                      Total Tunggakan
                    </th>
                    <th className="px-5 py-3 text-right whitespace-nowrap">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DCFCE7] text-sm">
                  {filteredMembers.map((item) => (
                    <tr
                      key={item.member.AnggotaID}
                      className="hover:bg-[#F0FDF4]/50 transition-colors"
                    >
                      <td className="px-5 py-3.5 font-semibold text-[#14532D] whitespace-nowrap">
                        {item.member.NamaLengkap}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        {item.hasArrears ? (
                          <StatusText
                            variant="warning"
                            label={
                              item.unpaidMeetingCount > 0 && item.unpaidPrev > 0
                                ? `${item.unpaidMeetingCount} pertemuan + tunggakan lalu`
                                : item.unpaidMeetingCount > 0
                                ? `${item.unpaidMeetingCount} pertemuan belum lunas`
                                : 'Ada tunggakan periode lalu'
                            }
                          />
                        ) : (
                          <StatusText variant="positive" label="Lunas" />
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right font-semibold tabular-nums whitespace-nowrap">
                        <span
                          className={
                            item.totalTunggakan > 0
                              ? 'text-[#854D0E]'
                              : 'text-[#15803D]'
                          }
                        >
                          {formatRupiah(item.totalTunggakan)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openPaymentPopup(item.member)}
                          className={
                            readOnly
                              ? 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#BBF7D0] bg-[#FFFFFF] text-xs font-semibold text-[#15803D] hover:bg-[#F0FDF4] transition-colors whitespace-nowrap'
                              : 'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#16A34A] text-white text-xs font-semibold hover:bg-[#15803D] transition-colors whitespace-nowrap'
                          }
                        >
                          {readOnly ? (
                            <>
                              <Eye className="h-3.5 w-3.5" />
                              <span>Lihat Rincian</span>
                            </>
                          ) : (
                            <>
                              <CreditCard className="h-3.5 w-3.5" />
                              <span>Bayar</span>
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
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
          aria-labelledby="setoran-filter-sheet-title"
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
                id="setoran-filter-sheet-title"
                className="text-base font-bold text-[#14532D]"
              >
                Filter Setoran
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
                  htmlFor="mobile-setoran-periode"
                  className="block text-xs font-semibold text-[#14532D] mb-1.5"
                >
                  Periode Yasinan
                </label>
                <select
                  id="mobile-setoran-periode"
                  value={draftPeriodeId}
                  onChange={(e) => setDraftPeriodeId(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#BBF7D0] text-sm font-medium text-[#14532D]"
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
                  htmlFor="mobile-setoran-status"
                  className="block text-xs font-semibold text-[#14532D] mb-1.5"
                >
                  Status Pembayaran
                </label>
                <select
                  id="mobile-setoran-status"
                  value={draftStatusFilter}
                  onChange={(e) =>
                    setDraftStatusFilter(e.target.value as StatusFilterOption)
                  }
                  className="w-full min-h-[44px] px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#BBF7D0] text-sm font-medium text-[#14532D]"
                >
                  <option value="SEMUA">Semua Status</option>
                  <option value="LUNAS">Lunas</option>
                  <option value="ADA_TUNGGAKAN">Ada Tunggakan</option>
                </select>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    const resetId = defaultPeriode?.PeriodeID ?? '';
                    setDraftPeriodeId(resetId);
                    setDraftStatusFilter('SEMUA');
                    setSelectedPeriodeId(resetId);
                    setStatusFilter('SEMUA');
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

      {/* Payment Popup per Member: Full-screen sheet on mobile, modal on sm+ */}
      {payingMember && activePeriode && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center sm:p-4 bg-[#14532D]/35"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-bayar-title"
        >
          <div className="w-full h-full sm:h-auto sm:max-w-2xl sm:max-h-[90vh] flex flex-col bg-[#FFFFFF] sm:rounded-lg shadow-xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 sm:py-4 border-b border-[#DCFCE7] shrink-0">
              <div className="min-w-0">
                <h2
                  id="modal-bayar-title"
                  className="text-base font-bold text-[#14532D] truncate"
                >
                  {readOnly ? 'Rincian Setoran & Tunggakan' : 'Pembayaran Setoran'} —{' '}
                  {payingMember.NamaLengkap}
                </h2>
                <p className="text-xs text-[#15803D] mt-0.5 truncate">
                  {activePeriode.NamaPeriode} ·{' '}
                  {readOnly
                    ? 'Informasi status pembayaran per pertemuan'
                    : 'Pilih pertemuan ke-berapa yang akan dibayar'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPayingMember(null)}
                aria-label="Tutup pop-up pembayaran"
                className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-[#14532D]/70 hover:bg-[#F0FDF4] transition-colors shrink-0"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={handleSavePaymentPopup}
              className="flex-1 flex flex-col min-h-0"
            >
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
                {paymentError && (
                  <div className="p-3 rounded-lg bg-[#FEF2F2] border border-[#DC2626]/30 text-xs text-[#991B1B]">
                    {paymentError}
                  </div>
                )}

                {/* Arrears Alert Summary */}
                {popupTotals.totalTunggakanSaatIni > 0 && (
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-lg bg-[#FEFCE8] border border-[#FACC15]">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle
                        className="h-5 w-5 text-[#CA8A04] shrink-0 mt-0.5"
                        aria-hidden="true"
                      />
                      <div>
                        <p className="text-sm font-bold text-[#14532D]">
                          Terdapat Tunggakan Pembayaran
                        </p>
                        <p className="text-xs text-[#14532D]/85 mt-0.5 tabular-nums">
                          Total tunggakan yang belum dibayar saat ini:{' '}
                          <span className="font-bold">
                            {formatRupiah(popupTotals.totalTunggakanSaatIni)}
                          </span>
                        </p>
                      </div>
                    </div>
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={handleCheckAllArrears}
                        className="min-h-[44px] px-3.5 py-2 rounded-lg bg-[#16A34A] text-white text-xs font-semibold hover:bg-[#15803D] transition-colors whitespace-nowrap shrink-0"
                      >
                        Lunasi Semua Tunggakan
                      </button>
                    )}
                  </div>
                )}

                {/* Previous Period Arrears Section */}
                {memberPrevTunggakanList.length > 0 && (
                  <div className="space-y-2.5">
                    <h3 className="text-xs font-bold text-[#15803D]">
                      Tunggakan dari Periode Sebelumnya
                    </h3>
                    <div className="divide-y divide-[#DCFCE7] border border-[#DCFCE7] rounded-lg overflow-hidden">
                      {memberPrevTunggakanList.map((t) => {
                        const currentStatus =
                          draftTunggakan[t.TunggakanID] ?? t.StatusBayar;
                        const isChecked = currentStatus === 'Lunas';
                        return (
                          <label
                            key={t.TunggakanID}
                            className={`flex items-center justify-between gap-3 px-4 py-3 min-h-[44px] bg-[#FFFFFF] ${
                              readOnly ? '' : 'hover:bg-[#F0FDF4]/60 cursor-pointer'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              {!readOnly && (
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) =>
                                    setDraftTunggakan((prev) => ({
                                      ...prev,
                                      [t.TunggakanID]: e.target.checked
                                        ? 'Lunas'
                                        : 'Belum Lunas',
                                    }))
                                  }
                                  className="h-5 w-5 rounded accent-[#16A34A]"
                                />
                              )}
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-[#14532D] truncate">
                                  {t.Keterangan}
                                </p>
                                <p className="text-xs text-[#15803D] tabular-nums">
                                  {isChecked ? 'Lunas / Dibayar' : 'Belum Lunas'}
                                </p>
                              </div>
                            </div>
                            <span className="text-sm font-bold text-[#14532D] tabular-nums shrink-0">
                              {formatRupiah(t.Nominal)}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Meetings Checklist Section */}
                <div className="space-y-2.5">
                  <h3 className="text-xs font-bold text-[#15803D]">
                    Pembayaran Pertemuan Ke-berapa
                  </h3>
                  {periodeJadwals.length === 0 ? (
                    <p className="text-sm text-[#14532D]/70 p-4 rounded-lg bg-[#F0FDF4]">
                      Belum ada jadwal pertemuan pada periode ini.
                    </p>
                  ) : (
                    <div className="divide-y divide-[#DCFCE7] border border-[#DCFCE7] rounded-lg overflow-hidden">
                      {periodeJadwals.map((j) => {
                        const existing = setorans.find(
                          (s) =>
                            s.PeriodeID === activePeriode.PeriodeID &&
                            s.JadwalID === j.JadwalID &&
                            s.AnggotaID === payingMember.AnggotaID
                        );
                        const nomArisan =
                          existing?.NominalArisan ??
                          activePeriode.NominalArisanPerOrang;
                        const nomKambing = payingMember.IkutIuranKambing
                          ? existing?.NominalKambing ??
                            activePeriode.NominalKambingPerOrang
                          : 0;
                        const draft = draftMeetings[j.JadwalID] ?? {
                          arisan: 'Belum Lunas',
                          kambing: payingMember.IkutIuranKambing
                            ? 'Belum Lunas'
                            : 'Lunas',
                        };
                        const isArisanUnpaidRecord =
                          existing && existing.StatusArisan === 'Belum Lunas';
                        const isKambingUnpaidRecord =
                          payingMember.IkutIuranKambing &&
                          existing &&
                          existing.StatusKambing === 'Belum Lunas';
                        const hasRecordedArrear =
                          isArisanUnpaidRecord || isKambingUnpaidRecord;

                        return (
                          <div
                            key={j.JadwalID}
                            className={`px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
                              hasRecordedArrear ? 'bg-[#FEFCE8]/60' : 'bg-[#FFFFFF]'
                            }`}
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-[#14532D] tabular-nums">
                                  Pertemuan Ke-{j.PertemuanKe}
                                </span>
                                <span className="text-xs text-[#15803D] tabular-nums">
                                  · {formatTanggalID(j.TanggalAcara)}
                                </span>
                              </div>
                              <p className="text-xs text-[#14532D]/70 mt-0.5 tabular-nums">
                                {existing
                                  ? existing.TanggalBayar
                                    ? `Tercatat bayar: ${formatTanggalID(existing.TanggalBayar)}`
                                    : 'Belum dibayar (Tunggakan)'
                                  : 'Jadwal belum tercatat pembayarannya'}
                              </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-[#14532D]">
                              {readOnly ? (
                                <>
                                  <StatusText
                                    variant={
                                      draft.arisan === 'Lunas' ? 'positive' : 'warning'
                                    }
                                    label={`Arisan ${formatRupiah(nomArisan)}: ${draft.arisan}`}
                                  />
                                  {payingMember.IkutIuranKambing ? (
                                    <StatusText
                                      variant={
                                        draft.kambing === 'Lunas'
                                          ? 'positive'
                                          : 'warning'
                                      }
                                      label={`Kambing ${formatRupiah(nomKambing)}: ${draft.kambing}`}
                                    />
                                  ) : (
                                    <span className="text-xs text-[#14532D]/60">
                                      Tidak ikut iuran kambing
                                    </span>
                                  )}
                                </>
                              ) : (
                                <>
                                  <label className="min-h-[44px] inline-flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={draft.arisan === 'Lunas'}
                                      onChange={(e) =>
                                        setDraftMeetings((prev) => ({
                                          ...prev,
                                          [j.JadwalID]: {
                                            ...draft,
                                            arisan: e.target.checked
                                              ? 'Lunas'
                                              : 'Belum Lunas',
                                          },
                                        }))
                                      }
                                      className="h-5 w-5 rounded accent-[#16A34A]"
                                    />
                                    <span className="tabular-nums">
                                      Arisan ({formatRupiah(nomArisan)})
                                    </span>
                                  </label>

                                  {payingMember.IkutIuranKambing ? (
                                    <label className="min-h-[44px] inline-flex items-center gap-2 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={draft.kambing === 'Lunas'}
                                        onChange={(e) =>
                                          setDraftMeetings((prev) => ({
                                            ...prev,
                                            [j.JadwalID]: {
                                              ...draft,
                                              kambing: e.target.checked
                                                ? 'Lunas'
                                                : 'Belum Lunas',
                                            },
                                          }))
                                        }
                                        className="h-5 w-5 rounded accent-[#16A34A]"
                                      />
                                      <span className="tabular-nums">
                                        Kambing ({formatRupiah(nomKambing)})
                                      </span>
                                    </label>
                                  ) : (
                                    <span className="text-xs text-[#14532D]/60">
                                      Tidak ikut iuran kambing
                                    </span>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Payment Date & Total Summary Box */}
                {!readOnly ? (
                  <div className="bg-[#F0FDF4] rounded-lg p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <label
                          htmlFor="popup-tanggal-bayar"
                          className="block text-xs font-semibold text-[#14532D] mb-1"
                        >
                          Tanggal Pembayaran
                        </label>
                        <input
                          id="popup-tanggal-bayar"
                          type="date"
                          value={paymentDate}
                          onChange={(e) => setPaymentDate(e.target.value)}
                          className="w-full sm:w-auto min-h-[44px] px-3 py-1.5 rounded-lg bg-[#FFFFFF] border border-[#BBF7D0] text-sm text-[#14532D] tabular-nums"
                        />
                      </div>

                      <div className="sm:text-right">
                        <p className="text-xs font-medium text-[#15803D]">
                          Total yang Harus Dibayar Sekarang
                        </p>
                        <p className="text-2xl font-bold text-[#14532D] tabular-nums">
                          {formatRupiah(popupTotals.totalYangHarusDibayar)}
                        </p>
                        {popupTotals.sisaTunggakan > 0 && (
                          <p className="text-xs font-medium text-[#854D0E] mt-0.5 tabular-nums">
                            Sisa tunggakan tersimpan:{' '}
                            {formatRupiah(popupTotals.sisaTunggakan)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-[#F0FDF4] rounded-lg p-4 flex items-center justify-between gap-4">
                    <span className="text-xs font-semibold text-[#15803D]">
                      Total Tunggakan Belum Lunas
                    </span>
                    <span className="text-xl font-bold text-[#14532D] tabular-nums">
                      {formatRupiah(popupTotals.totalTunggakanSaatIni)}
                    </span>
                  </div>
                )}
              </div>

              <div className="sticky bottom-0 bg-[#FFFFFF] border-t border-[#DCFCE7] px-4 sm:px-5 py-3 flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setPayingMember(null)}
                  className="min-h-[44px] px-4 py-2 rounded-lg border border-[#BBF7D0] bg-[#FFFFFF] text-sm font-medium text-[#14532D] hover:bg-[#F0FDF4] transition-colors whitespace-nowrap"
                >
                  {readOnly ? 'Tutup' : 'Batal'}
                </button>
                {!readOnly && (
                  <button
                    type="submit"
                    className="flex-1 sm:flex-none min-h-[44px] px-5 py-2 rounded-lg bg-[#16A34A] text-white text-sm font-semibold hover:bg-[#15803D] transition-colors whitespace-nowrap"
                  >
                    Simpan Pembayaran
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Input Tunggakan dari Periode Sebelumnya */}
      {!readOnly && isTunggakanModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center sm:p-4 bg-[#14532D]/35"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-tunggakan-title"
        >
          <div className="w-full h-full sm:h-auto sm:max-w-md bg-[#FFFFFF] sm:rounded-lg shadow-xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 sm:py-4 border-b border-[#DCFCE7] shrink-0">
              <div>
                <h2
                  id="modal-tunggakan-title"
                  className="text-base font-bold text-[#14532D]"
                >
                  Input Tunggakan Periode Sebelumnya
                </h2>
                <p className="text-xs text-[#15803D] mt-0.5">
                  Catat sisa tunggakan anggota yang terbawa dari periode lalu
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsTunggakanModalOpen(false)}
                aria-label="Tutup dialog tunggakan"
                className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-[#14532D]/70 hover:bg-[#F0FDF4] transition-colors shrink-0"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={handleSubmitTunggakanAwal}
              className="flex-1 flex flex-col min-h-0"
            >
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
                {tErrors.length > 0 && (
                  <div className="p-3 rounded-lg bg-[#FEF2F2] border border-[#DC2626]/30 text-xs text-[#991B1B] space-y-1">
                    {tErrors.map((err, i) => (
                      <p key={i}>{err}</p>
                    ))}
                  </div>
                )}

                <div>
                  <label
                    htmlFor="tunggakan-periode"
                    className="block text-xs font-semibold text-[#14532D] mb-1.5"
                  >
                    Periode Berjalan
                  </label>
                  <select
                    id="tunggakan-periode"
                    value={tPeriodeId}
                    onChange={(e) => setTPeriodeId(e.target.value)}
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
                    htmlFor="tunggakan-anggota"
                    className="block text-xs font-semibold text-[#14532D] mb-1.5"
                  >
                    Nama Anggota
                  </label>
                  <select
                    id="tunggakan-anggota"
                    value={tAnggotaId}
                    onChange={(e) => setTAnggotaId(e.target.value)}
                    className="w-full min-h-[44px] px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#BBF7D0] text-sm text-[#14532D]"
                  >
                    {anggotas.map((a) => (
                      <option key={a.AnggotaID} value={a.AnggotaID}>
                        {a.NamaLengkap} ({a.AnggotaID})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="tunggakan-nominal"
                    className="block text-xs font-semibold text-[#14532D] mb-1.5"
                  >
                    Nominal Tunggakan (Rp)
                  </label>
                  <input
                    id="tunggakan-nominal"
                    type="number"
                    min={500}
                    step={500}
                    value={tNominal}
                    onChange={(e) => setTNominal(e.target.value)}
                    placeholder="Contoh: 15000"
                    className="w-full min-h-[44px] px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#BBF7D0] text-sm text-[#14532D] tabular-nums"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="tunggakan-keterangan"
                    className="block text-xs font-semibold text-[#14532D] mb-1.5"
                  >
                    Keterangan
                  </label>
                  <input
                    id="tunggakan-keterangan"
                    type="text"
                    value={tKeterangan}
                    onChange={(e) => setTKeterangan(e.target.value)}
                    placeholder="Contoh: Sisa iuran Putaran XI"
                    className="w-full min-h-[44px] px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#BBF7D0] text-sm text-[#14532D]"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="tunggakan-status"
                    className="block text-xs font-semibold text-[#14532D] mb-1.5"
                  >
                    Status
                  </label>
                  <select
                    id="tunggakan-status"
                    value={tStatus}
                    onChange={(e) => setTStatus(e.target.value as StatusBayar)}
                    className="w-full min-h-[44px] px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#BBF7D0] text-sm text-[#14532D]"
                  >
                    <option value="Belum Lunas">Belum Lunas</option>
                    <option value="Lunas">Lunas</option>
                  </select>
                </div>
              </div>

              <div className="sticky bottom-0 bg-[#FFFFFF] border-t border-[#DCFCE7] px-4 sm:px-5 py-3 flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsTunggakanModalOpen(false)}
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
