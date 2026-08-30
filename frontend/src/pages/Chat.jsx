import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { Link, useSearchParams } from 'react-router-dom';
import { MessageCircle, Mic, MicOff, Phone, PhoneOff, Send, Video, VideoOff, Wifi, WifiOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { DashboardLayout } from '../components/DashboardLayout';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { getPatients, getChatMessages, getChatThreadContext, markChatMessageRead, sendChatMessage } from '../services/api';
import { getAuthSession } from '../utils/auth';
import { useVideoCall } from '../context/VideoCallContext';

const SOCKET_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://smart-health-backend-2idf.onrender.com';
const PRESENCE_PING_MS = 20000;
const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
  ],
};

const toTime = (isoValue) => {
  if (!isoValue) {
    return '';
  }

  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const toLastSeen = (isoValue) => {
  if (!isoValue) {
    return 'offline';
  }

  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) {
    return 'offline';
  }

  const diffSeconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (diffSeconds < 60) {
    return 'last seen just now';
  }

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `last seen ${diffMinutes}m ago`;
  }

  return `last seen ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
};

const getUnreadCount = (rows, receiverId) => {
  const target = String(receiverId || '').trim().toLowerCase();
  if (!target) {
    return 0;
  }

  return rows.filter((row) => {
    const incoming = String(row?.receiverId || '').trim().toLowerCase();
    return incoming === target && !row?.readAt;
  }).length;
};

const getLatestText = (rows) => {
  if (!Array.isArray(rows) || !rows.length) {
    return 'No messages yet';
  }

  const last = rows[rows.length - 1] || {};
  const text = String(last.text || '').trim();
  return text || 'No messages yet';
};

export function Chat() {
  const session = getAuthSession();
  const role = session?.role === 'doctor' ? 'doctor' : 'patient';
  const { openDialer, startCall } = useVideoCall();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedPatientId = searchParams.get('patientId') || '';
  const [doctorPatients, setDoctorPatients] = useState([]);

  const [contextData, setContextData] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [partnerOnline, setPartnerOnline] = useState(false);
  const [partnerLastSeen, setPartnerLastSeen] = useState('');
  const [socketReady, setSocketReady] = useState(false);
  const [typing, setTyping] = useState(false);
  const [conversationItems, setConversationItems] = useState([]);
  const [listLoading, setListLoading] = useState(false);

  const socketRef = useRef(null);
  const pingRef = useRef(null);
  const scrollAnchorRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const currentCallThreadRef = useRef('');
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  const [incomingCall, setIncomingCall] = useState(null);
  const [outgoingCall, setOutgoingCall] = useState(false);
  const [callActive, setCallActive] = useState(false);
  const [callStatus, setCallStatus] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);

  const partnerKey = useMemo(() => {
    if (!contextData?.partnerRole || !contextData?.partnerId) {
      return '';
    }

    return `${String(contextData.partnerRole).toLowerCase()}:${String(contextData.partnerId).toLowerCase()}`;
  }, [contextData]);

  useEffect(() => {
    let active = true;

    const loadDoctorPatients = async () => {
      if (role !== 'doctor') {
        return;
      }

      try {
        const rows = await getPatients();
        if (active) {
          const normalized = Array.isArray(rows) ? rows : [];
          setDoctorPatients(normalized);

          if (!selectedPatientId && normalized[0]?.id) {
            setSearchParams({ patientId: String(normalized[0].id) }, { replace: true });
          }
        }
      } catch {
        if (active) {
          setDoctorPatients([]);
        }
      }
    };

    loadDoctorPatients();
    return () => {
      active = false;
    };
  }, [role, selectedPatientId, setSearchParams]);

  useEffect(() => {
    let active = true;

    const loadContextAndHistory = async () => {
      if (!session?.token) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const nextContext = await getChatThreadContext({
          patientId: role === 'doctor' ? selectedPatientId : undefined,
        });

        if (!active) {
          return;
        }

        setContextData(nextContext);
        setPartnerOnline(Boolean(nextContext?.partnerPresence?.online));
        setPartnerLastSeen(String(nextContext?.partnerPresence?.lastSeen || ''));

        const initialMessages = await getChatMessages(nextContext.threadId, { limit: 80 });
        if (!active) {
          return;
        }

        setMessages(initialMessages);
      } catch (error) {
        if (active) {
          toast.error(error?.response?.data?.message || 'Unable to load chat thread.');
          setContextData(null);
          setMessages([]);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadContextAndHistory();
    return () => {
      active = false;
    };
  }, [role, selectedPatientId, session?.token]);

  useEffect(() => {
    let active = true;

    const loadConversationList = async () => {
      if (!session?.token) {
        setConversationItems([]);
        return;
      }

      if (role !== 'doctor') {
        if (contextData?.threadId) {
          setConversationItems([
            {
              threadId: contextData.threadId,
              patientId: contextData.patientId,
              partnerName: contextData.partnerName || 'Doctor',
              preview: messages.length ? getLatestText(messages) : 'No messages yet',
              unreadCount: 0,
              updatedAt: messages.length ? (messages[messages.length - 1]?.createdAt || '') : '',
            },
          ]);
        }
        return;
      }

      if (!doctorPatients.length) {
        setConversationItems([]);
        return;
      }

      setListLoading(true);
      try {
        const scopedPatients = doctorPatients.slice(0, 10);
        const myReceiverId = String(session?.email || '').trim().toLowerCase();
        const items = await Promise.all(scopedPatients.map(async (patient) => {
          const patientId = String(patient.id || '').trim();
          if (!patientId) {
            return null;
          }

          try {
            const thread = await getChatThreadContext({ patientId });
            if (!thread?.threadId) {
              return null;
            }

            const rows = await getChatMessages(thread.threadId, { limit: 25 });
            const unreadCount = getUnreadCount(rows, myReceiverId);
            const latest = rows.length ? rows[rows.length - 1] : null;

            return {
              threadId: thread.threadId,
              patientId,
              partnerName: patient.name || thread.partnerName || patientId,
              preview: getLatestText(rows),
              unreadCount,
              updatedAt: latest?.createdAt || '',
            };
          } catch {
            return {
              threadId: '',
              patientId,
              partnerName: patient.name || patientId,
              preview: 'Conversation unavailable',
              unreadCount: 0,
              updatedAt: '',
            };
          }
        }));

        if (active) {
          const normalized = items.filter(Boolean);
          normalized.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
          setConversationItems(normalized);
        }
      } finally {
        if (active) {
          setListLoading(false);
        }
      }
    };

    loadConversationList();
    return () => {
      active = false;
    };
  }, [contextData?.partnerName, contextData?.patientId, contextData?.threadId, doctorPatients, messages, role, session?.email, session?.token]);

  useEffect(() => {
    if (!session?.token || !contextData?.threadId) {
      return undefined;
    }

    const socket = io(SOCKET_BASE_URL, {
      transports: ['websocket', 'polling'],
      auth: {
        token: session.token,
      },
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setSocketReady(true);
      socket.emit('chat:join_thread', {
        threadId: contextData.threadId,
      });
      socket.emit('chat:presence_ping', {});
    });

    socket.on('disconnect', () => {
      setSocketReady(false);
    });

    socket.on('chat:error', (payload) => {
      if (payload?.message) {
        toast.error(payload.message);
      }
    });

    socket.on('call:error', (payload) => {
      if (payload?.message) {
        toast.error(payload.message);
      }
    });

    socket.on('call:incoming', (payload) => {
      if (payload?.threadId !== contextData.threadId) {
        return;
      }
      setIncomingCall(payload);
      setCallStatus('Incoming call...');
    });

    socket.on('call:outgoing', (payload) => {
      if (payload?.threadId !== contextData.threadId) {
        return;
      }
      setOutgoingCall(true);
      setCallStatus('Ringing...');
    });

    socket.on('call:accepted', async (payload) => {
      if (payload?.threadId !== contextData.threadId) {
        return;
      }

      try {
        await ensureLocalStream();
        const connection = createPeerConnection(contextData.threadId);
        const offer = await connection.createOffer();
        await connection.setLocalDescription(offer);

        socket.emit('webrtc:offer', {
          threadId: contextData.threadId,
          sdp: offer,
        });

        setOutgoingCall(false);
        setCallActive(true);
        setCallStatus('Connecting...');
      } catch (error) {
        toast.error(error?.message || 'Unable to start video call.');
        endCallLocally({ notifyPeer: true });
      }
    });

    socket.on('call:rejected', (payload) => {
      if (payload?.threadId !== contextData.threadId) {
        return;
      }
      setOutgoingCall(false);
      setCallStatus('Call rejected');
      endCallLocally({ notifyPeer: false });
    });

    socket.on('call:ended', (payload) => {
      if (payload?.threadId !== contextData.threadId) {
        return;
      }
      setCallStatus('Call ended');
      endCallLocally({ notifyPeer: false });
    });

    socket.on('call:missed', (payload) => {
      if (payload?.threadId !== contextData.threadId) {
        return;
      }
      setOutgoingCall(false);
      setCallStatus('Partner is unavailable');
    });

    socket.on('webrtc:offer', async (payload) => {
      if (payload?.threadId !== contextData.threadId) {
        return;
      }

      try {
        await ensureLocalStream();
        const connection = createPeerConnection(contextData.threadId);
        await connection.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        const answer = await connection.createAnswer();
        await connection.setLocalDescription(answer);

        socket.emit('webrtc:answer', {
          threadId: contextData.threadId,
          sdp: answer,
        });

        setCallActive(true);
        setCallStatus('Connecting...');
      } catch (error) {
        toast.error(error?.message || 'Unable to accept video call.');
        endCallLocally({ notifyPeer: true });
      }
    });

    socket.on('webrtc:answer', async (payload) => {
      if (payload?.threadId !== contextData.threadId || !peerConnectionRef.current) {
        return;
      }

      try {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      } catch {
        toast.error('Failed to establish remote video session.');
      }
    });

    socket.on('webrtc:ice_candidate', async (payload) => {
      if (payload?.threadId !== contextData.threadId || !peerConnectionRef.current || !payload?.candidate) {
        return;
      }

      try {
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(payload.candidate));
      } catch {
        // Ignore candidate race conditions while negotiation settles.
      }
    });

    socket.on('chat:history', (payload) => {
      if (payload?.threadId !== contextData.threadId) {
        return;
      }
      const rows = Array.isArray(payload?.messages) ? payload.messages : [];
      setMessages(rows);
    });

    socket.on('chat:new_message', (payload) => {
      if (payload?.threadId !== contextData.threadId || !payload?.id) {
        return;
      }

      setMessages((current) => {
        const exists = current.some((row) => String(row.id) === String(payload.id));
        if (exists) {
          return current;
        }
        return [...current, payload];
      });

      const fromPartner = String(payload?.senderId || '') === String(contextData.partnerId || '');
      if (fromPartner) {
        socket.emit('chat:mark_read', {
          threadId: contextData.threadId,
          messageId: payload.id,
        });
      }
    });

    socket.on('chat:message_read', (payload) => {
      if (payload?.threadId !== contextData.threadId || !payload?.messageId) {
        return;
      }

      setMessages((current) => current.map((row) => (
        String(row.id) === String(payload.messageId)
          ? { ...row, status: 'read', readAt: payload.readAt || row.readAt }
          : row
      )));
    });

    socket.on('chat:presence_update', (payload) => {
      if (!partnerKey || String(payload?.userKey || '').toLowerCase() !== partnerKey) {
        return;
      }

      setPartnerOnline(Boolean(payload?.online));
      setPartnerLastSeen(String(payload?.lastSeen || ''));
    });

    socket.on('chat:typing', (payload) => {
      if (payload?.threadId !== contextData.threadId) {
        return;
      }

      const fromPartner = String(payload?.userId || '') === String(contextData.partnerId || '');
      if (!fromPartner) {
        return;
      }

      setTyping(Boolean(payload?.typing));
    });

    pingRef.current = window.setInterval(() => {
      socket.emit('chat:presence_ping', {});
    }, PRESENCE_PING_MS);

    return () => {
      if (pingRef.current) {
        window.clearInterval(pingRef.current);
        pingRef.current = null;
      }
      endCallLocally({ notifyPeer: false });
      socket.disconnect();
      socketRef.current = null;
      setSocketReady(false);
      setTyping(false);
    };
  }, [contextData?.partnerId, contextData?.threadId, createPeerConnection, endCallLocally, ensureLocalStream, partnerKey, session?.token]);

  useEffect(() => {
    if (!messages.length) {
      return;
    }

    const unreadFromPartner = messages
      .filter((row) => String(row.senderId || '') === String(contextData?.partnerId || ''))
      .filter((row) => String(row.receiverId || '') === String(role === 'doctor' ? session?.email || '' : session?.patientId || ''))
      .filter((row) => !row.readAt)
      .slice(-15);

    if (!unreadFromPartner.length) {
      return;
    }

    unreadFromPartner.forEach((row) => {
      if (socketRef.current?.connected) {
        socketRef.current.emit('chat:mark_read', {
          threadId: contextData?.threadId,
          messageId: row.id,
        });
      } else {
        markChatMessageRead({ messageId: row.id, threadId: contextData?.threadId }).catch(() => {
          // Ignore transient read update errors to avoid interrupting chat flow.
        });
      }
    });
  }, [contextData?.partnerId, contextData?.threadId, messages, role, session?.email, session?.patientId]);

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  const stopLocalStream = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
  }, []);

  const closePeerConnection = useCallback(() => {
    if (peerConnectionRef.current) {
      try {
        peerConnectionRef.current.close();
      } catch {
        // Ignore close errors during cleanup.
      }
      peerConnectionRef.current = null;
    }
  }, []);

  const resetCallState = useCallback(() => {
    setCallActive(false);
    setOutgoingCall(false);
    setIncomingCall(null);
    setCallStatus('');
    setIsMuted(false);
    setIsCameraOff(false);
    currentCallThreadRef.current = '';
  }, []);

  const endCallLocally = useCallback(({ notifyPeer = false } = {}) => {
    const activeThreadId = currentCallThreadRef.current || contextData?.threadId || '';
    if (notifyPeer && socketRef.current?.connected && activeThreadId) {
      socketRef.current.emit('call:end', { threadId: activeThreadId });
    }

    closePeerConnection();
    stopLocalStream();
    resetCallState();
  }, [closePeerConnection, contextData?.threadId, resetCallState, stopLocalStream]);

  const ensureLocalStream = useCallback(async () => {
    if (localStreamRef.current) {
      return localStreamRef.current;
    }

    if (!navigator?.mediaDevices?.getUserMedia) {
      throw new Error('Camera access is not supported in this browser.');
    }

    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localStreamRef.current = stream;
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }
    return stream;
  }, []);

  const createPeerConnection = useCallback((threadId) => {
    closePeerConnection();

    const connection = new RTCPeerConnection(RTC_CONFIG);
    peerConnectionRef.current = connection;
    currentCallThreadRef.current = threadId;

    connection.onicecandidate = (event) => {
      if (event.candidate && socketRef.current?.connected) {
        socketRef.current.emit('webrtc:ice_candidate', {
          threadId,
          candidate: event.candidate,
        });
      }
    };

    connection.ontrack = (event) => {
      const [remoteStream] = event.streams || [];
      if (remoteVideoRef.current && remoteStream) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
    };

    connection.onconnectionstatechange = () => {
      const state = connection.connectionState;
      if (state === 'connected') {
        setCallStatus('Connected');
      }

      if (state === 'failed' || state === 'disconnected' || state === 'closed') {
        endCallLocally({ notifyPeer: false });
      }
    };

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        connection.addTrack(track, localStreamRef.current);
      });
    }

    return connection;
  }, [closePeerConnection, endCallLocally]);

  const startOutgoingCall = useCallback(async () => {
    if (!contextData?.threadId || !socketRef.current?.connected) {
      toast.error('Realtime connection is not ready for calling.');
      return;
    }

    setOutgoingCall(true);
    setCallStatus('Calling...');
    socketRef.current.emit('call:request', {
      threadId: contextData.threadId,
    });
  }, [contextData?.threadId]);

  const acceptIncomingCall = useCallback(async () => {
    if (!incomingCall?.threadId || !socketRef.current?.connected) {
      return;
    }

    try {
      await ensureLocalStream();
      setCallActive(true);
      setCallStatus('Connecting...');
      currentCallThreadRef.current = incomingCall.threadId;
      socketRef.current.emit('call:accept', {
        threadId: incomingCall.threadId,
      });
      setIncomingCall(null);
    } catch (error) {
      toast.error(error?.message || 'Unable to access camera/microphone.');
    }
  }, [ensureLocalStream, incomingCall]);

  const rejectIncomingCall = useCallback(() => {
    if (incomingCall?.threadId && socketRef.current?.connected) {
      socketRef.current.emit('call:reject', {
        threadId: incomingCall.threadId,
      });
    }
    setIncomingCall(null);
    setCallStatus('Call rejected');
  }, [incomingCall]);

  const toggleMute = useCallback(() => {
    const nextMuted = !isMuted;
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !nextMuted;
      });
    }
    setIsMuted(nextMuted);
  }, [isMuted]);

  const toggleCamera = useCallback(() => {
    const nextCameraOff = !isCameraOff;
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = !nextCameraOff;
      });
    }
    setIsCameraOff(nextCameraOff);
  }, [isCameraOff]);

  useEffect(() => {
    return () => {
      closePeerConnection();
      stopLocalStream();
    };
  }, [closePeerConnection, stopLocalStream]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) {
      return;
    }

    let activeThread = contextData;
    if (!activeThread?.threadId) {
      try {
        const refreshedContext = await getChatThreadContext({
          patientId: role === 'doctor' ? selectedPatientId : undefined,
        });

        if (refreshedContext?.threadId) {
          activeThread = refreshedContext;
          setContextData(refreshedContext);
          setPartnerOnline(Boolean(refreshedContext?.partnerPresence?.online));
          setPartnerLastSeen(String(refreshedContext?.partnerPresence?.lastSeen || ''));
        }
      } catch {
        // Fall through to the user-facing error below.
      }
    }

    if (!activeThread?.threadId) {
      toast.error('Chat thread is not ready yet. Please wait a moment and try again.');
      return;
    }

    setSending(true);
    setInput('');

    try {
      const sent = await sendChatMessage({
        threadId: activeThread.threadId,
        text,
        receiverId: activeThread.partnerId,
      });

      if (sent?.id) {
        setMessages((current) => {
          const exists = current.some((row) => String(row.id) === String(sent.id));
          if (exists) {
            return current;
          }

          return [...current, sent];
        });
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Message could not be sent.');
      setInput(text);
    } finally {
      setSending(false);
    }
  };

  const handleType = (value) => {
    setInput(value);
    if (!socketRef.current?.connected || !contextData?.threadId) {
      return;
    }

    socketRef.current.emit('chat:typing', {
      threadId: contextData.threadId,
      typing: Boolean(value.trim()),
    });
  };

  return (
    <DashboardLayout
      title="Realtime Chat"
      subtitle="Doctor and patient one-to-one secure conversation"
      backLabel="Back to Dashboard"
    >
      <div className="space-y-4 sm:space-y-5 lg:space-y-6">
        <Card className="overflow-hidden p-0">
          <div className="grid min-h-0 lg:min-h-[640px] lg:grid-cols-[280px_1fr]">
            <aside className="border-b border-white/10 bg-slate-950/75 lg:border-b-0 lg:border-r">
              <div className="border-b border-white/10 px-3 py-3 sm:px-4 sm:py-4">
                <p className="text-[9px] uppercase tracking-[0.32em] text-cyan-300 sm:text-xs">{role === 'doctor' ? 'Patient chats' : 'Doctor chat'}</p>
                <h3 className="mt-0.5 text-base font-semibold text-white sm:mt-1 sm:text-lg">{role === 'doctor' ? 'Patients' : 'Doctor'}</h3>
              </div>

              <div className="max-h-[42vh] space-y-1 overflow-y-auto p-1.5 sm:max-h-[46vh] sm:p-2 lg:max-h-[calc(100vh-19rem)]">
                {listLoading ? <p className="px-2 py-2 text-xs text-slate-400 sm:px-3 sm:text-sm">Loading conversations...</p> : null}

                {!listLoading && !conversationItems.length ? (
                  <p className="px-2 py-2 text-xs text-slate-400 sm:px-3 sm:text-sm">No conversations.</p>
                ) : null}

                {conversationItems.map((item) => {
                  const isActive = role === 'doctor'
                    ? String(item.patientId || '') === String(selectedPatientId || '')
                    : String(item.threadId || '') === String(contextData?.threadId || '');

                  return (
                    <button
                      key={`${item.threadId || item.patientId}`}
                      type="button"
                      onClick={() => {
                        if (role === 'doctor' && item.patientId) {
                          setSearchParams({ patientId: String(item.patientId) }, { replace: true });
                        }
                      }}
                      className={[
                        'w-full rounded-lg border px-2 py-2 text-left transition sm:rounded-2xl sm:px-3 sm:py-3',
                        isActive
                          ? 'border-cyan-300/45 bg-cyan-300/12'
                          : 'border-white/10 bg-white/[0.03] hover:border-cyan-300/30 hover:bg-white/[0.06]',
                      ].join(' ')}
                    >
                      <div className="flex items-start justify-between gap-1.5 sm:gap-2">
                        <p className="line-clamp-1 text-xs font-semibold text-white sm:text-sm">{item.partnerName}</p>
                        {item.unreadCount > 0 ? (
                          <span className="inline-flex min-w-5 flex-shrink-0 items-center justify-center rounded-full bg-cyan-400 px-1.5 py-0.5 text-[10px] font-semibold text-slate-950 sm:min-w-6">
                            {item.unreadCount}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-300 sm:mt-1 sm:text-xs">{item.preview}</p>
                      <p className="mt-0.5 text-[10px] text-slate-500 sm:mt-1 sm:text-[11px]">{toTime(item.updatedAt)}</p>
                    </button>
                  );
                })}
              </div>
            </aside>

            <section className="flex min-h-0 flex-col">
              <div className="border-b border-white/10 bg-white/[0.03] px-3 py-3 sm:px-5 sm:py-4">
            <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
              <div className="min-w-0">
                <p className="text-[9px] uppercase tracking-[0.28em] text-cyan-300 sm:text-xs">{role === 'doctor' ? 'Patient Chat' : 'Doctor Chat'}</p>
                <h2 className="mt-0.5 truncate font-display text-lg font-bold text-white sm:mt-1 sm:text-2xl">
                  {contextData?.partnerName || 'Chat'}
                </h2>
                <p className="mt-0.5 text-xs text-slate-300 sm:mt-1 sm:text-sm">
                  {partnerOnline ? '🟢 Online' : toLastSeen(partnerLastSeen)}
                </p>
                {role === 'patient' && (contextData?.partnerEmail || contextData?.partnerPhone) ? (
                  <div className="mt-1 space-y-0.5 sm:mt-2">
                    {contextData?.partnerEmail ? (
                      <p className="text-[10px] text-slate-400 sm:text-xs">{contextData.partnerEmail}</p>
                    ) : null}
                    {contextData?.partnerPhone ? (
                      <p className="text-[10px] text-slate-400 sm:text-xs">{contextData.partnerPhone}</p>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-slate-950/55 px-2 py-1 text-[10px] text-slate-300 sm:gap-2 sm:px-3 sm:py-1.5 sm:text-xs">
                {socketReady ? <Wifi className="h-3 w-3 text-emerald-300 sm:h-3.5 sm:w-3.5" /> : <WifiOff className="h-3 w-3 text-amber-300 sm:h-3.5 sm:w-3.5" />}
                <span className="hidden sm:inline">{socketReady ? 'Realtime' : 'Reconnecting'}</span>
              </div>

              <div className="flex items-center gap-2">
                {callActive ? (
                  <>
                    <button
                      type="button"
                      onClick={toggleMute}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-100 transition hover:bg-white/10"
                      aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
                    >
                      {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={toggleCamera}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-100 transition hover:bg-white/10"
                      aria-label={isCameraOff ? 'Turn camera on' : 'Turn camera off'}
                    >
                      {isCameraOff ? <VideoOff className="h-4 w-4" /> : <Video className="h-4 w-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => endCallLocally({ notifyPeer: true })}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-rose-300/40 bg-rose-500/20 text-rose-100 transition hover:bg-rose-500/30"
                      aria-label="End call"
                    >
                      <PhoneOff className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (role === 'doctor' && (selectedPatientId || contextData?.patientId)) {
                        startCall({
                          id: selectedPatientId || contextData?.patientId,
                          patientId: selectedPatientId || contextData?.patientId,
                          name: contextData?.partnerName || 'Patient',
                          patientName: contextData?.partnerName || 'Patient',
                        });
                      } else {
                        openDialer();
                      }
                    }}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-cyan-300/40 bg-cyan-400/15 text-cyan-100 transition hover:bg-cyan-400/25"
                    aria-label="Start video call"
                    title="Telehealth Video Consultation"
                  >
                    <Video className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
              </div>

              {(incomingCall || outgoingCall || callActive) ? (
                <div className="border-b border-white/10 bg-slate-950/55 px-3 py-3 sm:px-5 sm:py-4">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 sm:p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-xs font-semibold text-white">
                          {incomingCall ? `${incomingCall.fromName || 'Partner'} is calling...` : callActive ? 'Video call in progress' : 'Calling partner...'}
                        </p>
                        <p className="text-[11px] text-slate-300 sm:text-xs">
                          {callStatus || 'Preparing secure media channel...'}
                        </p>
                      </div>

                      {incomingCall ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={acceptIncomingCall}
                            className="rounded-full border border-emerald-300/40 bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/30"
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            onClick={rejectIncomingCall}
                            className="rounded-full border border-rose-300/40 bg-rose-500/20 px-3 py-1.5 text-xs font-semibold text-rose-100 transition hover:bg-rose-500/30"
                          >
                            Reject
                          </button>
                        </div>
                      ) : null}
                    </div>

                    {(callActive || outgoingCall) ? (
                      <div className="mt-3 grid gap-3 md:grid-cols-[2fr_1fr]">
                        <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-950/70">
                          <video
                            ref={remoteVideoRef}
                            autoPlay
                            playsInline
                            className="h-44 w-full bg-slate-950 object-cover sm:h-56"
                          />
                        </div>
                        <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-950/70">
                          <video
                            ref={localVideoRef}
                            autoPlay
                            muted
                            playsInline
                            className="h-44 w-full bg-slate-950 object-cover sm:h-56"
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <div className="max-h-[50vh] min-h-[320px] flex-1 space-y-2 overflow-y-auto bg-[linear-gradient(180deg,rgba(2,6,23,0.42)_0%,rgba(2,6,23,0.72)_100%)] px-3 py-3 sm:max-h-none sm:space-y-3 sm:px-5 sm:py-5">
            {loading ? (
              <p className="text-xs text-slate-300 sm:text-sm">Loading...</p>
            ) : null}

            {!loading && !messages.length ? (
              <div className="rounded-lg border border-dashed border-white/15 bg-white/[0.03] p-4 text-center sm:rounded-2xl sm:p-6">
                <MessageCircle className="mx-auto h-6 w-6 text-cyan-300 sm:h-8 sm:w-8" />
                <p className="mt-2 text-xs text-slate-300 sm:mt-3 sm:text-sm">Start the conversation</p>
              </div>
            ) : null}

            {messages.map((message) => {
              const isMine = String(message.senderRole || '').toLowerCase() === role;
              return (
                <div key={message.id} className={['flex', isMine ? 'justify-end' : 'justify-start'].join(' ')}>
                  <div
                    className={[
                      'max-w-[85%] rounded-lg px-3 py-2 shadow-[0_10px_26px_rgba(2,6,23,0.25)] sm:max-w-[78%] sm:rounded-2xl sm:px-4 sm:py-3',
                      isMine
                        ? 'rounded-br-sm border border-cyan-300/30 bg-gradient-to-br from-cyan-400/25 to-sky-500/15 text-white sm:rounded-br-md'
                        : 'rounded-bl-sm border border-white/10 bg-white/[0.06] text-slate-100 sm:rounded-bl-md',
                    ].join(' ')}
                  >
                    <p className="whitespace-pre-wrap text-xs leading-5 sm:text-sm sm:leading-6">{message.text}</p>
                    <div className="mt-1 flex items-center justify-end gap-1.5 text-[10px] text-slate-300/85 sm:mt-2 sm:gap-2 sm:text-[11px]">
                      <span>{toTime(message.createdAt)}</span>
                      {isMine ? <span className="uppercase tracking-[0.12em]">{message.status || 'sent'}</span> : null}
                    </div>
                  </div>
                </div>
              );
            })}

            {typing ? (
              <div className="inline-flex rounded-full border border-white/10 bg-white/[0.05] px-2 py-1 text-xs text-slate-300 sm:px-3 sm:py-1 sm:text-xs">
                typing...
              </div>
            ) : null}
            <div ref={scrollAnchorRef} />
              </div>

              <div className="border-t border-white/10 bg-slate-950/70 px-3 py-3 sm:px-5 sm:py-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-3">
              <textarea
                rows={2}
                value={input}
                onChange={(event) => handleType(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Type a message"
                className="min-h-12 w-full resize-none rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/15 sm:min-h-[52px] sm:rounded-2xl sm:px-4 sm:py-3 sm:text-sm"
              />

              <Button type="button" onClick={handleSend} disabled={sending || !input.trim() || !contextData?.threadId} size="sm" className="h-12 w-full px-3 sm:h-[50px] sm:w-auto sm:px-5">
                <Send className="h-4 w-4" />
              </Button>
            </div>

            {!session?.token ? (
              <p className="mt-2 text-xs text-amber-300">
                Token missing. Re-login may be required.
              </p>
            ) : null}
              </div>
            </section>
          </div>
        </Card>

        <div className="text-xs text-slate-400 sm:text-sm">
          <Link to="/dashboard" className="text-cyan-300 hover:text-cyan-200">← Back to dashboard</Link>
        </div>
      </div>
    </DashboardLayout>
  );
}
