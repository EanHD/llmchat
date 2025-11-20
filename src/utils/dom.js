/**
 * DOM Helper Utilities
 * Element creation and event handling helpers
 */

/**
 * Create DOM element with properties
 */
export function createElement(tag, props = {}, ...children) {
  const element = document.createElement(tag);

  // Set properties
  Object.entries(props).forEach(([key, value]) => {
    if (key === 'className') {
      element.className = value;
    } else if (key === 'dataset') {
      Object.entries(value).forEach(([dataKey, dataValue]) => {
        element.dataset[dataKey] = dataValue;
      });
    } else if (key.startsWith('on') && typeof value === 'function') {
      const eventName = key.substring(2).toLowerCase();
      element.addEventListener(eventName, value);
    } else {
      element[key] = value;
    }
  });

  // Append children
  children.forEach(child => {
    if (typeof child === 'string') {
      element.appendChild(document.createTextNode(child));
    } else if (child instanceof Node) {
      element.appendChild(child);
    }
  });

  return element;
}

/**
 * Clear all children from element
 */
export function clearElement(element) {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}

/**
 * Add event listener with cleanup
 */
export function addListener(element, event, handler, options) {
  element.addEventListener(event, handler, options);
  return () => element.removeEventListener(event, handler, options);
}

/**
 * Query selector with error handling
 */
export function $(selector, context = document) {
  const element = context.querySelector(selector);
  if (!element) {
    // Only warn for critical elements (not buttons that may be hidden on desktop)
    const optionalSelectors = ['#close-sidebar-btn', '#voice-btn'];
    if (!optionalSelectors.includes(selector)) {
      console.warn(`Element not found: ${selector}`);
    }
  }
  return element;
}

/**
 * Query selector all
 */
export function $$(selector, context = document) {
  return Array.from(context.querySelectorAll(selector));
}

/**
 * Toggle class on element
 */
export function toggleClass(element, className, force) {
  element.classList.toggle(className, force);
}

/**
 * Set multiple attributes
 */
export function setAttributes(element, attributes) {
  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });
}

/**
 * Debounce function calls
 */
export function debounce(fn, delay) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Throttle function calls
 */
export function throttle(fn, delay) {
  let lastCall = 0;
  return function (...args) {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      fn.apply(this, args);
    }
  };
}
