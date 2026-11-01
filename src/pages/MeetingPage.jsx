import React, { useEffect, useRef, useState } from 'react';
import Brand from '../components/Brand.jsx';
import Icon from '../components/Icon.jsx';
import MeetingOutcomesPanel from '../components/MeetingOutcomesPanel.jsx';
import RoomPeoplePanel from '../components/RoomPeoplePanel.jsx';

function StreamPreview({ stream, label, className = '', muted = true }) {
  const videoRef = useRef(null);
  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream || null;
  }, [stream]);
  return <video ref={videoRef} className={className} autoPlay muted={muted} playsInline aria-label={label}/>;
}

export default function MeetingPage({ title, roomCode, onCopyInvite, onGoHome, participants, remoteStreams, chatMessages, realtimeStatus, relayAvailable, onSendChat, peopleOpen, onTogglePeople, displayName, timeLabel, cameraOn, micOn, localStream, screenStream, shareActive, onToggleMic, onToggleCamera, onShareScreen, outcomesOpen, onToggleOutcomes, outcomes, onChangeOutcomeNotes, onAddDecision, onRemoveDecision, onAddAction, onToggleAction, onRemoveAction, onCopyOutcomes, onLeave, toast }) {
  const sidePanelOpen = outcomesOpen || peopleOpen;
  const meetingRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const syncFullscreen = () => setIsFullscreen(document.fullscreenElement === meetingRef.current);
    document.addEventListener('fullscreenchange', syncFullscreen);
    return () => document.removeEventListener('fullscreenchange', syncFullscreen);
  }, []);
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await meetingRef.current?.requestFullscreen();
    } catch {
      // Fullscreen is optional and may be blocked by browser policy.
    }
  };
  const onlineCount = participants?.filter(person => person.isPresent).length ?? 0;
  const statusLabel = realtimeStatus === 'connected' ? 'Connected' : realtimeStatus === 'reconnecting' ? 'Reconnecting' : realtimeStatus === 'configuring' ? 'Connecting' : 'Offline';
  return <div className="meeting-shell" ref={meetingRef}>
    <header className="meeting-topbar">
      <div className="meeting-brand"><Brand compact onClick={onGoHome}/><span className="top-divider"/><div><strong>{title}</strong><span className="meeting-id">{roomCode ? `Instant room · ${roomCode}` : 'Personal meeting workspace'}</span></div></div>
      <div className="meeting-top-right">{roomCode && <button className="invite-code-button" onClick={onCopyInvite} title="Copy invitation code"><Icon name="copy" size={14}/><span>Copy invite code</span></button>}<span className="timer"><Icon name="clock" size={15}/>{timeLabel}</span></div>
    </header>
    <main className={`meeting-content local-meeting-content ${sidePanelOpen ? 'with-panel' : ''}`}>
      <section className="video-area local-video-area">
        <div className={`video-grid local-workspace ${shareActive ? 'sharing-screen' : ''} ${remoteStreams?.length ? 'has-remote-participants' : ''}`}>
          <div className="video-tile local-preview-tile">
            {cameraOn && localStream?.getVideoTracks().some(track => track.readyState === 'live') ? <StreamPreview stream={localStream} label="Camera preview" className="local-video-preview"/> : <div className="local-preview-empty"><span className="self-avatar">{displayName.trim().charAt(0).toUpperCase() || 'Y'}</span><strong>{cameraOn ? 'Camera preview unavailable' : 'Camera is off'}</strong><span>{cameraOn ? 'Check browser permissions or connect a camera.' : 'Turn the camera on when you’re ready.'}</span></div>}
            <div className="tile-label">{displayName.trim() || 'You'} <span className="you-tag">YOU</span></div>
            {!micOn && <span className="muted-indicator"><Icon name="micOff" size={13}/></span>}
          </div>
          {remoteStreams?.map(({ userId, stream, streamId }) => <div className="video-tile local-preview-tile remote-participant-tile" key={streamId}><StreamPreview stream={stream} label="Participant camera or shared screen" className="local-video-preview" muted={false}/><div className="tile-label">{participants?.find(person => person.userId === userId)?.username || 'Participant'}</div></div>)}
          {shareActive && screenStream && <div className="video-tile screen-preview-tile"><StreamPreview stream={screenStream} label="Screen share preview" className="screen-video-preview"/><div className="tile-label">Your shared screen</div></div>}
        </div>
        <div className="meeting-bottom local-meeting-bottom">
          <div className={`local-session-status ${roomCode ? `status-${realtimeStatus}` : 'status-local'}`} role="status"><span className="local-status-dot"/><span>{roomCode ? statusLabel : 'Preview only'}</span></div>
          <div className="call-controls local-controls">
            <button className={`control ${!micOn ? 'control-off' : ''}`} onClick={onToggleMic} title={micOn ? 'Mute microphone' : 'Turn microphone on'} aria-label={micOn ? 'Mute microphone' : 'Turn microphone on'} aria-pressed={!micOn}><Icon name={micOn ? 'mic' : 'micOff'} size={20}/><span>{micOn ? 'Mute' : 'Mic on'}</span></button>
            <button className={`control ${!cameraOn ? 'control-off' : ''}`} onClick={onToggleCamera} title={cameraOn ? 'Turn camera off' : 'Turn camera on'} aria-label={cameraOn ? 'Turn camera off' : 'Turn camera on'} aria-pressed={!cameraOn}><Icon name={cameraOn ? 'video' : 'cameraOff'} size={20}/><span>{cameraOn ? 'Camera' : 'Camera on'}</span></button>
            <button className={`control present-control ${shareActive ? 'control-active' : ''}`} onClick={onShareScreen} title={shareActive ? 'Stop sharing screen' : 'Share screen'} aria-label={shareActive ? 'Stop presenting' : 'Present screen'} aria-pressed={shareActive}><Icon name="share" size={20}/><span>{shareActive ? 'Stop share' : 'Present'}</span></button>
            <button className={`control outcomes-control ${outcomesOpen ? 'control-selected' : ''}`} onClick={onToggleOutcomes} title="Meeting outcomes" aria-label="Meeting notes and outcomes" aria-pressed={outcomesOpen}><Icon name="note" size={20}/><span>Notes</span></button>
            {roomCode && <button className={`control room-people-control ${peopleOpen ? 'control-selected' : ''}`} onClick={onTogglePeople} title="People and chat" aria-label={`People and chat${onlineCount ? `, ${onlineCount} active` : ''}`} aria-pressed={peopleOpen}><Icon name="users" size={20}/><span>People{onlineCount > 0 && <span className="control-count">{onlineCount}</span>}</span></button>}
            <button className="control fullscreen-control" onClick={toggleFullscreen} title={isFullscreen ? 'Exit full screen' : 'Enter full screen'} aria-label={isFullscreen ? 'Exit full screen' : 'Enter full screen'} aria-pressed={isFullscreen}><Icon name={isFullscreen ? 'exitFullscreen' : 'fullscreen'} size={19}/><span>{isFullscreen ? 'Exit full' : 'Full screen'}</span></button>
            <span className="controls-divider"/><button className="leave-button" onClick={onLeave} aria-label="Finish meeting"><Icon name="phone" size={19}/><span>Finish</span></button>
          </div>
          <div className="bottom-spacer"/>
        </div>
      </section>
      {outcomesOpen && <aside className="side-panel outcome-panel">
        <div className="panel-heading"><div><h3>Meeting outcomes</h3><span>Decisions and next steps</span></div><button className="plain-icon" onClick={onToggleOutcomes}><Icon name="close"/></button></div>
        <MeetingOutcomesPanel outcomes={outcomes} onChangeNotes={onChangeOutcomeNotes} onAddDecision={onAddDecision} onRemoveDecision={onRemoveDecision} onAddAction={onAddAction} onToggleAction={onToggleAction} onRemoveAction={onRemoveAction} onCopy={onCopyOutcomes}/>
      </aside>}
      {peopleOpen && roomCode && <RoomPeoplePanel participants={participants || []} messages={chatMessages || []} realtimeStatus={realtimeStatus} relayAvailable={relayAvailable} onSend={onSendChat} onClose={onTogglePeople}/>}
    </main>
    {toast && <div className="toast"><Icon name="check" size={16}/>{toast}</div>}
  </div>;
}
