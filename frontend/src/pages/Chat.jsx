import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCheck,
  Languages,
  MessageCircle,
  MessageSquare,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Send,
  Sparkles,
  User,
  Users,
  Video,
  VideoOff,
  Wifi,
  WifiOff,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { DashboardLayout } from '../components/DashboardLayout';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { getPatients, getChatMessages, getChatThreadContext, markChatMessageRead, sendChatMessage } from '../services/api';
import { getAuthSession } from '../utils/auth';
import { useVideoCall } from '../context/VideoCallContext';
import { useI18n } from '../context/I18nContext';

const SOCKET_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://smart-health-backend-2idf.onrender.com';
const PRESENCE_PING_MS = 20000;
const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

const toTime = (isoValue) => {
  if (!isoValue) return '';
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const toLastSeen = (isoValue) => {
  if (!isoValue) return 'offline';
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) return 'offline';

  const diffSeconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (diffSeconds < 60) return 'last seen just now';

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `last seen ${diffMinutes}m ago`;

  return `last seen ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
};

const getUnreadCount = (rows, receiverId) => {
  const target = String(receiverId || '').trim().toLowerCase();
  if (!target) return 0;
  return rows.filter((row) => {
    const incoming = String(row?.receiverId || '').trim().toLowerCase();
    return incoming === target && !row?.readAt;
  }).length;
};

const getLatestText = (rows) => {
  if (!Array.isArray(rows) || !rows.length) return 'No messages yet';
  const last = rows[rows.length - 1] || {};
  return String(last.text || '').trim() || 'No messages yet';
};

export function Chat() {
  const { t } = useI18n();
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
    if (!contextData?.partnerRole || !contextData?.partnerId) return '';
    return `${String(contextData.partnerRole).toLowerCase()}:${String(contextData.partnerId).toLowerCase()}`;
  }, [contextData]);

  // ============================================================================
  // 1. WEBRTC & CALL HANDLER CALLBACKS (Declared before useEffect to avoid TDZ)
  // ============================================================================
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

  // ============================================================================
  // 2. DATA LOADING EFFECTS
  // ============================================================================
  useEffect(() => {
    let active = true;

    const loadDoctorPatients = async () => {
      if (role !== 'doctor') return;

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

        if (!active) return;

        setContextData(nextContext);
        setPartnerOnline(Boolean(nextContext?.partnerPresence?.online));
        setPartnerLastSeen(String(nextContext?.partnerPresence?.lastSeen || ''));

        const initialMessages = await getChatMessages(nextContext.threadId, { limit: 80 });
        if (!active) return;

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
          if (!patientId) return null;

          try {
            const thread = await getChatThreadContext({ patientId });
            if (!thread?.threadId) return null;

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

  // ============================================================================
  // 3. REALTIME SOCKET.IO EFFECT
  // ============================================================================
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
      if (payload?.threadId !== contextData.threadId) return;
      setIncomingCall(payload);
      setCallStatus('Incoming call...');
    });

    socket.on('call:outgoing', (payload) => {
      if (payload?.threadId !== contextData.threadId) return;
      setOutgoingCall(true);
      setCallStatus('Ringing...');
    });

    socket.on('call:accepted', async (payload) => {
      if (payload?.threadId !== contextData.threadId) return;

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
      if (payload?.threadId !== contextData.threadId) return;
      setOutgoingCall(false);
      setCallStatus('Call rejected');
      endCallLocally({ notifyPeer: false });
    });

    socket.on('call:ended', (payload) => {
      if (payload?.threadId !== contextData.threadId) return;
      setCallStatus('Call ended');
      endCallLocally({ notifyPeer: false });
    });

    socket.on('call:missed', (payload) => {
      if (payload?.threadId !== contextData.threadId) return;
      setOutgoingCall(false);
      setCallStatus('Partner is unavailable');
    });

    socket.on('webrtc:offer', async (payload) => {
      if (payload?.threadId !== contextData.threadId) return;

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
      if (payload?.threadId !== contextData.threadId || !peerConnectionRef.current) return;

      try {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      } catch {
        toast.error('Failed to establish remote video session.');
      }
    });

    socket.on('webrtc:ice_candidate', async (payload) => {
      if (payload?.threadId !== contextData.threadId || !peerConnectionRef.current || !payload?.candidate) return;

      try {
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(payload.candidate));
      } catch {
        // Ignore candidate race conditions
      }
    });

    socket.on('chat:history', (payload) => {
      if (payload?.threadId !== contextData.threadId) return;
      const rows = Array.isArray(payload?.messages) ? payload.messages : [];
      setMessages(rows);
    });

    socket.on('chat:new_message', (payload) => {
      if (payload?.threadId !== contextData.threadId || !payload?.id) return;

      setMessages((current) => {
        const exists = current.some((row) => String(row.id) === String(payload.id));
        if (exists) return current;
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
      if (payload?.threadId !== contextData.threadId || !payload?.messageId) return;

      setMessages((current) => current.map((row) => (
        String(row.id) === String(payload.messageId)
          ? { ...row, status: 'read', readAt: payload.readAt || row.readAt }
          : row
      )));
    });

    socket.on('chat:presence_update', (payload) => {
      if (!partnerKey || String(payload?.userKey || '').toLowerCase() !== partnerKey) return;

      setPartnerOnline(Boolean(payload?.online));
      setPartnerLastSeen(String(payload?.lastSeen || ''));
    });

    socket.on('chat:typing', (payload) => {
      if (payload?.threadId !== contextData.threadId) return;

      const fromPartner = String(payload?.userId || '') === String(contextData.partnerId || '');
      if (!fromPartner) return;

      setTyping(Boolean(payload?.typing));
    });

    pingRef.current = window.setInterval(() => {
      if (socket.connected) {
        socket.emit('chat:presence_ping', {});
      }
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
    if (!messages.length) return;

    const unreadFromPartner = messages
      .filter((row) => String(row.senderId || '') === String(contextData?.partnerId || ''))
      .filter((row) => String(row.receiverId || '') === String(role === 'doctor' ? session?.email || '' : session?.patientId || ''))
      .filter((row) => !row.readAt)
      .slice(-15);

    if (!unreadFromPartner.length) return;

    unreadFromPartner.forEach((row) => {
      if (socketRef.current?.connected) {
        socketRef.current.emit('chat:mark_read', {
          threadId: contextData?.threadId,
          messageId: row.id,
        });
      } else {
        markChatMessageRead({ messageId: row.id, threadId: contextData?.threadId }).catch(() => {});
      }
    });
  }, [contextData?.partnerId, contextData?.threadId, messages, role, session?.email, session?.patientId]);

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  useEffect(() => {
    return () => {
      closePeerConnection();
      stopLocalStream();
    };
  }, [closePeerConnection, stopLocalStream]);

  // ============================================================================
  // 4. USER ACTION HANDLERS
  // ============================================================================
  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;

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
        // Fall through
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
          if (exists) return current;
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
    if (!socketRef.current?.connected || !contextData?.threadId) return;

    socketRef.current.emit('chat:typing', {
      threadId: contextData.threadId,
      typing: Boolean(value.trim()),
    });
  };

  const isDoctor = role === 'doctor';

  return (
    <DashboardLayout
      role={role}
      title={isDoctor ? "Patient Clinical Communications" : "Direct Physician Consultation"}
      subtitle={isDoctor ? "Encrypted realtime messaging and clinical consultations" : "Connect securely with your assigned attending cardiologist & care team"}
      backTo="/dashboard"
      backLabel="Back to Dashboard"
    >
      <div className="space-y-4 sm:space-y-5 lg:space-y-6">
        <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_4px_25px_rgba(15,23,42,0.06)]">
          <div className="grid min-h-0 lg:min-h-[660px] lg:grid-cols-[300px_1fr]">
            {/* Left Sidebar: Conversation List */}
            <aside className="border-b border-slate-100 bg-slate-50/75 lg:border-b-0 lg:border-r">
              <div className="border-b border-slate-100 px-4 py-3.5 sm:px-5 sm:py-4 bg-white">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#0284C7]">
                      <MessageSquare className="h-3 w-3" />
                      {isDoctor ? 'Assigned Patients' : 'Care Physician'}
                    </span>
                    <h3 className="text-sm font-bold text-[#0F172A] sm:text-base">
                      {isDoctor ? 'Patient Conversations' : 'Attending Doctor'}
                    </h3>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
                    {conversationItems.length}
                  </span>
                </div>
              </div>

              <div className="max-h-[42vh] space-y-1.5 overflow-y-auto p-2 sm:max-h-[50vh] sm:p-3 lg:max-h-[calc(100vh-21rem)]">
                {listLoading ? (
                  <div className="space-y-2 p-3">
                    <div className="h-14 animate-pulse rounded-xl bg-slate-200/70" />
                    <div className="h-14 animate-pulse rounded-xl bg-slate-200/70" />
                  </div>
                ) : null}

                {!listLoading && !conversationItems.length ? (
                  <div className="p-6 text-center">
                    <Users className="mx-auto h-8 w-8 text-slate-300" />
                    <p className="mt-2 text-xs font-semibold text-slate-500">No active conversations found.</p>
                  </div>
                ) : null}

                {conversationItems.map((item) => {
                  const isActive = isDoctor
                    ? String(item.patientId || '') === String(selectedPatientId || '')
                    : String(item.threadId || '') === String(contextData?.threadId || '');

                  return (
                    <button
                      key={`${item.threadId || item.patientId}`}
                      type="button"
                      onClick={() => {
                        if (isDoctor && item.patientId) {
                          setSearchParams({ patientId: String(item.patientId) }, { replace: true });
                        }
                      }}
                      className={[
                        'w-full rounded-xl border p-2.5 text-left transition sm:p-3 shadow-2xs',
                        isActive
                          ? 'border-[#0284C7]/40 bg-gradient-to-r from-sky-50 to-blue-50/60 ring-1 ring-[#0284C7]/25'
                          : 'border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50/90',
                      ].join(' ')}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white shadow-2xs ${
                            isActive ? 'bg-[#0284C7]' : 'bg-slate-500'
                          }`}>
                            {(item.partnerName || 'PT').slice(0, 2).toUpperCase()}
                          </div>
                          <p className="truncate text-xs font-bold text-[#0F172A] sm:text-sm">
                            {item.partnerName}
                          </p>
                        </div>
                        {item.unreadCount > 0 ? (
                          <span className="inline-flex min-w-5 shrink-0 items-center justify-center rounded-full bg-[#0284C7] px-1.5 py-0.5 text-[10px] font-bold text-white shadow-2xs">
                            {item.unreadCount}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1.5 line-clamp-1 text-[11px] text-slate-500 font-medium pl-9">
                        {item.preview}
                      </p>
                      <p className="mt-1 text-[10px] font-semibold text-slate-400 pl-9">
                        {toTime(item.updatedAt)}
                      </p>
                    </button>
                  );
                })}
              </div>
            </aside>

            {/* Right Chat Panel */}
            <section className="flex min-h-0 flex-col bg-white">
              {/* Top Chat Header */}
              <div className="border-b border-slate-100 bg-white px-4 py-3.5 sm:px-6 sm:py-4">
                <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#0284C7] to-blue-700 text-sm font-bold text-white shadow-xs">
                      {(contextData?.partnerName || (isDoctor ? 'PT' : 'DR')).slice(0, 2).toUpperCase()}
                      <span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white ${
                        partnerOnline ? 'bg-emerald-500' : 'bg-slate-300'
                      }`} />
                    </div>
                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-bold text-[#0F172A] sm:text-base">
                        {contextData?.partnerName || (isDoctor ? 'Select Patient' : 'Attending Physician')}
                      </h2>
                      <p className="text-[11px] font-semibold text-slate-500">
                        {partnerOnline ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Active Now
                          </span>
                        ) : (
                          toLastSeen(partnerLastSeen)
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Socket Signal Status */}
                    <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600 shadow-2xs">
                      {socketReady ? (
                        <>
                          <Wifi className="h-3.5 w-3.5 text-emerald-600" />
                          <span className="hidden sm:inline">Encrypted Signal</span>
                        </>
                      ) : (
                        <>
                          <WifiOff className="h-3.5 w-3.5 text-amber-500" />
                          <span className="hidden sm:inline">Connecting...</span>
                        </>
                      )}
                    </div>

                    {/* Quick Telehealth Video Call Button */}
                    {callActive ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={toggleMute}
                          className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-slate-100 text-slate-700 transition hover:bg-slate-200 shadow-2xs"
                          aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
                        >
                          {isMuted ? <MicOff className="h-4 w-4 text-rose-600" /> : <Mic className="h-4 w-4" />}
                        </button>
                        <button
                          type="button"
                          onClick={toggleCamera}
                          className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-slate-100 text-slate-700 transition hover:bg-slate-200 shadow-2xs"
                          aria-label={isCameraOff ? 'Turn camera on' : 'Turn camera off'}
                        >
                          {isCameraOff ? <VideoOff className="h-4 w-4 text-rose-600" /> : <Video className="h-4 w-4" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => endCallLocally({ notifyPeer: true })}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 transition hover:bg-rose-100 shadow-2xs"
                        >
                          <PhoneOff className="h-3.5 w-3.5" /> End Call
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          if (isDoctor && (selectedPatientId || contextData?.patientId)) {
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
                        className="inline-flex items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-bold text-[#0284C7] transition hover:bg-sky-100 shadow-2xs"
                        title="Start Telehealth Video Consultation"
                      >
                        <Video className="h-3.5 w-3.5" /> Start Video Call
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Active / Incoming Video Call Banner */}
              {(incomingCall || outgoingCall || callActive) ? (
                <div className="border-b border-sky-100 bg-sky-50/60 p-3 sm:p-4">
                  <div className="rounded-xl border border-sky-200 bg-white p-3.5 shadow-xs">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-xs font-bold text-[#0F172A]">
                          {incomingCall ? `📞 ${incomingCall.fromName || 'Partner'} is calling...` : callActive ? '🩺 Telehealth Consultation Active' : 'Calling clinical counterparty...'}
                        </p>
                        <p className="text-[11px] font-semibold text-slate-500">
                          {callStatus || 'Preparing secure WebRTC media pipeline...'}
                        </p>
                      </div>

                      {incomingCall ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={acceptIncomingCall}
                            className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-1.5 text-xs font-bold text-emerald-800 transition hover:bg-emerald-100 shadow-2xs"
                          >
                            Accept Consultation
                          </button>
                          <button
                            type="button"
                            onClick={rejectIncomingCall}
                            className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-1.5 text-xs font-bold text-rose-800 transition hover:bg-rose-100 shadow-2xs"
                          >
                            Decline
                          </button>
                        </div>
                      ) : null}
                    </div>

                    {(callActive || outgoingCall) ? (
                      <div className="mt-3 grid gap-3 md:grid-cols-[2fr_1fr]">
                        <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-900">
                          <video
                            ref={remoteVideoRef}
                            autoPlay
                            playsInline
                            className="h-44 w-full object-cover sm:h-56"
                          />
                        </div>
                        <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-900">
                          <video
                            ref={localVideoRef}
                            autoPlay
                            muted
                            playsInline
                            className="h-44 w-full object-cover sm:h-56"
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {/* Chat Messages Timeline */}
              <div className="max-h-[50vh] min-h-[340px] flex-1 space-y-3 overflow-y-auto bg-[#F8FAFC] p-3 sm:max-h-none sm:p-5">
                {loading ? (
                  <div className="flex items-center justify-center p-8">
                    <p className="text-xs font-semibold text-slate-500">Loading secure medical conversation...</p>
                  </div>
                ) : null}

                {!loading && !messages.length ? (
                  <div className="my-10 rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center shadow-2xs">
                    <MessageCircle className="mx-auto h-9 w-9 text-slate-300" />
                    <p className="mt-2 text-sm font-bold text-[#0F172A]">Encrypted Clinical Thread Ready</p>
                    <p className="mt-1 text-xs text-slate-500">Send your first clinical observation or inquiry below.</p>
                  </div>
                ) : null}

                {messages.map((message) => {
                  const isMine = String(message.senderRole || '').toLowerCase() === role;
                  return (
                    <div key={message.id} className={['flex', isMine ? 'justify-end' : 'justify-start'].join(' ')}>
                      <div
                        className={[
                          'max-w-[85%] rounded-2xl px-3.5 py-2.5 shadow-2xs sm:max-w-[75%] sm:px-4 sm:py-3',
                          isMine
                            ? 'rounded-br-xs bg-[#0284C7] text-white'
                            : 'rounded-bl-xs border border-slate-200/90 bg-white text-[#0F172A]',
                        ].join(' ')}
                      >
                        <p className="whitespace-pre-wrap text-xs font-medium leading-relaxed sm:text-sm">
                          {message.text}
                        </p>
                        <div className={[
                          'mt-1.5 flex items-center justify-end gap-1.5 text-[10px] font-semibold',
                          isMine ? 'text-sky-100' : 'text-slate-400',
                        ].join(' ')}>
                          <span>{toTime(message.createdAt)}</span>
                          {isMine ? (
                            <span className="inline-flex items-center">
                              {message.status === 'read' ? (
                                <CheckCheck className="h-3.5 w-3.5 text-sky-200" />
                              ) : (
                                <span className="uppercase tracking-wider">✓</span>
                              )}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {typing ? (
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-500 shadow-2xs">
                    <span className="flex h-1.5 w-1.5 animate-ping rounded-full bg-[#0284C7]" />
                    <span>typing...</span>
                  </div>
                ) : null}
                <div ref={scrollAnchorRef} />
              </div>

              {/* Message Composer Input */}
              <div className="border-t border-slate-100 bg-white p-3 sm:p-4">
                <div className="flex items-end gap-2 sm:gap-3">
                  <textarea
                    rows={1}
                    value={input}
                    onChange={(event) => handleType(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder="Type a clinical message or patient update (Press Enter to send)..."
                    className="min-h-[44px] max-h-32 w-full resize-none rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-2.5 text-xs text-[#0F172A] placeholder:text-slate-400 outline-none transition focus:border-[#0284C7] focus:bg-white focus:ring-2 focus:ring-[#0284C7]/15 sm:min-h-[48px] sm:px-4 sm:py-3 sm:text-sm"
                  />

                  <Button
                    type="button"
                    onClick={handleSend}
                    disabled={sending || !input.trim() || !contextData?.threadId}
                    size="sm"
                    className="h-11 shrink-0 rounded-xl bg-[#0284C7] px-4 font-bold text-white shadow-2xs hover:bg-[#0369A1] sm:h-12 sm:px-5"
                  >
                    <Send className="h-4 w-4" />
                    <span className="hidden sm:inline">Send</span>
                  </Button>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
