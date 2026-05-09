import mongoose from 'mongoose';

const productivitySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  todos: [{ id: String, text: String, done: { type: Boolean, default: false } }],
  reminders: [{ id: String, text: String, dueAt: Date, done: { type: Boolean, default: false } }],
  focus: { type: String, default: '' },
  pomodoro: { work: { type: Number, default: 25 }, break: { type: Number, default: 5 } }
}, { timestamps: true });

export default mongoose.model('Productivity', productivitySchema);
