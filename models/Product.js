const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, trim: true, index: true },
    description: { type: String, default: '' },
    price: { type: Number, required: true, min: 0 },
    compareAtPrice: { type: Number, default: null, min: 0 },
    category: { type: String, default: 'Joyas', trim: true },
    material: { type: String, default: '', trim: true },
    imageUrl: { type: String, default: '' },
    stock: { type: Number, default: 0, min: 0 },
    active: { type: Boolean, default: true },
    featured: { type: Boolean, default: false },
    order: { type: Number, default: 0 }
  },
  { timestamps: true }
);

function toSlug(value) {
  return value
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

productSchema.pre('save', function productPreSave(next) {
  if (!this.slug || this.isModified('name')) {
    this.slug = toSlug(this.name);
  }
  next();
});

productSchema.pre('findOneAndUpdate', function productPreUpdate(next) {
  const update = this.getUpdate();
  const body = update.$set || update;
  if (body.name) {
    body.slug = toSlug(body.name);
    if (update.$set) update.$set = body;
    else this.setUpdate(body);
  }
  next();
});

module.exports = mongoose.model('Product', productSchema);
