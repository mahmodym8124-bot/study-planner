/* global use, db */

// MindVault database playground.
// Run individual blocks from VS Code's MongoDB playground after connecting
// to the same Atlas cluster used by MONGODB_URI in .env.

use('study-planner');

// Quick health summary for the collections used by the Express/Mongoose app.
[
  'users',
  'notes',
  'ideas',
  'fileassets',
  'productivities',
  'activities'
].forEach((name) => {
  console.log(`${name}: ${db.getCollection(name).countDocuments()} documents`);
});

// Inspect recent activity without exposing passwords or large document bodies.
db.getCollection('activities')
  .find({}, { action: 1, subject: 1, entityType: 1, createdAt: 1 })
  .sort({ createdAt: -1 })
  .limit(10);

// Optional cleanup candidates. These collections are not used by the current app
// and were empty during the last inspection. Run manually only if you are sure.
// db.getCollection('schedule').drop();
// db.getCollection('file').drop();
// db.getCollection('tasks').drop();
