import { formatIndonesianDate } from '../lib/dateUtils';
import {
  GRADE_LABELS,
  type AttitudeItem,
  type KnowledgeItem,
  type SkillItem,
} from '../types/database';

export interface ReportPreviewProps {
  studentName: string;
  educationLevel: string;
  className: string;
  schoolName?: string | null;
  parentName?: string | null;
  semester: string;
  academicYear: string;
  reportPeriod: string;
  reportDate: string;
  reportCity: string;
  teacherName: string;
  knowledgeData: KnowledgeItem[];
  attitudeData: AttitudeItem[];
  skillData: SkillItem[];
  teacherNotes?: string | null;
}

export function ReportDocumentPreview({
  studentName,
  educationLevel,
  className,
  schoolName,
  parentName,
  semester,
  academicYear,
  reportPeriod,
  reportDate,
  reportCity,
  teacherName,
  knowledgeData,
  attitudeData,
  skillData,
  teacherNotes,
}: ReportPreviewProps) {
  const displayParent = parentName?.trim() ? parentName.trim() : 'Siswa';
  const displayStudent = studentName?.trim() || 'Nama Siswa';
  const displayLevelClass = [educationLevel, className].filter(Boolean).join(' / ') || '-';
  const displayPeriod = reportPeriod?.trim() || `${semester} · ${academicYear}`;

  return (
    <div className="print-only-sheet mx-auto w-full max-w-[210mm] rounded-lg border border-slate-200 bg-white px-6 py-8 text-slate-900 shadow-sm sm:px-12 sm:py-11">
      {/* Institutional Header */}
      <header className="flex flex-col items-center gap-4 border-b-2 border-[#0f274a] pb-4 sm:flex-row sm:items-center sm:gap-5">
        <div className="flex h-20 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white">
          <img
            src="/assets/aistudio/logo_GEC_4cd69325.png"
            alt="Logo Bimbel Galaxi Edu Center"
            referrerPolicy="no-referrer"
            className="h-full w-full object-contain"
          />
        </div>
        <div className="flex-1 text-center sm:text-left">
          <p className="font-display text-lg font-extrabold tracking-tight text-[#0f274a] sm:text-xl">
            BIMBEL GALAXI EDU CENTER (GEC)
          </p>
          <p className="mt-0.5 font-display text-sm font-bold tracking-wide text-slate-800 sm:text-base">
            LAPORAN HASIL BELAJAR AKHIR SEMESTER
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Periode Evaluasi: {displayPeriod}
          </p>
        </div>
      </header>
      <div className="h-[2px] w-full bg-[#c59b27]" />

      {/* Student Identity Table */}
      <section className="mt-6">
        <table className="w-full text-sm">
          <tbody>
            <tr>
              <td className="w-36 py-1 font-semibold text-[#0f274a] align-top">Nama</td>
              <td className="w-4 py-1 text-slate-500 align-top">:</td>
              <td className="py-1 font-semibold text-slate-900">{displayStudent}</td>
            </tr>
            <tr>
              <td className="py-1 font-semibold text-[#0f274a] align-top">Jenjang / Kelas</td>
              <td className="py-1 text-slate-500 align-top">:</td>
              <td className="py-1 text-slate-800">{displayLevelClass}</td>
            </tr>
            <tr>
              <td className="py-1 font-semibold text-[#0f274a] align-top">Periode</td>
              <td className="py-1 text-slate-500 align-top">:</td>
              <td className="py-1 text-slate-800">
                {semester} · Tahun Ajaran {academicYear}
              </td>
            </tr>
            {schoolName?.trim() && (
              <tr>
                <td className="py-1 font-semibold text-[#0f274a] align-top">Sekolah Asal</td>
                <td className="py-1 text-slate-500 align-top">:</td>
                <td className="py-1 text-slate-800">{schoolName}</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {/* Salutation */}
      <p className="mt-5 text-sm leading-relaxed text-slate-700">
        Kepada Yth. Orang Tua/Wali <span className="font-semibold text-slate-900">{displayParent}</span>.
        Berikut perkembangan Ananda <span className="font-semibold text-slate-900">{displayStudent}</span> pada
        materi yang telah dipelajari sampai periode laporan.
      </p>

      {/* Section A: Pengetahuan */}
      <section className="mt-6">
        <h2 className="font-display text-sm font-bold tracking-tight text-[#0f274a]">
          A. NILAI KOGNITIF / PENGETAHUAN
        </h2>
        <div className="mt-2.5 overflow-x-auto">
          <table className="w-full border-collapse border border-slate-300 text-xs sm:text-[13px]">
            <thead>
              <tr className="bg-[#0f274a] text-white">
                <th className="w-10 border border-slate-300 px-2.5 py-2 text-center font-semibold">No</th>
                <th className="w-32 border border-slate-300 px-2.5 py-2 text-left font-semibold">
                  Mata Pelajaran
                </th>
                <th className="w-36 border border-slate-300 px-2.5 py-2 text-left font-semibold">
                  Materi yang Dipelajari
                </th>
                <th className="w-28 border border-slate-300 px-2.5 py-2 text-center font-semibold">
                  Pemahaman
                </th>
                <th className="border border-slate-300 px-2.5 py-2 text-left font-semibold">
                  Deskripsi Perkembangan
                </th>
              </tr>
            </thead>
            <tbody>
              {knowledgeData.length === 0 ? (
                <tr>
                  <td colSpan={5} className="border border-slate-300 px-3 py-4 text-center text-slate-500">
                    Belum ada data penilaian pengetahuan.
                  </td>
                </tr>
              ) : (
                knowledgeData.map((item, idx) => (
                  <tr key={item.id} className={idx % 2 === 1 ? 'bg-slate-50/70' : 'bg-white'}>
                    <td className="border border-slate-300 px-2.5 py-2 text-center tabular-nums align-top">
                      {idx + 1}
                    </td>
                    <td className="border border-slate-300 px-2.5 py-2 font-medium text-slate-900 align-top">
                      {item.subject || '-'}
                    </td>
                    <td className="border border-slate-300 px-2.5 py-2 text-slate-800 align-top">
                      {item.material || '-'}
                    </td>
                    <td className="border border-slate-300 px-2.5 py-2 text-center font-semibold text-[#0f274a] align-top">
                      {item.grade} ({GRADE_LABELS[item.grade] ?? item.grade})
                    </td>
                    <td className="border border-slate-300 px-2.5 py-2 leading-relaxed text-slate-700 align-top">
                      {item.description || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Section B: Sikap */}
      <section className="mt-6">
        <h2 className="font-display text-sm font-bold tracking-tight text-[#0f274a]">
          B. NILAI AFEKTIF / SIKAP
        </h2>
        <div className="mt-2.5 overflow-x-auto">
          <table className="w-full border-collapse border border-slate-300 text-xs sm:text-[13px]">
            <thead>
              <tr className="bg-[#0f274a] text-white">
                <th className="w-10 border border-slate-300 px-2.5 py-2 text-center font-semibold">No</th>
                <th className="w-40 border border-slate-300 px-2.5 py-2 text-left font-semibold">Sikap</th>
                <th className="w-28 border border-slate-300 px-2.5 py-2 text-center font-semibold">
                  Predikat
                </th>
                <th className="border border-slate-300 px-2.5 py-2 text-left font-semibold">
                  Deskripsi Perkembangan
                </th>
              </tr>
            </thead>
            <tbody>
              {attitudeData.length === 0 ? (
                <tr>
                  <td colSpan={4} className="border border-slate-300 px-3 py-4 text-center text-slate-500">
                    Belum ada data penilaian sikap.
                  </td>
                </tr>
              ) : (
                attitudeData.map((item, idx) => {
                  const label =
                    item.attitude === 'Sikap lainnya' && item.custom_attitude?.trim()
                      ? item.custom_attitude.trim()
                      : item.attitude;
                  return (
                    <tr key={item.id} className={idx % 2 === 1 ? 'bg-slate-50/70' : 'bg-white'}>
                      <td className="border border-slate-300 px-2.5 py-2 text-center tabular-nums align-top">
                        {idx + 1}
                      </td>
                      <td className="border border-slate-300 px-2.5 py-2 font-medium text-slate-900 align-top">
                        {label || '-'}
                      </td>
                      <td className="border border-slate-300 px-2.5 py-2 text-center font-semibold text-[#0f274a] align-top">
                        {item.grade} ({GRADE_LABELS[item.grade] ?? item.grade})
                      </td>
                      <td className="border border-slate-300 px-2.5 py-2 leading-relaxed text-slate-700 align-top">
                        {item.description || '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Section C: Keterampilan */}
      <section className="mt-6">
        <h2 className="font-display text-sm font-bold tracking-tight text-[#0f274a]">
          C. NILAI PSIKOMOTOR / KETERAMPILAN
        </h2>
        <div className="mt-2.5 overflow-x-auto">
          <table className="w-full border-collapse border border-slate-300 text-xs sm:text-[13px]">
            <thead>
              <tr className="bg-[#0f274a] text-white">
                <th className="w-10 border border-slate-300 px-2.5 py-2 text-center font-semibold">No</th>
                <th className="w-40 border border-slate-300 px-2.5 py-2 text-left font-semibold">
                  Keterampilan
                </th>
                <th className="w-28 border border-slate-300 px-2.5 py-2 text-center font-semibold">
                  Predikat
                </th>
                <th className="border border-slate-300 px-2.5 py-2 text-left font-semibold">
                  Deskripsi Perkembangan
                </th>
              </tr>
            </thead>
            <tbody>
              {skillData.length === 0 ? (
                <tr>
                  <td colSpan={4} className="border border-slate-300 px-3 py-4 text-center text-slate-500">
                    Belum ada data penilaian keterampilan.
                  </td>
                </tr>
              ) : (
                skillData.map((item, idx) => {
                  const label =
                    item.skill === 'Keterampilan lainnya' && item.custom_skill?.trim()
                      ? item.custom_skill.trim()
                      : item.skill;
                  return (
                    <tr key={item.id} className={idx % 2 === 1 ? 'bg-slate-50/70' : 'bg-white'}>
                      <td className="border border-slate-300 px-2.5 py-2 text-center tabular-nums align-top">
                        {idx + 1}
                      </td>
                      <td className="border border-slate-300 px-2.5 py-2 font-medium text-slate-900 align-top">
                        {label || '-'}
                      </td>
                      <td className="border border-slate-300 px-2.5 py-2 text-center font-semibold text-[#0f274a] align-top">
                        {item.grade} ({GRADE_LABELS[item.grade] ?? item.grade})
                      </td>
                      <td className="border border-slate-300 px-2.5 py-2 leading-relaxed text-slate-700 align-top">
                        {item.description || '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Teacher Notes */}
      {teacherNotes?.trim() && (
        <section className="mt-6 rounded-md border border-slate-300 bg-slate-50/60 p-3.5">
          <p className="text-xs font-bold uppercase tracking-wide text-[#0f274a]">
            Catatan Tambahan Guru
          </p>
          <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-700">
            {teacherNotes.trim()}
          </p>
        </section>
      )}

      {/* Signature Footer */}
      <footer className="mt-10 flex justify-end">
        <div className="w-60 text-left text-sm text-slate-800">
          <p>
            {reportCity?.trim() || 'Rejang Lebong'}, {formatIndonesianDate(reportDate)}
          </p>
          <p className="mt-0.5">Guru Pengajar,</p>
          <div className="h-20 border-b border-slate-400" />
          <p className="mt-2 font-bold text-[#0f274a]">{teacherName || 'Guru Bimbel GEC'}</p>
        </div>
      </footer>
    </div>
  );
}
