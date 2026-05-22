import Activity from '../models/Activity.js';

export function recordActivity(user, action, subject, entityType, entityId) {
  return Activity.create({ user, action, subject, entityType, entityId }).catch(() => null);
}

export function recordActivitySoon(user, action, subject, entityType, entityId) {
  queueMicrotask(() => {
    void recordActivity(user, action, subject, entityType, entityId);
  });
}
