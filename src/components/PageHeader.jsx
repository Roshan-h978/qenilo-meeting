import React, { useEffect, useRef, useState } from 'react';
import Brand from './Brand.jsx';
import Icon from './Icon.jsx';

export default function PageHeader({ onHome, activePage, upcomingCount = 0, username, onOpenRecent, onOpenCalendar, onOpenSettings, onOpenSignIn, onSignOut, signingOut }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);
  const links = [
    { id: 'home', label: 'Meetings', icon: 'video', onClick: onHome },
    { id: 'recent', label: 'Recent', icon: 'clock', onClick: onOpenRecent },
    { id: 'calendar', label: 'Calendar', icon: 'calendar', onClick: onOpenCalendar, count: upcomingCount },
  ];

  useEffect(() => {
    setMenuOpen(false);
    setProfileOpen(false);
  }, [activePage]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const closeOnEscape = event => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [menuOpen]);

  useEffect(() => {
    if (!profileOpen) return undefined;
    const closeProfile = event => {
      if (event.key === 'Escape' || !profileRef.current?.contains(event.target)) setProfileOpen(false);
    };
    window.addEventListener('keydown', closeProfile);
    window.addEventListener('pointerdown', closeProfile);
    return () => {
      window.removeEventListener('keydown', closeProfile);
      window.removeEventListener('pointerdown', closeProfile);
    };
  }, [profileOpen]);

  const goHome = () => {
    setMenuOpen(false);
    onHome?.();
  };

  return <header className="dashboard-topbar">
    <Brand onClick={goHome}/>
    <div className="nav-header-actions">
      <button className="nav-mobile-toggle" type="button" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={menuOpen} aria-controls="qenilo-main-navigation" onClick={() => setMenuOpen(open => !open)}>
        <Icon name={menuOpen ? 'close' : 'menu'} size={19}/><span>{menuOpen ? 'Close' : 'Menu'}</span>
      </button>
    </div>
    <nav id="qenilo-main-navigation" className={`dashboard-nav ${menuOpen ? 'is-open' : ''}`} aria-label="Main navigation">
      <ul className="nav-links">{links.map(link => <li key={link.id}><button className={`nav-link ${activePage === link.id ? 'is-active' : ''}`} type="button" onClick={() => { setMenuOpen(false); link.onClick?.(); }} aria-current={activePage === link.id ? 'page' : undefined}>
        <Icon name={link.icon} size={17}/><span>{link.label}</span>{link.count > 0 && <span className="nav-count">{link.count}</span>}
      </button></li>)}</ul>
      <div className="nav-account">{username ? <div className="nav-profile" ref={profileRef}>
        <button className={`nav-profile-trigger ${activePage === 'settings' ? 'is-active' : ''}`} type="button" aria-expanded={profileOpen} aria-controls="qenilo-profile-menu" aria-current={activePage === 'settings' ? 'page' : undefined} onClick={() => { setProfileOpen(open => !open); setMenuOpen(false); }}>
          <span className="nav-user-avatar" aria-hidden="true">{username.trim().charAt(0).toUpperCase()}</span><span className="nav-user-name">{username}</span><span className="nav-profile-chevron" aria-hidden="true">⌄</span>
        </button>
        {profileOpen && <div className="nav-profile-menu" id="qenilo-profile-menu">
          <div className="nav-profile-summary"><span>Signed in as</span><strong>{username}</strong></div>
          <button className="nav-profile-item" type="button" aria-current={activePage === 'settings' ? 'page' : undefined} onClick={() => { setProfileOpen(false); onOpenSettings?.(); }}><Icon name="settings" size={17}/><span>Settings</span></button>
          <button className="nav-profile-item" type="button" onClick={() => { setProfileOpen(false); onOpenSignIn?.(); }}>Switch account</button>
          <button className="nav-profile-item is-danger" type="button" onClick={onSignOut} disabled={signingOut}>{signingOut ? 'Signing out…' : 'Sign out'}</button>
        </div>}
      </div> : <button className="nav-signin" type="button" onClick={() => { setMenuOpen(false); onOpenSignIn(); }}>Sign in</button>}</div>
    </nav>
  </header>;
}
