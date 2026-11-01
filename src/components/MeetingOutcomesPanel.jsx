import React, { useState } from 'react';
import Icon from './Icon.jsx';

export default function MeetingOutcomesPanel({ outcomes, onChangeNotes, onAddDecision, onRemoveDecision, onAddAction, onToggleAction, onRemoveAction, onCopy }) {
  const [decisionDraft, setDecisionDraft] = useState('');
  const [actionDraft, setActionDraft] = useState('');
  const [ownerDraft, setOwnerDraft] = useState('');

  const submitDecision = (event) => {
    event.preventDefault();
    const text = decisionDraft.trim();
    if (!text) return;
    onAddDecision(text);
    setDecisionDraft('');
  };

  const submitAction = (event) => {
    event.preventDefault();
    const text = actionDraft.trim();
    if (!text) return;
    onAddAction(text, ownerDraft.trim());
    setActionDraft('');
    setOwnerDraft('');
  };

  return <div className="outcomes-content">
    <div className="outcomes-intro"><span className="outcomes-kicker">MAKE THE MEETING COUNT</span><p>Capture what was decided and what happens next.</p><button className="copy-outcomes-button" onClick={onCopy}><Icon name="copy" size={14}/> Copy outcomes</button></div>
    <label className="outcome-notes-label">Meeting notes<textarea value={outcomes.notes} onChange={event => onChangeNotes(event.target.value)} placeholder="Add context, key points, or open questions..." rows={4}/></label>

    <section className="outcome-section"><div className="outcome-section-heading"><h4>Decisions</h4><span>{outcomes.decisions.length}</span></div>
      <form className="outcome-add-form" onSubmit={submitDecision}><input value={decisionDraft} onChange={event => setDecisionDraft(event.target.value)} placeholder="What did the team decide?" maxLength={180}/><button type="submit" aria-label="Add decision" disabled={!decisionDraft.trim()}><Icon name="plus" size={16}/></button></form>
      {outcomes.decisions.length ? <ul className="outcome-list">{outcomes.decisions.map(item => <li key={item.id}><span className="decision-marker"><Icon name="check" size={13}/></span><span>{item.text}</span><button onClick={() => onRemoveDecision(item.id)} aria-label="Remove decision"><Icon name="close" size={14}/></button></li>)}</ul> : <p className="outcome-empty">Decisions you add will show here.</p>}
    </section>

    <section className="outcome-section action-section"><div className="outcome-section-heading"><h4>Action items</h4><span>{outcomes.actions.filter(item => !item.done).length} open</span></div>
      <form className="outcome-action-form" onSubmit={submitAction}><input value={actionDraft} onChange={event => setActionDraft(event.target.value)} placeholder="Add a next step" maxLength={180}/><div><input value={ownerDraft} onChange={event => setOwnerDraft(event.target.value)} placeholder="Owner (optional)" maxLength={40}/><button type="submit" aria-label="Add action item" disabled={!actionDraft.trim()}><Icon name="plus" size={16}/></button></div></form>
      {outcomes.actions.length ? <ul className="outcome-list action-list">{outcomes.actions.map(item => <li key={item.id} className={item.done ? 'action-done' : ''}><button className="action-check" onClick={() => onToggleAction(item.id)} aria-label={item.done ? 'Mark action as open' : 'Mark action as done'}><Icon name="check" size={13}/></button><span className="action-text">{item.text}{item.owner && <small>Owner: {item.owner}</small>}</span><button className="remove-action" onClick={() => onRemoveAction(item.id)} aria-label="Remove action item"><Icon name="close" size={14}/></button></li>)}</ul> : <p className="outcome-empty">Add owners and next steps as you talk.</p>}
    </section>
    <p className="outcomes-local-note">Saved with this meeting in your browser.</p>
  </div>;
}
