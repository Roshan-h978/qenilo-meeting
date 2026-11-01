import React, { useState } from 'react';
import Icon from './Icon.jsx';

function participantStatus(person) {
  if (person.isLocal) return 'You';
  if (person.connectionStatus === 'connected') return 'Connected';
  if (person.connectionStatus === 'failed' || person.connectionStatus === 'disconnected') return 'Reconnecting';
  return 'Joining';
}

export default function RoomPeoplePanel({ participants, messages, realtimeStatus, relayAvailable, onSend, onClose }) {
  const [draft, setDraft] = useState('');

  const submit = event => {
    event.preventDefault();
    if (onSend(draft)) setDraft('');
  };

  return <aside className="side-panel room-people-panel">
    <div className="panel-heading"><div><h3>People &amp; chat</h3><span>{participants.length} in this room · {realtimeStatus} · {relayAvailable ? 'TURN relay configured' : 'TURN relay not configured'}</span></div><button className="plain-icon" onClick={onClose} aria-label="Close people and chat"><Icon name="close"/></button></div>
    <section className="room-participants-section"><div className="room-section-title"><strong>Participants</strong><span>{participants.length}</span></div>
      <ul className="room-participant-list">{participants.map(person => <li key={person.userId}><span className={`participant-avatar ${person.isLocal ? 'self' : ''}`}>{(person.username || 'P').charAt(0).toUpperCase()}</span><span className="participant-name"><strong>{person.username || 'Participant'}{person.isLocal ? ' (you)' : ''}</strong><small>{person.isHost ? 'Host' : participantStatus(person)}</small></span><span className={`participant-state ${person.connectionStatus === 'connected' || person.isLocal ? 'online' : ''}`} aria-hidden="true"/></li>)}</ul>
    </section>
    <section className="room-chat-section"><div className="room-section-title"><strong>In-call messages</strong><span>Live only</span></div>
      <div className="room-chat-messages" aria-live="polite">{messages.length ? messages.map((message, index) => <article className="room-chat-message" key={`${message.sentAt}-${message.userId}-${index}`}><strong>{message.username}</strong><span>{message.text}</span><time>{new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(message.sentAt))}</time></article>) : <div className="room-chat-empty"><Icon name="note" size={20}/><span>Messages sent here are visible to people in this room.</span></div>}</div>
      <form className="room-chat-form" onSubmit={submit}><input value={draft} onChange={event => setDraft(event.target.value)} maxLength={1000} placeholder="Send a message" aria-label="Message"/><button type="submit" disabled={!draft.trim() || realtimeStatus !== 'connected'} aria-label="Send message"><Icon name="arrow" size={16}/></button></form>
    </section>
  </aside>;
}
