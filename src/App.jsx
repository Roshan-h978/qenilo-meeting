import React, { useState } from 'react';
import CalendarPage from './pages/CalendarPage.jsx';
import HomePage from './pages/HomePage.jsx';
import MeetingPage from './pages/MeetingPage.jsx';
import RecentMeetingsPage from './pages/RecentMeetingsPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import useCalendar, { toLocalDateTime } from './hooks/useCalendar.js';
import useMeetingSession from './hooks/useMeetingSession.js';
import useSettings from './hooks/useSettings.js';
import useToast from './hooks/useToast.js';
import useAuth from './hooks/useAuth.js';
import useRooms from './hooks/useRooms.js';
import useRealtimeRoom from './hooks/useRealtimeRoom.js';
import SignInPage from './pages/SignInPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';

function App() {
  const [page, setPage] = useState('home');
  const [meetingTitleDraft, setMeetingTitleDraft] = useState('');
  const [pendingMeetingTitle, setPendingMeetingTitle] = useState('');
  const [pendingInstantMeeting, setPendingInstantMeeting] = useState(false);
  const [pendingJoinCode, setPendingJoinCode] = useState('');
  const [joinCodeDraft, setJoinCodeDraft] = useState('');
  const [instantRoom, setInstantRoom] = useState(null);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [toast, setToast] = useToast();
  const [settings, setSettings] = useSettings();
  const auth = useAuth();
  const rooms = useRooms(setToast);
  const calendar = useCalendar(setToast);
  const meeting = useMeetingSession({ settings, active: page === 'meeting', onToast: setToast });
  const realtime = useRealtimeRoom({
    room: instantRoom,
    user: auth.user,
    active: page === 'meeting' && Boolean(instantRoom),
    localStream: meeting.localStream,
    screenStream: meeting.screenStream,
    onToast: setToast,
  });

  const openMeeting = (title, outcomes) => {
    if (!auth.user) {
      setPendingInstantMeeting(false);
      setPendingJoinCode('');
      setPendingMeetingTitle(title || meetingTitleDraft || '');
      auth.clearError();
      setPage('sign-in');
      return;
    }
    if (meeting.start(title, outcomes)) setPage('meeting');
  };

  const createInstantMeeting = async title => {
    const room = await rooms.createRoom(title);
    if (!room) {
      setPage('home');
      return false;
    }
    setInstantRoom(room);
    if (meeting.start(title)) {
      setPage('meeting');
      return true;
    }
    await rooms.leaveRoom(room.code);
    setInstantRoom(null);
    setPage('home');
    return false;
  };

  const startInstantMeeting = () => {
    const title = meetingTitleDraft.trim() || 'Instant meeting';
    if (!auth.user) {
      setPendingInstantMeeting(true);
      setPendingJoinCode('');
      setPendingMeetingTitle(title);
      auth.clearError();
      setPage('sign-in');
      return;
    }
    createInstantMeeting(title);
  };

  const openJoinedRoom = async normalizedCode => {
    const room = await rooms.joinRoom(normalizedCode);
    if (!room) return;
    setInstantRoom(room);
    setJoinCodeDraft('');
    if (meeting.start(room.title)) setPage('meeting');
    else {
      await rooms.leaveRoom(room.code);
      setInstantRoom(null);
    }
  };

  const joinInstantMeeting = async code => {
    const normalizedCode = code.trim().toUpperCase();
    if (!auth.user) {
      setPendingInstantMeeting(false);
      setPendingMeetingTitle('');
      setPendingJoinCode(normalizedCode);
      auth.clearError();
      setPage('sign-in');
      return;
    }
    await openJoinedRoom(normalizedCode);
  };

  const continueAfterAuthentication = async () => {
    setPage('home');
    if (pendingJoinCode) {
      const code = pendingJoinCode;
      setPendingJoinCode('');
      await openJoinedRoom(code);
      return;
    }
    if (pendingInstantMeeting) {
      const title = pendingMeetingTitle.trim() || 'Instant meeting';
      setPendingInstantMeeting(false);
      setPendingMeetingTitle('');
      await createInstantMeeting(title);
      return;
    }
    if (pendingMeetingTitle.trim()) {
      const title = pendingMeetingTitle.trim();
      setPendingMeetingTitle('');
      if (meeting.start(title)) setPage('meeting');
    }
  };

  const finishSignIn = async values => {
    const ok = await auth.signIn(values);
    if (!ok) return false;
    await continueAfterAuthentication();
    return true;
  };

  const finishGoogleSignIn = async credential => {
    const ok = await auth.googleSignIn(credential);
    if (!ok) return false;
    await continueAfterAuthentication();
    return true;
  };

  const finishRegistration = async values => {
    const ok = await auth.register(values);
    if (!ok) return false;
    await continueAfterAuthentication();
    return true;
  };

  const finishMeeting = () => {
    meeting.finish();
    setPage('home');
    setPeopleOpen(false);
    if (instantRoom) rooms.leaveRoom(instantRoom.code);
    setInstantRoom(null);
    setToast('Meeting workspace saved');
  };

  const copyInviteCode = async () => {
    if (!instantRoom?.code) return;
    try {
      await navigator.clipboard.writeText(instantRoom.code);
      setToast('Meeting invite code copied');
    } catch {
      setToast('Clipboard access is unavailable in this browser');
    }
  };

  const toggleOutcomes = () => {
    if (!meeting.outcomesOpen) setPeopleOpen(false);
    meeting.setOutcomesOpen(value => !value);
  };

  const togglePeople = () => {
    if (!peopleOpen) meeting.setOutcomesOpen(false);
    setPeopleOpen(value => !value);
  };

  const navigation = {
    onHome: () => setPage('home'),
    onOpenRecent: () => setPage('recent'),
    onOpenCalendar: () => setPage('calendar'),
    onOpenSettings: () => setPage('settings'),
    onOpenSignIn: () => { setPendingInstantMeeting(false); setPendingJoinCode(''); setPendingMeetingTitle(''); auth.clearError(); setPage('sign-in'); },
    onSignOut: async () => { if (await auth.signOut()) setPage('home'); },
    signingOut: auth.busy,
    username: auth.user?.username,
    upcomingCount: calendar.meetings.length,
  };

  if (page === 'sign-in') {
    const authProps = {
      error: auth.error,
      connectionError: auth.connectionError,
      busy: auth.busy,
      onRetry: auth.refreshSession,
    };
    return <SignInPage {...authProps} onSignIn={finishSignIn} onGoogleSignIn={finishGoogleSignIn} googleClientId={import.meta.env.VITE_GOOGLE_CLIENT_ID} onRegister={() => { auth.clearError(); setPage('register'); }} onClose={() => { setPendingInstantMeeting(false); setPendingJoinCode(''); setPendingMeetingTitle(''); setPage('home'); }} />;
  }

  if (page === 'register') return <RegisterPage
    error={auth.error}
    connectionError={auth.connectionError}
    busy={auth.busy}
    onRetry={auth.refreshSession}
    onRegister={finishRegistration}
    onGoogleSignIn={finishGoogleSignIn}
    googleClientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}
    onSignIn={() => { auth.clearError(); setPage('sign-in'); }}
    onClose={() => { setPendingInstantMeeting(false); setPendingJoinCode(''); setPendingMeetingTitle(''); setPage('home'); }}
  />;

  if (page === 'calendar') return <CalendarPage
    navigation={navigation}
    title={calendar.title}
    onTitleChange={calendar.setTitle}
    date={calendar.date}
    onDateChange={calendar.setDate}
    onSchedule={calendar.scheduleMeeting}
    meetings={calendar.meetings}
    onOpenRoom={title => openMeeting(title)}
    toast={toast}
    toLocalDateTime={toLocalDateTime}
  />;

  if (page === 'recent') return <RecentMeetingsPage
    navigation={navigation}
    onBack={() => setPage('home')}
    meetings={meeting.history}
    onOpenRoom={(title, outcomes) => openMeeting(title, outcomes)}
    onRemoveMeeting={id => {
      meeting.removeFromHistory(id);
      setToast('Meeting removed from recent history');
    }}
    toast={toast}
  />;

  if (page === 'settings') return <SettingsPage
    navigation={navigation}
    displayName={settings.displayName}
    onDisplayNameChange={displayName => setSettings(current => ({ ...current, displayName }))}
    microphoneOn={settings.microphoneOn}
    onMicrophoneChange={microphoneOn => setSettings(current => ({ ...current, microphoneOn }))}
    cameraOn={settings.cameraOn}
    onCameraChange={cameraOn => setSettings(current => ({ ...current, cameraOn }))}
    noiseSuppression={settings.noiseSuppression}
    onNoiseSuppressionChange={noiseSuppression => setSettings(current => ({ ...current, noiseSuppression }))}
    echoCancellation={settings.echoCancellation}
    onEchoCancellationChange={echoCancellation => setSettings(current => ({ ...current, echoCancellation }))}
    autoGainControl={settings.autoGainControl}
    onAutoGainControlChange={autoGainControl => setSettings(current => ({ ...current, autoGainControl }))}
  />;

  if (page === 'meeting') return <MeetingPage
    title={meeting.title}
    roomCode={instantRoom?.code}
    onCopyInvite={copyInviteCode}
    participants={realtime.participants}
    remoteStreams={realtime.remoteStreams}
    chatMessages={realtime.messages}
    realtimeStatus={realtime.status}
    relayAvailable={realtime.relayAvailable}
    onSendChat={realtime.sendChat}
    peopleOpen={peopleOpen}
    onTogglePeople={togglePeople}
    onGoHome={finishMeeting}
    displayName={settings.displayName || 'You'}
    timeLabel={meeting.timeLabel}
    cameraOn={meeting.cameraOn}
    micOn={meeting.micOn}
    localStream={meeting.localStream}
    screenStream={meeting.screenStream}
    shareActive={meeting.shareActive}
    onToggleMic={() => meeting.setMediaEnabled('audio')}
    onToggleCamera={() => meeting.setMediaEnabled('video')}
    onShareScreen={meeting.toggleScreenShare}
    outcomesOpen={meeting.outcomesOpen}
    onToggleOutcomes={toggleOutcomes}
    outcomes={meeting.outcomes}
    onChangeOutcomeNotes={meeting.setNotes}
    onAddDecision={meeting.addDecision}
    onRemoveDecision={meeting.removeDecision}
    onAddAction={meeting.addAction}
    onToggleAction={meeting.toggleAction}
    onRemoveAction={meeting.removeAction}
    onCopyOutcomes={meeting.copyOutcomes}
    onLeave={finishMeeting}
    toast={toast}
  />;

  return <HomePage
    navigation={navigation}
    onStartMeeting={openMeeting}
    onStartInstantMeeting={startInstantMeeting}
    onJoinMeeting={joinInstantMeeting}
    joinCode={joinCodeDraft}
    onJoinCodeChange={setJoinCodeDraft}
    instantBusy={rooms.busy}
    meetingTitle={meetingTitleDraft}
    onMeetingTitleChange={setMeetingTitleDraft}
    onGoHome={() => setPage('home')}
    accountError={auth.error}
    toast={toast}
  />;
}

export default App;
