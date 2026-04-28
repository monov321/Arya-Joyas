const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
  {
    buyOrder: { type: String, required: true, unique: true, index: true },
    sessionId: { type: String, required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    productSnapshot: {
      name: { type: String, required: true },
      description: { type: String, default: '' },
      price: { type: Number, required: true },
      category: { type: String, default: 'Joyas' },
      material: { type: String, default: '' },
      imageUrl: { type: String, default: '' }
    },
    quantity: { type: Number, default: 1, min: 1, max: 10 },
    amount: { type: Number, required: true, min: 1 },
    token: { type: String, index: true },
    status: {
      type: String,
      enum: ['created', 'authorized', 'failed', 'cancelled', 'error'],
      default: 'created'
    },
    webpayResponse: { type: mongoose.Schema.Types.Mixed, default: null }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', orderSchema);
