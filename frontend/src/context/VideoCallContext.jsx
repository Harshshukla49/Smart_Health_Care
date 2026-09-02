import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { io } from 'socket.io-client';
import { getAuthSession, setAuthSession, normalizeRole } from '../utils/auth';
import { getApiPatientById } from '../services/api';

const VideoCallContext = createContext(null);

const SOCKET_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://smart-health-backend-2idf.onrender.com';

const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    ...(import.meta.env.VITE_TURN_SERVER
      ? [
          {
            urls: import.meta.env.VITE_TURN_SERVER,
            username: import.meta.env.VITE_TURN_USERNAME || '',
            credential: import.meta.env.VITE_TURN_PASSWORD || '',
          },
        ]
      : []),
  ],
};

// Standard Available Hospital Specialist Department extensions (Available for direct dial)
export const HOSPITAL_PHYSICIANS = [
  {
    id: 'DOC-EM-02',
    name: 'Dr. Priya Sharma',
    role: 'doctor',
    title: 'Senior Emergency Physician',
    department: 'Emergency Trauma & Rapid Response',
    phone: '+91 98111 22334',
    extension: '102',
    avatar: '/assets/doctor-telemetry-desk.jpg',
    status: 'online',
    isAssigned: false,
  },
  {
    id: 'DOC-IM-03',
    name: 'Dr. Rajesh Gupta',
    role: 'doctor',
    title: 'Internal Medicine Consultant',
    department: 'General Medicine & Tele-Triage',
    phone: '+91 98222 33445',
    extension: '104',
    avatar: '/assets/doctor-command-center.png',
    status: 'online',
    isAssigned: false,
  },
  {
    id: 'DOC-PU-04',
    name: 'Dr. Sneha Verma',
    role: 'doctor',
    title: 'Pulmonologist & Critical Care',
    department: 'Respiratory Telemetry & ICU',
    phone: '+91 98333 44556',
    extension: '108',
    avatar: '/assets/doctor-telemetry-desk.jpg',
    status: 'online',
    isAssigned: false,
  },
  {
    id: 'DESK-4B-RRT',
    name: 'Ward 4B Telemetry Duty Desk',
    role: 'doctor',
    title: 'Clinical Rapid Response Team',
    department: '24/7 Ward Monitoring Station',
    phone: '+91 98444 55667',
    extension: '911',
    avatar: '/assets/telemetry-hub-hero.png',
    status: 'online',
    isAssigned: false,
  },
];

export const getAssignedDoctorFromSession = (session) => {
  if (!session || normalizeRole(session.role) !== 'patient') return null;
  const docId = String(session.doctorId || session.doctorEmail || session.assignedDoctorId || '').trim();
  const docName = String(session.doctorName || session.assignedDoctorName || '').trim();
  const docEmail = String(session.doctorEmail || (docId.includes('@') ? docId : '')).trim();
  const docPhone = String(session.doctorPhone || '').trim();
  const docSpecialty = String(session.doctorSpecialty || 'Attending Physician').trim();

  if (!docId && !docName && !docEmail) {
    return null;
  }

  const formattedName = docName
    ? (docName.toLowerCase().startsWith('dr.') ? docName : `Dr. ${docName}`)
    : (docEmail ? `Dr. ${docEmail.split('@')[0]}` : 'Assigned Physician');

  return {
    id: docId || docEmail || 'DOC-ASSIGNED',
    doctorId: docId || docEmail,
    email: docEmail,
    name: formattedName,
    doctorName: formattedName,
    role: 'doctor',
    title: docSpecialty || 'Attending Physician',
    department: 'Cardiology & Intensive Ward 4B',
    phone: docPhone || '+91 98765 43210',
    extension: '401',
    avatar: '/assets/doctor-command-center.png',
    status: 'online',
    isAssigned: true,
  };
};

export function VideoCallProvider({ children }) {
  const [session, setSession] = useState(() => getAuthSession());

  useEffect(() => {
    const handleAuthChange = () => {
      setSession(getAuthSession());
    };
    window.addEventListener('smart-health-auth-change', handleAuthChange);
    window.addEventListener('storage', handleAuthChange);
    return () => {
      window.removeEventListener('smart-health-auth-change', handleAuthChange);
      window.removeEventListener('storage', handleAuthChange);
    };
  }, []);

  const userRole = normalizeRole(session?.role);
  const isDoctor = userRole === 'doctor';
  const currentUserId = isDoctor
    ? String(session?.doctorId || session?.email || '').trim()
    : String(session?.patientId || '').trim();
  const currentUserEmail = String(session?.email || '').trim().toLowerCase();
  const currentUserName = session?.name || (isDoctor ? 'Doctor' : 'Patient');
  const authToken = String(session?.token || '').trim();

  // Modal & Call States - Dynamically initialized from the authenticated patient's assigned doctor
  const [isDialerOpen, setIsDialerOpen] = useState(false);
  const [dialerDefaultDoctor, setDialerDefaultDoctor] = useState(() => getAssignedDoctorFromSession(getAuthSession()));

  // Call Lifecycle: 'idle' | 'calling' | 'incoming' | 'connecting' | 'connected' | 'rejected' | 'busy' | 'unavailable' | 'ended' | 'failed'
  const [callState, setCallState] = useState('idle');
  const [activeCall, setActiveCall] = useState(null);
  const [callDuration, setCallDuration] = useState(0);

  // Audio / Video stream state
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);

  // Refs
  const socketRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const iceCandidateQueueRef = useRef([]);
  const audioContextRef = useRef(null);
  const ringtoneTimerRef = useRef(null);
  const isRingtonePlayingRef = useRef(false);
  const ringtoneMasterGainRef = useRef(null);
  const activeOscillatorsRef = useRef(new Set());
  const callTimerRef = useRef(null);
  const callTimeoutRef = useRef(null);
  const activeCallRef = useRef(null);

  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  // Universal Stop for All Call Audio Sounds (Ringtone, Chime, Burst)
  const stopAllCallSounds = useCallback(() => {
    console.log('[RINGTONE-ENGINE] Hard stopping ALL ringtone and audio sources');
    isRingtonePlayingRef.current = false;

    // 1. Clear repeating interval timers immediately
    if (ringtoneTimerRef.current) {
      clearInterval(ringtoneTimerRef.current);
      ringtoneTimerRef.current = null;
    }

    // 2. Stop and disconnect every tracked oscillator node
    activeOscillatorsRef.current.forEach((osc) => {
      try {
        osc.onended = null;
        osc.stop(0);
        osc.disconnect();
      } catch {}
    });
    activeOscillatorsRef.current.clear();

    // 3. Immediately mute and disconnect master gain
    if (ringtoneMasterGainRef.current) {
      try {
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
          const currentTime = audioContextRef.current.currentTime;
          ringtoneMasterGainRef.current.gain.cancelScheduledValues(currentTime);
          ringtoneMasterGainRef.current.gain.setValueAtTime(0, currentTime);
        }
        ringtoneMasterGainRef.current.disconnect();
      } catch {}
      ringtoneMasterGainRef.current = null;
    }

    // 4. Suspend audio context immediately to completely halt hardware audio output
    if (audioContextRef.current && audioContextRef.current.state === 'running') {
      try {
        audioContextRef.current.suspend().catch(() => {});
      } catch {}
    }
  }, []);

  const stopRingtone = useCallback(() => {
    stopAllCallSounds();
  }, [stopAllCallSounds]);

  // Synthesize Realistic Clinical Dual-Tone Ringtone via Web Audio API
  const startRingtone = useCallback(() => {
    stopAllCallSounds(); // Prevent overlapping interval leaks
    isRingtonePlayingRef.current = true;
    console.log('[RINGTONE-ENGINE] Starting ringtone synthesis');

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new AudioCtx();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      // Create fresh master gain dedicated to this ring session
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(1, ctx.currentTime);
      masterGain.connect(ctx.destination);
      ringtoneMasterGainRef.current = masterGain;

      const playBurst = () => {
        // STRICT GUARD: If ringtone was stopped, ABORT IMMEDIATELY!
        if (!isRingtonePlayingRef.current || !audioContextRef.current || audioContextRef.current.state === 'closed') {
          return;
        }

        try {
          const currentCtx = audioContextRef.current;
          if (currentCtx.state === 'suspended') {
            currentCtx.resume().catch(() => {});
          }

          const currentMaster = ringtoneMasterGainRef.current;
          if (!currentMaster || !isRingtonePlayingRef.current) return;

          const osc1 = currentCtx.createOscillator();
          const osc2 = currentCtx.createOscillator();
          const burstGain = currentCtx.createGain();

          osc1.frequency.value = 440; // Clinical dial tone A4
          osc2.frequency.value = 480; // Clinical dial tone B4

          burstGain.gain.setValueAtTime(0.04, currentCtx.currentTime);
          burstGain.gain.exponentialRampToValueAtTime(0.0001, currentCtx.currentTime + 1.8);

          osc1.connect(burstGain);
          osc2.connect(burstGain);
          burstGain.connect(currentMaster);

          activeOscillatorsRef.current.add(osc1);
          activeOscillatorsRef.current.add(osc2);

          const cleanupNodes = () => {
            activeOscillatorsRef.current.delete(osc1);
            activeOscillatorsRef.current.delete(osc2);
            try {
              osc1.disconnect();
              osc2.disconnect();
              burstGain.disconnect();
            } catch {}
          };

          osc1.onended = cleanupNodes;
          osc2.onended = cleanupNodes;

          osc1.start(currentCtx.currentTime);
          osc2.start(currentCtx.currentTime);
          osc1.stop(currentCtx.currentTime + 1.8);
          osc2.stop(currentCtx.currentTime + 1.8);
        } catch (err) {
          console.warn('[RINGTONE-ENGINE] Burst error:', err);
        }
      };

      playBurst();
      ringtoneTimerRef.current = window.setInterval(() => {
        if (isRingtonePlayingRef.current) {
          playBurst();
        } else if (ringtoneTimerRef.current) {
          clearInterval(ringtoneTimerRef.current);
          ringtoneTimerRef.current = null;
        }
      }, 3200);
    } catch (err) {
      console.warn('[RINGTONE-ENGINE] Start error:', err);
    }
  }, [stopAllCallSounds]);

  // Automatic Safety Kill-Switch: Ensure ringtone NEVER plays outside 'incoming' or 'calling'
  useEffect(() => {
    console.log('[CALL-STATE-GUARD] callState changed to:', callState);
    if (callState !== 'incoming' && callState !== 'calling') {
      stopAllCallSounds();
    }
  }, [callState, stopAllCallSounds]);

  // Universal Unmount Cleanup
  useEffect(() => {
    return () => {
      stopAllCallSounds();
      if (audioContextRef.current) {
        try {
          audioContextRef.current.close().catch(() => {});
        } catch {}
        audioContextRef.current = null;
      }
    };
  }, [stopAllCallSounds]);

  // Play pleasant call connected chime
  const playConnectChime = useCallback(() => {
    stopAllCallSounds();
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = (audioContextRef.current && audioContextRef.current.state !== 'closed')
        ? audioContextRef.current
        : new AudioCtx();
      audioContextRef.current = ctx;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.18);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch {
      // ignore audio error
    }
  }, [stopAllCallSounds]);

  // Real Camera & Mic Stream acquisition
  const acquireMediaStream = useCallback(async () => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        localStreamRef.current = stream;
        setLocalStream(stream);
        return stream;
      }
    } catch (err) {
      console.warn('Camera/Mic permission denied or not available:', err);
      toast.error('Camera/microphone access denied. Please enable device permissions in your browser.');
    }
    return null;
  }, []);

  const stopMediaStream = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    }
    if (remoteStreamRef.current) {
      remoteStreamRef.current.getTracks().forEach((track) => track.stop());
      remoteStreamRef.current = null;
      setRemoteStream(null);
    }
  }, []);

  // WebRTC Peer Connection Factory
  const createPeerConnection = useCallback((callId, targetRole, targetId) => {
    if (peerConnectionRef.current) {
      try {
        peerConnectionRef.current.close();
      } catch {
        // ignore
      }
    }

    const pc = new RTCPeerConnection(RTC_CONFIG);
    iceCandidateQueueRef.current = [];

    // Relay local ICE candidates to counterparty via socket signaling
    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('webrtc:ice_candidate', {
          callId,
          targetRole,
          targetId,
          candidate: event.candidate.toJSON(),
        });
      }
    };

    // Receive incoming remote tracks
    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        remoteStreamRef.current = event.streams[0];
        setRemoteStream(event.streams[0]);
      }
    };

    const updateConnectedStatus = () => {
      const connState = pc.connectionState;
      const iceState = pc.iceConnectionState;
      if (connState === 'connected' || iceState === 'connected' || iceState === 'completed') {
        setCallState('connected');
      } else if (connState === 'failed' || iceState === 'failed') {
        console.warn('[WEBRTC] Connection failed:', { connState, iceState });
        toast.error('Video link connection unstable or failed. Retrying...');
      }
    };

    pc.onconnectionstatechange = updateConnectedStatus;
    pc.oniceconnectionstatechange = updateConnectedStatus;

    // Add local tracks to peer connection
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    peerConnectionRef.current = pc;
    return pc;
  }, []);

  const closePeerConnection = useCallback(() => {
    if (peerConnectionRef.current) {
      try {
        peerConnectionRef.current.close();
      } catch {
        // ignore
      }
      peerConnectionRef.current = null;
    }
    iceCandidateQueueRef.current = [];
  }, []);

  // Keep latest function refs to avoid socket disconnection churn
  const createPeerConnectionRef = useRef(createPeerConnection);
  createPeerConnectionRef.current = createPeerConnection;
  const stopRingtoneRef = useRef(stopRingtone);
  stopRingtoneRef.current = stopRingtone;
  const startRingtoneRef = useRef(startRingtone);
  startRingtoneRef.current = startRingtone;
  const playConnectChimeRef = useRef(playConnectChime);
  playConnectChimeRef.current = playConnectChime;
  const stopMediaStreamRef = useRef(stopMediaStream);
  stopMediaStreamRef.current = stopMediaStream;
  const closePeerConnectionRef = useRef(closePeerConnection);
  closePeerConnectionRef.current = closePeerConnection;

  // Persistent Authenticated Socket Connection
  useEffect(() => {
    if (!currentUserId) return undefined;

    console.log('[WEBRTC-CALL] Initializing persistent Socket.IO connection for:', {
      role: userRole,
      id: currentUserId,
      email: currentUserEmail,
    });

    const socket = io(SOCKET_BASE_URL, {
      transports: ['websocket', 'polling'],
      auth: {
        token: authToken,
        role: userRole,
        doctorId: isDoctor ? currentUserId : undefined,
        patientId: !isDoctor ? currentUserId : undefined,
        email: currentUserEmail,
        name: currentUserName,
      },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[WEBRTC-CALL] Socket connected successfully. SID:', socket.id);
      socket.emit('call:register', {
        role: userRole,
        doctorId: isDoctor ? currentUserId : undefined,
        patientId: !isDoctor ? currentUserId : undefined,
        email: currentUserEmail,
        name: currentUserName,
      });
    });

    socket.on('call:registered', (ack) => {
      console.log('[WEBRTC-CALL] Socket call registration confirmed by backend:', ack);
    });

    // 1. Incoming Call Event (Received by targeted participant: Doctor or Patient)
    socket.on('call:incoming', (payload) => {
      console.log('[WEBRTC-CALL] Incoming call event received:', payload);
      // Guard: Receiver should match current role
      if (payload.receiverRole && payload.receiverRole !== userRole) {
        console.warn('[WEBRTC-CALL] Incoming call intended for different role:', payload.receiverRole, 'vs current:', userRole);
        return;
      }

      setActiveCall(payload);
      setCallState('incoming');
      startRingtoneRef.current();
    });

    // 2. Call Accepted Event (Received by whichever party initiated the call)
    socket.on('call:accepted', async (payload) => {
      console.log('[WEBRTC-CALL] Call accepted event received:', payload);
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }
      stopRingtoneRef.current();
      playConnectChimeRef.current();
      setCallState('connecting');

      // The caller initiates the WebRTC offer towards the counterparty
      const isDoctorCaller = userRole === 'doctor';
      const targetRole = isDoctorCaller ? 'patient' : 'doctor';
      const targetId = isDoctorCaller ? payload.patientId : payload.doctorId;

      const pc = createPeerConnectionRef.current(payload.callId, targetRole, targetId);

      try {
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
        });
        await pc.setLocalDescription(offer);

        socket.emit('webrtc:offer', {
          callId: payload.callId,
          targetRole,
          targetId,
          fromRole: userRole,
          fromId: currentUserId,
          sdp: offer,
        });
      } catch (err) {
        console.error('[WEBRTC] Failed to create offer:', err);
        toast.error('Could not initialize video connection. Please try again.');
      }
    });

    // 3. WebRTC Offer (Received by the party that accepted the call)
    socket.on('webrtc:offer', async (payload) => {
      console.log('[WEBRTC-CALL] WebRTC offer received:', payload);
      const isDoctorReceiver = userRole === 'doctor';
      const targetRole = isDoctorReceiver ? 'patient' : 'doctor';
      const currentCall = activeCallRef.current;
      const targetId = isDoctorReceiver
        ? (payload.fromId || currentCall?.patientId)
        : (payload.fromId || currentCall?.doctorId);

      const pc = createPeerConnectionRef.current(payload.callId, targetRole, targetId);

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));

        // Flush any queued ICE candidates
        while (iceCandidateQueueRef.current.length > 0) {
          const cand = iceCandidateQueueRef.current.shift();
          await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
        }

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit('webrtc:answer', {
          callId: payload.callId,
          targetRole,
          targetId,
          fromRole: userRole,
          fromId: currentUserId,
          sdp: answer,
        });

        playConnectChimeRef.current();
        setCallState('connecting');
      } catch (err) {
        console.error('[WEBRTC] Failed to process offer:', err);
      }
    });

    // 4. WebRTC Answer (Received by the offerer)
    socket.on('webrtc:answer', async (payload) => {
      console.log('[WEBRTC-CALL] WebRTC answer received:', payload);
      const pc = peerConnectionRef.current;
      if (pc) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));

          // Flush any queued ICE candidates
          while (iceCandidateQueueRef.current.length > 0) {
            const cand = iceCandidateQueueRef.current.shift();
            await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
          }
          const connState = pc.connectionState;
          if (connState === 'connected') {
            setCallState('connected');
          }
        } catch (err) {
          console.error('[WEBRTC] Failed to set remote description:', err);
        }
      }
    });

    // 5. WebRTC ICE Candidate (Received by both)
    socket.on('webrtc:ice_candidate', async (payload) => {
      const pc = peerConnectionRef.current;
      if (pc && pc.remoteDescription) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
        } catch (err) {
          console.warn('[WEBRTC] Error adding candidate:', err);
        }
      } else {
        iceCandidateQueueRef.current.push(payload.candidate);
      }
    });

    // 6. Call Rejected Event
    socket.on('call:rejected', (payload) => {
      console.log('[WEBRTC-CALL] Call rejected event received:', payload);
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }
      stopRingtoneRef.current();
      stopMediaStreamRef.current();
      closePeerConnectionRef.current();
      setCallState('rejected');
      const partnerName = isDoctor ? 'Patient' : 'Doctor';
      toast.error(payload?.reason || `${partnerName} declined or is currently unavailable.`);
      setTimeout(() => {
        setCallState('idle');
        setActiveCall(null);
      }, 3000);
    });

    // 7. Offline / Unavailable Event
    socket.on('call:unavailable', (payload) => {
      console.log('[WEBRTC-CALL] Call unavailable event received:', payload);
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }
      stopRingtoneRef.current();
      stopMediaStreamRef.current();
      closePeerConnectionRef.current();
      setCallState('unavailable');
      toast.error(payload?.message || 'Participant is currently offline or unavailable.');
      setTimeout(() => {
        setCallState('idle');
        setActiveCall(null);
      }, 3500);
    });

    // 8. Busy Event
    socket.on('call:busy', (payload) => {
      console.log('[WEBRTC-CALL] Call busy event received:', payload);
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }
      stopRingtoneRef.current();
      stopMediaStreamRef.current();
      closePeerConnectionRef.current();
      setCallState('busy');
      toast.error(payload?.message || 'Participant is currently on another call.');
      setTimeout(() => {
        setCallState('idle');
        setActiveCall(null);
      }, 3500);
    });

    // 9. Call Ended Event
    socket.on('call:ended', (payload) => {
      console.log('[WEBRTC-CALL] Call ended event received:', payload);
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }
      stopRingtoneRef.current();
      stopMediaStreamRef.current();
      closePeerConnectionRef.current();
      setCallState('ended');
      toast('Video consultation concluded.', { icon: 'ℹ️' });
      setTimeout(() => {
        setCallState('idle');
        setActiveCall(null);
        setCallDuration(0);
      }, 1800);
    });

    // 10. Call Error Event
    socket.on('call:error', (payload) => {
      console.error('[WEBRTC-CALL] Call error event received:', payload);
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }
      stopRingtoneRef.current();
      stopMediaStreamRef.current();
      closePeerConnectionRef.current();
      setCallState('idle');
      setActiveCall(null);
      toast.error(payload?.message || 'Call signaling error occurred.');
    });

    return () => {
      console.log('[WEBRTC-CALL] Disconnecting socket for:', currentUserId);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [authToken, currentUserEmail, currentUserId, currentUserName, isDoctor, userRole]);

  // Call duration counter
  useEffect(() => {
    if (callState === 'connected') {
      callTimerRef.current = window.setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
        callTimerRef.current = null;
      }
    }
    return () => {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
        callTimerRef.current = null;
      }
    };
  }, [callState]);

  // Synchronize dynamic assigned doctor details for patient accounts in background
  useEffect(() => {
    let active = true;
    const syncDoctorDetails = async () => {
      const currentSession = getAuthSession();
      if (!currentSession || normalizeRole(currentSession.role) !== 'patient' || !currentSession.patientId) return;

      try {
        const profile = await getApiPatientById(currentSession.patientId);
        if (!active || !profile) return;
        const docId = String(profile.doctorId || profile.assignedDoctorId || profile.doctorEmail || '').trim();
        const docName = String(profile.doctorName || profile.assignedDoctorName || profile.doctorContact?.name || '').trim();
        const docEmail = String(profile.doctorEmail || profile.doctorContact?.email || (docId.includes('@') ? docId : '')).trim();
        const docPhone = String(profile.doctorPhone || profile.doctorContact?.phone || '').trim();
        const docSpecialty = String(profile.doctorSpecialty || profile.doctorContact?.specialty || '').trim();

        if (docId || docName || docEmail) {
          const formattedName = docName
            ? (docName.toLowerCase().startsWith('dr.') ? docName : `Dr. ${docName}`)
            : (docEmail ? `Dr. ${docEmail.split('@')[0]}` : 'Assigned Physician');

          const updatedDoc = {
            id: docId || docEmail || 'DOC-ASSIGNED',
            doctorId: docId || docEmail,
            email: docEmail,
            name: formattedName,
            doctorName: formattedName,
            role: 'doctor',
            title: docSpecialty || 'Attending Physician',
            department: 'Cardiology & Intensive Ward 4B',
            phone: docPhone || '+91 98765 43210',
            extension: '401',
            avatar: '/assets/doctor-command-center.png',
            status: 'online',
            isAssigned: true,
          };
          setDialerDefaultDoctor(updatedDoc);

          setAuthSession({
            ...currentSession,
            doctorId: docId || docEmail,
            doctorName: docName,
            doctorEmail: docEmail,
            doctorPhone: docPhone,
            doctorSpecialty: docSpecialty,
          });
        }
      } catch {
        // Fallback gracefully
      }
    };

    syncDoctorDetails();
    return () => {
      active = false;
    };
  }, []);

  // API: Open Dialer Modal
  const openDialer = useCallback((defaultDoctor = null) => {
    if (defaultDoctor && defaultDoctor.name) {
      setDialerDefaultDoctor(defaultDoctor);
    } else {
      const currentSession = getAuthSession();
      const resolved = getAssignedDoctorFromSession(currentSession);
      if (resolved) {
        setDialerDefaultDoctor(resolved);
      } else {
        setDialerDefaultDoctor({
          id: 'CARE-TRIAGE',
          name: 'Hospital Tele-Triage Desk',
          doctorName: 'Hospital Tele-Triage Desk',
          role: 'doctor',
          title: 'On-Duty Emergency Medical Staff',
          department: 'Clinical Rapid Response & Telemetry Desk',
          phone: '+91 98444 55667',
          extension: '911',
          avatar: '/assets/telemetry-hub-hero.png',
          status: 'online',
          isAssigned: false,
        });
      }
    }
    setIsDialerOpen(true);
  }, []);

  const closeDialer = useCallback(() => {
    setIsDialerOpen(false);
  }, []);

  // API: Start Video Call (Bidirectional: Doctor -> Patient OR Patient -> Doctor)
  const startCall = useCallback(async (target) => {
    setIsDialerOpen(false);

    const media = await acquireMediaStream();
    if (!media) {
      toast.error('Cannot place video call without camera/microphone permission.');
      return;
    }

    const currentSession = getAuthSession();
    const isDoctorCaller = userRole === 'doctor';
    const generatedCallId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    let callerId = currentUserId;
    let callerRole = userRole;
    let callerName = currentUserName;

    let receiverRole;
    let receiverId;
    let receiverName;
    let doctorId;
    let doctorName;
    let patientId;
    let patientName;

    if (isDoctorCaller) {
      // DOCTOR INITIATES CALL TO SELECTED PATIENT
      receiverRole = 'patient';
      receiverId = String(target?.patientId || target?.id || '').trim();
      receiverName = String(target?.patientName || target?.name || 'Patient').trim();

      if (!receiverId) {
        toast.error('Cannot start call: No patient selected.');
        stopMediaStream();
        return;
      }

      doctorId = currentUserId.toLowerCase();
      doctorName = currentUserName;
      patientId = receiverId;
      patientName = receiverName;
    } else {
      // PATIENT INITIATES CALL TO ASSIGNED DOCTOR
      receiverRole = 'doctor';
      const assignedDoc = getAssignedDoctorFromSession(currentSession);

      const resolvedDocId = String(
        target?.doctorId ||
        (target?.isAssigned ? (assignedDoc?.doctorId || assignedDoc?.id || currentSession?.doctorId || currentSession?.doctorEmail) : '') ||
        target?.id ||
        target?.email ||
        currentSession?.doctorId ||
        currentSession?.doctorEmail ||
        assignedDoc?.id ||
        ''
      ).trim().toLowerCase();

      const resolvedDocName = String(
        target?.doctorName ||
        (target?.isAssigned ? (assignedDoc?.name || currentSession?.doctorName) : '') ||
        target?.name ||
        currentSession?.doctorName ||
        assignedDoc?.name ||
        'Assigned Physician'
      ).trim();

      if (!resolvedDocId) {
        toast.error('Cannot start call: No assigned doctor available.');
        stopMediaStream();
        return;
      }

      receiverId = resolvedDocId;
      receiverName = resolvedDocName;
      doctorId = resolvedDocId;
      doctorName = resolvedDocName;
      patientId = currentUserId;
      patientName = currentUserName;
    }

    const callPayload = {
      callId: generatedCallId,
      callerRole,
      callerId,
      callerName,
      receiverRole,
      receiverId,
      receiverName,
      patientId,
      patientName,
      doctorId,
      doctorName,
      recipientId: receiverId,
      recipientName: receiverName,
      recipientTitle: target?.title || (isDoctorCaller ? 'Monitored Patient' : 'Attending Physician'),
      recipientDepartment: target?.department || 'Ward 4B',
      recipientPhone: target?.phone || '+91 98765 43210',
      recipientExtension: target?.extension || '401',
      isAssignedDoctor: Boolean(target?.isAssigned ?? true),
      callType: 'video',
      status: 'calling',
      vitalsSnapshot: target?.vitalsSnapshot || {
        heartRate: target?.heartRate || 72,
        spo2: target?.spo2 || 98,
        temperature: target?.temperature || 36.7,
        status: target?.status || 'Normal Sinus Rhythm',
      },
      startedAt: Date.now(),
    };

    setActiveCall(callPayload);
    setCallState('calling');
    startRingtone();

    // 45-second auto-timeout if partner does not answer
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
    }
    callTimeoutRef.current = setTimeout(() => {
      stopRingtone();
      stopMediaStream();
      closePeerConnection();
      setCallState('idle');
      setActiveCall(null);
      const partnerRoleLabel = isDoctorCaller ? 'Patient' : 'Doctor';
      toast.error(`${partnerRoleLabel} did not answer. Please try again shortly.`);
      if (socketRef.current) {
        socketRef.current.emit('call:end', {
          callId: generatedCallId,
          patientId,
          doctorId,
        });
      }
    }, 45000);

    if (socketRef.current) {
      socketRef.current.emit('call:request', callPayload);
    } else {
      toast.error('Connecting to signaling server... please try again in a moment.');
    }
  }, [
    acquireMediaStream,
    closePeerConnection,
    currentUserId,
    currentUserName,
    startRingtone,
    stopMediaStream,
    stopRingtone,
    userRole,
  ]);

  // API: Receiver accepts call
  const acceptCall = useCallback(async () => {
    if (!activeCall) return;
    stopRingtone();
    const media = await acquireMediaStream();
    if (!media) {
      toast.error('Cannot answer call without camera/microphone permission.');
      return;
    }

    setCallState('connecting');

    if (socketRef.current) {
      socketRef.current.emit('call:accept', {
        callId: activeCall.callId,
        patientId: activeCall.patientId,
        doctorId: activeCall.doctorId,
        acceptedByRole: userRole,
        acceptedById: currentUserId,
      });
    }
  }, [acquireMediaStream, activeCall, currentUserId, stopRingtone, userRole]);

  // API: Receiver declines call
  const declineCall = useCallback(() => {
    if (!activeCall) return;
    stopRingtone();
    stopMediaStream();
    closePeerConnection();

    if (socketRef.current) {
      socketRef.current.emit('call:reject', {
        callId: activeCall.callId,
        patientId: activeCall.patientId,
        doctorId: activeCall.doctorId,
        reason: `${isDoctor ? 'Physician' : 'Patient'} declined the call`,
      });
    }

    setCallState('idle');
    setActiveCall(null);
    toast('Call declined.', { icon: '📵' });
  }, [activeCall, closePeerConnection, isDoctor, stopMediaStream, stopRingtone]);

  // API: End Active Call
  const endCall = useCallback(() => {
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }

    if (!activeCall) {
      setCallState('idle');
      return;
    }

    stopRingtone();
    stopMediaStream();
    closePeerConnection();

    if (socketRef.current) {
      socketRef.current.emit('call:end', {
        callId: activeCall.callId,
        patientId: activeCall.patientId,
        doctorId: activeCall.doctorId,
        duration: callDuration,
      });
    }

    setCallState('ended');
    setTimeout(() => {
      setCallState('idle');
      setActiveCall(null);
      setCallDuration(0);
    }, 1200);
  }, [activeCall, closePeerConnection, callDuration, stopMediaStream, stopRingtone]);

  // Audio/Video Mute toggles
  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = isMuted;
      });
    }
    setIsMuted(!isMuted);
  }, [isMuted]);

  const toggleCamera = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = isCameraOff;
      });
    }
    setIsCameraOff(!isCameraOff);
  }, [isCameraOff]);

  // Format call duration MM:SS
  const formattedDuration = `${String(Math.floor(callDuration / 60)).padStart(2, '0')}:${String(callDuration % 60).padStart(2, '0')}`;

  // Explicit Participant Identity Separation
  const localParticipant = useMemo(() => ({
    role: userRole,
    id: currentUserId,
    name: currentUserName,
  }), [currentUserId, currentUserName, userRole]);

  const remoteParticipant = useMemo(() => {
    if (!activeCall) return null;
    if (isDoctor) {
      return {
        role: 'patient',
        id: activeCall.patientId,
        name: activeCall.patientName || 'Patient',
        vitals: activeCall.vitalsSnapshot,
      };
    }
    return {
      role: 'doctor',
      id: activeCall.doctorId,
      name: activeCall.doctorName || 'Assigned Physician',
    };
  }, [activeCall, isDoctor]);

  const value = {
    isDialerOpen,
    openDialer,
    closeDialer,
    dialerDefaultDoctor,
    callState,
    activeCall,
    callDuration,
    formattedDuration,
    startCall,
    acceptCall,
    declineCall,
    endCall,
    isMuted,
    isCameraOff,
    toggleMute,
    toggleCamera,
    localStream,
    remoteStream,
    localParticipant,
    remoteParticipant,
    hospitalPhysicians: HOSPITAL_PHYSICIANS,
  };

  return (
    <VideoCallContext.Provider value={value}>
      {children}
    </VideoCallContext.Provider>
  );
}

export function useVideoCall() {
  const context = useContext(VideoCallContext);
  if (!context) {
    throw new Error('useVideoCall must be used within a VideoCallProvider');
  }
  return context;
}
