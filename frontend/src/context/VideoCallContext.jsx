import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { getAuthSession, normalizeRole } from '../utils/auth';

const VideoCallContext = createContext(null);

// Standard Available Hospital Physicians
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
    isAssigned: true,
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
  const currentUserId = isDoctor ? (session?.email || 'abhishek@gmail.com') : (session?.patientId || 'pat-2026-2007');
  const currentUserName = session?.name || (isDoctor ? 'Dr. Abhishek Rai' : 'Akash Soni');

  // Modal & Call States
  const [isDialerOpen, setIsDialerOpen] = useState(false);
  const [dialerDefaultDoctor, setDialerDefaultDoctor] = useState(HOSPITAL_PHYSICIANS[0]);
  
  // Call Lifecycle: 'idle' | 'calling' | 'incoming' | 'connected' | 'ended' | 'rejected'
  const [callState, setCallState] = useState('idle');
  const [activeCall, setActiveCall] = useState(null);
  const [callDuration, setCallDuration] = useState(0);

  // Audio / Video stream controls
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const localStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const ringtoneTimerRef = useRef(null);
  const callTimerRef = useRef(null);
  const broadcastChannelRef = useRef(null);

  // Synthesize Realistic Clinical Phone Ringtone via Web Audio API (cross-browser, zero external files)
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

          // Standard US/International PBX ringtone frequencies (440Hz + 480Hz)
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
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.18); // A5
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
        return stream;
      }
    } catch (err) {
      console.warn('Camera/Mic permission denied or not available, using simulated stream:', err);
    }
    return null;
  }, []);

  const stopMediaStream = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
  }, []);

  // Broadcast signaling across browser tabs/windows
  const broadcastCallEvent = useCallback((event) => {
    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.postMessage(event);
    }
    try {
      localStorage.setItem('smart_health_call_event', JSON.stringify({ ...event, _ts: Date.now() }));
    } catch {
      // ignore
    }
  }, []);

  // Handle incoming broadcast events
  const handleSignalingMessage = useCallback((event) => {
    if (!event || !event.type) return;

    const { type, payload } = event;

    switch (type) {
      case 'CALL_INITIATED': {
        // If current session is doctor or target recipient, trigger incoming call!
        const isTargetDoctor = isDoctor || payload.recipientId === currentUserId || payload.recipientRole === 'doctor';
        if (isTargetDoctor && callState === 'idle') {
          setActiveCall(payload);
          setCallState('incoming');
          startRingtone();
        }
        break;
      }

      case 'CALL_ACCEPTED': {
        // When doctor accepts, the patient's outgoing call transitions to connected
        if (activeCall && (activeCall.callId === payload.callId)) {
          stopRingtone();
          playConnectChime();
          setCallState('connected');
          toast.success(`${payload.doctorName || 'Doctor'} accepted the video call!`);
        }
        break;
      }

      case 'CALL_DECLINED': {
        if (activeCall && (activeCall.callId === payload.callId)) {
          stopRingtone();
          setCallState('rejected');
          toast.error(`${payload.declinedByName || 'Doctor'} is currently unavailable.`);
          setTimeout(() => {
            setCallState('idle');
            setActiveCall(null);
          }, 3500);
        }
        break;
      }

      case 'CALL_ENDED': {
        if (activeCall && (activeCall.callId === payload.callId)) {
          stopRingtone();
          stopMediaStream();
          setCallState('ended');
          toast('Video consultation completed.', { icon: 'ℹ️' });
          setTimeout(() => {
            setCallState('idle');
            setActiveCall(null);
            setCallDuration(0);
          }, 2000);
        }
        break;
      }

      default:
        break;
    }
  }, [activeCall, callState, currentUserId, isDoctor, playConnectChime, startRingtone, stopMediaStream, stopRingtone]);

  // Listen to BroadcastChannel and localStorage events
  useEffect(() => {
    let channel;
    try {
      channel = new BroadcastChannel('smart_health_video_call_channel');
      broadcastChannelRef.current = channel;
      channel.onmessage = (msg) => {
        handleSignalingMessage(msg.data);
      };
    } catch {
      // BroadcastChannel fallback to storage listener below
    }

    const onStorage = (e) => {
      if (e.key === 'smart_health_call_event' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          handleSignalingMessage(parsed);
        } catch {
          // ignore
        }
      }
    };

    window.addEventListener('storage', onStorage);

    return () => {
      if (channel) channel.close();
      window.removeEventListener('storage', onStorage);
    };
  }, [handleSignalingMessage]);

  // Call duration timer
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

  // API: Open Patient Dialer Modal
  const openDialer = useCallback((defaultDoctor = null) => {
    if (defaultDoctor) {
      setDialerDefaultDoctor(defaultDoctor);
    } else {
      setDialerDefaultDoctor(HOSPITAL_PHYSICIANS[0]);
    }
    setIsDialerOpen(true);
  }, []);

  const closeDialer = useCallback(() => {
    setIsDialerOpen(false);
  }, []);

  // API: Patient starts call to doctor
  const startCall = useCallback(async (targetDoctor) => {
    setIsDialerOpen(false);
    await acquireMediaStream();

    const callPayload = {
      callId: `CALL-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      callerId: currentUserId,
      callerName: currentUserName,
      callerRole: userRole,
      callerPhone: '+91 86018 45515',
      patientId: isDoctor ? 'PAT-2026-2007' : currentUserId,
      patientName: isDoctor ? 'Akash Soni' : currentUserName,
      recipientId: targetDoctor.id || targetDoctor.email || 'DOC-4B-01',
      recipientName: targetDoctor.name || 'Dr. Abhishek Rai',
      recipientTitle: targetDoctor.title || 'Cardiologist',
      recipientDepartment: targetDoctor.department || 'Ward 4B',
      recipientPhone: targetDoctor.phone || '+91 98765 43210',
      recipientExtension: targetDoctor.extension || '401',
      doctorName: targetDoctor.name || 'Dr. Abhishek Rai',
      dialedNumber: targetDoctor.dialedNumber || targetDoctor.phone || targetDoctor.extension,
      isAssignedDoctor: Boolean(targetDoctor.isAssigned),
      vitalsSnapshot: {
        heartRate: 72,
        spo2: 98,
        temperature: 36.7,
        status: 'Normal Sinus Rhythm',
      },
      startedAt: Date.now(),
    };

    setActiveCall(callPayload);
    setCallState('calling');
    startRingtone();

    // Broadcast call to doctor
    broadcastCallEvent({
      type: 'CALL_INITIATED',
      payload: callPayload,
    });
  }, [acquireMediaStream, broadcastCallEvent, currentUserId, currentUserName, isDoctor, startRingtone, userRole]);

  // API: Doctor accepts call
  const acceptCall = useCallback(async () => {
    if (!activeCall) return;
    stopRingtone();
    await acquireMediaStream();

    const updatedCall = {
      ...activeCall,
      doctorName: currentUserName,
      connectedAt: Date.now(),
    };

    setActiveCall(updatedCall);
    setCallState('connected');
    playConnectChime();

    broadcastCallEvent({
      type: 'CALL_ACCEPTED',
      payload: updatedCall,
    });
  }, [acquireMediaStream, activeCall, broadcastCallEvent, currentUserName, playConnectChime, stopRingtone]);

  // API: Doctor declines call
  const declineCall = useCallback(() => {
    if (!activeCall) return;
    stopRingtone();
    stopMediaStream();

    broadcastCallEvent({
      type: 'CALL_DECLINED',
      payload: {
        callId: activeCall.callId,
        declinedByName: currentUserName,
      },
    });

    setCallState('idle');
    setActiveCall(null);
    toast('Call declined.', { icon: '📵' });
  }, [activeCall, broadcastCallEvent, currentUserName, stopMediaStream, stopRingtone]);

  // API: End Active Call
  const endCall = useCallback(() => {
    if (!activeCall) {
      setCallState('idle');
      return;
    }

    stopRingtone();
    stopMediaStream();

    broadcastCallEvent({
      type: 'CALL_ENDED',
      payload: {
        callId: activeCall.callId,
        endedByName: currentUserName,
        duration: callDuration,
      },
    });

    setCallState('ended');
    setTimeout(() => {
      setCallState('idle');
      setActiveCall(null);
      setCallDuration(0);
    }, 1500);
  }, [activeCall, broadcastCallEvent, callDuration, currentUserName, stopMediaStream, stopRingtone]);

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

  // For testing: simulate an incoming call from a patient to the doctor
  const simulateIncomingPatientCall = useCallback(() => {
    const mockCall = {
      callId: `CALL-SIM-${Date.now()}`,
      callerId: 'pat-2026-2007',
      callerName: 'Akash Soni',
      callerRole: 'patient',
      callerPhone: '+91 86018 45515',
      patientId: 'PAT-2026-2007',
      patientName: 'Akash Soni',
      recipientId: currentUserId,
      recipientName: isDoctor ? currentUserName : 'Dr. Abhishek Rai',
      recipientTitle: 'Chief of Cardiology',
      recipientDepartment: 'Cardiology Ward 4B',
      doctorName: isDoctor ? currentUserName : 'Dr. Abhishek Rai',
      isAssignedDoctor: true,
      vitalsSnapshot: {
        heartRate: 74,
        spo2: 98,
        temperature: 36.8,
        status: 'Normal Sinus Rhythm',
      },
      startedAt: Date.now(),
    };

    setActiveCall(mockCall);
    setCallState('incoming');
    startRingtone();
    toast('Incoming simulated patient video call...', { icon: '📞' });
  }, [currentUserId, currentUserName, isDoctor, startRingtone]);

  // Format call duration MM:SS
  const formattedDuration = `${String(Math.floor(callDuration / 60)).padStart(2, '0')}:${String(callDuration % 60).padStart(2, '0')}`;

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
    localStream: localStreamRef.current,
    simulateIncomingPatientCall,
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
