import React from 'react';

export default function Brand({ compact = false, onClick }) {
  const contents = <><svg className="brand-mark" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <path d="M8 11.5C8 8.46 10.46 6 13.5 6h13C29.54 6 32 8.46 32 11.5v9C32 23.54 29.54 26 26.5 26H21l-7 7v-7h-.5C10.46 26 8 23.54 8 20.5v-9Z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round"/>
      <path d="M14 16h12M20 10v12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
    </svg>{!compact && <span>QENILO</span>}</>;
  const brand = <span className={`brand ${compact ? 'brand-compact' : ''}`}>{contents}</span>;
  return onClick
    ? <button className="brand-home-button" type="button" onClick={onClick} aria-label="Go to QENILO homepage" title="Go to homepage">{brand}</button>
    : <div className={`brand ${compact ? 'brand-compact' : ''}`}>{contents}</div>;
}
