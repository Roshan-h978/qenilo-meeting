import React, { useEffect } from 'react';
import Brand from './Brand.jsx';

export default function AuthLayout({ title, description, children, footer, onClose, closeDisabled = false }) {
  useEffect(() => {
    if (!onClose || closeDisabled) return undefined;
    const handleKeyDown = event => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, closeDisabled]);

  return <main className="auth-screen">
    <header className="auth-topbar"><button className="auth-brand-home" type="button" onClick={onClose} disabled={!onClose || closeDisabled} aria-label="Go to QENILO homepage"><Brand/></button>{onClose && <button className="auth-close-button" type="button" onClick={onClose} disabled={closeDisabled} aria-label="Close account screen" title="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button>}</header>
    <div className="auth-layout">
      <aside className="auth-showcase">
        <div className="auth-showcase-copy"><div className="eyebrow">QENILO VIDEO MEETINGS</div><h2>Make room for<br/><span>good work.</span></h2><p>Bring people together, keep the conversation focused, and leave with clear next steps.</p></div>
        <div className="auth-showcase-art" aria-hidden="true"><div className="auth-orbit auth-orbit-one"/><div className="auth-orbit auth-orbit-two"/><div className="auth-showcase-core"><Brand compact/></div><i/><i/><i/></div>
        <div className="auth-showcase-caption">A calmer space for meaningful meetings</div>
      </aside>
      <section className="auth-card">
        <div className="auth-heading"><div className="eyebrow">QENILO ACCOUNT</div><h1>{title}</h1><p>{description}</p></div>
        {children}
        <div className="auth-footer">{footer}</div>
      </section>
    </div>
    <p className="auth-device-note">Your meeting preferences and saved workspace data remain stored in this browser.</p>
  </main>;
}
