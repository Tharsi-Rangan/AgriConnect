const mongoose = require('mongoose');

const deliverySchema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  orderNumber: { type: String, required: true },
  customer: { type: String, required: true },
  address: { type: String, required: true },
  items: { type: String, required: true },
  scheduledDate: { type: Date, required: true },
  status: { type: String, enum: ['pending', 'in_transit', 'delivered','cancelled'], default: 'pending' },
}, { timestamps: true });

const Delivery = mongoose.models.Delivery || mongoose.model('Delivery', deliverySchema);
module.exports = Delivery;