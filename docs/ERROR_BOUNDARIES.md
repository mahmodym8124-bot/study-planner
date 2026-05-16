# Frontend Error Boundaries

Error boundaries are a critical part of MindVault's frontend resilience. They catch and handle errors gracefully, preventing complete application crashes and providing users with helpful recovery options.

## Architecture

### Core Components

**`error-boundary.js`** - Core error handling system
- `ErrorBoundary` - Main class for global error capture
- `ComponentBoundary` - Wraps individual components with error handling
- `APIErrorHandler` - Specialized handling for API errors
- `globalErrorBoundary` - Singleton instance

**`error-utils.js`** - Integration utilities
- `safeFetch()` - Wrapped fetch with timeout and error handling
- `safeAPI()` - Safe API wrapper with automatic error handling
- `safeAddEventListener()` - Event listeners with error boundary
- `safeAsync()` - Generic async operation wrapper
- `ErrorRecovery` - Recovery context for specific error scenarios

**`error-boundary.css`** - Styling for error UI
- Error toast notifications
- Error recovery modals
- Component error boundaries

## Usage

### 1. Global Error Handling

Errors are automatically captured globally via:
- Uncaught synchronous errors
- Unhandled promise rejections
- API request failures
- Render errors

```javascript
// Already initialized in main.js
import { globalErrorBoundary, setupErrorMonitoring } from './error-utils.js';

setupErrorMonitoring({
  enabled: true,
  onError: (errorObj) => {
    console.log('Error captured:', errorObj);
  }
});
```

### 2. API Calls with Error Handling

All API calls are automatically wrapped with error boundaries:

```javascript
// In api.js - errors are captured with context
try {
  const response = await fetch(url, opts);
  // ... error handling
} catch (error) {
  window.__errorBoundary.captureError(error, 'api-error', {
    path,
    method,
    status: error.status
  });
}
```

### 3. Safe Wrapper Functions

#### Safe Async Operations
```javascript
import { safeAsync } from './error-utils.js';

// Auto-captures errors, returns fallback if fails
const result = await safeAsync(
  () => api.notes(),
  'load-notes',
  { notes: [] } // fallback
);
```

#### Safe DOM Manipulation
```javascript
import { safeDOMManipulation } from './error-utils.js';

safeDOMManipulation(() => {
  document.querySelector('#app').innerHTML = '...';
}, { operation: 'render-view' });
```

#### Safe Event Listeners
```javascript
import { safeAddEventListener } from './error-utils.js';

// Listener errors are caught and logged
safeAddEventListener(button, 'click', (e) => {
  // Handler logic
}, true);
```

### 4. Component Error Boundaries

Wrap component rendering:

```javascript
import { createSafeComponent } from './error-utils.js';

const safeNotesList = createSafeComponent(renderNotesList, {
  fallback: (error) => '<div class="error">Failed to load notes</div>'
});

// Use it
safeNotesList.render(container);
```

## Error Types

### Captured Error Categories

| Category | Source | Example |
|----------|--------|---------|
| `auth-error` | 401 responses | Session expired |
| `permission-error` | 403 responses | Access denied |
| `not-found-error` | 404 responses | Resource missing |
| `validation-error` | 400/422 responses | Invalid input |
| `server-error` | 500+ responses | Backend failure |
| `network-error` | Network issues | Connection lost |
| `api-timeout` | 30s+ requests | Request timeout |
| `render-error` | DOM rendering | Component crash |
| `uncaught` | Sync errors | Code exception |
| `unhandled-promise` | Promise rejection | Async failure |

## Error Display

### Toast Notifications

Auto-displayed error toasts with user-friendly messages:

```
┌─────────────────────────────────────────┐
│ ⚠️  Network error. Please check your    │
│     connection.                      × │
└─────────────────────────────────────────┘
```

**Features:**
- Auto-dismiss after 8 seconds
- Detailed stack traces in development mode
- Click to expand details (dev only)
- Accessible (role="alert", aria-live)

### Recovery UI

Modal dialog for critical failures:

```
┌────────────────────────────────────────┐
│              ⚠️                         │
│         Something went wrong            │
│   Failed to load the dashboard         │
│  [Try Again]  [Go to Dashboard]        │
└────────────────────────────────────────┘
```

**Features:**
- Centered modal with backdrop
- Custom action buttons
- Primary action highlighted
- Smooth animations

## Error Recovery

### Built-in Recovery Actions

```javascript
import { ErrorRecovery } from './error-utils.js';

// Handle auth errors
ErrorRecovery.handleAuthError('Your session expired');

// Handle network errors
ErrorRecovery.handleNetworkError();

// Create custom recovery UI
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

### Error Monitoring Integration

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

## Error Context

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
  url: 'https://study-planner.com/app/notes',
  userAgent: '...'
}
```

## Best Practices

### 1. Always Catch API Errors

```javascript
// ✅ Good - Error is captured
try {
  await api.notes();
} catch (error) {
  toast('Failed to load notes', 'error');
}

// ❌ Bad - Error might not be caught
api.notes().then(data => {
  // Process data
});
```

### 2. Provide Fallbacks

```javascript
// ✅ Good - Graceful degradation
const stats = await safeAsync(
  () => api.stats(),
  'load-stats',
  { stats: {} } // Fallback
);

// ❌ Bad - No fallback
const stats = await api.stats();
```

### 3. Use Safe Wrappers for DOM

```javascript
// ✅ Good - Errors don't crash app
safeDOMManipulation(() => {
  document.querySelector('#app').innerHTML = markup;
}, { operation: 'render' });

// ❌ Bad - Could crash on bad selector
document.querySelector('#app').innerHTML = markup;
```

### 4. Provide Context

```javascript
// ✅ Good - Context helps debugging
globalErrorBoundary.captureError(error, 'api-error', {
  path: '/api/notes',
  userId: user.id,
  action: 'fetch-notes'
});

// ❌ Bad - No context
throw error;
```

## Debugging

### Development Mode

In development, errors show:
- Full stack traces in toasts
- Expandable error details
- Grouped console output

### Production Mode

In production:
- User-friendly error messages
- No sensitive stack traces
- Monitoring integration

### Inspect Error History

```javascript
// Get all captured errors
const errors = window.__errorBoundary.getErrors();

// Clear history
window.__errorBoundary.clearErrors();

// Subscribe to new errors
const unsubscribe = window.__errorBoundary.subscribe((errorObj) => {
  console.log('New error:', errorObj);
});

// Unsubscribe
unsubscribe();
```

## Testing Error Boundaries

### Simulate Errors

```javascript
// Uncaught error
throw new Error('Test error');

// Unhandled promise rejection
Promise.reject(new Error('Test rejection'));

// API error
api.notes().catch(error => {
  console.log('API error caught');
});
```

### Test in Components

```javascript
// Force render error
function BuggyComponent() {
  throw new Error('Component error');
}

// Will be caught by error boundary
renderComponent(BuggyComponent);
```

## Performance Considerations

- Error capture has minimal overhead (<1ms per error)
- Error toasts are removed from DOM automatically
- Error listener cleanup prevents memory leaks
- Global error count limited to 5 to prevent spam

## Integration with Monitoring

Ready to integrate with:
- **Sentry** - `window.Sentry?.captureException()`
- **LogRocket** - `window.LogRocket?.captureException()`
- **DataDog** - `window.DD_RUM?.addError()`
- **Custom endpoints** - POST to error logging service

```javascript
setupErrorMonitoring({
  onError: (errorObj) => {
    // Send to your monitoring service
    fetch('/api/errors', {
      method: 'POST',
      body: JSON.stringify(errorObj)
    }).catch(() => {});
  }
});
```

## Files

- `client/js/error-boundary.js` - Core error boundary system (247 lines)
- `client/js/error-utils.js` - Integration utilities (183 lines)
- `client/styles/error-boundary.css` - Styling (245 lines)
- Updates to `client/js/main.js` - Initialization and integration
- Updates to `client/js/api.js` - API error handling

## Migration Checklist

✅ Error boundary system created  
✅ Global error handling initialized  
✅ API error capture integrated  
✅ Safe wrapper functions available  
✅ Error UI styled and responsive  
✅ Development/production modes configured  
✅ Monitoring hooks ready  
✅ Documentation complete  

## Next Steps

1. **Test in staging** - Verify error handling in real scenarios
2. **Add error tracking** - Integrate with monitoring service (Sentry, etc.)
3. **Analyze error trends** - Monitor error patterns to fix root causes
4. **Enhance recovery** - Add context-specific recovery actions
5. **Performance monitor** - Track error boundary overhead
