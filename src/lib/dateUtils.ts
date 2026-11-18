const JAKARTA_TIMEZONE = 'Asia/Jakarta';

/**
 * Returns today's date in YYYY-MM-DD format according to Asia/Jakarta timezone.
 */
export function getTodayJakartaISO(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: JAKARTA_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const year = parts.find((p) => p.type === 'year')?.value ?? '2026';
  const month = parts.find((p) => p.type === 'month')?.value ?? '01';
  const day = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${year}-${month}-${day}`;
}

/**
 * Formats an ISO date or YYYY-MM-DD string in Indonesian long format: "18 November 2026"
 */
export function formatIndonesianDate(dateInput?: string | Date | null): string {
  if (!dateInput) return '-';
  try {
    let dateObj: Date;
    if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
      const [y, m, d] = dateInput.split('-').map(Number);
      dateObj = new Date(Date.UTC(y, m - 1, d, 5, 0, 0));
    } else {
      dateObj = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    }
    if (Number.isNaN(dateObj.getTime())) return '-';
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: JAKARTA_TIMEZONE,
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(dateObj);
  } catch {
    return '-';
  }
}

/**
 * Formats timestamp to HH:mm WIB in Asia/Jakarta timezone (e.g., "19:24")
 */
export function formatJakartaTime(dateInput?: string | Date | null): string {
  if (!dateInput) return '-';
  try {
    const dateObj = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (Number.isNaN(dateObj.getTime())) return '-';
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: JAKARTA_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
      .format(dateObj)
      .replace('.', ':');
  } catch {
    return '-';
  }
}

/**
 * Formats timestamp to Indonesian date + time: "18 Nov 2026, 19:24 WIB"
 */
export function formatIndonesianDateTime(dateInput?: string | Date | null): string {
  if (!dateInput) return '-';
  try {
    const dateObj = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (Number.isNaN(dateObj.getTime())) return '-';
    const datePart = new Intl.DateTimeFormat('id-ID', {
      timeZone: JAKARTA_TIMEZONE,
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(dateObj);
    const timePart = formatJakartaTime(dateObj);
    return `${datePart}, ${timePart} WIB`;
  } catch {
    return '-';
  }
}

/**
 * Returns default academic year string (e.g. "2026/2027")
 */
export function getDefaultAcademicYear(): string {
  const yearStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: JAKARTA_TIMEZONE,
    year: 'numeric',
  }).format(new Date());
  const year = Number(yearStr) || 2026;
  return `${year}/${year + 1}`;
}
