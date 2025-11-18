/**
 * Toast Notification Component
 * User feedback for errors, success messages, and warnings
 */

import { createElement } from '../utils/dom.js';

class ToastManager {
  constructor() {
    this.container = null;
    this.init();
  }

  /**
   * Initialize toast container
   */
  init() {
    this.container = createElement('div', {
      className: 'toast-container',
      id: 'toast-container'
    });
    document.body.appendChild(this.container);
  }

  /**
   * Show toast notification
   */
  show(message, type = 'info', duration = 3000) {
    const toast = this.createToast(message, type);
    this.container.appendChild(toast);

    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 10);

    // Auto-dismiss
    if (duration > 0) {
      setTimeout(() => this.dismiss(toast), duration);
    }

    return toast;
  }

  /**
   * Create toast element
   */
  createToast(message, type) {
    const icons = {
      info: '✓',
      success: '✓',
      warning: '⚠',
      error: '✕'
    };

    const icon = createElement('span', {
      className: 'toast-icon'
    }, icons[type] || icons.info);

    const text = createElement('span', {
      className: 'toast-message'
    }, message);

    const closeBtn = createElement('button', {
      className: 'toast-close',
      onClick: (e) => {
        e.stopPropagation();
        this.dismiss(toast);
      }
    }, '✕');

    const toast = createElement('div', {
      className: `toast toast-${type}`,
      onClick: () => this.dismiss(toast)
    }, icon, text, closeBtn);

    return toast;
  }

  /**
   * Dismiss toast
   */
  dismiss(toast) {
    toast.classList.remove('show');
    toast.classList.add('hide');

    setTimeout(() => {
      if (toast.parentElement) {
        toast.parentElement.removeChild(toast);
      }
    }, 300);
  }

  /**
   * Show success message
   */
  success(message, duration) {
    return this.show(message, 'success', duration);
  }

  /**
   * Show error message
   */
  error(message, duration = 5000) {
    return this.show(message, 'error', duration);
  }

  /**
   * Show warning message
   */
  warning(message, duration = 4000) {
    return this.show(message, 'warning', duration);
  }

  /**
   * Show info message
   */
  info(message, duration) {
    return this.show(message, 'info', duration);
  }

  /**
   * Clear all toasts
   */
  clearAll() {
    const toasts = this.container.querySelectorAll('.toast');
    toasts.forEach(toast => this.dismiss(toast));
  }
}

// Export singleton instance
export const toast = new ToastManager();
