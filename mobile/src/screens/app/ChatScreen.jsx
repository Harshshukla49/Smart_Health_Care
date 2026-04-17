import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { io } from 'socket.io-client';
import {
  mediaDevices,
  RTCIceCandidate,
  RTCPeerConnection,
  RTCSessionDescription,
  RTCView,
} from 'react-native-webrtc';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../config/env';
import {
  getChatMessages,
  getChatThreadContext,
  markChatMessageRead,
  normalizeChatMessage,
} from '../../services/chatService';
import { getPatients } from '../../services/patientService';
import { colors } from '../../theme/colors';

const RTC_CONFIG = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

function formatTime(value) {
  if (!value) {
    return '';
  }
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) {
    return '';
  }
  return dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function MessageBubble({ item, mine }) {
  return (
    <View style={[styles.messageBubble, mine ? styles.messageMine : styles.messageOther]}>
      <Text style={[styles.messageText, mine ? styles.messageTextMine : styles.messageTextOther]}>{item.text}</Text>
      <Text style={[styles.messageMeta, mine ? styles.messageMetaMine : styles.messageMetaOther]}>
        {formatTime(item.createdAt)} {item.readAt ? 'Read' : ''}
      </Text>
    </View>
  );
}

export function ChatScreen() {
  const { session } = useAuth();
  const role = session?.role === 'doctor' ? 'doctor' : 'patient';

  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [contextData, setContextData] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [typing, setTyping] = useState(false);
  const [callState, setCallState] = useState('idle');
  const [callBanner, setCallBanner] = useState('');
  const [incomingCall, setIncomingCall] = useState(null);
  const [localStreamUrl, setLocalStreamUrl] = useState('');
  const [remoteStreamUrl, setRemoteStreamUrl] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);

  const socketRef = useRef(null);
  const listRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const callThreadRef = useRef('');
  const outgoingCallRef = useRef(false);

  const myIdentity = useMemo(() => {
    if (role === 'doctor') {
      return String(session?.email || '').toLowerCase();
    }
    return String(session?.patientId || '');
  }, [role, session?.email, session?.patientId]);

  const loadContext = useCallback(async (patientId = '') => {
    const nextContext = await getChatThreadContext({
      patientId: role === 'doctor' ? patientId || undefined : undefined,
    });
    return nextContext;
  }, [role]);

  const loadMessages = useCallback(async (threadId) => {
    if (!threadId) {
      return [];
    }
    return getChatMessages(threadId, { limit: 80 });
  }, []);

  const stopLocalStream = useCallback(() => {
    if (!localStreamRef.current) {
      return;
    }

    localStreamRef.current.getTracks().forEach((track) => {
      track.stop();
    });
    localStreamRef.current = null;
    setLocalStreamUrl('');
  }, []);

  const closePeerConnection = useCallback(() => {
    if (!peerConnectionRef.current) {
      return;
    }

    try {
      peerConnectionRef.current.close();
    } catch {
      // Ignore cleanup errors from stale peer instances.
    }
    peerConnectionRef.current = null;
    setRemoteStreamUrl('');
  }, []);

  const resetCallState = useCallback(() => {
    setCallState('idle');
    setCallBanner('');
    setIncomingCall(null);
    setIsMuted(false);
    setIsCameraOff(false);
    outgoingCallRef.current = false;
    callThreadRef.current = '';
  }, []);

  const endCallLocally = useCallback((notifyPeer = false) => {
    const activeThread = callThreadRef.current || contextData?.threadId || '';
    if (notifyPeer && socketRef.current?.connected && activeThread) {
      socketRef.current.emit('call:end', { threadId: activeThread });
    }

    closePeerConnection();
    stopLocalStream();
    resetCallState();
  }, [closePeerConnection, contextData?.threadId, resetCallState, stopLocalStream]);

  const ensureLocalStream = useCallback(async () => {
    if (localStreamRef.current) {
      return localStreamRef.current;
    }

    const stream = await mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });

    localStreamRef.current = stream;
    setLocalStreamUrl(stream.toURL());
    return stream;
  }, []);

  const createPeerConnection = useCallback(async (threadId) => {
    closePeerConnection();

    const stream = await ensureLocalStream();
    const connection = new RTCPeerConnection(RTC_CONFIG);
    peerConnectionRef.current = connection;
    callThreadRef.current = threadId;

    stream.getTracks().forEach((track) => {
      connection.addTrack(track, stream);
    });

    connection.onicecandidate = (event) => {
      if (event?.candidate && socketRef.current?.connected) {
        socketRef.current.emit('webrtc:ice_candidate', {
          threadId,
          candidate: event.candidate,
        });
      }
    };

    connection.ontrack = (event) => {
      const nextStream = event?.streams?.[0];
      if (nextStream) {
        setRemoteStreamUrl(nextStream.toURL());
      }
    };

    connection.onconnectionstatechange = () => {
      const state = connection.connectionState;
      if (state === 'connected') {
        setCallState('in-call');
        setCallBanner('Media stream connected.');
      }

      if (state === 'failed' || state === 'disconnected' || state === 'closed') {
        endCallLocally(false);
      }
    };

    return connection;
  }, [closePeerConnection, endCallLocally, ensureLocalStream]);

  useEffect(() => {
    let active = true;

    const init = async () => {
      setLoading(true);
      try {
        if (role === 'doctor') {
          const rows = await getPatients();
          if (!active) {
            return;
          }
          setPatients(rows);
          const seedPatientId = String(rows[0]?.id || rows[0]?.patientId || '');
          setSelectedPatientId(seedPatientId);
          const nextContext = await loadContext(seedPatientId);
          if (!active) {
            return;
          }
          setContextData(nextContext);
          const history = await loadMessages(nextContext?.threadId);
          if (!active) {
            return;
          }
          setMessages(history);
        } else {
          const nextContext = await loadContext();
          if (!active) {
            return;
          }
          setContextData(nextContext);
          const history = await loadMessages(nextContext?.threadId);
          if (!active) {
            return;
          }
          setMessages(history);
        }

        setError('');
      } catch (requestError) {
        if (active) {
          setError(requestError?.response?.data?.message || requestError?.message || 'Unable to load chat.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    init();
    return () => {
      active = false;
    };
  }, [loadContext, loadMessages, role]);

  useEffect(() => {
    if (role !== 'doctor' || !selectedPatientId) {
      return;
    }

    let active = true;
    const refreshForPatient = async () => {
      try {
        const nextContext = await loadContext(selectedPatientId);
        if (!active) {
          return;
        }
        setContextData(nextContext);
        const history = await loadMessages(nextContext?.threadId);
        if (!active) {
          return;
        }
        setMessages(history);
      } catch {
        // keep current state to avoid jitter while switching.
      }
    };

    refreshForPatient();
    return () => {
      active = false;
    };
  }, [loadContext, loadMessages, role, selectedPatientId]);

  useEffect(() => {
    if (!session?.token || !contextData?.threadId) {
      return undefined;
    }

    const socket = io(API_BASE_URL, {
      transports: ['websocket', 'polling'],
      auth: { token: session.token },
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('chat:join_thread', { threadId: contextData.threadId });
      socket.emit('chat:presence_ping', {});
    });

    socket.on('chat:error', (payload) => {
      setError(String(payload?.message || 'Chat socket error'));
    });

    socket.on('chat:history', (payload) => {
      const rows = Array.isArray(payload?.messages) ? payload.messages.map(normalizeChatMessage) : [];
      setMessages(rows);
    });

    socket.on('chat:new_message', (payload) => {
      const next = normalizeChatMessage(payload);
      if (!next?.id) {
        return;
      }

      setMessages((current) => {
        if (current.some((row) => String(row.id) === String(next.id))) {
          return current;
        }
        return [...current, next];
      });
    });

    socket.on('chat:message_read', (payload) => {
      const targetId = String(payload?.messageId || '');
      if (!targetId) {
        return;
      }

      setMessages((current) =>
        current.map((row) =>
          String(row.id) === targetId
            ? { ...row, readAt: payload?.readAt || row.readAt, status: payload?.status || row.status }
            : row
        )
      );
    });

    socket.on('chat:typing', (payload) => {
      const fromId = String(payload?.userId || '');
      const mine = String(myIdentity || '') === fromId;
      if (!mine) {
        setTyping(Boolean(payload?.typing));
      }
    });

    socket.on('call:incoming', (payload) => {
      setIncomingCall(payload || {});
      setCallState('incoming');
      setCallBanner(`Incoming call from ${payload?.fromName || 'partner'}`);
    });

    socket.on('call:outgoing', () => {
      setCallState('ringing');
      setCallBanner('Calling...');
      outgoingCallRef.current = true;
    });

    socket.on('call:accepted', async (payload) => {
      const threadId = String(payload?.threadId || contextData?.threadId || '');
      if (!outgoingCallRef.current || !threadId) {
        return;
      }

      try {
        const connection = await createPeerConnection(threadId);
        const offer = await connection.createOffer();
        await connection.setLocalDescription(offer);

        socketRef.current?.emit('webrtc:offer', {
          threadId,
          sdp: offer,
        });

        setIncomingCall(null);
        setCallState('connecting');
        setCallBanner('Connecting media stream...');
      } catch (mediaError) {
        setCallBanner(mediaError?.message || 'Unable to start media stream.');
        endCallLocally(true);
      }
    });

    socket.on('call:rejected', () => {
      setIncomingCall(null);
      setCallState('idle');
      setCallBanner('Call rejected.');
    });

    socket.on('call:ended', () => {
      setCallBanner('Call ended.');
      endCallLocally(false);
    });

    socket.on('call:missed', () => {
      setCallBanner('Partner unavailable.');
      endCallLocally(false);
    });

    socket.on('call:error', (payload) => {
      setCallBanner(String(payload?.message || 'Call signaling error'));
      endCallLocally(false);
    });

    socket.on('webrtc:offer', async (payload) => {
      const threadId = String(payload?.threadId || contextData?.threadId || '');
      if (!threadId || !payload?.sdp) {
        return;
      }

      try {
        const connection = await createPeerConnection(threadId);
        await connection.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        const answer = await connection.createAnswer();
        await connection.setLocalDescription(answer);

        socketRef.current?.emit('webrtc:answer', {
          threadId,
          sdp: answer,
        });

        setCallState('connecting');
        setCallBanner('Connecting media stream...');
      } catch (mediaError) {
        setCallBanner(mediaError?.message || 'Failed to accept media stream.');
        endCallLocally(true);
      }
    });

    socket.on('webrtc:answer', async (payload) => {
      if (!peerConnectionRef.current || !payload?.sdp) {
        return;
      }

      try {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      } catch {
        // Ignore transient duplicate-answer errors.
      }
    });

    socket.on('webrtc:ice_candidate', async (payload) => {
      if (!peerConnectionRef.current || !payload?.candidate) {
        return;
      }

      try {
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(payload.candidate));
      } catch {
        // Ignore race where candidate arrives before remote description is ready.
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setTyping(false);
    };
  }, [contextData?.threadId, createPeerConnection, endCallLocally, myIdentity, session?.token]);

  useEffect(() => {
    return () => {
      endCallLocally(false);
    };
  }, [endCallLocally]);

  useEffect(() => {
    if (messages.length) {
      listRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages]);

  useEffect(() => {
    const unread = messages
      .filter((row) => String(row.receiverId || '') === String(myIdentity || ''))
      .filter((row) => !row.readAt)
      .slice(-20);

    if (!unread.length || !contextData?.threadId) {
      return;
    }

    unread.forEach((row) => {
      if (socketRef.current?.connected) {
        socketRef.current.emit('chat:mark_read', {
          threadId: contextData.threadId,
          messageId: row.id,
        });
      } else {
        markChatMessageRead({ messageId: row.id, threadId: contextData.threadId }).catch(() => {});
      }
    });
  }, [contextData?.threadId, messages, myIdentity]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending || !contextData?.threadId) {
      return;
    }

    setSending(true);
    try {
      socketRef.current?.emit('chat:typing', {
        threadId: contextData.threadId,
        typing: false,
      });

      socketRef.current?.emit('chat:send_message', {
        threadId: contextData.threadId,
        receiverId: contextData.partnerId,
        text,
      });

      setInput('');
      setError('');
    } catch (requestError) {
      setError(requestError?.response?.data?.message || requestError?.message || 'Unable to send message.');
    } finally {
      setSending(false);
    }
  };

  const handleType = (value) => {
    setInput(value);
    if (!contextData?.threadId) {
      return;
    }
    socketRef.current?.emit('chat:typing', {
      threadId: contextData.threadId,
      typing: Boolean(String(value || '').trim()),
    });
  };

  const requestCall = () => {
    if (!contextData?.threadId) {
      return;
    }

    socketRef.current?.emit('call:request', { threadId: contextData.threadId });
    setCallState('ringing');
    setCallBanner('Calling...');
    outgoingCallRef.current = true;
    callThreadRef.current = contextData.threadId;
  };

  const acceptCall = async () => {
    if (!incomingCall?.threadId) {
      return;
    }

    try {
      await ensureLocalStream();
      socketRef.current?.emit('call:accept', { threadId: incomingCall.threadId });
      callThreadRef.current = incomingCall.threadId;
      setIncomingCall(null);
      setCallState('connecting');
      setCallBanner('Connecting media stream...');
    } catch (mediaError) {
      setCallBanner(mediaError?.message || 'Camera/mic permission is required.');
    }
  };

  const rejectCall = () => {
    if (!incomingCall?.threadId) {
      return;
    }

    socketRef.current?.emit('call:reject', { threadId: incomingCall.threadId });
    setCallBanner('Call rejected.');
    endCallLocally(false);
  };

  const endCall = () => {
    setCallBanner('Call ended.');
    endCallLocally(true);
  };

  const toggleMute = () => {
    if (!localStreamRef.current) {
      return;
    }

    const nextMuted = !isMuted;
    localStreamRef.current.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });
    setIsMuted(nextMuted);
  };

  const toggleCamera = () => {
    if (!localStreamRef.current) {
      return;
    }

    const nextCameraOff = !isCameraOff;
    localStreamRef.current.getVideoTracks().forEach((track) => {
      track.enabled = !nextCameraOff;
    });
    setIsCameraOff(nextCameraOff);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>Loading chat...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Chat</Text>
        <Text style={styles.subtitle}>Secure one-to-one conversation</Text>

        {role === 'doctor' ? (
          <View style={styles.patientRow}>
            {patients.slice(0, 4).map((row) => {
              const id = String(row.id || row.patientId || '');
              const active = id && id === selectedPatientId;
              return (
                <Pressable
                  key={id || row.name}
                  style={[styles.patientChip, active ? styles.patientChipActive : null]}
                  onPress={() => setSelectedPatientId(id)}
                >
                  <Text style={[styles.patientChipText, active ? styles.patientChipTextActive : null]} numberOfLines={1}>
                    {row.name || id}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <View style={styles.contextCard}>
          <Text style={styles.contextTitle}>{contextData?.partnerName || 'Partner'}</Text>
          <Text style={styles.contextMeta}>Thread: {contextData?.threadId || 'N/A'}</Text>
          {callBanner ? <Text style={styles.callBanner}>{callBanner}</Text> : null}

          <View style={styles.callActions}>
            {callState !== 'in-call' && callState !== 'connecting' ? (
              <Pressable style={styles.callButton} onPress={requestCall}>
                <Text style={styles.callButtonText}>Call</Text>
              </Pressable>
            ) : (
              <Pressable style={styles.callEndButton} onPress={endCall}>
                <Text style={styles.callButtonText}>End</Text>
              </Pressable>
            )}

            {incomingCall ? (
              <>
                <Pressable style={styles.acceptButton} onPress={acceptCall}>
                  <Text style={styles.callButtonText}>Accept</Text>
                </Pressable>
                <Pressable style={styles.rejectButton} onPress={rejectCall}>
                  <Text style={styles.callButtonText}>Reject</Text>
                </Pressable>
              </>
            ) : null}

            {(callState === 'in-call' || callState === 'connecting') ? (
              <>
                <Pressable style={styles.callButton} onPress={toggleMute}>
                  <Text style={styles.callButtonText}>{isMuted ? 'Unmute' : 'Mute'}</Text>
                </Pressable>
                <Pressable style={styles.callButton} onPress={toggleCamera}>
                  <Text style={styles.callButtonText}>{isCameraOff ? 'Camera On' : 'Camera Off'}</Text>
                </Pressable>
              </>
            ) : null}
          </View>
        </View>

        {(callState === 'in-call' || callState === 'connecting' || callState === 'ringing' || callState === 'incoming') ? (
          <View style={styles.mediaSection}>
            <View style={styles.remoteWrap}>
              {remoteStreamUrl ? (
                <RTCView streamURL={remoteStreamUrl} style={styles.remoteVideo} objectFit="cover" />
              ) : (
                <View style={styles.videoPlaceholder}><Text style={styles.videoPlaceholderText}>Waiting for remote video...</Text></View>
              )}
            </View>

            <View style={styles.localWrap}>
              {localStreamUrl ? (
                <RTCView streamURL={localStreamUrl} style={styles.localVideo} objectFit="cover" mirror />
              ) : (
                <View style={styles.videoPlaceholder}><Text style={styles.videoPlaceholderText}>Camera preview</Text></View>
              )}
            </View>
          </View>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {typing ? <Text style={styles.typing}>Partner is typing...</Text> : null}

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item, index) => `${item.id || 'message'}-${index}`}
          contentContainerStyle={styles.messagesContainer}
          renderItem={({ item }) => (
            <MessageBubble
              item={item}
              mine={String(item.senderId || '') === String(myIdentity || '')}
            />
          )}
        />

        <View style={styles.inputRow}>
          <TextInput
            value={input}
            onChangeText={handleType}
            placeholder="Type a message"
            style={styles.input}
          />
          <Pressable style={styles.sendButton} disabled={sending} onPress={handleSend}>
            <Text style={styles.sendButtonText}>{sending ? '...' : 'Send'}</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, padding: 14 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { color: colors.textSecondary },
  title: { fontSize: 28, fontWeight: '700', color: colors.textPrimary },
  subtitle: { color: colors.textSecondary, marginBottom: 8 },
  patientRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  patientChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: colors.surface,
    maxWidth: 170,
  },
  patientChipActive: { borderColor: colors.primary, backgroundColor: '#e0f2fe' },
  patientChipText: { color: colors.textPrimary, fontSize: 12 },
  patientChipTextActive: { color: colors.primaryDark, fontWeight: '700' },
  contextCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 12,
    marginBottom: 8,
  },
  contextTitle: { color: colors.textPrimary, fontWeight: '700', fontSize: 16 },
  contextMeta: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  callBanner: { color: colors.primaryDark, marginTop: 6, fontSize: 12 },
  callActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  callButton: { backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  callEndButton: { backgroundColor: colors.danger, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  acceptButton: { backgroundColor: '#16a34a', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  rejectButton: { backgroundColor: '#b91c1c', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  callButtonText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  mediaSection: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#0b1220',
    padding: 8,
    marginBottom: 8,
    gap: 8,
  },
  remoteWrap: {
    borderRadius: 10,
    overflow: 'hidden',
    height: 180,
    backgroundColor: '#111827',
  },
  localWrap: {
    borderRadius: 10,
    overflow: 'hidden',
    height: 120,
    backgroundColor: '#111827',
  },
  remoteVideo: { width: '100%', height: '100%' },
  localVideo: { width: '100%', height: '100%' },
  videoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoPlaceholderText: { color: '#9ca3af', fontSize: 12 },
  error: { color: colors.danger, marginBottom: 4 },
  typing: { color: colors.textSecondary, marginBottom: 6, fontSize: 12 },
  messagesContainer: { paddingBottom: 6, gap: 8 },
  messageBubble: { maxWidth: '80%', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 8 },
  messageMine: { alignSelf: 'flex-end', backgroundColor: colors.primary },
  messageOther: { alignSelf: 'flex-start', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  messageText: { fontSize: 14 },
  messageTextMine: { color: '#fff' },
  messageTextOther: { color: colors.textPrimary },
  messageMeta: { marginTop: 4, fontSize: 10 },
  messageMetaMine: { color: '#dbeafe', textAlign: 'right' },
  messageMetaOther: { color: colors.textSecondary },
  inputRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 6 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.surface,
  },
  sendButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  sendButtonText: { color: '#fff', fontWeight: '700' },
});
