import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { ShoppingBag, Package, Clock, CheckCircle, AlertCircle, Calendar } from 'lucide-react';
import axios from 'axios';
import bannerImg from '../assets/banner.jpg';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css'

interface OrderItem {
  productId?: string;
  productName?: string;
  quantity?: number;
  price?: number;
}

interface Order {
  _id: string;
  customerId: string;
  items: OrderItem[] | string[];
  totalAmount: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  createdAt: string;
  updatedAt: string;
  __v: number;
}

interface Delivery {
  _id: string;
  orderNumber: string;
  customer: string;
  address: string;
  items: string;
  scheduledDate: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  __v: number;
}

const UserHome = () => {
  const { user } = useAuthStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingDelivery, setEditingDelivery] = useState<Delivery | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedDeliveryDate, setSelectedDeliveryDate] = useState('');
  const [products, setProducts] = useState<any[]>([]);

  const statusIcons: { [key in 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled']: JSX.Element } = {
    pending: <Clock className="h-5 w-5 text-yellow-500" />,
    processing: <Package className="h-5 w-5 text-blue-500" />,
    shipped: <ShoppingBag className="h-5 w-5 text-purple-500" />,
    delivered: <CheckCircle className="h-5 w-5 text-green-500" />,
    cancelled: <AlertCircle className="h-5 w-5 text-red-500" />
  };

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setLoading(true);

        // Fetch available products
        interface Product {
          id: string;
          name: string;
          price: number;
          description?: string;
          [key: string]: string | number | undefined; // Adjust based on the actual product structure
        }

        const productsResponse = await axios.get<Product[]>('http://localhost:5000/api/products');
        setProducts(productsResponse.data);

        // Fetch user orders
        if (user?.id) {
          const ordersResponse = await axios.get<{ message: string; orders: Order[] }>(
            `http://localhost:5000/api/orders/user/${user.id}`
          );
          console.log('Orders Response:', ordersResponse.data.orders);
          setOrders(ordersResponse.data.orders);

          // Fetch all deliveries
          const deliveriesResponse = await axios.get<Delivery[]>('http://localhost:5000/api/deliveries/all');
          console.log('Deliveries Response:', deliveriesResponse.data);

          // Filter deliveries for the current user (case-insensitive and trimmed)
          const userDeliveries = deliveriesResponse.data.filter(
            (delivery) => delivery.customer.trim().toLowerCase() === user.name.trim().toLowerCase()
          );
          console.log('Filtered Deliveries:', userDeliveries);
          setDeliveries(userDeliveries);
        }

        setLoading(false);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to fetch data. Please try again later.');
        setLoading(false);
      }
    };

    if (user?.id) {
      fetchUserData();
    } else {
      setLoading(false);
    }
  }, [user?.id, user?.name]);

  const cancelOrder = async (orderId: string) => {
    try {
      interface CancelOrderResponse {
        success: boolean;
        message: string;
      }

      const response = await axios.delete<CancelOrderResponse>(`http://localhost:5000/api/orders/cancel/${orderId}`);

      if (response.data.success) {
        // Update the orders state to reflect the canceled order
        setOrders((prevOrders) =>
          prevOrders.map((order) =>
            order._id === orderId ? { ...order, status: 'cancelled' } : order
          )
        );
        toast.success(response.data.message || 'Order cancelled successfully');
      } else {
        throw new Error(response.data.message || 'Failed to cancel order');
      }
    } catch (err) {
      console.error('Error canceling order:', err);
      toast.error(err.response?.data?.message || err.message || 'Failed to cancel order. Please try again.');
    }
  };

  const parseOrderItems = (order: Order): OrderItem[] => {
    if (!order.items || order.items.length === 0) return [];
    
    if (typeof order.items[0] === 'string') {
      // Convert string items to OrderItem objects
      return order.items.map((item, index) => ({
        productId: `item-${index}`,
        productName: String(item),
        quantity: 1,
        price: order.totalAmount / order.items.length
      }));
    } else {
      // Already OrderItem objects
      return order.items.map(item => {
        if (typeof item === 'object' && item !== null) {
          // Find product name by ID if available
          const productName = products.find(p => p.id === item.productId)?.name || `Product ID: ${item.productId?.substring(0, 8)}`;
          return {
            productId: item.productId,
            productName,
            quantity: item.quantity || 1,
            price: item.price || 0
          };
        }
        return {
          productId: `unknown-${Math.random().toString(36).substring(7)}`,
          productName: String(item),
          quantity: 1,
          price: 0
        };
      });
    }
  };

  const findDeliveryForOrder = (orderId: string): Delivery | undefined => {
    return deliveries.find(delivery => delivery.orderNumber === orderId);
  };

  const handleEditDelivery = (order: Order) => {
    if (order.status === 'cancelled') {
      toast.error('Delivery for cancelled orders cannot be updated');
      return;
    }

    if (order.status === 'delivered') {
      toast.error('This order has already been delivered');
      return;
    }
    
    const delivery = findDeliveryForOrder(order._id);
    
    if (!delivery) {
      toast.error('No delivery found for this order');
      return;
    }
    
    setEditingDelivery(delivery);
    setSelectedDeliveryDate(delivery.scheduledDate || '');
    setShowEditModal(true);
  };

  const handleUpdateDelivery = async () => {
    if (!editingDelivery || !selectedDeliveryDate) {
      toast.error('Please select a valid delivery date and time');
      return;
    }

    // Validate the delivery date is in the future
    const deliveryDate = new Date(selectedDeliveryDate);
    const now = new Date();
    
    if (deliveryDate <= now) {
      toast.error('Please select a future date and time for delivery');
      return;
    }

    try {
      const response = await axios.put(`http://localhost:5000/api/orders/update/${editingDelivery._id}`, {
        scheduledDate: selectedDeliveryDate
      });

      if (response.data.message === 'Delivery updated successfully') {
        // Update local state for deliveries
        setDeliveries(prevDeliveries =>
          prevDeliveries.map(delivery =>
            delivery._id === editingDelivery._id
              ? { ...delivery, scheduledDate: selectedDeliveryDate }
              : delivery
          )
        );
        
        toast.success('Delivery date updated successfully');
        setShowEditModal(false);
      }
    } catch (err) {
      console.error('Error updating delivery:', err);
      toast.error(err.response?.data?.message || 'Failed to update delivery date');
    }
  };

  const displayItems = (items: OrderItem[] | string[]) => {
    if (!items) return 'No items';

    if (Array.isArray(items)) {
      if (items.length === 0) return 'No items';

      if (typeof items[0] === 'string') {
        return items.join(', ');
      } else {
        return items.map(item => {
          if (typeof item === 'object' && item !== null) {
            const productName = products.find(p => p.id === item.productId)?.name || `Product ID: ${item.productId?.substring(0, 8)}`;
            return `${item.quantity || 1} x ${productName}`;
          }
          return String(item);
        }).join(', ');
      }
    }

    return String(items);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <ToastContainer position="top-right" autoClose={3000} />
      {/* Farming Banner */}
      <div className="w-full h-48 mb-8 overflow-hidden relative">
        <img
          src={bannerImg}
          alt="Farm landscape with crops and fields"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black bg-opacity-30 flex flex-col justify-center items-center">
          <h2 className="text-white text-3xl font-bold">Fresh Farm Products</h2>
          <p className="text-white text-lg">From our fields to your home</p>
        </div>
      </div>
      <div className="bg-white shadow rounded-lg p-6 mb-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Welcome back, {user?.name}!</h1>
          <p className="text-gray-600 mt-1">
            Track your orders and deliveries from this dashboard.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            {
              name: 'Total Orders',
              value: orders.length,
              icon: ShoppingBag,
              color: 'bg-blue-100 text-blue-800'
            },
            {
              name: 'Pending',
              value: orders.filter(order => order.status === 'pending').length,
              icon: Clock,
              color: 'bg-yellow-100 text-yellow-800'
            },
            {
              name: 'Delivered',
              value: orders.filter(order => order.status === 'delivered').length,
              icon: CheckCircle,
              color: 'bg-green-100 text-green-800'
            },
            {
              name: 'Active Deliveries',
              value: deliveries.filter(delivery => delivery.status === 'pending').length,
              icon: Package,
              color: 'bg-purple-100 text-purple-800'
            }
          ].map((item, index) => (
            <div key={index} className={`${item.color} rounded-lg p-4 shadow-sm`}>
              <div className="flex items-center mb-2">
                <item.icon className="h-5 w-5 mr-2" />
                <h3 className="font-semibold text-sm">{item.name}</h3>
              </div>
              <div className="text-2xl font-bold">{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-6 mb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-800">Your Recent Orders</h2>
          <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
            View All
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Order ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Items
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {orders.length > 0 ? (
                orders.map((order) => (
                  <tr key={order._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      #{order._id.substring(0, 8)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {displayItems(order.items)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ${order.totalAmount.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {statusIcons[order.status]}
                        <span className="ml-2 text-sm capitalize">{order.status}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {(() => {
                        const orderDate = new Date(order.createdAt);
                        const now = new Date();
                        const diffTime = Math.abs(now.getTime() - orderDate.getTime());
                        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

                        if (diffDays === 0) {
                          const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
                          if (diffHours === 0) {
                            const diffMinutes = Math.floor(diffTime / (1000 * 60));
                            return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
                          }
                          return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
                        } else if (diffDays < 7) {
                          return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
                        } else {
                          return new Date(order.createdAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          });
                        }
                      })()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {/* <button
                        onClick={() => handleEditDelivery(order)}
                        className={`text-blue-600 hover:text-blue-800 font-medium mr-4 ${
                          (order.status === 'cancelled' || order.status === 'delivered') ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                        disabled={order.status === 'cancelled' || order.status === 'delivered'}
                      >
                        Update Delivery
                      </button> */}
                      <button
                        onClick={() => cancelOrder(order._id)}
                        className={`text-red-600 hover:text-red-800 font-medium ${
                          order.status === 'cancelled' ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                        disabled={order.status === 'cancelled'}
                      >
                        {order.status === 'cancelled' ? 'Cancelled' : 'Cancel'}
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-sm text-gray-500">
                    No orders found. Start shopping to see your orders here.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-800">Delivery Status</h2>
        </div>

        {deliveries.length > 0 ? (
          <div className="space-y-4">
             {deliveries.map((delivery) => (
      <div key={delivery._id} className="border rounded-lg p-4">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center">
            <Package className="h-5 w-5 text-blue-500 mr-2" />
            <span className="font-medium">Delivery #{delivery._id.substring(0, 8)}</span>
          </div>
          <span
            className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${delivery.status === 'completed'
              ? 'bg-green-100 text-green-800'
              : delivery.status === 'cancelled'
                ? 'bg-red-100 text-red-800'
                : 'bg-blue-100 text-blue-800'
              }`}
          >
            {delivery.status}
          </span>
                </div>
                <p className="text-sm text-gray-600 mb-2">Order: {delivery.orderNumber}</p>
                <p className="text-sm text-gray-600 mb-2">
                  Expected delivery: {delivery.scheduledDate ? new Date(delivery.scheduledDate).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  }) : 'Not specified'}
                </p>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500">Items: {delivery.items}</span>
                  {/* <button 
                    onClick={() => {
                      // Find the associated order
                      const order = orders.find(o => o._id === delivery.orderNumber);
                      if (order) {
                        handleEditDelivery(order);
                      } else {
                        toast.error('Associated order not found');
                      }
                    }}
                    className={`text-blue-600 hover:text-blue-800 font-medium ${
                      delivery.status === 'completed' || delivery.status === 'cancelled' ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    disabled={delivery.status === 'completed' || delivery.status === 'cancelled'}
                  >
                    Update Schedule
                  </button> */}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Package className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <p>No active deliveries found.</p>
          </div>
        )}
      </div>

      {/* Delivery Update Modal */}
      {showEditModal && editingDelivery && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">Update Delivery Schedule</h3>
            
            <div className="mb-6">
              <div className="flex items-center mb-3">
                <Calendar className="h-5 w-5 text-blue-500 mr-2" />
                <span className="font-medium">Delivery Details</span>
              </div>
              
              <div className="text-sm text-gray-600 mb-4">
                <p><span className="font-medium">Order ID:</span> #{editingDelivery.orderNumber.substring(0, 8)}</p>
                <p><span className="font-medium">Items:</span> {editingDelivery.items}</p>
                <p><span className="font-medium">Delivery Address:</span> {editingDelivery.address}</p>
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select New Delivery Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={selectedDeliveryDate}
                  onChange={(e) => setSelectedDeliveryDate(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {selectedDeliveryDate && new Date(selectedDeliveryDate) <= new Date() && (
                  <p className="mt-1 text-sm text-red-600">Please select a future date and time</p>
                )}
              </div>
              
              <div className="text-sm text-gray-500 bg-blue-50 p-3 rounded-md mb-4">
                <p>Note: You can only update the delivery date and time. Order items and payment details cannot be modified after the order is placed.</p>
              </div>
            </div>

            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 bg-gray-300 hover:bg-gray-400 rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateDelivery}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md"
                disabled={!selectedDeliveryDate || new Date(selectedDeliveryDate) <= new Date()}
              >
                Update Schedule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserHome;