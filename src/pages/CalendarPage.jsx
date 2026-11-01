import React from 'react';
import Icon from '../components/Icon.jsx';
import PageHeader from '../components/PageHeader.jsx';

export default function CalendarPage({ navigation, title, onTitleChange, date, onDateChange, onSchedule, meetings, onOpenRoom, toast, toLocalDateTime }) {
  return <div className="app-shell"><main className="dashboard-main">
    <PageHeader {...navigation} activePage="calendar"/>
    <div className="calendar-content">
      <div className="calendar-intro"><div className="eyebrow">PLAN YOUR CONVERSATION</div><h1>Calendar &amp; scheduling</h1><p>Set a time for your next meeting. Schedules are saved in this browser.</p></div>
      <div className="calendar-layout">
        <section className="schedule-card"><div className="calendar-section-title"><span className="calendar-icon"><Icon name="calendar" size={19}/></span><div><h2>Schedule a meeting</h2><p>Add a title and choose when to meet.</p></div></div>
          <form className="schedule-form" onSubmit={onSchedule}>
            <label>Meeting name<input value={title} onChange={event => onTitleChange(event.target.value)} placeholder="e.g. Weekly design review" maxLength={80} required/></label>
            <label>Date and time<input type="datetime-local" value={date} min={toLocalDateTime(new Date())} onChange={event => onDateChange(event.target.value)} required/></label>
            <button className="schedule-submit" type="submit"><Icon name="plus" size={17}/> Schedule meeting</button>
          </form>
        </section>
        <section className="schedule-list-card"><div className="calendar-section-title list-title"><span><h2>Upcoming meetings</h2><p>{meetings.length ? `${meetings.length} scheduled` : 'Your upcoming meetings will appear here.'}</p></span><span className="schedule-count">{meetings.length}</span></div>
          {meetings.length ? <div className="scheduled-list">{meetings.map(item => <article className="scheduled-item" key={item.id}><div className="date-block"><strong>{new Intl.DateTimeFormat(undefined, { day: '2-digit' }).format(new Date(item.startsAt))}</strong><span>{new Intl.DateTimeFormat(undefined, { month: 'short' }).format(new Date(item.startsAt))}</span></div><div className="scheduled-copy"><strong>{item.title}</strong><span>{new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(item.startsAt))}</span></div><button className="open-room-button" onClick={() => onOpenRoom(item.title)}>Open workspace <Icon name="arrow" size={14}/></button></article>)}</div> : <div className="schedule-empty"><div className="empty-calendar-icon"><Icon name="calendar" size={22}/></div><strong>No upcoming meetings</strong><span>Use the form to plan your next conversation.</span></div>}
        </section>
      </div>
      <p className="calendar-note">Scheduled meetings are stored on this device. No invitations or reminders are sent.</p>
    </div>
    {toast && <div className="toast"><Icon name="check" size={16}/>{toast}</div>}
  </main></div>;
}
