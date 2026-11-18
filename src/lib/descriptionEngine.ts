import type { Grade } from '../types/database';

/**
 * Mesin Deskripsi Otomatis Lokal (Offline-capable, Instan, Konsisten)
 * Menghasilkan deskripsi perkembangan siswa berdasarkan kombinasi:
 * jenis penilaian, predikat (A/B/C/D), mata pelajaran, materi, sikap, dan keterampilan.
 */

export function generateKnowledgeDescription(
  subject: string,
  material: string,
  grade: Grade
): string {
  const cleanMaterial = material.trim() || 'materi pembelajaran';
  const cleanSubject = subject.trim();
  const subjectContext = cleanSubject ? ` pada mata pelajaran ${cleanSubject}` : '';

  switch (grade) {
    case 'A':
      return `Ananda menunjukkan pemahaman yang sangat baik dalam mempelajari materi ${cleanMaterial}${subjectContext}, mampu memahami konsep dengan tepat, serta menyelesaikan latihan secara mandiri dan teliti.`;
    case 'B':
      return `Ananda memahami materi ${cleanMaterial}${subjectContext} dengan baik dan mampu menyelesaikan sebagian besar latihan dengan tepat. Kemampuan Ananda terus berkembang melalui kegiatan pembelajaran.`;
    case 'C':
      return `Ananda telah memahami sebagian konsep ${cleanMaterial}${subjectContext}, namun masih memerlukan latihan agar semakin terampil dan percaya diri dalam menyelesaikan soal.`;
    case 'D':
      return `Ananda masih memerlukan bimbingan bertahap dalam memahami konsep ${cleanMaterial}${subjectContext} dan latihan secara teratur agar penguasaan materi semakin meningkat.`;
  }
}

interface AttitudePhraseSet {
  noun: string;
  traitA: string;
  traitB: string;
  traitC: string;
  traitD: string;
}

const ATTITUDE_PHRASE_MAP: Record<string, AttitudePhraseSet> = {
  Disiplin: {
    noun: 'kedisiplinan',
    traitA: 'sangat disiplin, tertib mengikuti jadwal dan aturan belajar, serta konsisten membangun kebiasaan belajar positif',
    traitB: 'disiplin dalam mengikuti kegiatan belajar dan mampu menjaga ketertiban selama pembelajaran',
    traitC: 'mulai menunjukkan perkembangan sikap disiplin dan masih perlu pembiasaan agar lebih konsisten hadir serta tertib belajar',
    traitD: 'memerlukan pendampingan dan motivasi untuk menumbuhkan kedisiplinan serta ketertiban selama kegiatan belajar',
  },
  'Tanggung Jawab': {
    noun: 'tanggung jawab',
    traitA: 'sangat bertanggung jawab dalam menyelesaikan setiap tugas dan kewajiban belajar dengan penuh kesadaran',
    traitB: 'bertanggung jawab dalam menjalankan tugas serta kegiatan belajar sesuai arahan guru',
    traitC: 'mulai menunjukkan sikap tanggung jawab dan masih perlu dorongan agar lebih konsisten menuntaskan kewajiban belajar',
    traitD: 'memerlukan bimbingan dan pendampingan untuk membangun rasa tanggung jawab terhadap tugas dan aktivitas belajarnya',
  },
  'Percaya Diri': {
    noun: 'kepercayaan diri',
    traitA: 'kepercayaan diri yang sangat baik, berani menyampaikan pendapat, dan yakin dalam mengerjakan latihan secara mandiri',
    traitB: 'percaya diri yang baik saat mengikuti pembelajaran maupun saat menjawab pertanyaan di kelas',
    traitC: 'mulai menumbuhkan rasa percaya diri, namun masih perlu motivasi agar lebih berani mengemukakan gagasan',
    traitD: 'memerlukan dukungan serta motivasi bertahap untuk membangun kepercayaan diri dalam mengikuti proses belajar',
  },
  Keaktifan: {
    noun: 'keaktifan',
    traitA: 'sangat aktif bertanya, berpartisipasi dalam diskusi, dan antusias mengikuti setiap sesi pembelajaran',
    traitB: 'aktif mengikuti kegiatan pembelajaran dan memberikan respons yang baik terhadap materi yang dibahas',
    traitC: 'mulai menunjukkan keaktifan belajar, namun masih perlu dorongan agar lebih rutin berpartisipasi dalam diskusi',
    traitD: 'memerlukan pendampingan serta stimulasi agar lebih aktif terlibat selama kegiatan pembelajaran berlangsung',
  },
  'Kerja Sama': {
    noun: 'kerja sama',
    traitA: 'kemampuan kerja sama yang sangat baik, komunikatif, dan saling mendukung bersama teman maupun guru selama belajar',
    traitB: 'mampu bekerja sama dengan baik dalam kegiatan belajar kelompok serta menjaga interaksi yang positif',
    traitC: 'mulai mampu menjalin kerja sama dalam belajar, tetapi masih perlu arahan agar lebih terbuka berkolaborasi',
    traitD: 'memerlukan bimbingan untuk meningkatkan kemampuan kerja sama dan komunikasi positif dengan lingkungan belajar',
  },
  Ketekunan: {
    noun: 'ketekunan',
    traitA: 'ketekunan belajar yang sangat baik, bersungguh-sungguh memahami materi, dan tidak mudah menyerah saat menghadapi soal sulit',
    traitB: 'tekun dalam mengikuti pembelajaran serta berusaha menyelesaikan latihan hingga tuntas',
    traitC: 'mulai menunjukkan ketekunan belajar, namun masih perlu pendampingan agar tetap konsisten saat menemui tantangan',
    traitD: 'memerlukan motivasi dan bimbingan rutin agar lebih tekun serta pantang menyerah dalam belajar',
  },
  Kemandirian: {
    noun: 'kemandirian',
    traitA: 'kemandirian belajar yang sangat baik, mampu berinisiatif menyelesaikan latihan tanpa bergantung penuh pada arahan guru',
    traitB: 'mampu belajar dengan mandiri dan menyelesaikan sebagian besar latihan sesuai instruksi yang diberikan',
    traitC: 'mulai berlatih mandiri dalam mengerjakan tugas, namun masih memerlukan arahan pada bagian tertentu',
    traitD: 'memerlukan pendampingan intensif agar secara bertahap mampu membangun kemandirian dalam kegiatan belajar',
  },
  Menghargai: {
    noun: 'sikap saling menghargai',
    traitA: 'sikap menghargai yang sangat baik, santun dalam berkomunikasi, serta menghormati guru dan teman belajar',
    traitB: 'menunjukkan sikap saling menghargai dan sopan santun yang baik selama proses pembelajaran berlangsung',
    traitC: 'mulai menunjukkan sikap menghargai saat berinteraksi dan masih perlu penguatan dalam menjaga etika belajar',
    traitD: 'memerlukan pembinaan dan teladan berkelanjutan untuk membiasakan sikap menghargai guru serta teman sebaya',
  },
  Fokus: {
    noun: 'fokus dan konsentrasi',
    traitA: 'fokus belajar yang sangat baik, mampu menjaga konsentrasi penuh selama menyimak penjelasan dan menyelesaikan latihan',
    traitB: 'mampu menjaga fokus belajar dengan baik dan mengikuti alur pembelajaran secara tertib',
    traitC: 'mulai mampu menjaga fokus saat belajar, namun sesekali masih perlu diingatkan agar konsentrasi tidak mudah teralihkan',
    traitD: 'memerlukan pendampingan khusus dan suasana belajar terarah agar mampu mempertahankan fokus selama pembelajaran',
  },
};

export function generateAttitudeDescription(attitude: string, grade: Grade): string {
  const cleanAttitude = attitude.trim() || 'Sikap belajar';
  const preset = ATTITUDE_PHRASE_MAP[cleanAttitude];

  if (preset) {
    switch (grade) {
      case 'A':
        return `Ananda menunjukkan ${preset.noun} dengan predikat sangat baik; ${preset.traitA}.`;
      case 'B':
        return `Ananda menunjukkan sikap ${cleanAttitude.toLowerCase()} yang baik; ${preset.traitB}.`;
      case 'C':
        return `Ananda ${preset.traitC} terkait aspek ${preset.noun}.`;
      case 'D':
        return `Ananda ${preset.traitD}.`;
    }
  }

  // Fallback for custom "Sikap lainnya"
  const lower = cleanAttitude.toLowerCase();
  switch (grade) {
    case 'A':
      return `Ananda menunjukkan sikap ${lower} yang sangat baik, konsisten, dan menjadi contoh positif selama kegiatan pembelajaran berlangsung.`;
    case 'B':
      return `Ananda menunjukkan sikap ${lower} yang baik selama pembelajaran dan terus membangun kebiasaan belajar yang positif.`;
    case 'C':
      return `Ananda mulai menunjukkan perkembangan pada aspek sikap ${lower} dan masih perlu motivasi agar lebih konsisten dalam kegiatan belajar.`;
    case 'D':
      return `Ananda memerlukan pendampingan serta motivasi berkelanjutan untuk mengembangkan sikap ${lower} selama kegiatan pembelajaran.`;
  }
}

const SKILL_PHRASE_MAP: Record<string, string> = {
  Membaca: 'membaca dan memahami isi bacaan',
  Menulis: 'menulis dengan rapi, terstruktur, dan mudah dipahami',
  Berhitung: 'melakukan operasi hitung secara tepat dan cermat',
  'Menyelesaikan soal': 'menganalisis serta menyelesaikan soal latihan',
  'Menjelaskan konsep': 'menjelaskan kembali konsep materi dengan bahasa yang jelas',
  'Mempraktikkan materi': 'mempraktikkan materi pembelajaran dalam kegiatan latihan',
  'Menyelesaikan tugas': 'menuntaskan tugas pembelajaran secara teratur',
  'Menggunakan alat belajar': 'menggunakan alat dan media belajar secara efektif',
};

export function generateSkillDescription(skill: string, grade: Grade): string {
  const cleanSkill = skill.trim() || 'keterampilan belajar';
  const actionPhrase = SKILL_PHRASE_MAP[cleanSkill] ?? cleanSkill.toLowerCase();

  switch (grade) {
    case 'A':
      return `Ananda menunjukkan keterampilan ${cleanSkill.toLowerCase()} yang sangat baik, mampu ${actionPhrase} secara mandiri, teliti, dan terampil dalam menerapkan materi yang dipelajari.`;
    case 'B':
      return `Ananda mampu ${actionPhrase} dengan baik dan menunjukkan keterampilan yang terus berkembang sesuai materi pembelajaran.`;
    case 'C':
      return `Ananda mulai menguasai keterampilan untuk ${actionPhrase}, tetapi masih memerlukan latihan dan arahan agar lebih lancar serta teliti.`;
    case 'D':
      return `Ananda masih memerlukan pendampingan dan latihan bertahap untuk meningkatkan keterampilan dalam ${actionPhrase} selama kegiatan pembelajaran.`;
  }
}
