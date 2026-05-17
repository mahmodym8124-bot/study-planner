/**
 * Error Boundary Integration Utilities
 * Helper functions to integrate error handling throughout the app
 */

import { globalErrorBoundary, APIErrorHandler, ComponentBoundary } from './error-boundary.js';
import { toast } from './ui.js';

export const apiErrorHandler = new APIErrorHandler(globalErrorBoundary);

/**
 * Safe fetch wrapper with error handling
 */
export async function safeFetch(url, options = {}) {
  const timeout = options.timeout || 30000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}`);
      error.status = response.status;
      error.response = response;

      const context = {
        url,
        method: options.method || 'GET',
        status: response.status
      };

      globalErrorBoundary.captureError(error, 'api-call', context);
      throw error;
    }

    return response;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error.name === 'AbortError') {
      const timeoutError = new Error('Request timeout');
      timeoutError.status = 408;
      globalErrorBoundary.captureError(timeoutError, 'api-timeout', { url });
      throw timeoutError;
    }

    if (!error.status) {
      globalErrorBoundary.captureError(error, 'api-network', { url });
    }

    throw error;
  }
}

/**
 * Safe API request with automatic error handling
 */
export async function safeAPI(apiMethod, context = {}) {
  try {
    return await apiMethod();
  } catch (error) {
    const errorInfo = apiErrorHandler.handle(error, context);
    
    // Show user-friendly message
    const message = getErrorMessage(errorInfo);
    toast(message, 'error');
    
    throw errorInfo;
  }
}

/**
 * Get user-friendly error message
 */
export function getErrorMessage(errorInfo) {
  const { source } = errorInfo;

  const messages = {
    'auth-error': 'Your session has expired. Please log in again.',
    'permission-error': 'You don\'t have permission to access this resource.',
    'not-found-error': 'The requested resource was not found.',
    'validation-error': 'Please check your input and try again.',
    'server-error': 'Server error. Please try again later.',
    'network-error': 'Network error. Please check your connection.',
    'api-timeout': 'Request timed out. Please try again.'
  };

  return messages[source] || 'An error occurred. Please try again.';
}

/**
 * Wrap component rendering with error boundary
 */
export function createSafeComponent(component, options = {}) {
  return new ComponentBoundary(component, {
    errorBoundary: globalErrorBoundary,
    ...options
  });
}

/**
 * Safe event listener wrapper
 */
export function safeAddEventListener(element, event, handler, options) {
  const safeHandler = globalErrorBoundary.wrap((e) => {
    handler(e);
  }, `event-${event}`);

  element.addEventListener(event, safeHandler, options);

  return () => element.removeEventListener(event, safeHandler, options);
}

/**
 * Safe async operation wrapper
 */
export async function safeAsync(operation, name = 'async-operation', fallback = null) {
  try {
    return await operation();
  } catch (error) {
    globalErrorBoundary.captureError(error, name);
    return fallback;
  }
}

/**
 * Safe DOM manipulation
 */
export function safeDOMManipulation(fn, context = {}) {
  try {
    return fn();
  } catch (error) {
    globalErrorBoundary.captureError(error, 'dom-manipulation', context);
    return null;
  }
}

/**
 * Safe localStorage operations
 */
export const safeStorage = {
  getItem(key, fallback = null) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      globalErrorBoundary.captureError(error, 'storage-read', { key });
      return fallback;
    }
  },

  setItem(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      globalErrorBoundary.captureError(error, 'storage-write', { key });
      return false;
    }
  },

  removeItem(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      globalErrorBoundary.captureError(error, 'storage-remove', { key });
      return false;
    }
  }
};

/**
 * Error Recovery Context
 * Provides recovery actions for specific error scenarios
 */
export class ErrorRecovery {
  static async handleAuthError() {
    // Trigger auth refresh or redirect to login
    window.dispatchEvent(new CustomEvent('mindvault:auth-expired'));
  }

  static async handleNetworkError() {
    // Could trigger offline mode or retry logic
    toast('Network connection lost. Some features may be unavailable.', 'warning');
  }

  static createRecoveryUI(errorInfo, actions = []) {
    const recovery = globalErrorBoundary.createRecoveryUI(
      'Something went wrong',
      getErrorMessage(errorInfo),
      actions
    );

    document.body.appendChild(recovery);

    return () => recovery.remove();
  }

  static addRetryAction(originalFunction, name = 'retry') {
    return {
      label: 'Try Again',
      callback: () => {
        return safeAsync(originalFunction, `${name}-retry`);
      },
      primary: true
    };
  }
}

/**
 * Global error monitoring setup
 */
export function setupErrorMonitoring(config = {}) {
  // Subscribe to all errors
  globalErrorBoundary.subscribe((errorObj) => {
    // Could send to monitoring service (Sentry, LogRocket, etc.)
    if (config.onError) {
      config.onError(errorObj);
    }

    // Log in development
    if (import.meta.env.MODE === 'development') {
      console.group('🚨 Error Captured');
      console.log('Timestamp:', errorObj.timestamp);
      console.log('Source:', errorObj.source);
      console.log('Message:', errorObj.message);
      if (errorObj.context) console.log('Context:', errorObj.context);
      if (errorObj.stack) console.log('Stack:', errorObj.stack);
      console.groupEnd();
    }
  });

  // Handle specific error types
  globalErrorBoundary.subscribe((errorObj) => {
    if (errorObj.source === 'auth-error') {
      ErrorRecovery.handleAuthError(errorObj.message);
    } else if (errorObj.source === 'network-error') {
      ErrorRecovery.handleNetworkError();
    }
  });

  if (config.enabled !== false) {
    console.log('✅ Error monitoring initialized');
  }

  return () => globalErrorBoundary.destroy();
}

/**
 * Export for use in main app
 */
export { globalErrorBoundary };
