import React, { useState } from 'react';
import { Edit3, Plus, RefreshCw, X } from 'lucide-react';
import { FeedbackState, PeriodeYasinan, StatusPeriode } from '../types/yasinan';
import { formatRupiah, formatTanggalID, getTodayISO } from '../utils/formatters';
import {
  EmptyState,
  FeedbackBanner,
  StatusText,
  TableSkeleton,
} from './FeedbackBanner';

interface PeriodeScreenProps {
  periodes: PeriodeYasinan[];
  onSavePeriode: (
    data: Omit<PeriodeYasinan, 'PeriodeID'>,
    editingPeriodeId?: string
  ) => void;
}

export function PeriodeScreen({ periodes, onSavePeriode }: PeriodeScreenProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [formErrors, setFormErrors] = useState<string[]>([]);

  const [namaPeriode, setNamaPeriode] = useState('');
  const [tanggalMulai, setTanggalMulai] = useState(getTodayISO());
  const [tanggalSelesai, setTanggalSelesai] = useState(getTodayISO());
  const [saldoAwal, setSaldoAwal] = useState('450000');
  const [saldoAwalKambing, setSaldoAwalKambing] = useState('250000');
  const [saldoAwalAmalan, setSaldoAwalAmalan] = useState('175000');
  const [nominalArisan, setNominalArisan] = useState('10000');
  const [nominalKambing, setNominalKambing] = useState('5000');
  const [statusPeriode, setStatusPeriode] = useState<StatusPeriode>('Aktif');

  const openAddForm = () => {
    setEditingId(undefined);
    setFormErrors([]);
    setNamaPeriode('');
    setTanggalMulai(getTodayISO());
    setTanggalSelesai(getTodayISO());
    setSaldoAwal('0');
    setSaldoAwalKambing('0');
    setSaldoAwalAmalan('0');
    setNominalArisan('10000');
    setNominalKambing('5000');
    setStatusPeriode('Aktif');
    setIsFormOpen(true);
  };

  const openEditForm = (item: PeriodeYasinan) => {
    setEditingId(item.PeriodeID);
    setFormErrors([]);
    setNamaPeriode(item.NamaPeriode);
    setTanggalMulai(item.TanggalMulai);
    setTanggalSelesai(item.TanggalSelesai);
    setSaldoAwal(String(item.SaldoAwalPeriode));
    setSaldoAwalKambing(String(item.SaldoAwalKambing ?? 0));
    setSaldoAwalAmalan(String(item.SaldoAwalAmalan ?? 0));
    setNominalArisan(String(item.NominalArisanPerOrang));
    setNominalKambing(String(item.NominalKambingPerOrang));
    setStatusPeriode(item.StatusPeriode);
    setIsFormOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: string[] = [];
    const saldoNum = Number(saldoAwal);
    const kambingAwalNum = Number(saldoAwalKambing);
    const amalanAwalNum = Number(saldoAwalAmalan);
    const arisanNum = Number(nominalArisan);
    const kambingNum = Number(nominalKambing);

    if (!namaPeriode.trim()) {
      errors.push('Nama periode wajib diisi.');
    }
    if (!tanggalMulai || !tanggalSelesai) {
      errors.push('Tanggal mulai dan tanggal selesai wajib diisi.');
    } else if (tanggalSelesai < tanggalMulai) {
      errors.push('Tanggal selesai tidak boleh lebih awal dari tanggal mulai.');
    }
    if (!Number.isFinite(saldoNum) || saldoNum < 0) {
      errors.push('Saldo awal periode tidak valid.');
    }
    if (!Number.isFinite(kambingAwalNum) || kambingAwalNum < 0) {
      errors.push('Saldo awal uang kambing tidak valid.');
    }
    if (!Number.isFinite(amalanAwalNum) || amalanAwalNum < 0) {
      errors.push('Saldo awal kas amalan tidak valid.');
    }
    if (!Number.isFinite(arisanNum) || arisanNum <= 0) {
      errors.push('Nominal arisan per anggota harus lebih dari Rp0.');
    }
    if (!Number.isFinite(kambingNum) || kambingNum < 0) {
      errors.push('Nominal iuran kambing tidak valid.');
    }

    if (errors.length > 0) {
      setFormErrors(errors);
      setFeedback({
        type: 'error',
        message: 'Gagal menyimpan periode yasinan. Periksa kembali data yang dimasukkan.',
      });
      return;
    }

    onSavePeriode(
      {
        NamaPeriode: namaPeriode.trim(),
        TanggalMulai: tanggalMulai,
        TanggalSelesai: tanggalSelesai,
        SaldoAwalPeriode: saldoNum,
        SaldoAwalKambing: kambingAwalNum,
        SaldoAwalAmalan: amalanAwalNum,
        NominalArisanPerOrang: arisanNum,
        NominalKambingPerOrang: kambingNum,
        StatusPeriode: statusPeriode,
      },
      editingId
    );

    setIsFormOpen(false);
    setFormErrors([]);
    setFeedback({
      type: 'success',
      message: editingId
        ? 'Data periode yasinan dan saldo awal berhasil diperbarui.'
        : 'Periode yasinan baru berhasil ditambahkan.',
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
            Periode Yasinan
          </h1>
          <p className="text-sm text-[#15803D] mt-1">
            Pengelolaan putaran periode yasinan, saldo awal kas, uang kambing, dan kas amalan
          </p>
        </div>
        <button
          type="button"
          onClick={openAddForm}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#16A34A] text-white text-sm font-semibold hover:bg-[#15803D] transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>Tambah Periode</span>
        </button>
      </div>

      <FeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      {isFormOpen && (
        <section className="bg-[#FFFFFF] rounded-lg p-6 shadow-[0_1px_3px_rgba(20,83,45,0.06)]">
          <div className="flex items-center justify-between gap-4 pb-4 border-b border-[#DCFCE7]">
            <h2 className="text-base font-semibold text-[#14532D]">
              {editingId ? 'Ubah Periode Yasinan' : 'Tambah Periode Yasinan'}
            </h2>
            <button
              type="button"
              onClick={() => {
                setIsFormOpen(false);
                setFormErrors([]);
              }}
              aria-label="Tutup formulir periode"
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
            <div className="sm:col-span-2 lg:col-span-3">
              <label
                htmlFor="periode-nama"
                className="block text-xs font-semibold text-[#14532D] mb-1.5"
              >
                Nama Periode
              </label>
              <input
                id="periode-nama"
                type="text"
                value={namaPeriode}
                onChange={(e) => setNamaPeriode(e.target.value)}
                placeholder="Contoh: Putaran XIII (Jan - Mar 2027)"
                className="w-full px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#BBF7D0] text-sm text-[#14532D]"
                required
              />
            </div>

            <div>
              <label
                htmlFor="periode-mulai"
                className="block text-xs font-semibold text-[#14532D] mb-1.5"
              >
                Tanggal Mulai
              </label>
              <input
                id="periode-mulai"
                type="date"
                value={tanggalMulai}
                onChange={(e) => setTanggalMulai(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#BBF7D0] text-sm text-[#14532D] tabular-nums"
                required
              />
            </div>

            <div>
              <label
                htmlFor="periode-selesai"
                className="block text-xs font-semibold text-[#14532D] mb-1.5"
              >
                Tanggal Selesai
              </label>
              <input
                id="periode-selesai"
                type="date"
                value={tanggalSelesai}
                onChange={(e) => setTanggalSelesai(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#BBF7D0] text-sm text-[#14532D] tabular-nums"
                required
              />
            </div>

            <div>
              <label
                htmlFor="periode-status"
                className="block text-xs font-semibold text-[#14532D] mb-1.5"
              >
                Status Periode
              </label>
              <select
                id="periode-status"
                value={statusPeriode}
                onChange={(e) =>
                  setStatusPeriode(e.target.value as StatusPeriode)
                }
                className="w-full px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#BBF7D0] text-sm text-[#14532D]"
              >
                <option value="Aktif">Aktif</option>
                <option value="Selesai">Selesai</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="periode-saldo-awal"
                className="block text-xs font-semibold text-[#14532D] mb-1.5"
              >
                Saldo Awal Periode (Rp)
              </label>
              <input
                id="periode-saldo-awal"
                type="number"
                min={0}
                step={1000}
                value={saldoAwal}
                onChange={(e) => setSaldoAwal(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#BBF7D0] text-sm text-[#14532D] tabular-nums"
                required
              />
            </div>

            <div>
              <label
                htmlFor="periode-saldo-kambing"
                className="block text-xs font-semibold text-[#14532D] mb-1.5"
              >
                Saldo Awal Uang Kambing (Rp)
              </label>
              <input
                id="periode-saldo-kambing"
                type="number"
                min={0}
                step={1000}
                value={saldoAwalKambing}
                onChange={(e) => setSaldoAwalKambing(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#BBF7D0] text-sm text-[#14532D] tabular-nums"
                required
              />
            </div>

            <div>
              <label
                htmlFor="periode-saldo-amalan"
                className="block text-xs font-semibold text-[#14532D] mb-1.5"
              >
                Saldo Awal Kas Amalan (Rp)
              </label>
              <input
                id="periode-saldo-amalan"
                type="number"
                min={0}
                step={1000}
                value={saldoAwalAmalan}
                onChange={(e) => setSaldoAwalAmalan(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#BBF7D0] text-sm text-[#14532D] tabular-nums"
                required
              />
            </div>

            <div>
              <label
                htmlFor="periode-arisan"
                className="block text-xs font-semibold text-[#14532D] mb-1.5"
              >
                Iuran Arisan / Anggota (Rp)
              </label>
              <input
                id="periode-arisan"
                type="number"
                min={1000}
                step={1000}
                value={nominalArisan}
                onChange={(e) => setNominalArisan(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#BBF7D0] text-sm text-[#14532D] tabular-nums"
                required
              />
            </div>

            <div>
              <label
                htmlFor="periode-kambing"
                className="block text-xs font-semibold text-[#14532D] mb-1.5"
              >
                Iuran Kambing / Anggota (Rp)
              </label>
              <input
                id="periode-kambing"
                type="number"
                min={0}
                step={500}
                value={nominalKambing}
                onChange={(e) => setNominalKambing(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#BBF7D0] text-sm text-[#14532D] tabular-nums"
                required
              />
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
        <div className="p-4 sm:p-5 border-b border-[#DCFCE7] flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-[#14532D] tabular-nums">
            Daftar Periode ({periodes.length})
          </p>
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

        {isLoading ? (
          <TableSkeleton columns={9} rows={3} />
        ) : periodes.length === 0 ? (
          <EmptyState
            title="Belum ada periode yasinan"
            description="Buat periode baru untuk memulai pencatatan jadwal pertemuan, setoran arisan, dan saldo awal kas."
            actionLabel="Tambah Periode"
            onAction={openAddForm}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F0FDF4]/70 border-b border-[#DCFCE7] text-xs font-semibold text-[#15803D]">
                  <th className="px-4 py-3 whitespace-nowrap">PeriodeID</th>
                  <th className="px-4 py-3 whitespace-nowrap">Nama Periode</th>
                  <th className="px-4 py-3 whitespace-nowrap">Rentang Tanggal</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">
                    Saldo Awal Periode
                  </th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">
                    Awal Uang Kambing
                  </th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">
                    Awal Kas Amalan
                  </th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">
                    Iuran / Pertemuan
                  </th>
                  <th className="px-4 py-3 whitespace-nowrap">Status</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DCFCE7] text-sm">
                {periodes.map((item) => (
                  <tr
                    key={item.PeriodeID}
                    className="hover:bg-[#F0FDF4]/50 transition-colors"
                  >
                    <td className="px-4 py-3 text-xs font-semibold text-[#14532D] tabular-nums whitespace-nowrap">
                      {item.PeriodeID}
                    </td>
                    <td className="px-4 py-3 font-medium text-[#14532D] whitespace-nowrap">
                      {item.NamaPeriode}
                    </td>
                    <td className="px-4 py-3 text-[#14532D] tabular-nums whitespace-nowrap">
                      {formatTanggalID(item.TanggalMulai)} -{' '}
                      {formatTanggalID(item.TanggalSelesai)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-[#14532D] tabular-nums whitespace-nowrap">
                      {formatRupiah(item.SaldoAwalPeriode)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-[#14532D] tabular-nums whitespace-nowrap">
                      {formatRupiah(item.SaldoAwalKambing ?? 0)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-[#14532D] tabular-nums whitespace-nowrap">
                      {formatRupiah(item.SaldoAwalAmalan ?? 0)}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-[#14532D]/85 tabular-nums whitespace-nowrap">
                      Arisan {formatRupiah(item.NominalArisanPerOrang)} · Kambing{' '}
                      {formatRupiah(item.NominalKambingPerOrang)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StatusText
                        variant={
                          item.StatusPeriode === 'Aktif' ? 'positive' : 'neutral'
                        }
                        label={item.StatusPeriode}
                      />
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
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
