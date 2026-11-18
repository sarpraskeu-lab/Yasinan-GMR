import React, { useMemo, useState } from 'react';
import { ArrowUp, Bookmark, Search } from 'lucide-react';
import { SURAT_YASIN_AYAT, SURAT_YASIN_INFO } from '../data/suratYasin';
import { EmptyState } from './FeedbackBanner';

type ArabicSize = 'normal' | 'besar' | 'sangat-besar';

const BOOKMARK_STORAGE_KEY = 'yasinan_last_read_ayat';

function toArabicDigits(num: number): string {
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(num)
    .split('')
    .map((d) => arabicDigits[Number(d)] ?? d)
    .join('');
}

export function SuratYasinScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showLatin, setShowLatin] = useState(true);
  const [showTranslation, setShowTranslation] = useState(true);
  const [arabicSize, setArabicSize] = useState<ArabicSize>('besar');
  const [bookmarkedAyat, setBookmarkedAyat] = useState<number | null>(() => {
    try {
      const saved = window.localStorage.getItem(BOOKMARK_STORAGE_KEY);
      if (saved) {
        const num = Number(saved);
        return Number.isInteger(num) && num >= 1 && num <= 83 ? num : null;
      }
    } catch {
      // Ignore storage read errors
    }
    return null;
  });

  const filteredAyat = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return SURAT_YASIN_AYAT;
    return SURAT_YASIN_AYAT.filter((a) => {
      return (
        String(a.nomorAyat) === q ||
        a.teksLatin.toLowerCase().includes(q) ||
        a.teksIndonesia.toLowerCase().includes(q)
      );
    });
  }, [searchQuery]);

  const handleToggleBookmark = (nomorAyat: number) => {
    const nextValue = bookmarkedAyat === nomorAyat ? null : nomorAyat;
    setBookmarkedAyat(nextValue);
    try {
      if (nextValue === null) {
        window.localStorage.removeItem(BOOKMARK_STORAGE_KEY);
      } else {
        window.localStorage.setItem(BOOKMARK_STORAGE_KEY, String(nextValue));
      }
    } catch {
      // Ignore storage write errors
    }
  };

  const scrollToAyat = (nomorAyat: number) => {
    const el = document.getElementById(`ayat-${nomorAyat}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const arabicTextClass =
    arabicSize === 'sangat-besar'
      ? 'text-3xl sm:text-4xl leading-[2.4]'
      : arabicSize === 'besar'
      ? 'text-2xl sm:text-3xl leading-[2.3]'
      : 'text-xl sm:text-2xl leading-[2.2]';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#14532D]">
            Bacaan Surat Yasin
          </h1>
          <p className="text-sm text-[#15803D] mt-1 tabular-nums">
            Surah ke-{SURAT_YASIN_INFO.nomor} · {SURAT_YASIN_INFO.tempatTurun} ·{' '}
            {SURAT_YASIN_INFO.jumlahAyat} Ayat
          </p>
        </div>

        {bookmarkedAyat && (
          <button
            type="button"
            onClick={() => scrollToAyat(bookmarkedAyat)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#FEFCE8] border border-[#FACC15] text-xs font-semibold text-[#14532D] hover:bg-[#FEF9C3] transition-colors whitespace-nowrap self-start sm:self-auto"
          >
            <Bookmark className="h-3.5 w-3.5 text-[#CA8A04]" />
            <span className="tabular-nums">
              Lanjut ke Penanda: Ayat {bookmarkedAyat}
            </span>
          </button>
        )}
      </div>

      {/* Reading Controls Bar */}
      <section className="bg-[#FFFFFF] rounded-lg p-4 sm:p-5 shadow-[0_1px_3px_rgba(20,83,45,0.06)] space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search
              className="h-4 w-4 text-[#15803D] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nomor ayat (1-83), bacaan latin, atau arti..."
              aria-label="Cari ayat Surat Yasin"
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#F0FDF4]/60 border border-[#BBF7D0] text-sm text-[#14532D] placeholder:text-[#15803D]/60"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 text-xs font-medium text-[#14532D] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showLatin}
                onChange={(e) => setShowLatin(e.target.checked)}
                className="h-4 w-4 rounded accent-[#16A34A]"
              />
              <span>Teks Latin</span>
            </label>

            <label className="inline-flex items-center gap-2 text-xs font-medium text-[#14532D] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showTranslation}
                onChange={(e) => setShowTranslation(e.target.checked)}
                className="h-4 w-4 rounded accent-[#16A34A]"
              />
              <span>Terjemahan Indonesia</span>
            </label>

            <div className="flex items-center gap-1 p-1 rounded-lg bg-[#F0FDF4] border border-[#DCFCE7]">
              <button
                type="button"
                onClick={() => setArabicSize('normal')}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${
                  arabicSize === 'normal'
                    ? 'bg-[#16A34A] text-white'
                    : 'text-[#14532D] hover:bg-[#DCFCE7]/60'
                }`}
              >
                Normal
              </button>
              <button
                type="button"
                onClick={() => setArabicSize('besar')}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${
                  arabicSize === 'besar'
                    ? 'bg-[#16A34A] text-white'
                    : 'text-[#14532D] hover:bg-[#DCFCE7]/60'
                }`}
              >
                Besar
              </button>
              <button
                type="button"
                onClick={() => setArabicSize('sangat-besar')}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${
                  arabicSize === 'sangat-besar'
                    ? 'bg-[#16A34A] text-white'
                    : 'text-[#14532D] hover:bg-[#DCFCE7]/60'
                }`}
              >
                Sangat Besar
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Basmalah Header */}
      {!searchQuery.trim() && (
        <div className="bg-[#FFFFFF] rounded-lg px-6 py-6 shadow-[0_1px_3px_rgba(20,83,45,0.06)] text-center">
          <p
            dir="rtl"
            lang="ar"
            style={{ fontFamily: '"Amiri", serif' }}
            className="text-2xl sm:text-3xl text-[#14532D] leading-loose"
          >
            بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيْمِ
          </p>
          <p className="text-xs text-[#15803D] mt-2">
            Dengan nama Allah Yang Maha Pengasih, Maha Penyayang
          </p>
        </div>
      )}

      {/* Ayat List */}
      {filteredAyat.length === 0 ? (
        <div className="bg-[#FFFFFF] rounded-lg shadow-[0_1px_3px_rgba(20,83,45,0.06)]">
          <EmptyState
            title="Ayat tidak ditemukan"
            description="Tidak ada ayat Surat Yasin yang cocok dengan kata kunci atau nomor ayat yang Anda cari."
            actionLabel="Tampilkan Semua Ayat"
            onAction={() => setSearchQuery('')}
          />
        </div>
      ) : (
        <div className="bg-[#FFFFFF] rounded-lg shadow-[0_1px_3px_rgba(20,83,45,0.06)] divide-y divide-[#DCFCE7]">
          {filteredAyat.map((ayat) => {
            const isBookmarked = bookmarkedAyat === ayat.nomorAyat;
            return (
              <article
                key={ayat.nomorAyat}
                id={`ayat-${ayat.nomorAyat}`}
                className={`p-5 sm:p-6 transition-colors ${
                  isBookmarked ? 'bg-[#FEFCE8]/70' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-4 mb-4">
                  <span className="text-xs font-bold text-[#15803D] tabular-nums">
                    Ayat {ayat.nomorAyat}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleToggleBookmark(ayat.nomorAyat)}
                    aria-pressed={isBookmarked}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                      isBookmarked
                        ? 'bg-[#FEF9C3] text-[#854D0E]'
                        : 'text-[#14532D]/70 hover:bg-[#F0FDF4] hover:text-[#14532D]'
                    }`}
                  >
                    <Bookmark className="h-3.5 w-3.5" />
                    <span>{isBookmarked ? 'Ditandai' : 'Tandai Ayat'}</span>
                  </button>
                </div>

                <p
                  dir="rtl"
                  lang="ar"
                  style={{ fontFamily: '"Amiri", serif' }}
                  className={`text-right text-[#14532D] ${arabicTextClass}`}
                >
                  {ayat.teksArab}{' '}
                  <span className="text-[#16A34A] text-[0.8em] mx-1">
                    ﴿{toArabicDigits(ayat.nomorAyat)}﴾
                  </span>
                </p>

                {showLatin && (
                  <p className="mt-4 text-sm italic text-[#15803D] leading-relaxed">
                    {ayat.teksLatin}
                  </p>
                )}

                {showTranslation && (
                  <p className="mt-2 text-sm text-[#14532D]/90 leading-relaxed">
                    {ayat.teksIndonesia}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* Back to top */}
      {filteredAyat.length > 10 && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#BBF7D0] bg-[#FFFFFF] text-xs font-semibold text-[#15803D] hover:bg-[#F0FDF4] transition-colors whitespace-nowrap"
          >
            <ArrowUp className="h-3.5 w-3.5" />
            <span>Kembali ke Atas</span>
          </button>
        </div>
      )}
    </div>
  );
}
