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
  
  const messageContent = createElement('div', {
    className: 'message-content'
  });
  
  // Set content as text or render markdown if enabled
  messageContent.textContent = content || (status === 'streaming' ? '' : '...');

  const messageEl = createElement('div', {
    className: `message ${role} ${status || ''}`,
    dataset: { messageId: message.id }
  }, messageContent);

  // Long press for haptics
  let pressTimer;
  messageEl.addEventListener('touchstart', () => {
    pressTimer = setTimeout(() => {
      if (navigator.vibrate) {
        navigator.vibrate(5);
      }
    }, 500);
  }, { passive: true });

  messageEl.addEventListener('touchend', () => {
    clearTimeout(pressTimer);
  });

  messageEl.addEventListener('touchmove', () => {
    clearTimeout(pressTimer);
  });

  // Add TTS button for assistant messages - REMOVED


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
export function createConversationItem(conversation, isActive = false, handlers = {}) {
  const { onRename, onDelete, onToggleStar } = handlers;
  
  const titleContainer = createElement('div', {
    className: 'conversation-title-container'
  });
  
  const title = createElement('div', {
    className: 'conversation-title'
  }, conversation.title);
  
  titleContainer.appendChild(title);
  
  // Star button
  const starBtn = createElement('button', {
    className: 'conversation-action-btn star-btn',
    'aria-label': conversation.starred ? 'Unstar' : 'Star',
    title: conversation.starred ? 'Unstar' : 'Star'
  });
  starBtn.innerHTML = conversation.starred 
    ? '<svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>'
    : '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>';
  
  // Actions container (visible on hover)
  const actions = createElement('div', {
    className: 'conversation-actions'
  });
  
  // Rename button
  const renameBtn = createElement('button', {
    className: 'conversation-action-btn',
    'aria-label': 'Rename',
    title: 'Rename'
  });
  renameBtn.innerHTML = '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
  
  // Delete button
  const deleteBtn = createElement('button', {
    className: 'conversation-action-btn delete-btn',
    'aria-label': 'Delete',
    title: 'Delete'
  });
  deleteBtn.innerHTML = '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
  
  // Event handlers with stopPropagation to prevent conversation switch
  if (onToggleStar) {
    starBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      onToggleStar(conversation.id);
    });
  }
  
  if (onRename) {
    renameBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      onRename(conversation.id, conversation.title);
    });
  }
  
  if (onDelete) {
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      onDelete(conversation.id);
    });
  }
  
  actions.appendChild(starBtn);
  actions.appendChild(renameBtn);
  actions.appendChild(deleteBtn);
  
  const item = createElement('div', {
    className: `conversation-item ${isActive ? 'active' : ''} ${conversation.starred ? 'starred' : ''}`,
    dataset: { conversationId: conversation.id }
  });
  
  item.appendChild(titleContainer);
  item.appendChild(actions);

  // Swipe detection for mobile
  let touchStartX = 0;
  let touchEndX = 0;
  let touchStartY = 0;
  let touchEndY = 0;

  item.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
  }, { passive: true });

  item.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    touchEndY = e.changedTouches[0].screenY;
    handleSwipe();
  }, { passive: true });

  function handleSwipe() {
    const xDiff = touchStartX - touchEndX;
    const yDiff = touchStartY - touchEndY;
    
    // Check if horizontal swipe is dominant and long enough
    if (Math.abs(xDiff) > Math.abs(yDiff) && Math.abs(xDiff) > 50) {
      if (xDiff > 0) {
        // Swipe Left -> Show actions
        // Close other swiped items first
        document.querySelectorAll('.conversation-item.swiped').forEach(el => {
          if (el !== item) el.classList.remove('swiped');
        });
        item.classList.add('swiped');
      } else {
        // Swipe Right -> Hide actions
        item.classList.remove('swiped');
      }
    }
  }

  // Handle tap to close actions if open
  item.addEventListener('click', (e) => {
    if (item.classList.contains('swiped') && !e.target.closest('.conversation-actions')) {
      item.classList.remove('swiped');
      e.stopPropagation(); // Prevent opening chat when just closing actions
      return;
    }
  });

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
