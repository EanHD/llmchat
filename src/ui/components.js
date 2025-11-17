/**
 * Reusable UI Components
 * Button, input, message bubble, loading spinner, etc.
 */

import { createElement } from '../utils/dom.js';

/**
 * Create button component
 */
export function createButton(text, options = {}) {
  const {
    className = '',
    icon = null,
    onClick = null,
    disabled = false,
    ariaLabel = null
  } = options;

  const props = {
    className: `${className}`.trim(),
    disabled
  };

  if (onClick) {
    props.onClick = onClick;
  }

  if (ariaLabel) {
    props['aria-label'] = ariaLabel;
  }

  return createElement('button', props, text);
}

/**
 * Create icon button
 */
export function createIconButton(iconSvg, options = {}) {
  const {
    className = 'icon',
    onClick = null,
    ariaLabel = 'Button'
  } = options;

  const button = createElement('button', {
    className,
    onClick,
    'aria-label': ariaLabel
  });

  button.innerHTML = iconSvg;
  return button;
}

/**
 * Create message bubble
 */
export function createMessageBubble(message) {
  const { role, content, status } = message;
  
  const isUser = role === 'user';
  const avatar = createElement('div', {
    className: 'message-avatar'
  }, isUser ? 'U' : 'AI');

  const messageContent = createElement('div', {
    className: 'message-content'
  });
  messageContent.textContent = content;

  const messageEl = createElement('div', {
    className: `message ${role} ${status}`,
    dataset: { messageId: message.id }
  }, avatar, messageContent);

  return messageEl;
}

/**
 * Create loading spinner
 */
export function createSpinner(size = 'md') {
  return createElement('div', {
    className: `spinner spinner-${size}`,
    role: 'status',
    'aria-label': 'Loading'
  });
}

/**
 * Create empty state
 */
export function createEmptyState(title, description) {
  const icon = createElement('div', {
    className: 'empty-state-icon'
  }, '💬');

  const titleEl = createElement('div', {
    className: 'empty-state-title'
  }, title);

  const descEl = createElement('div', {
    className: 'empty-state-text'
  }, description);

  return createElement('div', {
    className: 'empty-state'
  }, icon, titleEl, descEl);
}

/**
 * Create conversation list item
 */
export function createConversationItem(conversation, isActive = false) {
  const title = createElement('div', {
    className: 'conversation-title'
  }, conversation.title);

  const item = createElement('div', {
    className: `conversation-item ${isActive ? 'active' : ''}`,
    dataset: { conversationId: conversation.id }
  }, title);

  return item;
}

/**
 * Create toast notification
 */
export function showToast(message, type = 'info') {
  const toast = createElement('div', {
    className: `toast toast-${type} animate-slide-in`
  }, message);

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/**
 * Create modal
 */
export function createModal(title, content, actions = []) {
  const modalTitle = createElement('h3', {
    className: 'modal-title'
  }, title);

  const modalContent = createElement('div', {
    className: 'modal-content'
  }, content);

  const modalActions = createElement('div', {
    className: 'modal-actions'
  }, ...actions);

  const modalBody = createElement('div', {
    className: 'modal-body'
  }, modalTitle, modalContent, modalActions);

  const overlay = createElement('div', {
    className: 'modal-overlay'
  }, modalBody);

  return overlay;
}
