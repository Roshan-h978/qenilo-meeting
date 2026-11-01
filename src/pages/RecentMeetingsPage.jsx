import React from 'react';
import Icon from '../components/Icon.jsx';
import PageHeader from '../components/PageHeader.jsx';

const formatDuration = (seconds) => `${Math.floor(seconds / 60)} min${seconds % 60 ? ` ${seconds % 60} sec` : ''}`;

export default function RecentMeetingsPage({ navigation, onBack, meetings, onOpenRoom, onRemoveMeeting, toast }) {
  return <div className="app-shell"><main className="dashboard-main">
    <PageHeader {...navigation} activePage="recent"/>
    <div className="recent-content">
      <div className="calendar-intro"><div className="eyebrow">YOUR MEETING LOG</div><h1>Recent meetings</h1><p>Meetings you’ve left on this device appear here.</p></div>
      <section className="recent-list-card">
        <div className="calendar-section-title list-title"><span><h2>Meeting history</h2><p>{meetings.length ? `${meetings.length} recent ${meetings.length === 1 ? 'meeting' : 'meetings'}` : 'Your meeting history is empty.'}</p></span><span className="schedule-count">{meetings.length}</span></div>
        {meetings.length ? <div className="recent-list">{meetings.map(item => <article className="recent-item" key={item.id}>
          <div className="recent-icon"><Icon name="video" size={18}/></div>
          <div className="recent-copy"><strong>{item.title}</strong><span>{new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(item.startedAt))}</span><small>{formatDuration(item.durationSeconds || 0)}</small>{item.outcomes && <small className="outcome-history-count">{item.outcomes.decisions?.length || 0} decisions · {item.outcomes.actions?.filter(action => !action.done).length || 0} open actions</small>}</div>
          <div className="recent-item-actions"><button className="open-room-button" onClick={() => onOpenRoom(item.title, item.outcomes)}>Open workspace <Icon name="arrow" size={14}/></button><button className="remove-recent-button" onClick={() => onRemoveMeeting(item.id)} aria-label={`Remove ${item.title} from recent meetings`} title="Remove from recent meetings"><Icon name="trash" size={15}/></button></div>
        </article>)}</div> : <div className="recent-empty"><div className="empty-calendar-icon"><Icon name="clock" size={22}/></div><strong>No recent meetings yet</strong><span>Open a meeting workspace, then finish it to save it here.</span><button onClick={onBack}>Go to meetings <Icon name="arrow" size={14}/></button></div>}
      </section>
      <p className="calendar-note">Meeting history is stored in this browser only.</p>
    </div>
    {toast && <div className="toast"><Icon name="check" size={16}/>{toast}</div>}
  </main></div>;
}
