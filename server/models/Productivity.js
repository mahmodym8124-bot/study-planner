import mongoose from 'mongoose';

const productivitySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  todos: [{ id: String, text: { type: String, trim: true, maxlength: 240 }, done: { type: Boolean, default: false } }],
  reminders: [{ id: String, text: { type: String, trim: true, maxlength: 240 }, dueAt: Date, done: { type: Boolean, default: false } }],
  focus: { type: String, default: '', maxlength: 2000 },
  pomodoro: {
    work: { type: Number, min: 5, max: 120, default: 25 },
    break: { type: Number, min: 1, max: 60, default: 5 }
  }
}, { timestamps: true });

export default mongoose.model('Productivity', productivitySchema);
