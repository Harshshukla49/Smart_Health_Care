/**
 * Vital Signs Animation and Dynamic Color Utilities
 * Provides helpers for critical value detection, color mapping, and animations
 */

export const VITAL_THRESHOLDS = {
  heartRate: { min: 60, max: 120, critical_high: 140, critical_low: 40 },
  spo2: { min: 95, max: 100, critical: 90 },
  temperature: { min: 36.5, max: 37.5, critical_high: 38.5, critical_low: 35 },
};

/**
 * Determine vital status based on value
 * @param {number} value - Vital value
 * @param {string} type - Vital type (heartRate, spo2, temperature)
 * @returns {string} - Status: 'normal', 'warning', 'critical'
 */
export function getVitalStatus(value, type) {
  if (!value || isNaN(value)) return 'unknown';

  const thresholds = VITAL_THRESHOLDS[type];
  if (!thresholds) return 'unknown';

  switch (type) {
    case 'heartRate':
      if (value >= thresholds.critical_high || value <= thresholds.critical_low)
        return 'critical';
      if (value < thresholds.min || value > thresholds.max)
        return 'warning';
      return 'normal';

    case 'spo2':
      if (value < thresholds.critical) return 'critical';
      if (value < thresholds.min) return 'warning';
      return 'normal';

    case 'temperature':
      if (value >= thresholds.critical_high || value <= thresholds.critical_low)
        return 'critical';
      if (value < thresholds.min || value > thresholds.max)
        return 'warning';
      return 'normal';

    default:
      return 'unknown';
  }
}

/**
 * Get color class for vital status
 * @param {string} status - Vital status (normal, warning, critical)
 * @returns {string} - Tailwind/CSS class
 */
export function getStatusColorClass(status) {
  switch (status) {
    case 'critical':
      return 'text-red-400 animate-pulse';
    case 'warning':
      return 'text-yellow-400';
    case 'normal':
      return 'text-green-400';
    default:
      return 'text-slate-300';
  }
}

/**
 * Animate number change from old value to new value
 * @param {HTMLElement} element - DOM element to animate
 * @param {number} oldValue - Starting value
 * @param {number} newValue - Ending value
 * @param {number} duration - Animation duration in ms (default 600)
 */
export function animateNumberChange(element, oldValue, newValue, duration = 600) {
  if (!element || !Number.isFinite(oldValue) || !Number.isFinite(newValue)) {
    return;
  }

  const startTime = performance.now();
  const difference = newValue - oldValue;

  function updateNumber(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    const easeOutQuad = 1 - (1 - progress) ** 2;
    const currentValue = oldValue + difference * easeOutQuad;

    element.textContent = currentValue.toFixed(1);

    if (progress < 1) {
      requestAnimationFrame(updateNumber);
    }
  }

  requestAnimationFrame(updateNumber);
}

/**
 * Trigger pulse animation for critical values
 * @param {HTMLElement} element - DOM element to pulse
 * @param {boolean} isCritical - Whether value is critical
 */
export function triggerPulseAnimation(element, isCritical) {
  if (!element) return;

  if (isCritical) {
    element.classList.add('animate-pulse', 'pulse-glow');
  } else {
    element.classList.remove('animate-pulse', 'pulse-glow');
  }
}

/**
 * Add glow effect to card based on vital status
 * @param {HTMLElement} element - Card element
 * @param {string} status - Vital status
 */
export function applyGlowEffect(element, status) {
  if (!element) return;

  element.classList.remove('glow-primary', 'glow-accent');

  switch (status) {
    case 'critical':
      element.style.boxShadow = '0 0 20px rgba(239, 68, 68, 0.4)';
      break;
    case 'normal':
      element.classList.add('glow-accent');
      break;
    default:
      element.classList.add('glow-primary');
  }
}

/**
 * Format vital value with unit
 * @param {number} value - Vital value
 * @param {string} unit - Unit of measurement
 * @param {number} decimals - Number of decimal places
 * @returns {string} - Formatted value
 */
export function formatVitalValue(value, unit, decimals = 1) {
  if (!Number.isFinite(value)) return `-- ${unit}`;
  return `${value.toFixed(decimals)} ${unit}`;
}

/**
 * Create heart rate card with pulse animation
 * Used for dynamic pulse effects on heart rate cards
 */
export function initializeHeartRateAnimation() {
  const heartRateElements = document.querySelectorAll('[data-vital-type="heart"]');
  
  heartRateElements.forEach((element) => {
    const value = parseFloat(element.getAttribute('data-value'));
    const status = getVitalStatus(value, 'heartRate');
    
    if (status === 'critical') {
      element.classList.add('heart-beat');
    }
  });
}

/**
 * Smooth scroll to vital section
 * @param {string} sectionId - Section ID to scroll to
 */
export function smoothScrollToSection(sectionId) {
  const element = document.getElementById(sectionId);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

/**
 * Add hover lift animation to card
 * @param {HTMLElement} card - Card element
 */
export function addHoverLiftAnimation(card) {
  if (!card) return;

  card.addEventListener('mouseenter', () => {
    card.style.transform = 'translateY(-4px)';
    card.style.boxShadow = '0 20px 40px rgba(0, 0, 0, 0.3)';
  });

  card.addEventListener('mouseleave', () => {
    card.style.transform = 'translateY(0)';
    card.style.boxShadow = 'var(--glass-shadow)';
  });
}

export default {
  VITAL_THRESHOLDS,
  getVitalStatus,
  getStatusColorClass,
  animateNumberChange,
  triggerPulseAnimation,
  applyGlowEffect,
  formatVitalValue,
  initializeHeartRateAnimation,
  smoothScrollToSection,
  addHoverLiftAnimation,
};
