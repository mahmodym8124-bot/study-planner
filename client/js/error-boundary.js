/**
 * Error Boundary System
 * Catches and handles JavaScript errors, API failures, and runtime exceptions
 * Provides recovery UI and error logging
 */

export class ErrorBoundary {
  constructor(options = {}) {
    this.onError = options.onError || this.defaultErrorHandler;
    this.onRecover = options.onRecover || (() => {});
    this.showUI = options.showUI !== false;
    this.maxErrors = options.maxErrors || 5;
    this.resetInterval = options.resetInterval || 60000; // 1 minute
    this.errors = [];
    this.listeners = new Set();
    this.setupGlobalHandlers();
  }

  setupGlobalHandlers() {
    // Catch synchronous errors
    window.addEventListener('error', (event) => {
      this.captureError(event.error || new Error(event.message), 'uncaught');
    });

    // Catch unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.captureError(event.reason || new Error('Unhandled Promise Rejection'), 'unhandled-promise');
      event.preventDefault();
    });

    // Reset error count periodically
    this.resetTimer = setInterval(() => {
      if (this.errors.length > 0) {
        this.errors = [];
      }
    }, this.resetInterval);
  }

  captureError(error, source = 'unknown', context = {}) {
    const errorObj = {
      timestamp: new Date().toISOString(),
      source,
      message: error?.message || String(error),
      stack: error?.stack || '',
      context,
      url: window.location.href,
      userAgent: navigator.userAgent
    };

    this.errors.push(errorObj);

    // Prevent error spam
    if (this.errors.length > this.maxErrors) {
      this.errors.shift();
    }

    // Notify listeners
    this.notifyListeners(errorObj);

    // Log error
    console.error(`[ErrorBoundary] ${source}:`, error, context);

    // Call custom error handler
    this.onError(errorObj);

    // Show error UI if enabled
    if (this.showUI) {
      this.displayError(errorObj);
    }
  }

  captureAsync(promise, source = 'async-operation', context = {}) {
    return promise.catch((error) => {
      this.captureError(error, source, context);
      throw error;
    });
  }

  wrap(fn, source = 'wrapped-function') {
    return (...args) => {
      try {
        const result = fn(...args);
        if (result instanceof Promise) {
          return this.captureAsync(result, source);
        }
        return result;
      } catch (error) {
        this.captureError(error, source, { args });
        throw error;
      }
    };
  }

  displayError(errorObj) {
    const toast = this.createErrorToast(errorObj);
    document.body.appendChild(toast);

    // Auto-remove after 8 seconds
    setTimeout(() => {
      toast.remove();
    }, 8000);
  }

  createErrorToast(errorObj) {
    const toast = document.createElement('div');
    toast.className = 'error-toast';
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');

    const isDev = import.meta.env.MODE === 'development';
    const message = this.getErrorMessage(errorObj);

    toast.innerHTML = `
      <div class="error-toast-content">
        <div class="error-toast-header">
          <svg class="error-icon" viewBox="0 0 24 24" width="20" height="20">
            <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/>
            <text x="12" y="16" text-anchor="middle" font-size="14" font-weight="bold" fill="currentColor">!</text>
          </svg>
          <div class="error-toast-message">${message}</div>
          <button class="error-toast-close" aria-label="Close error message">×</button>
        </div>
        ${isDev ? `<div class="error-toast-detail">${this.escapeHtml(errorObj.message)}</div>` : ''}
      </div>
    `;

    toast.querySelector('.error-toast-close').addEventListener('click', () => {
      toast.remove();
    });

    if (isDev && errorObj.stack) {
      const detail = toast.querySelector('.error-toast-detail');
      detail.style.cursor = 'pointer';
      detail.addEventListener('click', () => {
        detail.classList.toggle('expanded');
        if (detail.classList.contains('expanded')) {
          detail.innerHTML = `<pre>${this.escapeHtml(errorObj.stack)}</pre>`;
        }
      });
    }

    return toast;
  }

  createRecoveryUI(title, description, actions = []) {
    const container = document.createElement('div');
    container.className = 'error-boundary-recovery';

    const content = document.createElement('div');
    content.className = 'error-recovery-content';

    const icon = document.createElement('div');
    icon.className = 'error-recovery-icon';
    icon.innerHTML = `
      <svg viewBox="0 0 24 24" width="48" height="48">
        <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/>
        <path d="M12 8v4M12 16h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
    `;

    const titleEl = document.createElement('h2');
    titleEl.className = 'error-recovery-title';
    titleEl.textContent = title;

    const descEl = document.createElement('p');
    descEl.className = 'error-recovery-description';
    descEl.textContent = description;

    content.appendChild(icon);
    content.appendChild(titleEl);
    content.appendChild(descEl);

    if (actions.length > 0) {
      const actionsEl = document.createElement('div');
      actionsEl.className = 'error-recovery-actions';

      actions.forEach(({ label, callback, primary = false }) => {
        const btn = document.createElement('button');
        btn.className = `btn ${primary ? 'primary' : ''}`;
        btn.textContent = label;
        btn.addEventListener('click', () => {
          callback();
          this.onRecover();
        });
        actionsEl.appendChild(btn);
      });

      content.appendChild(actionsEl);
    }

    container.appendChild(content);
    return container;
  }

  getErrorMessage(errorObj) {
    const messages = {
      'network': 'Network error. Please check your connection.',
      'timeout': 'Request timed out. Please try again.',
      'auth': 'Authentication failed. Please log in again.',
      'permission': 'You don\'t have permission to perform this action.',
      'validation': 'Invalid data. Please check your input.',
      'server': 'Server error. Please try again later.',
      'uncaught': 'Something went wrong. Please refresh the page.',
      'unhandled-promise': 'An unexpected error occurred. Please refresh the page.'
    };

    const msg = errorObj.message?.toLowerCase() || '';
    for (const [key, value] of Object.entries(messages)) {
      if (msg.includes(key)) return value;
    }

    return messages[errorObj.source] || 'An unexpected error occurred. Please try again.';
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notifyListeners(errorObj) {
    this.listeners.forEach(listener => {
      try {
        listener(errorObj);
      } catch (e) {
        console.error('Error in error listener:', e);
      }
    });
  }

  getErrors() {
    return [...this.errors];
  }

  clearErrors() {
    this.errors = [];
  }

  defaultErrorHandler(errorObj) {
    // Default error handling - can be overridden
    if (import.meta.env.MODE === 'development') {
      console.table(errorObj);
    }
  }

  destroy() {
    clearInterval(this.resetTimer);
    this.listeners.clear();
    this.errors = [];
  }
}

/**
 * Component Error Wrapper
 * Wraps component rendering and catches errors
 */
export class ComponentBoundary {
  constructor(component, options = {}) {
    this.component = component;
    this.errorBoundary = options.errorBoundary || new ErrorBoundary();
    this.fallback = options.fallback || this.defaultFallback;
    this.onError = options.onError || (() => {});
  }

  render(container, ...args) {
    try {
      const result = this.component(container, ...args);
      container.classList.remove('error-state');
      return result;
    } catch (error) {
      this.errorBoundary.captureError(error, 'component-render', {
        component: this.component.name || 'Unknown'
      });

      container.classList.add('error-state');
      container.innerHTML = this.fallback(error);
      this.onError(error);

      return null;
    }
  }

  defaultFallback() {
    return `
      <div class="component-error-boundary">
        <div class="error-icon">⚠️</div>
        <h3>Component Error</h3>
        <p>The component failed to load. Please try refreshing the page.</p>
      </div>
    `;
  }
}

/**
 * API Error Handler
 * Specialized error handling for API calls
 */
export class APIErrorHandler {
  constructor(errorBoundary) {
    this.errorBoundary = errorBoundary;
  }

  handle(error, context = {}) {
    let source = 'api-error';
    let message = error?.message || 'Unknown error';

    if (error?.status === 401) {
      source = 'auth-error';
      message = 'Unauthorized';
    } else if (error?.status === 403) {
      source = 'permission-error';
      message = 'Forbidden';
    } else if (error?.status === 404) {
      source = 'not-found-error';
      message = 'Not found';
    } else if (error?.status === 422 || error?.status === 400) {
      source = 'validation-error';
      message = 'Invalid data';
    } else if (error?.status >= 500) {
      source = 'server-error';
      message = 'Server error';
    } else if (!error?.status || error.message?.includes('Network')) {
      source = 'network-error';
      message = 'Network error';
    }

    this.errorBoundary.captureError(error, source, context);
    
    return {
      source,
      message,
      status: error?.status,
      originalError: error
    };
  }

  createRecoveryAction(label = 'Retry', callback) {
    return { label, callback, primary: true };
  }
}

// Global singleton
export const globalErrorBoundary = new ErrorBoundary({
  onError: (error) => {
    // Send to monitoring service if available
    if (window.__errorMonitoring) {
      window.__errorMonitoring.captureException(error);
    }
  }
});

// Export convenience function
export function withErrorBoundary(fn, source = 'wrapped-operation') {
  return globalErrorBoundary.wrap(fn, source);
}
