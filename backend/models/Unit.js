import mongoose from 'mongoose';

const unitSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Unit name is required'],
    trim: true,
    unique: true,
    lowercase: true,
    maxlength: [20, 'Unit name cannot be more than 20 characters']
  },
  displayName: {
    type: String,
    trim: true,
    maxlength: [50, 'Display name cannot be more than 50 characters']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Index for faster searches
unitSchema.index({ name: 1 });
unitSchema.index({ isActive: 1 });

const Unit = mongoose.model('Unit', unitSchema);

export default Unit;
