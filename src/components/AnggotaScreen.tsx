import React, { useMemo, useState } from 'react';
import { Edit3, Plus, RefreshCw, Search, X } from 'lucide-react';
import { Anggota, FeedbackState, StatusAnggota } from '../types/yasinan';
import {
  EmptyState,
  FeedbackBanner,
  StatusText,
  TableSkeleton,
} from './FeedbackBanner';

interface AnggotaScreenProps {
  anggotas: Anggota[];
  onSaveAnggota: (
    data: Omit<Anggota, 'AnggotaID'>,
    editingAnggotaId?: string
  ) => void;
}

type KambingFilter = 'SEMUA' | 'IKUT' | 'TIDAK_IKUT';

export function AnggotaScreen({ anggotas, onSaveAnggota }: AnggotaScreenProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'SEMUA' | StatusAnggota>(
    'SEMUA'
  );
  const [kambingFilter, setKambingFilter] = useState<KambingFilter>('SEMUA');
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [formErrors, setFormErrors] = useState<string[]>([]);

  const [namaLengkap, setNamaLengkap] = useState('');
  const [alamat, setAlamat] = useState('');
  const [noTelepon, setNoTelepon] = useState('');
  const [statusAktif, setStatusAktif] = useState<StatusAnggota>('Aktif');
  const [ikutIuranKambing, setIkutIuranKambing] = useState<boolean>(true);

  const filteredAnggota = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return anggotas.filter((a) => {
      if (statusFilter !== 'SEMUA' && a.StatusAktif !== statusFilter) {
        return false;
      }
      if (kambingFilter === 'IKUT' && !a.IkutIuranKambing) {
        return false;
      }
      if (kambingFilter === 'TIDAK_IKUT' && a.IkutIuranKambing) {
        return false;
      }
      if (!q) return true;
      return (
        a.AnggotaID.toLowerCase().includes(q) ||
        a.NamaLengkap.toLowerCase().includes(q) ||
        a.Alamat.toLowerCase().includes(q) ||
        a.NoTelepon.toLowerCase().includes(q)
      );
    });
  }, [anggotas, searchQuery, statusFilter, kambingFilter]);

  const openAddForm = () => {
    setEditingId(undefined);
    setFormErrors([]);
    setNamaLengkap('');
    setAlamat('');
    setNoTelepon('');
    setStatusAktif('Aktif');
    setIkutIuranKambing(true);
    setIsFormOpen(true);
  };

  const openEditForm = (item: Anggota) => {
    setEditingId(item.AnggotaID);
    setFormErrors([]);
    setNamaLengkap(item.NamaLengkap);
    setAlamat(item.Alamat);
    setNoTelepon(item.NoTelepon);
    setStatusAktif(item.StatusAktif);
    setIkutIuranKambing(item.IkutIuranKambing);
    setIsFormOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: string[] = [];
    if (!namaLengkap.trim()) {
      errors.push('Nama lengkap anggota wajib diisi.');
    }
    if (!alamat.trim()) {
      errors.push('Alamat wajib diisi.');
    }
    if (!noTelepon.trim()) {
      errors.push('Nomor telepon wajib diisi.');
    }

    if (errors.length > 0) {
      setFormErrors(errors);
      setFeedback({
        type: 'error',
        message: 'Gagal menyimpan data anggota. Lengkapi kolom yang wajib diisi.',
      });
      return;
    }

    onSaveAnggota(
      {
        NamaLengkap: namaLengkap.trim(),
        Alamat: alamat.trim(),
        NoTelepon: noTelepon.trim(),
        StatusAktif: statusAktif,
        IkutIuranKambing: ikutIuranKambing,
      },
      editingId
    );

    setIsFormOpen(false);
    setFormErrors([]);
    setFeedback({
      type: 'success',
      message: editingId
        ? 'Data anggota berhasil diperbarui.'
        : 'Anggota baru berhasil ditambahkan.',
    });
  };

  const handleRefresh = () => {
    setIsLoading(true);
    window.setTimeout(() => setIsLoading(false), 300);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#14532D]">
            Data Anggota Yasinan
          </h1>
          <p className="text-sm text-[#15803D] mt-1">
            Daftar jamaah peserta arisan, keikutsertaan iuran kambing, dan giliran tuan rumah
          </p>
        </div>
        <button
          type="button"
          onClick={openAddForm}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#16A34A] text-white text-sm font-semibold hover:bg-[#15803D] transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>Tambah Anggota</span>
        </button>
      </div>

      <FeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      {isFormOpen && (
        <section className="bg-[#FFFFFF] rounded-lg p-6 shadow-[0_1px_3px_rgba(20,83,45,0.06)]">
          <div className="flex items-center justify-between gap-4 pb-4 border-b border-[#DCFCE7]">
            <h2 className="text-base font-semibold text-[#14532D]">
              {editingId ? 'Ubah Data Anggota' : 'Tambah Anggota Baru'}
            </h2>
            <button
              type="button"
              onClick={() => {
                setIsFormOpen(false);
                setFormErrors([]);
              }}
              aria-label="Tutup formulir anggota"
              className="p-1.5 rounded-lg text-[#14532D]/70 hover:bg-[#F0FDF4] transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {formErrors.length > 0 && (
            <div className="mt-4 p-3.5 rounded-lg bg-[#FEF2F2] border border-[#DC2626]/30 text-xs text-[#991B1B] space-y-1">
              {formErrors.map((err, idx) => (
                <p key={idx}>{err}</p>
              ))}
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            <div>
              <label
                htmlFor="anggota-nama"
                className="block text-xs font-semibold text-[#14532D] mb-1.5"
              >
                Nama Lengkap
              </label>
              <input
                id="anggota-nama"
                type="text"
                value={namaLengkap}
                onChange={(e) => setNamaLengkap(e.target.value)}
                placeholder="Contoh: Bpk. Wahyu Hidayat"
                className="w-full px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#BBF7D0] text-sm text-[#14532D]"
                required
              />
            </div>

            <div>
              <label
                htmlFor="anggota-telp"
                className="block text-xs font-semibold text-[#14532D] mb-1.5"
              >
                No. Telepon
              </label>
              <input
                id="anggota-telp"
                type="text"
                value={noTelepon}
                onChange={(e) => setNoTelepon(e.target.value)}
                placeholder="Contoh: 0812-3456-7890"
                className="w-full px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#BBF7D0] text-sm text-[#14532D] tabular-nums"
                required
              />
            </div>

            <div>
              <label
                htmlFor="anggota-status"
                className="block text-xs font-semibold text-[#14532D] mb-1.5"
              >
                Status Keanggotaan
              </label>
              <select
                id="anggota-status"
                value={statusAktif}
                onChange={(e) =>
                  setStatusAktif(e.target.value as StatusAnggota)
                }
                className="w-full px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#BBF7D0] text-sm text-[#14532D]"
              >
                <option value="Aktif">Aktif</option>
                <option value="Nonaktif">Nonaktif</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label
                htmlFor="anggota-alamat"
                className="block text-xs font-semibold text-[#14532D] mb-1.5"
              >
                Alamat
              </label>
              <input
                id="anggota-alamat"
                type="text"
                value={alamat}
                onChange={(e) => setAlamat(e.target.value)}
                placeholder="Contoh: Jl. Melati No. 08, RT 01/RW 03"
                className="w-full px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#BBF7D0] text-sm text-[#14532D]"
                required
              />
            </div>

            <div>
              <label
                htmlFor="anggota-kambing"
                className="block text-xs font-semibold text-[#14532D] mb-1.5"
              >
                Keikutsertaan Iuran Kambing
              </label>
              <select
                id="anggota-kambing"
                value={ikutIuranKambing ? 'YA' : 'TIDAK'}
                onChange={(e) => setIkutIuranKambing(e.target.value === 'YA')}
                className="w-full px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#BBF7D0] text-sm text-[#14532D]"
              >
                <option value="YA">Ya, Ikut Iuran Kambing</option>
                <option value="TIDAK">Tidak Ikut Iuran Kambing</option>
              </select>
            </div>

            <div className="sm:col-span-2 lg:col-span-3 flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsFormOpen(false);
                  setFormErrors([]);
                }}
                className="px-4 py-2 rounded-lg border border-[#BBF7D0] bg-[#FFFFFF] text-sm font-medium text-[#14532D] hover:bg-[#F0FDF4] transition-colors whitespace-nowrap"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-lg bg-[#16A34A] text-white text-sm font-semibold hover:bg-[#15803D] transition-colors whitespace-nowrap"
              >
                Simpan
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="bg-[#FFFFFF] rounded-lg shadow-[0_1px_3px_rgba(20,83,45,0.06)] overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-[#DCFCE7] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search
              className="h-4 w-4 text-[#15803D] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama anggota, ID, atau alamat..."
              aria-label="Cari anggota"
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#F0FDF4]/60 border border-[#BBF7D0] text-sm text-[#14532D] placeholder:text-[#15803D]/60"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              aria-label="Filter iuran kambing"
              value={kambingFilter}
              onChange={(e) =>
                setKambingFilter(e.target.value as KambingFilter)
              }
              className="px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#BBF7D0] text-sm font-medium text-[#14532D]"
            >
              <option value="SEMUA">Semua Iuran Kambing</option>
              <option value="IKUT">Ikut Iuran Kambing</option>
              <option value="TIDAK_IKUT">Tidak Ikut</option>
            </select>

            <select
              aria-label="Filter status anggota"
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as 'SEMUA' | StatusAnggota)
              }
              className="px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#BBF7D0] text-sm font-medium text-[#14532D]"
            >
              <option value="SEMUA">Semua Status</option>
              <option value="Aktif">Aktif</option>
              <option value="Nonaktif">Nonaktif</option>
            </select>

            <button
              type="button"
              onClick={handleRefresh}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#BBF7D0] bg-[#FFFFFF] text-sm font-medium text-[#14532D] hover:bg-[#F0FDF4] transition-colors whitespace-nowrap"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Muat Ulang</span>
            </button>
          </div>
        </div>

        {isLoading ? (
          <TableSkeleton columns={7} rows={6} />
        ) : filteredAnggota.length === 0 ? (
          <EmptyState
            title="Data anggota tidak ditemukan"
            description="Tidak ada anggota yang sesuai dengan kata kunci pencarian atau filter status."
            actionLabel={
              searchQuery || statusFilter !== 'SEMUA' || kambingFilter !== 'SEMUA'
                ? 'Reset Filter'
                : 'Tambah Anggota'
            }
            onAction={() => {
              if (
                searchQuery ||
                statusFilter !== 'SEMUA' ||
                kambingFilter !== 'SEMUA'
              ) {
                setSearchQuery('');
                setStatusFilter('SEMUA');
                setKambingFilter('SEMUA');
              } else {
                openAddForm();
              }
            }}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F0FDF4]/70 border-b border-[#DCFCE7] text-xs font-semibold text-[#15803D]">
                  <th className="px-5 py-3 whitespace-nowrap">AnggotaID</th>
                  <th className="px-5 py-3 whitespace-nowrap">Nama Lengkap</th>
                  <th className="px-5 py-3">Alamat</th>
                  <th className="px-5 py-3 whitespace-nowrap">No. Telepon</th>
                  <th className="px-5 py-3 whitespace-nowrap">Iuran Kambing</th>
                  <th className="px-5 py-3 whitespace-nowrap">Status</th>
                  <th className="px-5 py-3 text-right whitespace-nowrap">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DCFCE7] text-sm">
                {filteredAnggota.map((item) => (
                  <tr
                    key={item.AnggotaID}
                    className="hover:bg-[#F0FDF4]/50 transition-colors"
                  >
                    <td className="px-5 py-3 text-xs font-semibold text-[#14532D] tabular-nums whitespace-nowrap">
                      {item.AnggotaID}
                    </td>
                    <td className="px-5 py-3 font-medium text-[#14532D] whitespace-nowrap">
                      {item.NamaLengkap}
                    </td>
                    <td className="px-5 py-3 text-[#14532D]/85">{item.Alamat}</td>
                    <td className="px-5 py-3 text-[#14532D] tabular-nums whitespace-nowrap">
                      {item.NoTelepon}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      <StatusText
                        variant={item.IkutIuranKambing ? 'positive' : 'neutral'}
                        label={item.IkutIuranKambing ? 'Ikut' : 'Tidak Ikut'}
                      />
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      <StatusText
                        variant={
                          item.StatusAktif === 'Aktif' ? 'positive' : 'neutral'
                        }
                        label={item.StatusAktif}
                      />
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
