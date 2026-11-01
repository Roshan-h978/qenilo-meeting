import { useEffect, useMemo, useRef, useState } from 'react';

const emptyOutcomes = () => ({ notes: '', decisions: [], actions: [] });

function readHistory() {
  try {
    const value = JSON.parse(window.localStorage.getItem('qenilo-meeting-history') || '[]');
    return Array.isArray(value) ? value
      .filter(item => item?.title && item?.startedAt)
      .map(item => ({
        id: item.id || crypto.randomUUID(),
        title: item.title,
        startedAt: item.startedAt,
        durationSeconds: Number.isFinite(item.durationSeconds) ? item.durationSeconds : 0,
        outcomes: {
          notes: item.outcomes?.notes || '',
          decisions: Array.isArray(item.outcomes?.decisions) ? item.outcomes.decisions : [],
          actions: Array.isArray(item.outcomes?.actions) ? item.outcomes.actions : [],
        },
      })) : [];
  } catch {
    return [];
  }
}

export default function useMeetingSession({ settings, active, onToast }) {
  const [history, setHistory] = useState(readHistory);
  const [title, setTitle] = useState('');
  const [startedAt, setStartedAt] = useState(Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [shareActive, setShareActive] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [screenStream, setScreenStream] = useState(null);
  const [outcomes, setOutcomes] = useState(emptyOutcomes);
  const [outcomesOpen, setOutcomesOpen] = useState(false);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);

  useEffect(() => {
    try { window.localStorage.setItem('qenilo-meeting-history', JSON.stringify(history)); } catch { /* Browser storage can be disabled. */ }
  }, [history]);

  useEffect(() => {
    if (!active) return undefined;
    const timer = window.setInterval(() => setElapsed(seconds => seconds + 1), 1000);
    return () => window.clearInterval(timer);
  }, [active]);

  useEffect(() => {
    if (!active) return undefined;
    let cancelled = false;
    const releaseStreams = () => {
      localStreamRef.current?.getTracks().forEach(track => track.stop());
      screenStreamRef.current?.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
      screenStreamRef.current = null;
      setLocalStream(null);
      setScreenStream(null);
      setShareActive(false);
    };
    if (!settings.microphoneOn && !settings.cameraOn) return releaseStreams;
    if (!navigator.mediaDevices?.getUserMedia) {
      onToast('This browser does not support camera and microphone access');
      setMicOn(false);
      setCameraOn(false);
      return releaseStreams;
    }
    const audio = settings.microphoneOn ? {
      noiseSuppression: settings.noiseSuppression,
      echoCancellation: settings.echoCancellation,
      autoGainControl: settings.autoGainControl,
    } : false;
    navigator.mediaDevices.getUserMedia({ audio, video: settings.cameraOn })
      .then(stream => {
        if (cancelled) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        localStreamRef.current = stream;
        setLocalStream(stream);
      })
      .catch(() => {
        onToast('Allow camera and microphone access in your browser to use those devices');
        if (settings.microphoneOn) setMicOn(false);
        if (settings.cameraOn) setCameraOn(false);
      });
    return () => {
      cancelled = true;
      releaseStreams();
    };
  }, [active]);

  const timeLabel = useMemo(() => `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`, [elapsed]);

  const start = (meetingTitle, savedOutcomes) => {
    const nextTitle = meetingTitle.trim();
    if (!nextTitle) {
      onToast('Add a meeting title to continue');
      return false;
    }
    setTitle(nextTitle);
    setStartedAt(Date.now());
    setElapsed(0);
    setMicOn(settings.microphoneOn);
    setCameraOn(settings.cameraOn);
    setOutcomesOpen(false);
    setOutcomes(savedOutcomes ? {
      notes: savedOutcomes.notes || '',
      decisions: Array.isArray(savedOutcomes.decisions) ? savedOutcomes.decisions : [],
      actions: Array.isArray(savedOutcomes.actions) ? savedOutcomes.actions : [],
    } : emptyOutcomes());
    return true;
  };

  const setMediaEnabled = async (kind) => {
    const isVideo = kind === 'video';
    const currentlyOn = isVideo ? cameraOn : micOn;
    const setEnabled = isVideo ? setCameraOn : setMicOn;
    const existingTrack = localStreamRef.current?.getTracks().find(track => track.kind === kind && track.readyState === 'live');
    if (currentlyOn && existingTrack) {
      existingTrack.enabled = false;
      setEnabled(false);
      return;
    }
    if (existingTrack) {
      existingTrack.enabled = true;
      setEnabled(true);
      return;
    }
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('unsupported');
      const audio = {
        noiseSuppression: settings.noiseSuppression,
        echoCancellation: settings.echoCancellation,
        autoGainControl: settings.autoGainControl,
      };
      const newStream = await navigator.mediaDevices.getUserMedia(isVideo ? { video: true, audio: false } : { audio, video: false });
      const currentTracks = localStreamRef.current?.getTracks().filter(track => track.readyState === 'live') || [];
      const combined = new MediaStream([...currentTracks, ...newStream.getTracks()]);
      localStreamRef.current = combined;
      setLocalStream(combined);
      setEnabled(true);
    } catch {
      onToast(`Allow ${isVideo ? 'camera' : 'microphone'} access in your browser to turn it on`);
    }
  };

  const toggleScreenShare = async () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
      setScreenStream(null);
      setShareActive(false);
      return;
    }
    if (!navigator.mediaDevices?.getDisplayMedia) {
      onToast('Screen sharing is not supported in this browser');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      screenStreamRef.current = stream;
      setScreenStream(stream);
      setShareActive(true);
      stream.getVideoTracks()[0]?.addEventListener('ended', () => {
        screenStreamRef.current = null;
        setScreenStream(null);
        setShareActive(false);
      }, { once: true });
    } catch {
      onToast('Screen sharing was cancelled');
    }
  };

  const addDecision = (text) => setOutcomes(current => ({
    ...current,
    decisions: [...current.decisions, { id: crypto.randomUUID(), text }],
  }));

  const addAction = (text, owner) => setOutcomes(current => ({
    ...current,
    actions: [...current.actions, { id: crypto.randomUUID(), text, owner, done: false }],
  }));

  const copyOutcomes = async () => {
    const lines = [`# ${title} — meeting outcomes`, '', '## Notes', outcomes.notes || 'No notes added.', '', '## Decisions', ...(outcomes.decisions.length ? outcomes.decisions.map(item => `- ${item.text}`) : ['- None recorded']), '', '## Action items', ...(outcomes.actions.length ? outcomes.actions.map(item => `- [${item.done ? 'x' : ' '}] ${item.text}${item.owner ? ` — ${item.owner}` : ''}`) : ['- None recorded'])];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      onToast('Meeting outcomes copied');
    } catch {
      onToast('Clipboard access is unavailable in this browser');
    }
  };

  const finish = () => {
    const finishedAt = Date.now();
    const sessionStartedAt = Math.min(startedAt, finishedAt);
    setHistory(items => [{
      id: crypto.randomUUID(),
      title,
      startedAt: new Date(sessionStartedAt).toISOString(),
      durationSeconds: Math.max(0, Math.floor((finishedAt - sessionStartedAt) / 1000)),
      outcomes,
    }, ...items].slice(0, 100));
  };

  const updateDecision = (id, change) => setOutcomes(current => ({ ...current, decisions: change(current.decisions, id) }));
  const updateAction = (id, change) => setOutcomes(current => ({ ...current, actions: change(current.actions, id) }));

  return {
    history, title, timeLabel, micOn, cameraOn, localStream, screenStream, shareActive, outcomes, outcomesOpen,
    setOutcomesOpen,
    start,
    finish,
    setMediaEnabled,
    toggleScreenShare,
    addDecision,
    addAction,
    copyOutcomes,
    removeFromHistory: id => setHistory(items => items.filter(item => item.id !== id)),
    setNotes: notes => setOutcomes(current => ({ ...current, notes })),
    removeDecision: id => updateDecision(id, (items, key) => items.filter(item => item.id !== key)),
    toggleAction: id => updateAction(id, (items, key) => items.map(item => item.id === key ? { ...item, done: !item.done } : item)),
    removeAction: id => updateAction(id, (items, key) => items.filter(item => item.id !== key)),
  };
}
