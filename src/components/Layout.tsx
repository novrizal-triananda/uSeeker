import { NavLink, Outlet } from 'react-router-dom';
import UpdateChecker from './UpdateChecker';
import AiIndicator from './AiIndicator';

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: '📊' },
  { path: '/triage', label: 'Triage', icon: '📋' },
  { path: '/research', label: 'Research', icon: '🔍' },
  { path: '/tailoring', label: 'Tailoring', icon: '🎤' },
  { path: '/visibility', label: 'Visibility', icon: '👁️' },
  { path: '/insights', label: 'Insights', icon: '💡' },
  { path: '/data-hub', label: 'Data Hub', icon: '🗄️' },
];

const BOTTOM_NAV_ITEMS = [
  { path: '/settings', label: 'Pengaturan', icon: '⚙️' },
];

const MOBILE_ITEMS = [
  { path: '/', label: 'Dashboard', icon: '📊' },
  { path: '/triage', label: 'Triage', icon: '📋' },
  { path: '/research', label: 'Research', icon: '🔍' },
  { path: '/insights', label: 'Insights', icon: '💡' },
  { path: '/data-hub', label: 'Data Hub', icon: '🗄️' },
  { path: '/settings', label: 'Pengaturan', icon: '⚙️' },
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
          <a
            href="/"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '1rem 1rem 0.75rem',
              borderBottom: '1px solid var(--color-border, #e5e7eb)',
              textDecoration: 'none',
              color: 'var(--color-primary, #2563eb)',
            }}
          >
            <img
              src="/favicon.svg"
              alt=""
              width={28}
              height={28}
              style={{ display: 'block' }}
            />
            <span style={{ fontSize: '1.125rem', fontWeight: 700 }}>uSeeker</span>
          </a>
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
          <ul className="app-nav__links" role="menubar" aria-label="Menu pengaturan" style={{ borderTop: '1px solid var(--color-border, #e5e7eb)', marginTop: 'var(--space-4)', paddingTop: 'var(--space-2)' }}>
            {BOTTOM_NAV_ITEMS.map((item) => (
              <li key={item.path} role="none">
                <NavLink
                  to={item.path}
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
          <UpdateChecker />
          <div style={{ padding: '4px 8px', borderTop: '1px solid var(--color-border, #e5e7eb)' }}>
            <AiIndicator />
          </div>
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
