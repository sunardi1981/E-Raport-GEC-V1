import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  BookOpen,
  FileCheck2,
  FilePlus2,
  GraduationCap,
  LayoutDashboard,
  Library,
  LogOut,
  Menu,
  Settings,
  UserCircle2,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/siswa', label: 'Data Siswa', icon: GraduationCap },
  { to: '/mapel', label: 'Mata Pelajaran', icon: BookOpen },
  { to: '/materi', label: 'Materi Pembelajaran', icon: Library },
  { to: '/rapot/baru', label: 'Buat Rapot', icon: FilePlus2 },
  { to: '/rapot', label: 'Rapot Tersimpan', icon: FileCheck2, end: true },
  { to: '/profil', label: 'Profil Guru', icon: UserCircle2 },
  { to: '/pengaturan', label: 'Pengaturan', icon: Settings },
];

const ROUTE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard Guru',
  '/siswa': 'Data Siswa',
  '/mapel': 'Mata Pelajaran',
  '/materi': 'Materi Pembelajaran',
  '/rapot/baru': 'Buat Rapot Digital',
  '/rapot': 'Rapot Tersimpan',
  '/profil': 'Profil Guru',
  '/pengaturan': 'Pengaturan Sistem',
};

export function AppLayout() {
  const { profile, user, signOut } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const pageTitle =
    ROUTE_TITLES[location.pathname] ||
    (location.pathname.startsWith('/rapot/') ? 'Editor & Preview Rapot' : 'GEC RAPOT');

  const handleLogout = async () => {
    await signOut();
    showToast('info', 'Anda telah keluar', 'Sesi akun guru berhasil diakhiri.');
    navigate('/login');
  };

  const teacherName = profile?.full_name || user?.email?.split('@')[0] || 'Guru GEC';

  const renderNavLinks = (onSelect?: () => void) => (
    <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Menu Utama">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onSelect}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                isActive
                  ? 'bg-[#0f274a] text-white'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {/* Desktop Sidebar */}
      <aside className="no-print hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 border-r border-slate-200 bg-white">
        <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-5">
          <img
            src="/assets/aistudio/logo_GEC_4cd69325.png"
            alt="Logo GEC"
            referrerPolicy="no-referrer"
            className="h-9 w-11 shrink-0 rounded-md object-contain"
          />
          <div className="min-w-0">
            <p className="font-display text-base font-extrabold tracking-tight text-[#0f274a] truncate">
              GEC RAPOT
            </p>
            <p className="text-[11px] font-medium text-slate-500 truncate">Galaxi Edu Center</p>
          </div>
        </div>

        {renderNavLinks()}

        <div className="border-t border-slate-200 p-3">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 whitespace-nowrap"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="no-print fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-950/40"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative z-10 flex w-72 max-w-[82vw] flex-col bg-white shadow-xl">
            <div className="flex h-16 items-center justify-between border-b border-slate-200 px-4">
              <div className="flex items-center gap-2.5">
                <img
                  src="/assets/aistudio/logo_GEC_4cd69325.png"
                  alt="Logo GEC"
                  referrerPolicy="no-referrer"
                  className="h-8 w-10 rounded object-contain"
                />
                <span className="font-display text-base font-extrabold text-[#0f274a]">GEC RAPOT</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Tutup menu"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {renderNavLinks(() => setMobileMenuOpen(false))}

            <div className="border-t border-slate-200 p-3">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  void handleLogout();
                }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                <span>Logout</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <header className="no-print sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Buka menu navigasi"
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="font-display text-base font-bold text-slate-900 truncate sm:text-lg">
              {pageTitle}
            </h1>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <NavLink
              to="/profil"
              className="hidden sm:flex items-center gap-2 text-right hover:opacity-80 transition-opacity"
            >
              <div>
                <p className="text-sm font-semibold text-slate-900 leading-tight">{teacherName}</p>
                <p className="text-xs text-slate-500 leading-tight">{user?.email}</p>
              </div>
            </NavLink>
            <NavLink
              to="/rapot/baru"
              className="inline-flex items-center gap-2 rounded-lg bg-[#0f274a] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#163561] transition-colors whitespace-nowrap shrink-0"
            >
              <FilePlus2 className="h-4 w-4" />
              <span className="hidden sm:inline">Buat Rapot</span>
              <span className="sm:hidden">Rapot</span>
            </NavLink>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-8 sm:py-8">
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
