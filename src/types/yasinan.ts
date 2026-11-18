export type UserRole = 'admin' | 'publik';

export type ScreenId =
  | 'dashboard'
  | 'periode'
  | 'anggota'
  | 'jadwal'
  | 'setoran'
  | 'kas-amalan'
  | 'surat-yasin'
  | 'google-sync';

export type StatusPeriode = 'Aktif' | 'Selesai';
export type StatusAnggota = 'Aktif' | 'Nonaktif';
export type StatusPenyerahan = 'Belum Diserahkan' | 'Sudah Diserahkan';
export type StatusBayar = 'Lunas' | 'Belum Lunas';
export type KategoriKas = 'Uang Amalan' | 'Iuran Kambing';
export type JenisTransaksi = 'Masuk' | 'Keluar';

export interface PeriodeYasinan {
  PeriodeID: string;
  NamaPeriode: string;
  TanggalMulai: string; // YYYY-MM-DD
  TanggalSelesai: string; // YYYY-MM-DD
  SaldoAwalPeriode: number;
  SaldoAwalKambing: number;
  SaldoAwalAmalan: number;
  NominalArisanPerOrang: number;
  NominalKambingPerOrang: number;
  StatusPeriode: StatusPeriode;
}

export interface TunggakanAwal {
  TunggakanID: string;
  PeriodeID: string;
  AnggotaID: string;
  Nominal: number;
  StatusBayar: StatusBayar;
  TanggalBayar: string; // YYYY-MM-DD or ''
  Keterangan: string;
}

export interface Anggota {
  AnggotaID: string;
  NamaLengkap: string;
  Alamat: string;
  NoTelepon: string;
  StatusAktif: StatusAnggota;
  IkutIuranKambing: boolean;
}

export interface JadwalArisan {
  JadwalID: string;
  PeriodeID: string;
  PertemuanKe: number;
  TanggalAcara: string; // YYYY-MM-DD
  AnggotaID: string;
  NominalArisanDiterima: number;
  StatusPenyerahan: StatusPenyerahan;
  Catatan: string;
}

export interface SetoranAnggota {
  SetoranID: string;
  PeriodeID: string;
  JadwalID: string;
  AnggotaID: string;
  NominalArisan: number;
  StatusArisan: StatusBayar;
  NominalKambing: number;
  StatusKambing: StatusBayar;
  TanggalBayar: string; // YYYY-MM-DD or ''
}

export interface TransaksiKas {
  TransaksiID: string;
  TanggalTransaksi: string; // YYYY-MM-DD
  KategoriKas: KategoriKas;
  JenisTransaksi: JenisTransaksi;
  Nominal: number;
  Keterangan: string;
}

export interface FeedbackState {
  type: 'success' | 'error';
  message: string;
}

export interface AppDataState {
  periodes: PeriodeYasinan[];
  anggotas: Anggota[];
  jadwals: JadwalArisan[];
  setorans: SetoranAnggota[];
  transaksiKas: TransaksiKas[];
  tunggakanAwals: TunggakanAwal[];
}
