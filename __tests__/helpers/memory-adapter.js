/**
 * In-memory test adapter for Mongoose when MongoDB binary is unavailable.
 * Provides a minimal CRUD interface for testing without a real Mongo server.
 */

class MemoryCollection {
  constructor(name) {
    this.name = name;
    this.documents = new Map();
    this.nextId = 1;
  }

  async insertOne(doc) {
    if (!doc._id) {
      doc._id = this.nextId++;
    }
    this.documents.set(String(doc._id), { ...doc });
    return { result: { ok: 1, n: 1 }, insertedId: doc._id };
  }

  async insertMany(docs) {
    const insertedIds = [];
    for (const doc of docs) {
      if (!doc._id) {
        doc._id = this.nextId++;
      }
      this.documents.set(String(doc._id), { ...doc });
      insertedIds.push(doc._id);
    }
    return { result: { ok: 1, n: docs.length }, insertedIds };
  }

  async find(filter) {
    const results = [];
    for (const doc of this.documents.values()) {
      if (this._matchesFilter(doc, filter)) {
        results.push({ ...doc });
      }
    }
    return results;
  }

  async findOne(filter) {
    for (const doc of this.documents.values()) {
      if (this._matchesFilter(doc, filter)) {
        return { ...doc };
      }
    }
    return null;
  }

  async findOneAndUpdate(filter, update, options = {}) {
    const doc = await this.findOne(filter);
    if (!doc) {
      if (options.upsert) {
        // Merge filter (without operators), $set, and $setOnInsert
        const newDoc = {};
        for (const [key, value] of Object.entries(filter)) {
          if (!key.startsWith('$') && typeof value !== 'object') {
            newDoc[key] = value;
          }
        }
        if (update.$set) Object.assign(newDoc, update.$set);
        if (update.$setOnInsert) Object.assign(newDoc, update.$setOnInsert);
        if (!newDoc._id) newDoc._id = this.nextId++;
        this.documents.set(String(newDoc._id), newDoc);
        return { value: newDoc };
      }
      return { value: null };
    }
    Object.assign(doc, update.$set);
    this.documents.set(String(doc._id), doc);
    return { value: options.new !== false ? doc : { ...doc } };
  }

  async findOneAndDelete(filter) {
    for (const [key, doc] of this.documents.entries()) {
      if (this._matchesFilter(doc, filter)) {
        this.documents.delete(key);
        return { value: doc };
      }
    }
    return { value: null };
  }

  async deleteMany(filter) {
    let count = 0;
    for (const [key, doc] of this.documents.entries()) {
      if (this._matchesFilter(doc, filter)) {
        this.documents.delete(key);
        count++;
      }
    }
    return { result: { ok: 1, n: count } };
  }

  async countDocuments(filter) {
    let count = 0;
    for (const doc of this.documents.values()) {
      if (this._matchesFilter(doc, filter)) {
        count++;
      }
    }
    return count;
  }

  async updateMany(filter, update) {
    let count = 0;
    for (const doc of this.documents.values()) {
      if (this._matchesFilter(doc, filter)) {
        if (update.$set) Object.assign(doc, update.$set);
        if (update.$push) {
          for (const [key, value] of Object.entries(update.$push)) {
            if (!Array.isArray(doc[key])) doc[key] = [];
            doc[key].push(value);
          }
        }
        count++;
      }
    }
    return { result: { ok: 1, n: count } };
  }

  _matchesFilter(doc, filter) {
    if (!filter || Object.keys(filter).length === 0) return true;
    for (const [key, value] of Object.entries(filter)) {
      if (key === '$or') {
        return value.some(or => this._matchesFilter(doc, or));
      }
      if (key === '$in') {
        if (!value.includes(doc[key])) return false;
      } else if (value && typeof value === 'object' && ('$gte' in value || '$lte' in value || '$gt' in value || '$lt' in value)) {
        if (value.$gte && doc[key] < value.$gte) return false;
        if (value.$lte && doc[key] > value.$lte) return false;
        if (value.$gt && doc[key] <= value.$gt) return false;
        if (value.$lt && doc[key] >= value.$lt) return false;
      } else if (value instanceof RegExp) {
        if (!value.test(String(doc[key]))) return false;
      } else {
        // Handle ObjectId comparison by converting both to string
        const docVal = doc[key]?.toString?.() ?? doc[key];
        const filterVal = value?.toString?.() ?? value;
        if (docVal !== filterVal) return false;
      }
    }
    return true;
  }
}

class MemoryDatabase {
  constructor() {
    this.collections = new Map();
  }

  collection(name) {
    if (!this.collections.has(name)) {
      this.collections.set(name, new MemoryCollection(name));
    }
    return this.collections.get(name);
  }

  async dropCollection(name) {
    this.collections.delete(name);
    return true;
  }

  async dropDatabase() {
    this.collections.clear();
    return true;
  }
}

// Global memory database instance for tests
const memoryDb = new MemoryDatabase();

export function getMemoryDatabase() {
  return memoryDb;
}
