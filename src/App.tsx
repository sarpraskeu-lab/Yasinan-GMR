import React, { useEffect, useState } from 'react';
import {
  BookOpenText,
  CalendarCheck,
  ClipboardCheck,
  LayoutDashboard,
  Menu,
  Wallet,
} from 'lucide-react';
import {
  Anggota,
  AppDataState,
  JadwalArisan,
  PeriodeYasinan,
  ScreenId,
  SetoranAnggota,
  TransaksiKas,
  TunggakanAwal,
  UserRole,
} from './types/yasinan';
import {
  INITIAL_ANGGOTA,
  INITIAL_JADWAL,
  INITIAL_PERIODE,
  INITIAL_SETORAN,
  INITIAL_TRANSAKSI_KAS,
  INITIAL_TUNGGAKAN_AWAL,
} from './data/seedData';
import { nextId } from './utils/formatters';
import { Sidebar } from './components/Sidebar';
import { DashboardScreen } from './components/DashboardScreen';
import { PeriodeScreen } from './components/PeriodeScreen';
import { AnggotaScreen } from './components/AnggotaScreen';
import { JadwalScreen } from './components/JadwalScreen';
import {
  MeetingPaymentDraft,
  SetoranScreen,
  TunggakanAwalDraft,
} from './components/SetoranScreen';
import { KasAmalanScreen } from './components/KasAmalanScreen';
import { SuratYasinScreen } from './components/SuratYasinScreen';
import { GoogleWorkspaceScreen } from './components/GoogleWorkspaceScreen';

const STORAGE_KEY = 'yasinan_kas_jadwal_v3';

function loadInitialData(): AppDataState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AppDataState>;
      if (
        Array.isArray(parsed.periodes) &&
        Array.isArray(parsed.anggotas) &&
        Array.isArray(parsed.jadwals) &&
        Array.isArray(parsed.setorans) &&
        Array.isArray(parsed.transaksiKas) &&
        Array.isArray(parsed.tunggakanAwals)
      ) {
        return {
          periodes: parsed.periodes.map((p) => ({
            ...p,
            SaldoAwalKambing: p.SaldoAwalKambing ?? 0,
            SaldoAwalAmalan: p.SaldoAwalAmalan ?? 0,
          })),
          anggotas: parsed.anggotas.map((a) => ({
            ...a,
            IkutIuranKambing: a.IkutIuranKambing ?? true,
          })),
          jadwals: parsed.jadwals,
          setorans: parsed.setorans,
          transaksiKas: parsed.transaksiKas,
          tunggakanAwals: parsed.tunggakanAwals,
        };
      }
    }
  } catch {
    // Fallback to initial seed data if localStorage is unavailable or malformed
  }
  return {
    periodes: INITIAL_PERIODE,
    anggotas: INITIAL_ANGGOTA,
    jadwals: INITIAL_JADWAL,
    setorans: INITIAL_SETORAN,
    transaksiKas: INITIAL_TRANSAKSI_KAS,
    tunggakanAwals: INITIAL_TUNGGAKAN_AWAL,
  };
}

const PUBLIC_SCREENS: ScreenId[] = [
  'dashboard',
  'jadwal',
  'setoran',
  'surat-yasin',
];

interface BottomTabItem {
  id: ScreenId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const ADMIN_MOBILE_TABS: BottomTabItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'jadwal', label: 'Jadwal', icon: CalendarCheck },
  { id: 'setoran', label: 'Setoran', icon: ClipboardCheck },
  { id: 'kas-amalan', label: 'Kas', icon: Wallet },
];

const PUBLIC_MOBILE_TABS: BottomTabItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'jadwal', label: 'Jadwal', icon: CalendarCheck },
  { id: 'setoran', label: 'Setoran', icon: ClipboardCheck },
  { id: 'surat-yasin', label: 'Surat Yasin', icon: BookOpenText },
];

export default function App() {
  const [role, setRole] = useState<UserRole>('admin');
  const [activeScreen, setActiveScreen] = useState<ScreenId>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [data, setData] = useState<AppDataState>(() => loadInitialData());

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Ignore storage quota errors safely
    }
  }, [data]);

  const handleChangeRole = (nextRole: UserRole) => {
    setRole(nextRole);
    if (nextRole === 'publik' && !PUBLIC_SCREENS.includes(activeScreen)) {
      setActiveScreen('dashboard');
    }
  };

  const handleSavePeriode = (
    formData: Omit<PeriodeYasinan, 'PeriodeID'>,
    editingPeriodeId?: string
  ) => {
    setData((prev) => {
      if (editingPeriodeId) {
        return {
          ...prev,
          periodes: prev.periodes.map((p) =>
            p.PeriodeID === editingPeriodeId ? { ...p, ...formData } : p
          ),
        };
      }
      const newId = nextId(
        'PRD-2026',
        prev.periodes.map((p) => p.PeriodeID),
        2
      );
      return {
        ...prev,
        periodes: [{ PeriodeID: newId, ...formData }, ...prev.periodes],
      };
    });
  };

  const handleUpdateSaldoAwalKas = (
    periodeId: string,
    saldoAwalKambing: number,
    saldoAwalAmalan: number
  ) => {
    setData((prev) => ({
      ...prev,
      periodes: prev.periodes.map((p) =>
        p.PeriodeID === periodeId
          ? {
              ...p,
              SaldoAwalKambing: saldoAwalKambing,
              SaldoAwalAmalan: saldoAwalAmalan,
            }
          : p
      ),
    }));
  };

  const handleSaveAnggota = (
    formData: Omit<Anggota, 'AnggotaID'>,
    editingAnggotaId?: string
  ) => {
    setData((prev) => {
      if (editingAnggotaId) {
        const activePeriodes = new Map(
          prev.periodes.map((p) => [p.PeriodeID, p])
        );
        const updatedAnggotas = prev.anggotas.map((a) =>
          a.AnggotaID === editingAnggotaId ? { ...a, ...formData } : a
        );
        // Sync unpaid kambing obligations when IkutIuranKambing changes
        const updatedSetorans = prev.setorans.map((s) => {
          if (s.AnggotaID !== editingAnggotaId) return s;
          const pObj = activePeriodes.get(s.PeriodeID);
          if (pObj?.StatusPeriode !== 'Aktif') return s;
          if (!formData.IkutIuranKambing && s.StatusKambing === 'Belum Lunas') {
            return {
              ...s,
              NominalKambing: 0,
              StatusKambing: 'Lunas' as const,
            };
          }
          if (formData.IkutIuranKambing && s.NominalKambing === 0) {
            return {
              ...s,
              NominalKambing: pObj.NominalKambingPerOrang,
              StatusKambing: 'Belum Lunas' as const,
            };
          }
          return s;
        });

        return {
          ...prev,
          anggotas: updatedAnggotas,
          setorans: updatedSetorans,
        };
      }

      const newId = nextId(
        'ANG',
        prev.anggotas.map((a) => a.AnggotaID),
        3
      );
      return {
        ...prev,
        anggotas: [...prev.anggotas, { AnggotaID: newId, ...formData }],
      };
    });
  };

  const handleSaveJadwal = (
    formData: Omit<JadwalArisan, 'JadwalID'>,
    editingJadwalId?: string
  ) => {
    setData((prev) => {
      if (editingJadwalId) {
        return {
          ...prev,
          jadwals: prev.jadwals.map((j) =>
            j.JadwalID === editingJadwalId ? { ...j, ...formData } : j
          ),
        };
      }

      const newJadwalId = nextId(
        'JDW',
        prev.jadwals.map((j) => j.JadwalID),
        3
      );
      const newJadwal: JadwalArisan = {
        JadwalID: newJadwalId,
        ...formData,
      };

      const targetPeriode = prev.periodes.find(
        (p) => p.PeriodeID === formData.PeriodeID
      );
      const nominalArisan = targetPeriode?.NominalArisanPerOrang ?? 10000;
      const nominalKambing = targetPeriode?.NominalKambingPerOrang ?? 5000;

      const runningIds = prev.setorans.map((s) => s.SetoranID);
      const activeMembers = prev.anggotas.filter(
        (a) => a.StatusAktif === 'Aktif'
      );

      const newSetorans: SetoranAnggota[] = [];
      for (const member of activeMembers) {
        const setoranId = nextId('STR', runningIds, 3);
        runningIds.push(setoranId);
        newSetorans.push({
          SetoranID: setoranId,
          PeriodeID: formData.PeriodeID,
          JadwalID: newJadwalId,
          AnggotaID: member.AnggotaID,
          NominalArisan: nominalArisan,
          StatusArisan: 'Belum Lunas',
          NominalKambing: member.IkutIuranKambing ? nominalKambing : 0,
          StatusKambing: member.IkutIuranKambing ? 'Belum Lunas' : 'Lunas',
          TanggalBayar: '',
        });
      }

      return {
        ...prev,
        jadwals: [...prev.jadwals, newJadwal],
        setorans: [...prev.setorans, ...newSetorans],
      };
    });
  };

  const handleSaveMemberPayments = ({
    periodeId,
    anggotaId,
    tanggalBayar,
    meetingDrafts,
    tunggakanDrafts,
  }: {
    periodeId: string;
    anggotaId: string;
    tanggalBayar: string;
    meetingDrafts: MeetingPaymentDraft[];
    tunggakanDrafts: TunggakanAwalDraft[];
  }) => {
    setData((prev) => {
      const targetPeriode = prev.periodes.find(
        (p) => p.PeriodeID === periodeId
      );
      const member = prev.anggotas.find((a) => a.AnggotaID === anggotaId);
      const ikutKambing = member?.IkutIuranKambing ?? true;

      const defaultArisan = targetPeriode?.NominalArisanPerOrang ?? 10000;
      const defaultKambing = ikutKambing
        ? targetPeriode?.NominalKambingPerOrang ?? 5000
        : 0;

      const updatedSetorans = [...prev.setorans];
      const runningIds = updatedSetorans.map((s) => s.SetoranID);

      for (const draft of meetingDrafts) {
        const idx = updatedSetorans.findIndex(
          (s) =>
            s.PeriodeID === periodeId &&
            s.JadwalID === draft.JadwalID &&
            s.AnggotaID === anggotaId
        );
        const safeKambingStatus = ikutKambing ? draft.StatusKambing : 'Lunas';
        const hasAnyLunas =
          draft.StatusArisan === 'Lunas' ||
          (ikutKambing && safeKambingStatus === 'Lunas');

        if (idx >= 0) {
          const existing = updatedSetorans[idx];
          const changedToPaid =
            (existing.StatusArisan === 'Belum Lunas' &&
              draft.StatusArisan === 'Lunas') ||
            (ikutKambing &&
              existing.StatusKambing === 'Belum Lunas' &&
              safeKambingStatus === 'Lunas');

          updatedSetorans[idx] = {
            ...existing,
            StatusArisan: draft.StatusArisan,
            StatusKambing: safeKambingStatus,
            NominalKambing: ikutKambing ? existing.NominalKambing : 0,
            TanggalBayar: hasAnyLunas
              ? changedToPaid || !existing.TanggalBayar
                ? tanggalBayar
                : existing.TanggalBayar
              : '',
          };
        } else if (hasAnyLunas) {
          const newSetoranId = nextId('STR', runningIds, 3);
          runningIds.push(newSetoranId);
          updatedSetorans.push({
            SetoranID: newSetoranId,
            PeriodeID: periodeId,
            JadwalID: draft.JadwalID,
            AnggotaID: anggotaId,
            NominalArisan: defaultArisan,
            StatusArisan: draft.StatusArisan,
            NominalKambing: defaultKambing,
            StatusKambing: safeKambingStatus,
            TanggalBayar: tanggalBayar,
          });
        }
      }

      const tunggakanMap = new Map(
        tunggakanDrafts.map((d) => [d.TunggakanID, d.StatusBayar])
      );

      const updatedTunggakanAwals = prev.tunggakanAwals.map((t) => {
        const nextStatus = tunggakanMap.get(t.TunggakanID);
        if (!nextStatus) return t;
        return {
          ...t,
          StatusBayar: nextStatus,
          TanggalBayar:
            nextStatus === 'Lunas'
              ? t.StatusBayar === 'Belum Lunas' || !t.TanggalBayar
                ? tanggalBayar
                : t.TanggalBayar
              : '',
        };
      });

      return {
        ...prev,
        setorans: updatedSetorans,
        tunggakanAwals: updatedTunggakanAwals,
      };
    });
  };

  const handleAddTunggakanAwal = (
    formData: Omit<TunggakanAwal, 'TunggakanID'>
  ) => {
    setData((prev) => {
      const newId = nextId(
        'TGK',
        prev.tunggakanAwals.map((t) => t.TunggakanID),
        3
      );
      return {
        ...prev,
        tunggakanAwals: [
          ...prev.tunggakanAwals,
          { TunggakanID: newId, ...formData },
        ],
      };
    });
  };

  const handleAddTransaksi = (formData: Omit<TransaksiKas, 'TransaksiID'>) => {
    setData((prev) => {
      const newId = nextId(
        'KAS',
        prev.transaksiKas.map((t) => t.TransaksiID),
        3
      );
      return {
        ...prev,
        transaksiKas: [
          { TransaksiID: newId, ...formData },
          ...prev.transaksiKas,
        ],
      };
    });
  };

  const handleUpdateTransaksi = (
    transaksiId: string,
    formData: Omit<TransaksiKas, 'TransaksiID'>
  ) => {
    setData((prev) => ({
      ...prev,
      transaksiKas: prev.transaksiKas.map((t) =>
        t.TransaksiID === transaksiId ? { ...t, ...formData } : t
      ),
    }));
  };

  const handleReplaceAllData = (nextData: AppDataState) => {
    setData({
      periodes: nextData.periodes.map((p) => ({
        ...p,
        SaldoAwalKambing: p.SaldoAwalKambing ?? 0,
        SaldoAwalAmalan: p.SaldoAwalAmalan ?? 0,
      })),
      anggotas: nextData.anggotas.map((a) => ({
        ...a,
        IkutIuranKambing: a.IkutIuranKambing ?? true,
      })),
      jadwals: nextData.jadwals,
      setorans: nextData.setorans,
      transaksiKas: nextData.transaksiKas,
      tunggakanAwals: nextData.tunggakanAwals ?? [],
    });
  };

  const handleImportAnggotaRows = (newMembers: Anggota[]) => {
    setData((prev) => ({
      ...prev,
      anggotas: [...prev.anggotas, ...newMembers],
    }));
  };

  const handleImportKasRows = (newTransactions: TransaksiKas[]) => {
    setData((prev) => ({
      ...prev,
      transaksiKas: [...newTransactions, ...prev.transaksiKas],
    }));
  };

  const isPublic = role === 'publik';
  const mobileTabs = isPublic ? PUBLIC_MOBILE_TABS : ADMIN_MOBILE_TABS;

  return (
    <div className="min-h-screen bg-[#F0FDF4] text-[#14532D] flex flex-col lg:flex-row">
      {/* Mobile Top Header Bar */}
      <header className="lg:hidden sticky top-0 z-30 h-12 bg-[#FFFFFF] border-b border-[#DCFCE7] px-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          aria-label="Buka menu navigasi"
          className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-[#14532D] hover:bg-[#F0FDF4] transition-colors shrink-0"
        >
          <Menu className="h-5 w-5" />
        </button>
        <span className="text-sm font-bold text-[#14532D] truncate">
          Kas & Jadwal Yasinan
        </span>
        <button
          type="button"
          onClick={() => handleChangeRole(isPublic ? 'admin' : 'publik')}
          className="min-h-[44px] px-3 rounded-lg border border-[#BBF7D0] bg-[#F0FDF4] text-xs font-semibold text-[#15803D] whitespace-nowrap shrink-0"
        >
          {isPublic ? 'Mode Publik' : 'Mode Admin'}
        </button>
      </header>

      {/* Left Sidebar Navigation */}
      <Sidebar
        activeScreen={activeScreen}
        onSelectScreen={setActiveScreen}
        role={role}
        onChangeRole={handleChangeRole}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 px-4 pt-5 pb-20 sm:px-6 lg:px-8 lg:py-8">
        <div className="max-w-7xl mx-auto">
          {activeScreen === 'dashboard' && (
            <DashboardScreen
              periodes={data.periodes}
              anggotas={data.anggotas}
              jadwals={data.jadwals}
              setorans={data.setorans}
              transaksiKas={data.transaksiKas}
              tunggakanAwals={data.tunggakanAwals}
              readOnly={isPublic}
              onNavigate={setActiveScreen}
            />
          )}

          {!isPublic && activeScreen === 'periode' && (
            <PeriodeScreen
              periodes={data.periodes}
              onSavePeriode={handleSavePeriode}
            />
          )}

          {!isPublic && activeScreen === 'anggota' && (
            <AnggotaScreen
              anggotas={data.anggotas}
              onSaveAnggota={handleSaveAnggota}
            />
          )}

          {activeScreen === 'jadwal' && (
            <JadwalScreen
              periodes={data.periodes}
              anggotas={data.anggotas}
              jadwals={data.jadwals}
              readOnly={isPublic}
              onSaveJadwal={handleSaveJadwal}
            />
          )}

          {activeScreen === 'setoran' && (
            <SetoranScreen
              periodes={data.periodes}
              anggotas={data.anggotas}
              jadwals={data.jadwals}
              setorans={data.setorans}
              tunggakanAwals={data.tunggakanAwals}
              readOnly={isPublic}
              onSaveMemberPayments={handleSaveMemberPayments}
              onAddTunggakanAwal={handleAddTunggakanAwal}
            />
          )}

          {!isPublic && activeScreen === 'kas-amalan' && (
            <KasAmalanScreen
              periodes={data.periodes}
              setorans={data.setorans}
              transaksiKas={data.transaksiKas}
              onAddTransaksi={handleAddTransaksi}
              onUpdateTransaksi={handleUpdateTransaksi}
              onUpdateSaldoAwalKas={handleUpdateSaldoAwalKas}
            />
          )}

          {!isPublic && activeScreen === 'google-sync' && (
            <GoogleWorkspaceScreen
              data={data}
              onReplaceAllData={handleReplaceAllData}
              onImportAnggotaRows={handleImportAnggotaRows}
              onImportKasRows={handleImportKasRows}
            />
          )}

          {activeScreen === 'surat-yasin' && <SuratYasinScreen />}
        </div>
      </main>

      {/* Mobile Bottom Tab Bar */}
      <nav
        aria-label="Navigasi bawah seluler"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#FFFFFF] border-t border-[#DCFCE7] h-14 px-1 grid grid-cols-4 items-center"
      >
        {mobileTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeScreen === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveScreen(tab.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`min-h-[44px] w-full flex flex-col items-center justify-center gap-0.5 rounded-lg px-1 transition-colors ${
                isActive
                  ? 'text-[#16A34A] font-bold bg-[#F0FDF4]'
                  : 'text-[#14532D]/75 font-medium hover:text-[#15803D]'
              }`}
            >
              <Icon
                className={`h-5 w-5 shrink-0 ${
                  isActive ? 'text-[#16A34A]' : 'text-[#15803D]'
                }`}
                aria-hidden="true"
              />
              <span className="text-[11px] leading-tight truncate max-w-full">
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
