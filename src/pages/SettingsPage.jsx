import React, { useState } from 'react';
import Icon from '../components/Icon.jsx';
import PageHeader from '../components/PageHeader.jsx';

function PreferenceToggle({ label, description, checked, onChange }) {
  return <div className="preference-row">
    <div><strong>{label}</strong><span>{description}</span></div>
    <button className={`setting-switch ${checked ? 'is-on' : ''}`} type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}><span/></button>
  </div>;
}

export default function SettingsPage({ navigation, displayName, onDisplayNameChange, microphoneOn, onMicrophoneChange, cameraOn, onCameraChange, noiseSuppression, onNoiseSuppressionChange, echoCancellation, onEchoCancellationChange, autoGainControl, onAutoGainControlChange }) {
  const [section, setSection] = useState('meeting');
  const sections = [
    { id: 'profile', label: 'Profile', icon: 'users' },
    { id: 'meeting', label: 'Meeting', icon: 'video' },
    { id: 'audio', label: 'Audio', icon: 'mic' },
  ];
  return <div className="app-shell"><main className="dashboard-main">
    <PageHeader {...navigation} activePage="settings"/>
    <div className="settings-content">
      <div className="settings-titlebar"><div><span className="settings-breadcrumb">PREFERENCES</span><h1>Settings</h1></div><span className="settings-save-state"><Icon name="check" size={14}/> Saved on this device</span></div>
      <div className="settings-workspace">
        <nav className="settings-sidebar" aria-label="Settings categories">{sections.map(item => <button key={item.id} type="button" className={`settings-side-link ${section === item.id ? 'is-active' : ''}`} aria-current={section === item.id ? 'page' : undefined} onClick={() => setSection(item.id)}><Icon name={item.icon} size={17}/><span>{item.label}</span></button>)}</nav>
        <div className="settings-panel">
          {section === 'profile' && <section aria-labelledby="settings-profile-title">
            <div className="settings-panel-heading"><div><h2 id="settings-profile-title">Profile</h2><p>Your name shown to people in a meeting.</p></div></div>
            <label className="settings-field">Display name<input value={displayName} onChange={event => onDisplayNameChange(event.target.value)} maxLength={40} placeholder="Enter your name"/><span>{displayName.length}/40 characters</span></label>
          </section>}
          {section === 'meeting' && <section aria-labelledby="settings-meeting-title">
            <div className="settings-panel-heading"><div><h2 id="settings-meeting-title">Meeting</h2><p>Choose what is enabled when you join.</p></div></div>
            <PreferenceToggle label="Microphone" description="Turn on your microphone when a meeting starts." checked={microphoneOn} onChange={onMicrophoneChange}/>
            <PreferenceToggle label="Camera" description="Turn on your camera when a meeting starts." checked={cameraOn} onChange={onCameraChange}/>
          </section>}
          {section === 'audio' && <section aria-labelledby="settings-audio-title">
            <div className="settings-panel-heading"><div><h2 id="settings-audio-title">Audio processing</h2><p>Microphone adjustments applied when you join a meeting.</p></div></div>
            <PreferenceToggle label="Noise suppression" description="Reduce steady background sounds like fans and typing." checked={noiseSuppression} onChange={onNoiseSuppressionChange}/>
            <PreferenceToggle label="Echo cancellation" description="Help prevent speaker audio from returning through your microphone." checked={echoCancellation} onChange={onEchoCancellationChange}/>
            <PreferenceToggle label="Automatic microphone level" description="Adjust your microphone volume as you speak." checked={autoGainControl} onChange={onAutoGainControlChange}/>
          </section>}
        </div>
      </div>
      <p className="settings-footnote">Preferences are stored in this browser and apply to this device.</p>
    </div>
  </main></div>;
}
