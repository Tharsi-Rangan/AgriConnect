const Order = require('../models/OrderModel');
const Payment = require('../models/paymentModel');
const Delivery = require('../models/DeliveryModel');
const mongoose = require('mongoose');

// Create order and initiate payment
exports.createOrder = async (req, res) => {
  try {
    const { customerId, items, totalAmount, paymentDetails, address, scheduledDate } = req.body;
    // Create and save order
    const order = new Order({
      customerId,
      items,
      totalAmount,
      status: 'pending',
      orderNumber: `ORD${Date.now()}`
    });

    const savedOrder = await order.save();

    // Create and save payment
    const payment = new Payment({
      orderId: savedOrder._id,
      amount: totalAmount,
      status: 'pending',
      paymentDetails,
    });

    await payment.save();

    // Create and save delivery
    const delivery = new Delivery({
      orderId: savedOrder._id,  // Use the MongoDB _id from the saved order
      orderNumber: savedOrder.orderNumber,
      customer: customerId,     // You might want to adjust this if you have customer name
      address: address,
      items: JSON.stringify(items), // Convert items array to string as per your model
      scheduledDate: scheduledDate || new Date(Date.now() + 86400000), // Default to tomorrow if not provided
      status: 'pending',
    });

    const savedDelivery = await delivery.save();

    // Return all created resources
    res.status(201).json({ 
      message: 'Order, payment, and delivery created successfully', 
      order: savedOrder,
      delivery: savedDelivery
    });
  } catch (err) {
    res.status(500).json({ message: 'Error creating order', error: err });
  }
};

// Read orders
exports.getOrders = async (req, res) => {
  try {
    const orders = await Order.find();
    res.status(200).json(orders);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching orders', error: err });
  }
};

exports.updateOrder = async (req, res) => {
  try {
    const { orderId, items, totalAmount } = req.body;


    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

   
    if (items) order.items = items;
    if (totalAmount) order.totalAmount = totalAmount;

  
    const updatedOrder = await order.save();

    res.status(200).json({ message: 'Order updated successfully', order: updatedOrder });
  } catch (err) {
    res.status(500).json({ message: 'Error updating order', error: err });
  }
};

// Update order and payment status
exports.updateOrder2 = async (req, res) => {
  try {
    const { orderId, status, paymentStatus } = req.body;
    const order = await Order.findByIdAndUpdate(orderId, { status }, { new: true });
    const payment = await Payment.findOneAndUpdate({ orderId }, { status: paymentStatus }, { new: true });

    res.status(200).json({ message: 'Order and payment status updated', order, payment });
  } catch (err) {
    res.status(500).json({ message: 'Error updating order', error: err });
  }
};

exports.updateDelivery = async (req, res) => {
  try {
    const { id } = req.params;
    const { scheduledDate } = req.body;
    
    // Validate that a scheduled date was provided
    if (!scheduledDate) {
      return res.status(400).json({ message: 'Scheduled date is required' });
    }
    
    // Find the delivery
    const delivery = await Delivery.findById(id);
    if (!delivery) {
      return res.status(404).json({ message: 'Delivery not found' });
    }
    
    // Check delivery status - only allow updates if not completed or cancelled
    if (delivery.status === 'completed' || delivery.status === 'cancelled') {
      return res.status(400).json({ 
        message: 'Cannot update delivery schedule for completed or cancelled deliveries' 
      });
    }
    
    // Update only the scheduled date
    delivery.scheduledDate = scheduledDate;
    
    const updatedDelivery = await delivery.save();
    
    res.status(200).json({ 
      message: 'Delivery updated successfully', 
      delivery: updatedDelivery 
    });
  } catch (err) {
    console.error('Error updating delivery:', err);
    res.status(500).json({ message: 'Error updating delivery', error: err.message });
  }
};

// Delete order
exports.cancelOrder = async (req, res) => {
  let session;
  try {
    session = await mongoose.startSession();
    session.startTransaction();
    
    const { orderId } = req.params;

    // 1. First get the order to find its orderNumber
    const order = await Order.findById(orderId).session(session);
    if (!order) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // 2. Update the order status to 'cancelled'
    const updatedOrder = await Order.findByIdAndUpdate(
      orderId,
      { status: 'cancelled' },
      { new: true, session }
    );

    // 3. Update payment status if exists
    await Payment.findOneAndUpdate(
      { orderId: orderId },
      { status: 'cancelled' },
      { new: true, session }
    );

    // 4. Update delivery status - using the correct orderNumber format
    // First check if the order has an orderNumber field
    const orderNumber = order.orderNumber || `ORD${order._id.toString().slice(-10)}`;
    
    const updatedDelivery = await Delivery.findOneAndUpdate(
      { orderNumber: orderNumber },
      { status: 'cancelled' },
      { new: true, session }
    );

    if (!updatedDelivery) {
      console.warn(`No delivery found for orderNumber ${orderNumber}`);
      // Continue with cancellation even if no delivery found
    }

    await session.commitTransaction();

    res.status(200).json({ 
      success: true,
      message: 'Order cancelled successfully',
      order: updatedOrder,
      delivery: updatedDelivery || null
    });

  } catch (err) {
    if (session) {
      await session.abortTransaction();
    }
    console.error('Error cancelling order:', err);
    res.status(500).json({ 
      success: false,
      message: 'Error cancelling order',
      error: err.message 
    });
  } finally {
    if (session) {
      session.endSession();
    }
  }
};

exports.getOrdersByUserId = async (req, res) => {
  const { userId } = req.params; // Get userId from route parameter

  try {
    // Find orders by userId
    const orders = await Order.find({ customerId: userId });

    // If no orders found
    if (orders.length === 0) {
      return res.status(404).json({ message: 'No orders found for this user' });
    }

    return res.status(200).json({
      message: 'Orders retrieved successfully',
      orders
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error fetching orders', error });
  }
};

exports.countOrders = async (req, res) => {
  try {
    const totalOrders = await Order.countDocuments();
    res.status(200).json({ totalOrders });
  } catch (error) {
    console.error('Error counting orders:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getTotalAmount = async (req, res) => {
  try {
    const totalAmount = await Payment.aggregate([
      {
        $group: {
          _id: null, 
          totalAmount: { $sum: '$amount' } 
        }
      }
    ]);

   
    if (!totalAmount.length) {
      return res.status(404).json({ message: 'No payments found' });
    }

    return res.status(200).json({ totalAmount: totalAmount[0].totalAmount });
  } catch (error) {
    console.error('Error calculating total payment amount:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};


exports.updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params; 
    const { status } = req.body; 

    
    if (!['pending', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status value' });
    }


    const updatedOrder = await Order.findByIdAndUpdate(
      orderId,
      { status },
      { new: true } 
    );

    if (!updatedOrder) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.status(200).json({ message: 'Order status updated successfully', updatedOrder });
  } catch (error) {
    res.status(500).json({ message: 'Error updating order status', error: error.message });
  }
};