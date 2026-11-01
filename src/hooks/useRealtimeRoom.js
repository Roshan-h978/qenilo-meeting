import { useEffect, useRef, useState } from 'react';

const FALLBACK_ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
];

export default function useRealtimeRoom({ room, user, active, localStream, screenStream, onToast }) {
  const socketRef = useRef(null);
  const peersRef = useRef(new Map());
  const mediaRef = useRef({ localStream, screenStream });
  const [participants, setParticipants] = useState([]);
  const [remoteStreams, setRemoteStreams] = useState([]);
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState('offline');
  const [relayAvailable, setRelayAvailable] = useState(false);

  useEffect(() => {
    mediaRef.current = { localStream, screenStream };
    for (const peer of peersRef.current.values()) {
      const liveTracks = [localStream, screenStream].filter(Boolean).flatMap(stream => stream.getTracks()).filter(track => track.readyState === 'live');
      const liveIds = new Set(liveTracks.map(track => track.id));
      for (const stream of [localStream, screenStream].filter(Boolean)) {
        for (const track of stream.getTracks()) {
          if (track.readyState !== 'live' || peer.senders.has(track.id)) continue;
          const sender = peer.connection.getSenders().find(existing => existing.track?.id === track.id) || peer.connection.addTrack(track, stream);
          peer.senders.set(track.id, sender);
        }
      }
      for (const [trackId, sender] of peer.senders) {
        if (!liveIds.has(trackId)) {
          sender.replaceTrack(null).catch(() => {});
          peer.senders.delete(trackId);
        }
      }
    }
  }, [localStream, screenStream]);

  useEffect(() => {
    if (!active || !room?.code) {
      setStatus('offline');
      setRelayAvailable(false);
      setParticipants([]);
      setRemoteStreams([]);
      setMessages([]);
      return undefined;
    }

    let disposed = false;
    let heartbeatTimer;
    let reconnectTimer;
    let credentialRefreshTimer;
    let reconnectAttempts = 0;
    let refreshAttempts = 0;
    let lastHeartbeatAckAt = 0;
    let rtcConfiguration = { iceServers: FALLBACK_ICE_SERVERS };
    let socket;
    const peerConnections = peersRef.current;
    const socketUrl = new URL(`/ws/rooms/${encodeURIComponent(room.code)}/`, window.location.href);
    socketUrl.protocol = socketUrl.protocol === 'https:' ? 'wss:' : 'ws:';
    setStatus('configuring');
    setParticipants(room.participants || []);

    const send = message => {
      if (socketRef.current?.readyState === WebSocket.OPEN) socketRef.current.send(JSON.stringify(message));
    };

    const updatePeerStatus = (userId, connectionStatus) => {
      setParticipants(current => current.map(person => person.userId === userId ? { ...person, connectionStatus } : person));
    };

    const restartPeer = (userId, peer) => {
      if (disposed || peer.connection.signalingState === 'closed') return;
      const now = Date.now();
      if (now - peer.lastRestartAt < 8000) return;
      peer.lastRestartAt = now;
      updatePeerStatus(userId, 'reconnecting');
      try { peer.connection.restartIce(); } catch { updatePeerStatus(userId, 'failed'); }
    };

    const restartAllPeers = () => {
      for (const [userId, peer] of peerConnections) restartPeer(userId, peer);
    };

    const createPeer = userId => {
      const existing = peerConnections.get(userId);
      if (existing) return existing;

      const connection = new RTCPeerConnection(rtcConfiguration);
      const peer = {
        connection,
        polite: Number(user?.id) > Number(userId),
        makingOffer: false,
        ignoreOffer: false,
        isSettingRemoteAnswerPending: false,
        pendingCandidates: [],
        senders: new Map(),
        lastRestartAt: 0,
        disconnectTimer: null,
      };
      peerConnections.set(userId, peer);

      connection.onicecandidate = event => {
        if (event.candidate) send({ type: 'ice_candidate', targetUserId: userId, payload: event.candidate.toJSON() });
      };
      connection.ontrack = event => {
        const stream = event.streams[0] || new MediaStream([event.track]);
        setRemoteStreams(current => {
          const existing = current.findIndex(item => item.streamId === stream.id);
          const item = { userId, streamId: stream.id, stream };
          if (existing === -1) return [...current, item];
          return current.map((currentItem, index) => index === existing ? item : currentItem);
        });
      };
      connection.onconnectionstatechange = () => updatePeerStatus(userId, connection.connectionState);
      connection.oniceconnectionstatechange = () => {
        const state = connection.iceConnectionState;
        if (state === 'connected' || state === 'completed') {
          if (peer.disconnectTimer) window.clearTimeout(peer.disconnectTimer);
          peer.disconnectTimer = null;
          peer.lastRestartAt = 0;
          updatePeerStatus(userId, 'connected');
        } else if (state === 'failed') {
          restartPeer(userId, peer);
        } else if (state === 'disconnected' && !peer.disconnectTimer) {
          peer.disconnectTimer = window.setTimeout(() => {
            peer.disconnectTimer = null;
            if (connection.iceConnectionState === 'disconnected') restartPeer(userId, peer);
          }, 5000);
        }
      };
      connection.onnegotiationneeded = async () => {
        try {
          peer.makingOffer = true;
          await connection.setLocalDescription();
          send({ type: connection.localDescription.type, targetUserId: userId, payload: connection.localDescription.toJSON() });
        } catch {
          updatePeerStatus(userId, 'failed');
        } finally {
          peer.makingOffer = false;
        }
      };

      for (const stream of [mediaRef.current.localStream, mediaRef.current.screenStream].filter(Boolean)) {
        for (const track of stream.getTracks()) {
          if (track.readyState !== 'live') continue;
          const sender = connection.addTrack(track, stream);
          peer.senders.set(track.id, sender);
        }
      }
      updatePeerStatus(userId, 'connecting');
      return peer;
    };

    const removePeer = userId => {
      const peer = peerConnections.get(userId);
      if (peer?.disconnectTimer) window.clearTimeout(peer.disconnectTimer);
      peer?.connection.close();
      peerConnections.delete(userId);
      setRemoteStreams(current => current.filter(item => item.userId !== userId));
      setParticipants(current => current.filter(person => person.userId !== userId));
    };

    const handleSignal = async message => {
      const peer = createPeer(message.fromUserId);
      const connection = peer.connection;
      try {
        if (message.type === 'offer' || message.type === 'answer') {
          const readyForOffer = !peer.makingOffer && (connection.signalingState === 'stable' || peer.isSettingRemoteAnswerPending);
          const offerCollision = message.type === 'offer' && !readyForOffer;
          peer.ignoreOffer = !peer.polite && offerCollision;
          if (peer.ignoreOffer) return;

          peer.isSettingRemoteAnswerPending = message.type === 'answer';
          await connection.setRemoteDescription(message.payload);
          peer.isSettingRemoteAnswerPending = false;
          for (const candidate of peer.pendingCandidates.splice(0)) await connection.addIceCandidate(candidate);

          if (message.type === 'offer') {
            await connection.setLocalDescription();
            send({ type: connection.localDescription.type, targetUserId: message.fromUserId, payload: connection.localDescription.toJSON() });
          }
          return;
        }

        if (message.type === 'ice_candidate') {
          if (!message.payload) return;
          if (connection.remoteDescription) await connection.addIceCandidate(message.payload);
          else peer.pendingCandidates.push(message.payload);
        }
      } catch (error) {
        if (message.type !== 'ice_candidate' || !peer.ignoreOffer) {
          updatePeerStatus(message.fromUserId, 'failed');
          onToast(`Could not connect to ${participants.find(person => person.userId === message.fromUserId)?.username || 'a participant'}.`);
        }
      }
    };

    const connectSocket = () => {
      if (disposed) return;
      if (reconnectTimer) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      socket = new WebSocket(socketUrl);
      socketRef.current = socket;
      socket.onopen = () => {
      if (disposed) return;
      reconnectAttempts = 0;
      lastHeartbeatAckAt = Date.now();
      setStatus('connected');
      socket.send(JSON.stringify({ type: 'heartbeat' }));
      if (heartbeatTimer) window.clearInterval(heartbeatTimer);
      heartbeatTimer = window.setInterval(() => {
        if (socket.readyState !== WebSocket.OPEN) return;
        if (Date.now() - lastHeartbeatAckAt > 75000) {
          socket.close(4000, 'Heartbeat timeout');
          return;
        }
        socket.send(JSON.stringify({ type: 'heartbeat' }));
      }, 30000);
      if (peerConnections.size) restartAllPeers();
      };
      const scheduleReconnect = () => {
        if (disposed || reconnectTimer) return;
        setStatus('reconnecting');
        if (heartbeatTimer) window.clearInterval(heartbeatTimer);
        heartbeatTimer = null;
        const delay = Math.min(15000, 1000 * (2 ** reconnectAttempts++)) + Math.random() * 500;
        reconnectTimer = window.setTimeout(() => { reconnectTimer = null; connectSocket(); }, delay);
      };
      socket.onclose = () => { if (!disposed) scheduleReconnect(); };
      socket.onerror = () => { if (!disposed) socket.close(); };
      socket.onmessage = event => {
      let message;
      try { message = JSON.parse(event.data); } catch { return; }
      if (message.type === 'ready') {
        if (!disposed) {
          setStatus('connected');
          setParticipants([{ userId: message.userId, username: user?.username || 'You', isHost: message.userId === room.host?.id, isLocal: true }, ...(message.participants || []).map(person => ({ ...person, isLocal: false }))]);
        }
        for (const person of message.participants || []) createPeer(person.userId);
      } else if (message.type === 'heartbeat_ack') {
        lastHeartbeatAckAt = Date.now();
        return;
      } else if (message.type === 'peer_joined') {
        if (message.userId === user?.id) return;
        setParticipants(current => current.some(person => person.userId === message.userId)
          ? current
          : [...current, { userId: message.userId, username: message.username || 'Participant', isHost: false, isLocal: false }]);
        createPeer(message.userId);
      } else if (message.type === 'peer_disconnected') {
        removePeer(message.userId);
      } else if (['offer', 'answer', 'ice_candidate'].includes(message.type)) {
        handleSignal(message);
      } else if (message.type === 'chat_message') {
        setMessages(current => [...current, message].slice(-100));
      } else if (message.type === 'error') {
        onToast(message.detail);
      }
      };
    };

    const refreshIceConfiguration = async () => {
      try {
        const response = await fetch('/api/rooms/ice-config/', { credentials: 'same-origin', cache: 'no-store' });
        if (!response.ok) throw new Error('ICE configuration unavailable');
        const config = await response.json();
        if (disposed) return;
        rtcConfiguration = { iceServers: config.iceServers?.length ? config.iceServers : FALLBACK_ICE_SERVERS };
        setRelayAvailable(Boolean(config.turnEnabled));
        refreshAttempts = 0;
        if (config.credentialExpiresAt) {
          const refreshIn = Math.max(60000, config.credentialExpiresAt * 1000 - Date.now() - 60000);
          credentialRefreshTimer = window.setTimeout(async () => {
            await refreshIceConfiguration();
            if (!disposed) {
              for (const peer of peerConnections.values()) {
                try { peer.connection.setConfiguration(rtcConfiguration); } catch { /* closed peer */ }
              }
              restartAllPeers();
            }
          }, refreshIn);
        }
      } catch {
        if (disposed) return;
        setRelayAvailable(false);
        const retryIn = Math.min(60000, 5000 * (2 ** refreshAttempts++));
        credentialRefreshTimer = window.setTimeout(refreshIceConfiguration, retryIn);
      }
    };

    const handleOnline = () => {
      if (!socketRef.current || socketRef.current.readyState >= WebSocket.CLOSING) connectSocket();
      restartAllPeers();
    };
    window.addEventListener('online', handleOnline);
    refreshIceConfiguration().finally(() => {
      if (!disposed) connectSocket();
    });

    return () => {
      disposed = true;
      if (heartbeatTimer) window.clearInterval(heartbeatTimer);
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      if (credentialRefreshTimer) window.clearTimeout(credentialRefreshTimer);
      window.removeEventListener('online', handleOnline);
      if (socket) {
      socket.onopen = null;
      socket.onclose = null;
      socket.onerror = null;
      socket.onmessage = null;
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) socket.close();
      if (socketRef.current === socket) socketRef.current = null;
      }
      for (const peer of peerConnections.values()) peer.connection.close();
      for (const peer of peerConnections.values()) if (peer.disconnectTimer) window.clearTimeout(peer.disconnectTimer);
      peerConnections.clear();
      setRemoteStreams([]);
    };
  }, [active, room?.code, user?.id]);

  const sendChat = text => {
    const trimmed = text.trim();
    if (!trimmed || trimmed.length > 1000) return false;
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      onToast('Chat is unavailable while the room connection is offline.');
      return false;
    }
    socket.send(JSON.stringify({ type: 'chat', text: trimmed }));
    return true;
  };

  return { participants, remoteStreams, messages, status, relayAvailable, sendChat };
}
