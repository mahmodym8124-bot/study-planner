import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  password: { type: String, required: true, minlength: 8, select: false },
  googleId: { type: String, unique: true, sparse: true, index: true },
  avatar: { type: String, default: null },
  authProviders: { type: [String], default: ['password'], enum: ['password', 'google'] },
  verified: { type: Boolean, default: false },
  verificationToken: { type: String, minlength: 64, maxlength: 64, select: false, index: true },
  verificationTokenExpires: { type: Date, index: true },
  theme: { type: String, default: 'dark', enum: ['dark', 'light'] },
  resetToken: { type: String, minlength: 64, maxlength: 64, select: false, index: true },
  resetExpires: { type: Date, select: false, index: true }
}, { timestamps: true });

function isBcryptHash(value) {
  return /^\$2[aby]\$\d{2}\$/.test(value);
}

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  if (isBcryptHash(this.password)) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toSafeJSON = function toSafeJSON() {
  return { _id: this._id, name: this.name, email: this.email, avatar: this.avatar, theme: this.theme };
};

export default mongoose.model('User', userSchema);
