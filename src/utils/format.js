/**
 * Formatting Utilities
 * Date, text, and number formatting helpers
 */

/**
 * Format timestamp to readable date/time
 */
export function formatDate(timestamp, options = {}) {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  // Less than 1 minute
  if (diffMins < 1) {
    return 'Just now';
  }

  // Less than 1 hour
  if (diffMins < 60) {
    return `${diffMins}m ago`;
  }

  // Less than 24 hours
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  // Less than 7 days
  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }

  // Format as date
  const formatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    ...options
  });

  return formatter.format(date);
}

/**
 * Format full timestamp
 */
export function formatFullDate(timestamp) {
  const date = new Date(timestamp);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(date);
}

/**
 * Truncate text to max length
 */
export function truncate(text, maxLength = 50, suffix = '...') {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength - suffix.length) + suffix;
}

/**
 * Escape HTML special characters
 */
export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Format number with commas
 */
export function formatNumber(num) {
  return new Intl.NumberFormat('en-US').format(num);
}

/**
 * Format file size
 */
export function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Pluralize word based on count
 */
export function pluralize(word, count) {
  return count === 1 ? word : `${word}s`;
}

/**
 * Generate title from text
 */
export function generateTitle(text, maxLength = 50) {
  // Remove extra whitespace
  const cleaned = text.trim().replace(/\s+/g, ' ');
  
  // Truncate at sentence or word boundary
  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  // Try to break at sentence
  const sentences = cleaned.match(/[^.!?]+[.!?]+/g);
  if (sentences && sentences[0] && sentences[0].length <= maxLength) {
    return sentences[0].trim();
  }

  // Break at word boundary
  const truncated = cleaned.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  
  if (lastSpace > maxLength * 0.7) {
    return truncated.substring(0, lastSpace) + '...';
  }

  return truncated + '...';
}
