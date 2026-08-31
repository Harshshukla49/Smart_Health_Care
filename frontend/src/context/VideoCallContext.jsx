import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { io } from 'socket.io-client';
import { getAuthSession, normalizeRole } from '../utils/auth';

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

// Standard Available Hospital Physicians (Fallback roster for patient dialing)
export const HOSPITAL_PHYSICIANS = [
  {
    id: 'DOC-4B-01',
    name: 'Dr. Abhishek Rai',
    role: 'doctor',
    title: 'Chief of Cardiology',
    department: 'Cardiology & Intensive Ward 4B',
    phone: '+91 98765 43210',
    extension: '401',
    avatar: '/assets/doctor-command-center.png',
    status: 'online',
    isAssigned: false,
  },
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

export function VideoCallProvider({ children }) {
  const session = getAuthSession();
  const userRole = normalizeRole(session?.role);
  const isDoctor = userRole === 'doctor';
  const currentUserId = isDoctor
    ? (session?.doctorId || session?.email || '')
    : (session?.patientId || '');
  const currentUserName = session?.name || (isDoctor ? 'Doctor' : 'Patient');

  // Modal & Call States
  const [isDialerOpen, setIsDialerOpen] = useState(false);
  const [dialerDefaultDoctor, setDialerDefaultDoctor] = useState(HOSPITAL_PHYSICIANS[0]);

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
  const callTimerRef = useRef(null);
  const callTimeoutRef = useRef(null);

  // Synthesize Realistic Clinical Phone Ringtone via Web Audio API
  const startRingtone = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioCtx();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const playBurst = () => {
        if (!audioContextRef.current) return;
        try {
          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const gain = ctx.createGain();

          osc1.frequency.value = 440;
          osc2.frequency.value = 480;

          gain.gain.setValueAtTime(0.04, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.8);

          osc1.connect(gain);
          osc2.connect(gain);
          gain.connect(ctx.destination);

          osc1.start();
          osc2.start();
          osc1.stop(ctx.currentTime + 1.8);
          osc2.stop(ctx.currentTime + 1.8);
        } catch {
          // ignore audio burst error
        }
      };

      playBurst();
      ringtoneTimerRef.current = window.setInterval(playBurst, 3200);
    } catch {
      // ignore web audio failure
    }
  }, []);

  const stopRingtone = useCallback(() => {
    if (ringtoneTimerRef.current) {
      clearInterval(ringtoneTimerRef.current);
      ringtoneTimerRef.current = null;
    }
  }, []);

  // Play pleasant call connected chime
  const playConnectChime = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = audioContextRef.current || new AudioCtx();
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
  }, []);

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

  // Persistent Authenticated Socket Connection
  useEffect(() => {
    if (!session) return undefined;

    const socket = io(SOCKET_BASE_URL, {
      transports: ['websocket', 'polling'],
      auth: {
        token: session?.token,
        role: userRole,
        doctorId: session?.doctorId || session?.email,
        patientId: session?.patientId,
        email: session?.email,
        name: session?.name,
      },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('call:register', {
        role: userRole,
        doctorId: session?.doctorId || session?.email,
        patientId: session?.patientId,
        email: session?.email,
        name: session?.name,
      });
    });

    // 1. Incoming Call Event (Received by targeted participant: Doctor or Patient)
    socket.on('call:incoming', (payload) => {
      // Guard: Receiver should match current role
      if (payload.receiverRole && payload.receiverRole !== userRole) return;

      setActiveCall(payload);
      setCallState('incoming');
      startRingtone();
    });

    // 2. Call Accepted Event (Received by whichever party initiated the call)
    socket.on('call:accepted', async (payload) => {
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }
      stopRingtone();
      playConnectChime();
      setCallState('connecting');

      // The caller initiates the WebRTC offer towards the counterparty
      const isDoctorCaller = userRole === 'doctor';
      const targetRole = isDoctorCaller ? 'patient' : 'doctor';
      const targetId = isDoctorCaller ? payload.patientId : payload.doctorId;

      const pc = createPeerConnection(payload.callId, targetRole, targetId);

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
      const isDoctorReceiver = userRole === 'doctor';
      const targetRole = isDoctorReceiver ? 'patient' : 'doctor';
      const targetId = isDoctorReceiver
        ? (payload.fromId || activeCall?.patientId)
        : (payload.fromId || activeCall?.doctorId);

      const pc = createPeerConnection(payload.callId, targetRole, targetId);

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

        playConnectChime();
        setCallState('connecting');
      } catch (err) {
        console.error('[WEBRTC] Failed to process offer:', err);
      }
    });

    // 4. WebRTC Answer (Received by the offerer)
    socket.on('webrtc:answer', async (payload) => {
      const pc = peerConnectionRef.current;
      if (pc) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));

          // Flush any queued ICE candidates
          while (iceCandidateQueueRef.current.length > 0) {
            const cand = iceCandidateQueueRef.current.shift();
            await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
          }
          // When ICE finishes, onconnectionstatechange will set 'connected'
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
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }
      stopRingtone();
      stopMediaStream();
      closePeerConnection();
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
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }
      stopRingtone();
      stopMediaStream();
      closePeerConnection();
      setCallState('unavailable');
      toast.error(payload?.message || 'Participant is currently offline or unavailable.');
      setTimeout(() => {
        setCallState('idle');
        setActiveCall(null);
      }, 3500);
    });

    // 8. Busy Event
    socket.on('call:busy', (payload) => {
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }
      stopRingtone();
      stopMediaStream();
      closePeerConnection();
      setCallState('busy');
      toast.error(payload?.message || 'Participant is currently on another call.');
      setTimeout(() => {
        setCallState('idle');
        setActiveCall(null);
      }, 3500);
    });

    // 9. Call Ended Event
    socket.on('call:ended', () => {
      stopRingtone();
      stopMediaStream();
      closePeerConnection();
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
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }
      stopRingtone();
      stopMediaStream();
      closePeerConnection();
      setCallState('idle');
      setActiveCall(null);
      toast.error(payload?.message || 'Call signaling error occurred.');
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [
    createPeerConnection,
    closePeerConnection,
    currentUserId,
    isDoctor,
    playConnectChime,
    session,
    startRingtone,
    stopMediaStream,
    stopRingtone,
    userRole,
  ]);

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

  // API: Open Dialer Modal
  const openDialer = useCallback((defaultDoctor = null) => {
    if (defaultDoctor) {
      setDialerDefaultDoctor(defaultDoctor);
    } else {
      const currentSession = getAuthSession();
      if (currentSession?.doctorName || currentSession?.doctorEmail || currentSession?.doctorId) {
        const rawName = currentSession?.doctorName || (currentSession?.doctorEmail ? currentSession.doctorEmail.split('@')[0] : 'Assigned Physician');
        setDialerDefaultDoctor({
          id: currentSession?.doctorId || currentSession?.doctorEmail || 'DOC-ASSIGNED',
          name: rawName.toLowerCase().startsWith('dr.') ? rawName : `Dr. ${rawName}`,
          role: 'doctor',
          title: currentSession?.doctorSpecialty || 'Attending Physician',
          department: 'Cardiology & Intensive Ward 4B',
          phone: currentSession?.doctorPhone || '+91 98765 43210',
          extension: '401',
          avatar: '/assets/doctor-command-center.png',
          status: 'online',
          isAssigned: true,
        });
      } else {
        setDialerDefaultDoctor(HOSPITAL_PHYSICIANS[0]);
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
      receiverId = String(
        target?.doctorId ||
        target?.id ||
        target?.email ||
        currentSession?.doctorId ||
        currentSession?.doctorEmail ||
        ''
      ).trim().toLowerCase();

      receiverName = String(
        target?.doctorName ||
        target?.name ||
        currentSession?.doctorName ||
        'Assigned Physician'
      ).trim();

      if (!receiverId) {
        toast.error('Cannot start call: No assigned doctor available.');
        stopMediaStream();
        return;
      }

      doctorId = receiverId;
      doctorName = receiverName;
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
