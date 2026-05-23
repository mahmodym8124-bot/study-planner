# Frontend Error Boundaries

MindVault uses lightweight frontend error boundaries to catch global, API, async, and component-level failures without crashing the whole app.

## Architecture

- [../client/js/error-boundary.js](../client/js/error-boundary.js) - core classes and the `globalErrorBoundary` singleton.
- [../client/js/error-utils.js](../client/js/error-utils.js) - safe wrappers, monitoring setup, and recovery helpers.
- [../client/styles/error-boundary.css](../client/styles/error-boundary.css) - toast, modal, and component fallback styles.
- [../client/js/main.js](../client/js/main.js) - initializes monitoring.
- [../client/js/api.js](../client/js/api.js) - captures API request failures with context.

## Usage

### Global Error Handling

Errors are captured from:

- Uncaught synchronous errors
- Unhandled promise rejections
- API request failures
- Render errors

```javascript
import { globalErrorBoundary, setupErrorMonitoring } from './error-utils.js';

setupErrorMonitoring({
  enabled: true,
  onError: (errorObj) => {
    console.log('Error captured:', errorObj);
  }
});
```

### API Calls

API errors are captured with route and method context in [../client/js/api.js](../client/js/api.js).

```javascript
try {
  const response = await fetch(url, opts);
} catch (error) {
  window.__errorBoundary.captureError(error, 'api-error', {
    path,
    method,
    status: error.status
  });
}
```

### Safe Wrapper Functions

```javascript
import { safeAsync } from './error-utils.js';

const result = await safeAsync(
  () => api.notes(),
  'load-notes',
  { notes: [] }
);
```

```javascript
import { safeDOMManipulation } from './error-utils.js';

safeDOMManipulation(() => {
  document.querySelector('#app').innerHTML = '...';
}, { operation: 'render-view' });
```

```javascript
import { safeAddEventListener } from './error-utils.js';

safeAddEventListener(button, 'click', (e) => {
  handleClick(e);
}, true);
```

### Component Boundaries

```javascript
import { createSafeComponent } from './error-utils.js';

const safeNotesList = createSafeComponent(renderNotesList, {
  fallback: (error) => '<div class="error">Failed to load notes</div>'
});

safeNotesList.render(container);
```

## Error Types

| Category | Typical Source |
|----------|--------|---------|
| `auth-error` | 401 responses |
| `permission-error` | 403 responses |
| `not-found-error` | 404 responses |
| `validation-error` | 400/422 responses |
| `server-error` | 500+ responses |
| `network-error` | failed network requests |
| `api-timeout` | long API requests |
| `render-error` | DOM or component rendering |
| `uncaught` | synchronous exceptions |
| `unhandled-promise` | rejected promises |

## Error Display

- Toast notifications auto-dismiss and expose developer details only in development.
- Recovery UI can show retry or navigation actions for critical failures.
- Component boundaries render localized fallback UI instead of leaving a broken area blank.

## Error Recovery

```javascript
import { ErrorRecovery } from './error-utils.js';

ErrorRecovery.handleAuthError('Your session expired');
ErrorRecovery.handleNetworkError();
ErrorRecovery.createRecoveryUI(
  errorInfo,
  [
    {
      label: 'Retry',
      callback: () => retryOperation(),
      primary: true
    },
    {
      label: 'Go Back',
      callback: () => history.back()
    }
  ]
);
```

## Monitoring Integration

Subscribe to all errors for monitoring services:

```javascript
setupErrorMonitoring({
  enabled: true,
  onError: (errorObj) => {
    // Send to Sentry, LogRocket, etc.
    window.Sentry?.captureException(errorObj);
  }
});
```

## Captured Context

Errors are captured with context:

```javascript
{
  timestamp: '2024-01-15T10:30:00.000Z',
  source: 'api-error',
  message: 'Network error',
  stack: '...',
  context: {
    path: '/api/notes',
    method: 'GET',
    status: 0
  },
  url: 'https://mindvault.example/app/notes',
  userAgent: '...'
}
```

## Best Practices

```javascript
try {
  await api.notes();
} catch (error) {
  toast('Failed to load notes', 'error');
}
```

```javascript
const stats = await safeAsync(
  () => api.stats(),
  'load-stats',
  { stats: {} }
);
```

```javascript
safeDOMManipulation(() => {
  document.querySelector('#app').innerHTML = markup;
}, { operation: 'render' });
```

```javascript
globalErrorBoundary.captureError(error, 'api-error', {
  path: '/api/notes',
  userId: user.id,
  action: 'fetch-notes'
});
```

## Debugging

```javascript
const errors = window.__errorBoundary.getErrors();
window.__errorBoundary.clearErrors();
const unsubscribe = window.__errorBoundary.subscribe((errorObj) => {
  console.log('New error:', errorObj);
});
unsubscribe();
```

## Testing Error Boundaries

```javascript
throw new Error('Test error');
Promise.reject(new Error('Test rejection'));
api.notes().catch(error => {
  console.log('API error caught');
});
```
