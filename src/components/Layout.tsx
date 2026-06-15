import { NavLink, Outlet } from 'react-router-dom';

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: '📊' },
  { path: '/triage', label: 'Triage', icon: '📋' },
  { path: '/research', label: 'Research', icon: '🔍' },
  { path: '/tailoring', label: 'Tailoring', icon: '🎤' },
  { path: '/visibility', label: 'Visibility', icon: '👁️' },
  { path: '/insights', label: 'Insights', icon: '💡' },
  { path: '/data-hub', label: 'Data Hub', icon: '🗄️' },
];

const MOBILE_ITEMS = [
  { path: '/', label: 'Dashboard', icon: '📊' },
  { path: '/triage', label: 'Triage', icon: '📋' },
  { path: '/research', label: 'Research', icon: '🔍' },
  { path: '/insights', label: 'Insights', icon: '💡' },
  { path: '/data-hub', label: 'Data Hub', icon: '🗄️' },
];

export default function Layout() {
  return (
    <>
      {/* Skip to content link for accessibility */}
      <a href="#main-content" className="skip-to-content">
        Langsung ke konten utama
      </a>

      <div className="app-layout">
        {/* Desktop / Tablet sidebar nav */}
        <nav className="app-nav" aria-label="Navigasi utama">
          <ul className="app-nav__links" role="menubar" aria-label="Menu layer">
            {NAV_ITEMS.map((item) => (
              <li key={item.path} role="none">
                <NavLink
                  to={item.path}
                  end={item.path === '/'}
                  className={({ isActive }) =>
                    `app-nav__link${isActive ? ' app-nav__link--active' : ''}`
                  }
                  role="menuitem"
                  aria-label={item.label}
                >
                  <span aria-hidden="true">{item.icon}</span>
                  <span className="app-nav__label">{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Mobile bottom tab bar */}
        <nav className="app-nav-mobile" aria-label="Navigasi mobile">
          <ul className="app-nav-mobile__links">
            {MOBILE_ITEMS.map((item) => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  end={item.path === '/'}
                  className={({ isActive }) =>
                    `app-nav-mobile__link${isActive ? ' app-nav-mobile__link--active' : ''}`
                  }
                  aria-label={item.label}
                >
                  <span aria-hidden="true" className="app-nav-mobile__icon">
                    {item.icon}
                  </span>
                  <span className="app-nav-mobile__label">{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Main content */}
        <main id="main-content" className="app-main" role="main">
          <Outlet />
        </main>
      </div>
    </>
  );
}
