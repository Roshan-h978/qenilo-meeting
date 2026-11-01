import React from 'react';
import Brand from '../components/Brand.jsx';
import Icon from '../components/Icon.jsx';
import PageHeader from '../components/PageHeader.jsx';

export default function HomePage({ navigation, onStartMeeting, onStartInstantMeeting, onJoinMeeting, instantBusy, joinCode, onJoinCodeChange, meetingTitle, onMeetingTitleChange, onGoHome, toast, accountError }) {
  return <div className="app-shell"><main className="dashboard-main">
    <PageHeader {...navigation} onHome={onGoHome} activePage="home"/>
    <div className="dashboard-content">
      <section className="welcome-row"><div><div className="eyebrow">QENILO VIDEO MEETINGS</div><h1>Make room for<br/><span>good work.</span></h1><p>Prepare a meeting workspace and capture what comes next.</p></div><div className="welcome-art" aria-hidden="true"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="art-core"><Brand compact/></div><span className="art-dot dot-a"/><span className="art-dot dot-b"/><span className="art-dot dot-c"/></div></section>
      <section className="action-grid">
        <article className="action-card primary-action"><div className="action-icon light-icon"><Icon name="video" size={22}/></div><div className="start-session-copy"><h2>Open a meeting workspace</h2><p>Use your devices, notes, and action list in one place.</p><form className="session-title-form" onSubmit={event => { event.preventDefault(); onStartMeeting(meetingTitle.trim()); }}><input value={meetingTitle} onChange={event => onMeetingTitleChange(event.target.value)} placeholder="Meeting title" aria-label="Meeting title" maxLength={80} required/><button type="submit" aria-label="Open meeting workspace"><Icon name="arrow"/></button></form></div></article>
        <button className="action-card secondary-action schedule-action" onClick={navigation.onOpenCalendar}><span className="action-icon dark-icon"><Icon name="calendar" size={21}/></span><span><strong>Schedule a meeting</strong><small>Set a time and find it in your calendar.</small></span><Icon name="arrow" size={18}/></button>
        <button className="action-card secondary-action instant-meeting-action" onClick={onStartInstantMeeting} disabled={instantBusy}><span className="action-icon dark-icon"><Icon name="video" size={21}/></span><span><strong>{instantBusy ? 'Creating your room…' : 'Start an instant meeting'}</strong><small>Create a room and get a shareable invite code.</small></span><Icon name="arrow" size={18}/></button>
        <article className="action-card secondary-action join-meeting-action"><span className="action-icon dark-icon"><Icon name="users" size={21}/></span><div><strong>Join a meeting</strong><small>Enter the invite code you received.</small><form className="join-meeting-form" onSubmit={event => { event.preventDefault(); onJoinMeeting(joinCode.trim()); }}><input aria-label="Meeting invite code" autoCapitalize="characters" autoComplete="off" maxLength={12} placeholder="12-character code" value={joinCode} onChange={event => onJoinCodeChange(event.target.value.toUpperCase())} required/><button type="submit" disabled={instantBusy || joinCode.trim().length < 12}>{instantBusy ? 'Joining…' : 'Join'}</button></form></div></article>
      </section>
      <footer className="dashboard-footer"><span>QENILO · VIDEO MEETINGS</span><span>Workspaces and saved notes stay on this device</span></footer>
    </div>
    {accountError && <div className="auth-signout-error" role="alert">{accountError}</div>}
    {toast && <div className="toast"><Icon name="check" size={16}/>{toast}</div>}
  </main></div>;
}
