import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertOctagon,
  CheckCircle2,
  ChevronDown,
  MapPin,
  Phone,
  Video,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '../Card';
import { Button } from '../Button';
import { useEmergency } from '../../context/EmergencyContext';
import { useVideoCall } from '../../context/VideoCallContext';
import { EmergencyMap } from './EmergencyMap';

export function DoctorEmergencyCenter() {
  const {
    doctorActiveEmergencies,
    activeEmergency,
    acknowledgeEmergency,
    resolveEmergency,
  } = useEmergency();
  const { startCall } = useVideoCall();

  const [selectedMapAlert, setSelectedMapAlert] = useState(null);
  const [showAll, setShowAll] = useState(false);

  // Combine live active emergency if doctor is viewing patient
  const displayAlerts = doctorActiveEmergencies.length > 0
    ? doctorActiveEmergencies
    : activeEmergency
    ? [activeEmergency]
    : [];

  if (displayAlerts.length === 0) {
    return null;
  }

  // Show only 1 alert by default to keep the dashboard compact & beautiful
  const visibleAlerts = showAll ? displayAlerts : displayAlerts.slice(0, 1);
  const totalCount = displayAlerts.length;
  const remainingCount = totalCount - 1;

  return (
    <section className="space-y-3">
      {/* Header with active emergency count */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#E11D48] text-white shadow-xs shadow-rose-600/30 animate-pulse">
            <AlertOctagon className="h-4 w-4" />
          </span>
          <h3 className="font-sans text-base sm:text-lg font-bold text-[#0F172A]">
            Emergency Clinical Alerts Center
          </h3>
          <span className="inline-flex items-center rounded-full bg-rose-50 border border-rose-200 px-2.5 py-0.5 text-xs font-bold text-[#E11D48]">
            {totalCount} Active {totalCount > 1 ? 'Emergencies' : 'Emergency'}
          </span>
        </div>

        {totalCount > 1 && (
          <button
            type="button"
            onClick={() => setShowAll(!showAll)}
            className="inline-flex items-center gap-1 text-xs font-bold text-[#E11D48] hover:text-rose-700 transition"
          >
            <span>{showAll ? 'Collapse' : `View All (${totalCount})`}</span>
            <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${showAll ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>

      {/* Emergency Alert Cards */}
      <div className="space-y-3">
        <AnimatePresence initial={false}>
          {visibleAlerts.map((alert) => {
            const isAcknowledged = alert.status === 'EMERGENCY_ACKNOWLEDGED';
            const patientCoords = alert.location || {
              latitude: 28.7504,
              longitude: 77.1839,
              accuracy: 172,
            };

            const hrValue = alert.vitals?.heartRate || '129.3';
            const spo2Value = alert.vitals?.spo2 || '100';
            const tempValue = alert.vitals?.temperature || '39.9';
            const reasonText = alert.triggerReason || 'Extreme Arrhythmia detected (Heart Rate 129.3 BPM outside [50-120] BPM)';

            return (
              <motion.div
                key={alert.alertId || alert.id}
                initial={{ opacity: 0, height: 0, y: -8 }}
                animate={{ opacity: 1, height: 'auto', y: 0 }}
                exit={{ opacity: 0, height: 0, y: -8 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
              >
                <div
                  className={`rounded-[16px] p-4 sm:p-5 border transition-all ${
                    isAcknowledged
                      ? 'border-amber-300 bg-amber-50/40 shadow-xs'
                      : 'border-rose-200 bg-[#FFF5F5] shadow-[0_4px_18px_rgba(225,29,72,0.06)]'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    {/* Left: Patient and Alert Overview */}
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md bg-[#E11D48] text-white text-[10px] font-extrabold uppercase px-2 py-0.5 tracking-wider shadow-2xs">
                          CRITICAL EMERGENCY
                        </span>
                        <h4 className="font-sans text-base sm:text-lg font-bold text-[#0F172A] truncate">
                          {alert.patientName || alert.patientId || 'Patient'}
                        </h4>
                        <span className="text-xs text-[#64748B] font-medium">
                          ID: {alert.patientId || 'N/A'}
                        </span>
                      </div>

                      <p className="text-xs sm:text-sm font-bold text-[#E11D48] leading-snug">
                        {reasonText}
                      </p>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#64748B]">
                        <span>
                          SpO2: <strong className="text-[#0F172A] font-bold">{spo2Value}%</strong>
                        </span>
                        <span>
                          HR: <strong className="text-[#E11D48] font-extrabold">{hrValue} BPM</strong>
                        </span>
                        <span>
                          Temp: <strong className="text-[#0F172A] font-bold">{tempValue}°C</strong>
                        </span>
                        <span className="flex items-center gap-1 font-mono text-[#475569]">
                          <MapPin className="h-3.5 w-3.5 text-[#E11D48]" />
                          {Number(patientCoords.latitude).toFixed(4)}, {Number(patientCoords.longitude).toFixed(4)} (±{patientCoords.accuracy || 172}m)
                        </span>
                      </div>
                    </div>

                    {/* Right: Emergency Action Buttons */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {/* View Location Button (neutral white/gray) */}
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedMapAlert(
                            selectedMapAlert?.alertId === alert.alertId ? null : alert
                          )
                        }
                        className="inline-flex items-center gap-1.5 rounded-[10px] border border-[#E2E8F0] bg-white px-3.5 py-2 text-xs font-semibold text-[#0F172A] shadow-2xs hover:bg-slate-50 transition"
                      >
                        <MapPin className="h-4 w-4 text-[#E11D48]" />
                        <span>{selectedMapAlert?.alertId === alert.alertId ? 'Hide Map' : 'View Location'}</span>
                      </button>

                      {/* Call Patient Button (neutral white/gray) */}
                      <a
                        href={alert.sosContact?.phone ? `tel:${alert.sosContact.phone}` : 'tel:+918601845515'}
                        className="inline-flex items-center gap-1.5 rounded-[10px] border border-[#E2E8F0] bg-white px-3.5 py-2 text-xs font-semibold text-[#0F172A] shadow-2xs hover:bg-slate-50 transition"
                      >
                        <Phone className="h-4 w-4 text-[#64748B]" />
                        <span>Call Patient</span>
                      </a>

                      {/* Video Consult Button (subtle teal styling) */}
                      <button
                        type="button"
                        onClick={() => {
                          startCall({
                            id: alert.patientId || 'N/A',
                            name: alert.patientName || alert.patientId || 'Patient',
                            title: 'Ward Monitored Patient',
                            department: 'Critical Care Telemetry',
                            phone: alert.sosContact?.phone || '',
                            extension: '201',
                            isAssigned: true,
                          });
                        }}
                        className="inline-flex items-center gap-1.5 rounded-[10px] border border-teal-200 bg-teal-50 px-3.5 py-2 text-xs font-semibold text-teal-800 hover:bg-teal-100 transition shadow-2xs"
                      >
                        <Video className="h-4 w-4 text-teal-600" />
                        <span>Video Consult</span>
                      </button>

                      {/* Acknowledge Button (Healthcare Blue #0284C7) */}
                      {!isAcknowledged ? (
                        <button
                          type="button"
                          onClick={() => acknowledgeEmergency(alert.alertId)}
                          className="inline-flex items-center gap-1.5 rounded-[10px] bg-[#0284C7] hover:bg-[#0369A1] text-white px-3.5 py-2 text-xs font-semibold shadow-xs transition"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          <span>Acknowledge</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => resolveEmergency(alert.alertId)}
                          className="inline-flex items-center gap-1.5 rounded-[10px] border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 px-3.5 py-2 text-xs font-semibold transition"
                        >
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          <span>Resolve</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Collapsible Doctor Emergency Map Preview */}
                  {selectedMapAlert?.alertId === alert.alertId ? (
                    <div className="mt-4 pt-4 border-t border-rose-100">
                      <EmergencyMap
                        latitude={patientCoords.latitude}
                        longitude={patientCoords.longitude}
                        accuracy={patientCoords.accuracy}
                        patientName={alert.patientName}
                        status={alert.status}
                        lastUpdated={alert.createdAt || 'Just now'}
                      />
                    </div>
                  ) : null}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* "View More Emergencies" Expandable Control */}
      {remainingCount > 0 && (
        <button
          type="button"
          onClick={() => setShowAll(!showAll)}
          className="flex w-full items-center justify-center gap-1.5 rounded-[12px] border border-[#FECDD3] bg-[#FFF1F2] py-2 px-4 text-xs font-bold text-[#E11D48] hover:bg-rose-100/70 transition-all shadow-2xs group"
        >
          <span>
            {showAll
              ? 'Show Less Emergencies'
              : `View More Emergencies · +${remainingCount} active in ward`}
          </span>
          <ChevronDown
            className={`h-4 w-4 text-[#E11D48] transition-transform duration-200 ${
              showAll ? 'rotate-180' : 'group-hover:translate-y-0.5'
            }`}
          />
        </button>
      )}
    </section>
  );
}

export default DoctorEmergencyCenter;
