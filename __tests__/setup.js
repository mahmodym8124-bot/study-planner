import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { beforeAll, afterAll, afterEach, jest } from '@jest/globals';
import { getMemoryDatabase } from './helpers/memory-adapter.js';

let mongoServer;
let usingMemoryAdapter = false;
const memoryDb = getMemoryDatabase();

const testPath = expect.getState().testPath || '';
const shouldSkipMongo =
  globalThis.process?.env?.SKIP_MONGO_TESTS === '1' ||
  /[\\/]__tests__[\\/]client[\\/]/.test(testPath);

function installMemoryAdapter() {
  usingMemoryAdapter = true;
  const Collection = mongoose.Collection.prototype;
  const memDb = getMemoryDatabase();
  
  Collection.insertOne = async function(doc, options) {
    const result = await memDb.collection(this.name).insertOne(doc);
    return { acknowledged: true, insertedId: result.insertedId };
  };
  
  Collection.insertMany = async function(docs, options) {
    const result = await memDb.collection(this.name).insertMany(docs);
    return { acknowledged: true, insertedIds: result.insertedIds };
  };
  
  Collection.find = async function(filter, options) {
    const docs = await memDb.collection(this.name).find(filter || {});
    let limitVal = Number.isInteger(options?.limit) ? options.limit : null;
    let skipVal = Number.isInteger(options?.skip) ? options.skip : 0;
    return {
      toArray: async function() { 
        let result = docs;
        if (skipVal) result = result.slice(skipVal);
        if (limitVal) result = result.slice(0, limitVal);
        return result;
      },
      sort: function() { return this; },
      limit: function(n) { limitVal = n; return this; },
      skip: function(n) { skipVal = n; return this; },
      lean: function() { return this; }
    };
  };
  
  Collection.findById = function(id, projection, options) {
    // Delegate to findOne
    return this.findOne({ _id: id }, projection, options);
  };
  
  // Create a Query-like object that's chainable and awaitable
  const createQuery = (promiseOrDoc) => {
    // If it's already a promise, wrap it properly
    const queryPromise = Promise.resolve(promiseOrDoc);
    queryPromise.lean = function() { return this; };
    queryPromise.select = function(fields) { return this; };
    queryPromise.exec = async function() { return await this; };
    return queryPromise;
  };
  
  Collection.findOne = async function(filter, options) {
    const doc = await memDb.collection(this.name).findOne(filter || {});
    return createQuery(doc);
  };
  
  Collection.findOneAndUpdate = async function(filter, update, options) {
    const result = await memDb.collection(this.name).findOneAndUpdate(filter, update, options);
    const queryPromise = Promise.resolve(result.value);
    queryPromise.lean = function() { return this; };
    queryPromise.select = function(fields) { return this; };
    queryPromise.exec = async function() { return await this; };
    return queryPromise;
  };
  
  Collection.findOneAndDelete = async function(filter, options) {
    const result = await memDb.collection(this.name).findOneAndDelete(filter);
    return { acknowledged: true, value: result.value, deletedCount: result.value ? 1 : 0 };
  };
  
  Collection.deleteMany = async function(filter, options) {
    const result = await memDb.collection(this.name).deleteMany(filter || {});
    return { acknowledged: true, deletedCount: result.result.n };
  };
  
  Collection.deleteOne = async function(filter, options) {
    const result = await memDb.collection(this.name).findOneAndDelete(filter);
    return { acknowledged: true, deletedCount: result.value ? 1 : 0 };
  };
  
  Collection.countDocuments = async function(filter, options) {
    return memDb.collection(this.name).countDocuments(filter || {});
  };
  
  Collection.updateMany = async function(filter, update, options) {
    const result = await memDb.collection(this.name).updateMany(filter, update);
    return { acknowledged: true, modifiedCount: result.result.n };
  };
  
  Collection.updateOne = async function(filter, update, options = {}) {
    const collection = memDb.collection(this.name);
    const doc = await collection.findOne(filter);

    if (!doc) {
      if (options.upsert) {
        await collection.findOneAndUpdate(filter, update, { upsert: true, new: true });
        return { acknowledged: true, modifiedCount: 0, matchedCount: 0, upsertedCount: 1 };
      }
      return { acknowledged: true, modifiedCount: 0, matchedCount: 0 };
    }

    if (update.$set) Object.assign(doc, update.$set);
    if (update.$unset) {
      for (const key of Object.keys(update.$unset)) {
        delete doc[key];
      }
    }
    collection.documents.set(String(doc._id), doc);
    return { acknowledged: true, modifiedCount: 1, matchedCount: 1 };
  };
  
  // Mock connection state
  mongoose.connection.readyState = 1;
  mongoose.connection._db = memDb;
}

// Helper to wrap memory adapter calls with proper async handling
function wrapMemoryMethod(name, method) {
  return function(...args) {
    return method.apply(memoryDb.collection(this.name), args);
  };
}

if (!shouldSkipMongo) {
  beforeAll(async () => {
    if (process.platform === 'win32') {
      installMemoryAdapter();
      return;
    }

    // Try real MongoDB memory server first
    try {
      mongoServer = await MongoMemoryServer.create({ spawn: { timeout: 8000 } });
      const mongoUri = mongoServer.getUri();
      await mongoose.connect(mongoUri);
    } catch (err) {
      // Binary spawn failed on this platform (likely Windows without mongod executable)
      console.warn('MongoMemoryServer unavailable, using fallback in-memory adapter:', err.code || err.message);
      installMemoryAdapter();
    }
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop().catch(() => {
        // Ignore errors if server didn't start
      });
    }
  });

  afterEach(async () => {
    if (usingMemoryAdapter) {
      // Clear all memory collections
      try {
        memoryDb.collections.forEach(col => {
          col.documents.clear();
        });
      } catch (e) {
        // Ignore cleanup errors
      }
    } else {
      // Real MongoDB cleanup
      const collections = mongoose.connection.collections;
      for (const key in collections) {
        try {
          await collections[key].deleteMany({});
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    }
  });
}
