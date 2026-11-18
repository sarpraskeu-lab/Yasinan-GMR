import React from 'react';
import {
  BookOpen,
  BookOpenText,
  CalendarCheck,
  CalendarRange,
  ClipboardCheck,
  FileSpreadsheet,
  LayoutDashboard,
  ShieldCheck,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { ScreenId, UserRole } from '../types/yasinan';

interface SidebarProps {
  activeScreen: ScreenId;
  onSelectScreen: (screen: ScreenId) => void;
  role: UserRole;
  onChangeRole: (role: UserRole) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

interface NavItem {
  id: ScreenId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: UserRole[];
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    roles: ['admin', 'publik'],
  },
  {
    id: 'periode',
    label: 'Periode Yasinan',
    icon: CalendarRange,
    roles: ['admin'],
  },
  {
    id: 'anggota',
    label: 'Data Anggota',
    icon: Users,
    roles: ['admin'],
  },
  {
    id: 'jadwal',
    label: 'Jadwal & Penyerahan',
    icon: CalendarCheck,
    roles: ['admin', 'publik'],
  },
  {
    id: 'setoran',
    label: 'Setoran & Tunggakan',
    icon: ClipboardCheck,
    roles: ['admin', 'publik'],
  },
  {
    id: 'kas-amalan',
    label: 'Kas Amalan',
    icon: Wallet,
    roles: ['admin'],
  },
  {
    id: 'google-sync',
    label: 'Google Sheets & Drive',
    icon: FileSpreadsheet,
    roles: ['admin'],
  },
  {
    id: 'surat-yasin',
    label: 'Bacaan Surat Yasin',
    icon: BookOpenText,
    roles: ['admin', 'publik'],
  },
];

export function Sidebar({
  activeScreen,
  onSelectScreen,
  role,
  onChangeRole,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const handleSelect = (id: ScreenId) => {
    onSelectScreen(id);
    onCloseMobile();
  };

  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(role));

  const navContent = (
    <div className="flex h-full flex-col bg-[#FFFFFF] border-r border-[#DCFCE7]">
      <div className="flex items-center justify-between px-5 py-5 border-b border-[#DCFCE7]">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#16A34A] text-white">
            <BookOpen className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold leading-snug text-[#14532D] truncate">
              Kas & Jadwal Yasinan
            </p>
            <p className="text-xs text-[#15803D] truncate">
              {role === 'admin' ? 'Mode Pengurus (Admin)' : 'Mode Jamaah (Publik)'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Tutup menu navigasi"
          className="lg:hidden rounded-lg p-2 text-[#14532D] hover:bg-[#F0FDF4] transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Role Switcher */}
      <div className="px-3 pt-4 pb-2">
        <div
          className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-[#F0FDF4] border border-[#DCFCE7]"
          role="group"
          aria-label="Pilih peran akses"
        >
          <button
            type="button"
            onClick={() => onChangeRole('admin')}
            className={`inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
              role === 'admin'
                ? 'bg-[#FFFFFF] text-[#14532D] shadow-xs'
                : 'text-[#15803D] hover:text-[#14532D]'
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
            <span>Admin</span>
          </button>
          <button
            type="button"
            onClick={() => onChangeRole('publik')}
            className={`inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
              role === 'publik'
                ? 'bg-[#FFFFFF] text-[#14532D] shadow-xs'
                : 'text-[#15803D] hover:text-[#14532D]'
            }`}
          >
            <Users className="h-3.5 w-3.5 shrink-0" />
            <span>Publik</span>
          </button>
        </div>
      </div>

      <nav
        aria-label="Navigasi utama"
        className="flex-1 px-3 py-2 space-y-1 overflow-y-auto"
      >
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeScreen === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelect(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 whitespace-nowrap ${
                isActive
                  ? 'bg-[#16A34A] text-white'
                  : 'text-[#14532D] hover:bg-[#F0FDF4] hover:text-[#15803D]'
              }`}
            >
              <Icon
                className={`h-4 w-4 shrink-0 ${
                  isActive ? 'text-white' : 'text-[#15803D]'
                }`}
              />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block lg:w-[260px] lg:shrink-0 lg:sticky lg:top-0 lg:h-screen">
        {navContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden flex"
          role="dialog"
          aria-modal="true"
          aria-label="Menu Navigasi"
        >
          <div
            className="fixed inset-0 bg-[#14532D]/30 transition-opacity"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 w-[270px] max-w-[85vw] h-full shadow-lg">
            {navContent}
          </div>
        </div>
      )}
    </>
  );
}
