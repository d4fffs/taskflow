import React, { useState, useRef, useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Briefcase,
  Kanban,
  CheckSquare,
  Calendar,
  Bell,
  Settings,
  User,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
  Moon,
  ChevronDown,
  Plus,
  LogOut,
  Menu,
  X,
  CheckCheck,
} from 'lucide-react';
import { useAuthStore } from '../../stores/useAuthStore.js';
import { useDataStore } from '../../stores/useDataStore.js';
import { Avatar } from '../common/UIPrimitives.jsx';
import { WorkspaceModal } from '../workspace/WorkspaceModal.jsx';
import { formatDistanceToNow } from 'date-fns';
import { toJsDate } from '../../utils/kanban.js';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/workspaces', label: 'Workspaces', icon: Briefcase },
  { to: '/boards', label: 'Boards', icon: Kanban },
  { to: '/my-tasks', label: 'My Tasks', icon: CheckSquare },
  { to: '/calendar', label: 'Calendar', icon: Calendar },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/settings', label: 'Settings', icon: Settings },
  { to: '/profile', label: 'Profile', icon: User },
];

export function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, user, isGuestMode, theme, toggleTheme, sidebarCollapsed, toggleSidebar, logout } =
    useAuthStore();
  const {
    workspaces,
    boards,
    activeWorkspaceId,
    setActiveWorkspaceId,
    notifications,
    markNotificationRead,
    markAllNotificationsRead,
  } = useDataStore();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [wsDropdownOpen, setWsDropdownOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [createWsOpen, setCreateWsOpen] = useState(false);

  const notifRef = useRef(null);
  const profileRef = useRef(null);
  const wsRef = useRef(null);

  useEffect(() => {
    const onOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileMenuOpen(false);
      if (wsRef.current && !wsRef.current.contains(e.target)) setWsDropdownOpen(false);
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const activeWorkspace =
    workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0] || null;
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const getBreadcrumb = () => {
    const path = location.pathname;
    if (path === '/dashboard') return ['Overview', 'Dashboard'];
    if (path === '/workspaces') return ['Organization', 'Workspaces'];
    if (path.startsWith('/workspace/')) {
      const wsId = path.split('/')[2];
      const ws = workspaces.find((w) => w.id === wsId);
      return ['Workspaces', ws?.name || 'Workspace'];
    }
    if (path === '/boards') return ['Work', 'Boards'];
    if (path.startsWith('/board/')) {
      const boardId = path.split('/')[2];
      const board = boards.find((b) => b.id === boardId);
      return ['Boards', board?.title || 'Kanban Board'];
    }
    if (path === '/my-tasks') return ['Work', 'My Tasks'];
    if (path === '/calendar') return ['Schedule', 'Calendar'];
    if (path === '/notifications') return ['Inbox', 'Notifications'];
    if (path === '/settings') return ['Workspace', 'Settings'];
    if (path === '/profile') return ['Account', 'Profile'];
    return ['TaskFlow'];
  };

  const breadcrumbs = getBreadcrumb();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const sidebarContent = (isMobile = false) => {
    const collapsed = !isMobile && sidebarCollapsed;
    return (
      <div className="flex flex-col h-full bg-white dark:bg-[#151722] border-r border-[#E6E8F0] dark:border-[#262A3D]">
        {/* Brand Row */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-[#E6E8F0] dark:border-[#262A3D] shrink-0">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2.5 text-left min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#635BFF] rounded-md"
          >
            <span className="w-7 h-7 rounded-lg bg-[#635BFF] text-white font-display font-bold text-sm flex items-center justify-center shrink-0">
              TF
            </span>
            {!collapsed && (
              <span className="font-display font-bold text-base tracking-tight text-[#20212B] dark:text-[#F4F5FA] whitespace-nowrap">
                TaskFlow
              </span>
            )}
          </button>

          {isMobile ? (
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close navigation menu"
              className="p-1.5 rounded-lg text-[#6B7085] hover:text-[#20212B] dark:text-[#9EA3B8] dark:hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={toggleSidebar}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="p-1.5 rounded-lg text-[#6B7085] hover:text-[#20212B] dark:text-[#9EA3B8] dark:hover:text-white hover:bg-[#F7F8FC] dark:hover:bg-[#1C1F2E] transition-colors"
            >
              {collapsed ? (
                <PanelLeftOpen className="w-4 h-4" />
              ) : (
                <PanelLeftClose className="w-4 h-4" />
              )}
            </button>
          )}
        </div>

        {/* Workspace Switcher */}
        <div className="p-3 border-b border-[#E6E8F0] dark:border-[#262A3D] relative" ref={wsRef}>
          <button
            type="button"
            onClick={() => setWsDropdownOpen((v) => !v)}
            aria-expanded={wsDropdownOpen}
            aria-label="Switch workspace"
            className={`w-full flex items-center gap-2.5 p-2 rounded-lg border border-[#E6E8F0] dark:border-[#262A3D] hover:bg-[#F7F8FC] dark:hover:bg-[#1C1F2E] transition-colors ${
              collapsed ? 'justify-center' : 'justify-between'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className="w-6 h-6 rounded-md text-white text-xs font-semibold flex items-center justify-center shrink-0"
                style={{ backgroundColor: activeWorkspace?.avatarColor || '#635BFF' }}
              >
                {(activeWorkspace?.name || 'W')[0].toUpperCase()}
              </span>
              {!collapsed && (
                <span className="text-sm font-medium text-[#20212B] dark:text-[#F4F5FA] truncate">
                  {activeWorkspace?.name || 'Select Workspace'}
                </span>
              )}
            </div>
            {!collapsed && <ChevronDown className="w-4 h-4 text-[#9295A5] shrink-0" />}
          </button>

          {wsDropdownOpen && (
            <div className="absolute left-3 right-3 top-16 z-40 bg-white dark:bg-[#1C1F2E] border border-[#E6E8F0] dark:border-[#262A3D] rounded-xl shadow-xl py-1.5 min-w-[220px]">
              <p className="px-3 py-1.5 text-xs font-medium text-[#6B7085] dark:text-[#9EA3B8]">
                Workspaces
              </p>
              <div className="max-h-52 overflow-y-auto">
                {workspaces.map((ws) => (
                  <button
                    key={ws.id}
                    type="button"
                    onClick={() => {
                      setActiveWorkspaceId(ws.id);
                      setWsDropdownOpen(false);
                      navigate(`/workspace/${ws.id}`);
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-[#F7F8FC] dark:hover:bg-[#262A3D]/60 transition-colors ${
                      ws.id === activeWorkspace?.id
                        ? 'font-semibold text-[#635BFF]'
                        : 'text-[#20212B] dark:text-[#F4F5FA]'
                    }`}
                  >
                    <span
                      className="w-5 h-5 rounded text-white text-[11px] font-semibold flex items-center justify-center shrink-0"
                      style={{ backgroundColor: ws.avatarColor || '#635BFF' }}
                    >
                      {ws.name[0].toUpperCase()}
                    </span>
                    <span className="truncate flex-1">{ws.name}</span>
                  </button>
                ))}
              </div>
              <div className="border-t border-[#E6E8F0] dark:border-[#262A3D] mt-1 pt-1 px-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setWsDropdownOpen(false);
                    setCreateWsOpen(true);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-medium text-[#635BFF] hover:bg-[#635BFF]/8 rounded-lg transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create new workspace</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Links */}
        <nav aria-label="Main navigation" className="flex-1 overflow-y-auto p-3 space-y-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              title={collapsed ? label : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  collapsed ? 'justify-center px-0' : ''
                } ${
                  isActive
                    ? 'bg-[#635BFF]/10 text-[#635BFF] dark:bg-[#635BFF]/20 dark:text-[#A5A0FF]'
                    : 'text-[#6B7085] dark:text-[#9EA3B8] hover:text-[#20212B] dark:hover:text-[#F4F5FA] hover:bg-[#F7F8FC] dark:hover:bg-[#1C1F2E]'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="flex-1 truncate">{label}</span>}
              {!collapsed && to === '/notifications' && unreadCount > 0 && (
                <span className="text-xs font-mono tabular-nums font-semibold text-[#635BFF]">
                  {unreadCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer Account Strip */}
        <div className="p-3 border-t border-[#E6E8F0] dark:border-[#262A3D] shrink-0">
          {isGuestMode && !collapsed && (
            <div className="mb-2.5 px-3 py-2 rounded-lg bg-[#F7F8FC] dark:bg-[#1C1F2E] border border-[#E6E8F0] dark:border-[#262A3D] text-xs text-[#6B7085] dark:text-[#9EA3B8]">
              Preview session ·{' '}
              <button
                type="button"
                onClick={handleLogout}
                className="text-[#635BFF] font-medium hover:underline"
              >
                Sign in to sync
              </button>
            </div>
          )}
          <div className={`flex items-center gap-2.5 ${collapsed ? 'justify-center' : ''}`}>
            <Avatar
              src={profile?.avatarUrl || user?.photoURL}
              name={profile?.fullName || user?.displayName || 'User'}
              size="sm"
            />
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[#20212B] dark:text-[#F4F5FA] truncate">
                  {profile?.fullName || user?.displayName || 'TaskFlow User'}
                </p>
                <p className="text-xs text-[#6B7085] dark:text-[#9EA3B8] truncate">
                  {profile?.roleTitle || 'Member'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex bg-[#F7F8FC] dark:bg-[#0D0E14] text-[#20212B] dark:text-[#F4F5FA]">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:block shrink-0 transition-[width] duration-200 ${
          sidebarCollapsed ? 'w-[68px]' : 'w-[256px]'
        }`}
      >
        <div className="sticky top-0 h-screen">{sidebarContent(false)}</div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden bg-[#0D0E14]/50 backdrop-blur-[2px]"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setMobileMenuOpen(false);
          }}
        >
          <div className="w-72 max-w-[85vw] h-full">{sidebarContent(true)}</div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 h-14 bg-white/95 dark:bg-[#151722]/95 backdrop-blur-sm border-b border-[#E6E8F0] dark:border-[#262A3D] px-4 lg:px-6 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 -ml-1 rounded-lg text-[#6B7085] hover:text-[#20212B] dark:text-[#9EA3B8] dark:hover:text-white"
            >
              <Menu className="w-5 h-5" />
            </button>
            <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm min-w-0">
              {breadcrumbs.map((crumb, idx) => (
                <React.Fragment key={idx}>
                  {idx > 0 && (
                    <span className="text-[#9295A5]" aria-hidden="true">
                      /
                    </span>
                  )}
                  <span
                    className={`truncate ${
                      idx === breadcrumbs.length - 1
                        ? 'font-semibold text-[#20212B] dark:text-[#F4F5FA]'
                        : 'text-[#6B7085] dark:text-[#9EA3B8] hidden sm:inline'
                    }`}
                  >
                    {crumb}
                  </span>
                </React.Fragment>
              ))}
            </nav>
          </div>

          {/* Right Utility Controls */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="p-2 rounded-lg text-[#6B7085] hover:text-[#20212B] dark:text-[#9EA3B8] dark:hover:text-white hover:bg-[#F7F8FC] dark:hover:bg-[#1C1F2E] transition-colors"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Notifications Dropdown */}
            <div className="relative" ref={notifRef}>
              <button
                type="button"
                onClick={() => setNotifOpen((v) => !v)}
                aria-label="Open notifications"
                aria-expanded={notifOpen}
                className="relative p-2 rounded-lg text-[#6B7085] hover:text-[#20212B] dark:text-[#9EA3B8] dark:hover:text-white hover:bg-[#F7F8FC] dark:hover:bg-[#1C1F2E] transition-colors"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#635BFF]" />
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-[#151722] border border-[#E6E8F0] dark:border-[#262A3D] rounded-xl shadow-xl overflow-hidden z-40">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-[#E6E8F0] dark:border-[#262A3D]">
                    <span className="text-sm font-semibold text-[#20212B] dark:text-[#F4F5FA]">
                      Notifications ({unreadCount})
                    </span>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={markAllNotificationsRead}
                        className="inline-flex items-center gap-1 text-xs font-medium text-[#635BFF] hover:underline"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-[#E6E8F0] dark:divide-[#262A3D]">
                    {notifications.length === 0 ? (
                      <p className="px-4 py-8 text-center text-xs text-[#6B7085] dark:text-[#9EA3B8]">
                        You are all caught up.
                      </p>
                    ) : (
                      notifications.slice(0, 6).map((n) => {
                        const dt = toJsDate(n.createdAt);
                        return (
                          <button
                            key={n.id}
                            type="button"
                            onClick={() => {
                              markNotificationRead(n.id);
                              setNotifOpen(false);
                              if (n.link) navigate(n.link);
                            }}
                            className={`w-full text-left px-4 py-3 hover:bg-[#F7F8FC] dark:hover:bg-[#1C1F2E] transition-colors ${
                              !n.isRead ? 'bg-[#635BFF]/[0.04]' : ''
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-xs font-semibold text-[#20212B] dark:text-[#F4F5FA]">
                                {n.title}
                              </p>
                              {!n.isRead && (
                                <span className="text-[11px] font-medium text-[#635BFF] shrink-0">
                                  New
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-[#6B7085] dark:text-[#9EA3B8] mt-0.5 line-clamp-2">
                              {n.message}
                            </p>
                            {dt && (
                              <p className="text-[11px] text-[#9295A5] mt-1 font-mono tabular-nums">
                                {formatDistanceToNow(dt, { addSuffix: true })}
                              </p>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                  <div className="px-4 py-2.5 border-t border-[#E6E8F0] dark:border-[#262A3D] bg-[#F7F8FC] dark:bg-[#1C1F2E]/60">
                    <button
                      type="button"
                      onClick={() => {
                        setNotifOpen(false);
                        navigate('/notifications');
                      }}
                      className="text-xs font-medium text-[#635BFF] hover:underline"
                    >
                      View all notifications
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Profile Menu */}
            <div className="relative" ref={profileRef}>
              <button
                type="button"
                onClick={() => setProfileMenuOpen((v) => !v)}
                aria-label="Open account menu"
                aria-expanded={profileMenuOpen}
                className="flex items-center gap-2 p-1 rounded-lg hover:bg-[#F7F8FC] dark:hover:bg-[#1C1F2E] transition-colors"
              >
                <Avatar
                  src={profile?.avatarUrl || user?.photoURL}
                  name={profile?.fullName || user?.displayName || 'User'}
                  size="sm"
                />
              </button>

              {profileMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-[#151722] border border-[#E6E8F0] dark:border-[#262A3D] rounded-xl shadow-xl py-1.5 z-40">
                  <div className="px-3.5 py-2 border-b border-[#E6E8F0] dark:border-[#262A3D]">
                    <p className="text-sm font-semibold text-[#20212B] dark:text-[#F4F5FA] truncate">
                      {profile?.fullName || user?.displayName}
                    </p>
                    <p className="text-xs text-[#6B7085] dark:text-[#9EA3B8] truncate">
                      {profile?.email || user?.email}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      navigate('/profile');
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-[#20212B] dark:text-[#F4F5FA] hover:bg-[#F7F8FC] dark:hover:bg-[#1C1F2E]"
                  >
                    <User className="w-4 h-4 text-[#6B7085]" />
                    <span>Profile</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      navigate('/settings');
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-[#20212B] dark:text-[#F4F5FA] hover:bg-[#F7F8FC] dark:hover:bg-[#1C1F2E]"
                  >
                    <Settings className="w-4 h-4 text-[#6B7085]" />
                    <span>Settings</span>
                  </button>
                  <div className="border-t border-[#E6E8F0] dark:border-[#262A3D] mt-1 pt-1">
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-[#EF4444] hover:bg-red-50 dark:hover:bg-red-950/30"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Viewport */}
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>

      <WorkspaceModal
        open={createWsOpen}
        onClose={() => setCreateWsOpen(false)}
        onSaved={(ws) => {
          if (ws?.id) navigate(`/workspace/${ws.id}`);
        }}
      />
    </div>
  );
}
