import React, { useState } from 'react';
import { X, AlertCircle, CheckCircle, AlertTriangle, Info } from 'lucide-react';

const alertTypes = {
  success: {
    icon: CheckCircle,
    class: 'alert-success',
  },
  warning: {
    icon: AlertTriangle,
    class: 'alert-warning',
  },
  danger: {
    icon: AlertCircle,
    class: 'alert-danger',
  },
  info: {
    icon: Info,
    class: 'alert-info',
  },
};

export function Alert({ type = 'info', title, message, onClose, dismissible = true }) {
  const [isVisible, setIsVisible] = useState(true);

  const typeConfig = alertTypes[type] || alertTypes.info;
  const IconComponent = typeConfig.icon;

  const handleClose = () => {
    setIsVisible(false);
    if (onClose) onClose();
  };

  if (!isVisible) return null;

  return (
    <div className={`alert ${typeConfig.class}`} role="alert">
      <IconComponent className="alert-icon" />
      <div className="alert-content">
        {title && <p className="font-semibold">{title}</p>}
        {message && <p className="text-sm">{message}</p>}
      </div>
      {dismissible && (
        <button
          className="alert-close"
          onClick={handleClose}
          aria-label="Close alert"
        >
          <X size={18} />
        </button>
      )}
    </div>
  );
}

export default Alert;
