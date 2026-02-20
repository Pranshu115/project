import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Category name is required'],
    trim: true,
    unique: true,
    lowercase: true,
    maxlength: [50, 'Category name cannot be more than 50 characters']
  },
  displayName: {
    type: String,
    trim: true,
    maxlength: [100, 'Display name cannot be more than 100 characters']
  },
  /**
   * Default specifications for this category.
   * These are typically set from the admin portal when admin finalizes
   * specification keys for a product in this category, and are then
   * re-used as a template for suppliers when they select the category.
   *
   * Stored as an object of { [specKey]: null } so that suppliers can
   * fill in their own values while keeping the admin-defined keys.
   */
  defaultSpecifications: {
    type: Object,
    default: {}
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
categorySchema.index({ name: 1 });
categorySchema.index({ isActive: 1 });

const Category = mongoose.model('Category', categorySchema);

export default Category;
