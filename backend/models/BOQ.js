import mongoose from 'mongoose';

const boqItemSchema = new mongoose.Schema({
  description: {
    type: String,
    required: [true, 'Item description is required'],
    trim: true
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [0, 'Quantity cannot be negative']
  },
  unit: {
    type: String,
    required: [true, 'Unit is required'],
    trim: true,
    lowercase: true,
    maxlength: [20, 'Unit cannot be more than 20 characters']
  },
  rate: {
    type: Number,
    min: [0, 'Rate cannot be negative']
  },
  amount: {
    type: Number,
    min: [0, 'Amount cannot be negative']
  },
  category: {
    type: String,
    trim: true,
    lowercase: true,
    maxlength: [50, 'Category cannot be more than 50 characters']
  },
  specifications: String,
  normalizedProduct: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  },
  alternatives: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
    },
    matchScore: Number,
    priceVariance: Number
  }]
});

const boqSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'BOQ name is required'],
    trim: true,
    maxlength: [100, 'BOQ name cannot be more than 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot be more than 500 characters']
  },
  serviceProvider: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Service provider is required']
  },
  project: {
    name: String,
    location: String,
    type: String,
    estimatedValue: Number
  },
  items: [boqItemSchema],
  status: {
    type: String,
    enum: ['draft', 'processing', 'normalized', 'vendor_selection', 'completed', 'cancelled'],
    default: 'draft'
  },
  totalValue: {
    type: Number,
    default: 0,
    min: [0, 'Total value cannot be negative']
  },
  normalizedAt: Date,
  completedAt: Date,
  uploadedFile: {
    filename: String,
    originalName: String,
    path: String,
    size: Number,
    mimetype: String
  },
  processingLog: [{
    action: String,
    timestamp: { type: Date, default: Date.now },
    details: String,
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
boqSchema.index({ serviceProvider: 1 });
boqSchema.index({ status: 1 });
boqSchema.index({ createdAt: -1 });
boqSchema.index({ 'items.category': 1 });

// Virtual for item count
boqSchema.virtual('itemCount').get(function() {
  return this.items ? this.items.length : 0;
});

// Virtual for completion percentage
boqSchema.virtual('completionPercentage').get(function() {
  if (!this.items || this.items.length === 0) return 0;
  
  const normalizedItems = this.items.filter(item => item.normalizedProduct);
  return Math.round((normalizedItems.length / this.items.length) * 100);
});

// Pre-save middleware to calculate total value
boqSchema.pre('save', function(next) {
  if (this.items && this.items.length > 0) {
    this.totalValue = this.items.reduce((total, item) => {
      return total + (item.amount || (item.quantity * (item.rate || 0)));
    }, 0);
  }
  next();
});

// Method to add processing log entry
boqSchema.methods.addProcessingLog = function(action, details, userId) {
  this.processingLog.push({
    action,
    details,
    user: userId,
    timestamp: new Date()
  });
};

const BOQ = mongoose.model('BOQ', boqSchema);

export default BOQ;