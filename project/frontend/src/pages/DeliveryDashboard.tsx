import React, { useState, useEffect } from 'react';
import { Truck, MapPin, Clock, X, Trash } from 'lucide-react';
import axios from 'axios';

interface Delivery {
  _id: string;
  orderNumber: string;
  customer: string;
  address: string;
  items: string;
  scheduledDate: string;
  status: 'pending' | 'in_transit' | 'completed';
  createdAt?: string;
  updatedAt?: string;
}

const DeliveryDashboard = () => {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState({
    pending: 0,
    in_transit: 0,
    completed: 0
  });
  
  // State for modal and selected delivery
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
  
  // State for status update dropdown
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  // State for delete confirmation
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deliveryToDelete, setDeliveryToDelete] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    fetchDeliveries();
  }, []);

  const fetchDeliveries = async () => {
    try {
      setLoading(true);
      const response = await axios.get<Delivery[]>('http://localhost:5000/api/deliveries/all');
      setDeliveries(response.data);
      
      // Calculate metrics
      const pending = response.data.filter(d => d.status === 'pending').length;
      const inTransit = response.data.filter(d => d.status === 'in_transit').length;
      const completed = response.data.filter(d => d.status === 'completed').length;
      
      setMetrics({
        pending,
        in_transit: inTransit,
        completed
      });
      
      setLoading(false);
    } catch (err) {
      console.error('Error fetching deliveries:', err);
      setError('Failed to load deliveries. Please try again later.');
      setLoading(false);
    }
  };

  // Format date from ISO string to YYYY-MM-DD
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
  };
  
  // Format date and time
  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Handle opening the details modal
  const handleViewDetails = (delivery: Delivery) => {
    setSelectedDelivery(delivery);
    setIsModalOpen(true);
  };
  
  // Close the modal
  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedDelivery(null);
  };
  
  const handleStatusUpdate = async (deliveryId: string, newStatus: 'pending' | 'in_transit' | 'completed') => {
    try {
      setStatusLoading(true);
      setUpdatingId(deliveryId);
      
      await axios.put(`http://localhost:5000/api/deliveries/${deliveryId}/status`, {
        status: newStatus
      });
      
      setDeliveries(prevDeliveries => 
        prevDeliveries.map(delivery => 
          delivery._id === deliveryId 
            ? { ...delivery, status: newStatus } 
            : delivery
        )
      );
      
      const updatedDeliveries = deliveries.map(delivery => 
        delivery._id === deliveryId 
          ? { ...delivery, status: newStatus } 
          : delivery
      );
      
      const pending = updatedDeliveries.filter(d => d.status === 'pending').length;
      const inTransit = updatedDeliveries.filter(d => d.status === 'in_transit').length;
      const completed = updatedDeliveries.filter(d => d.status === 'completed').length;
      
      setMetrics({
        pending,
        in_transit: inTransit,
        completed
      });
      
    } catch (err) {
      console.error('Error updating delivery status:', err);
      alert('Failed to update delivery status. Please try again.');
    } finally {
      setStatusLoading(false);
      setUpdatingId(null);
    }
  };

  // Handle delete confirmation
  const confirmDelete = (deliveryId: string) => {
    setDeliveryToDelete(deliveryId);
    setIsDeleteModalOpen(true);
    // If we're in the details modal, keep it open behind the confirmation dialog
  };

  // Handle delete cancellation
  const cancelDelete = () => {
    setIsDeleteModalOpen(false);
    setDeliveryToDelete(null);
  };

  // Handle delivery deletion
  const handleDeleteDelivery = async () => {
    if (!deliveryToDelete) return;
    
    try {
      setDeleteLoading(true);
      
      // Call the delete API endpoint
      await axios.delete(`http://localhost:5000/api/deliveries/delete/${deliveryToDelete}`);
      
      // Update local state by removing the deleted delivery
      setDeliveries(prevDeliveries => 
        prevDeliveries.filter(delivery => delivery._id !== deliveryToDelete)
      );
      
      // Recalculate metrics
      const updatedDeliveries = deliveries.filter(delivery => delivery._id !== deliveryToDelete);
      const pending = updatedDeliveries.filter(d => d.status === 'pending').length;
      const inTransit = updatedDeliveries.filter(d => d.status === 'in_transit').length;
      const completed = updatedDeliveries.filter(d => d.status === 'completed').length;
      
      setMetrics({
        pending,
        in_transit: inTransit,
        completed
      });
      
      // If we were viewing the deleted delivery's details, close that modal
      if (selectedDelivery && selectedDelivery._id === deliveryToDelete) {
        setIsModalOpen(false);
        setSelectedDelivery(null);
      }
      
      // Show success message
      alert('Delivery successfully deleted');
      
    } catch (err) {
      console.error('Error deleting delivery:', err);
      alert('Failed to delete delivery. Please try again.');
    } finally {
      setDeleteLoading(false);
      setIsDeleteModalOpen(false);
      setDeliveryToDelete(null);
    }
  };

  if (loading) {
    return <div className="text-center p-8">Loading deliveries...</div>;
  }

  if (error) {
    return <div className="text-center p-8 text-red-600">{error}</div>;
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Delivery Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage and track your delivery assignments
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center">
            <Truck className="h-10 w-10 text-green-600" />
            <div className="ml-4">
              <h2 className="text-lg font-semibold text-gray-900">Pending Deliveries</h2>
              <p className="text-2xl font-bold">{metrics.pending}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center">
            <MapPin className="h-10 w-10 text-blue-600" />
            <div className="ml-4">
              <h2 className="text-lg font-semibold text-gray-900">In Transit</h2>
              <p className="text-2xl font-bold">{metrics.in_transit}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center">
            <Clock className="h-10 w-10 text-yellow-500" />
            <div className="ml-4">
              <h2 className="text-lg font-semibold text-gray-900">Completed Today</h2>
              <p className="text-2xl font-bold">{metrics.completed}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Active Deliveries</h3>
        </div>
        {deliveries.length === 0 ? (
          <div className="p-6 text-center text-gray-500">No deliveries found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Order #
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Items
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Delivery Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {deliveries.map((delivery) => (
                  <tr key={delivery._id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {delivery.orderNumber}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{delivery.customer}</div>
                      <div className="text-sm text-gray-500">{delivery.address}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {delivery.items}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(delivery.scheduledDate)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        delivery.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-800'
                          : delivery.status === 'in_transit'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {delivery.status === 'pending' 
                          ? 'Pending' 
                          : delivery.status === 'in_transit' 
                          ? 'In Transit' 
                          : 'Completed'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {updatingId === delivery._id && statusLoading ? (
                        <span>Updating...</span>
                      ) : (
                        <div className="flex items-center">
                          <select 
                            className="mr-2 text-sm border rounded p-1"
                            value={delivery.status}
                            onChange={(e) => handleStatusUpdate(
                              delivery._id, 
                              e.target.value as 'pending' | 'in_transit' | 'completed'
                            )}
                          >
                            <option value="pending">Pending</option>
                            <option value="in_transit">In Transit</option>
                            <option value="completed">Completed</option>
                          </select>
                          <button 
                            className="text-blue-600 hover:text-blue-900 mr-3"
                            onClick={() => handleViewDetails(delivery)}
                          >
                            View Details
                          </button>
                          <button 
                            className="text-red-600 hover:text-red-900"
                            onClick={() => confirmDelete(delivery._id)}
                          >
                            <Trash className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Details Modal */}
      {isModalOpen && selectedDelivery && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4 md:mx-0">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Delivery Details</h3>
              <button 
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-500">Order Number</p>
                <p className="mt-1 text-sm text-gray-900">{selectedDelivery.orderNumber}</p>
              </div>
              
              <div>
                <p className="text-sm font-medium text-gray-500">Customer</p>
                <p className="mt-1 text-sm text-gray-900">{selectedDelivery.customer}</p>
              </div>
              
              <div>
                <p className="text-sm font-medium text-gray-500">Delivery Address</p>
                <p className="mt-1 text-sm text-gray-900">{selectedDelivery.address}</p>
              </div>
              
              <div>
                <p className="text-sm font-medium text-gray-500">Items</p>
                <p className="mt-1 text-sm text-gray-900">{selectedDelivery.items}</p>
              </div>
              
              <div>
                <p className="text-sm font-medium text-gray-500">Scheduled Date</p>
                <p className="mt-1 text-sm text-gray-900">{formatDateTime(selectedDelivery.scheduledDate)}</p>
              </div>
              
              <div>
                <p className="text-sm font-medium text-gray-500">Status</p>
                <p className="mt-1">
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                    selectedDelivery.status === 'pending'
                      ? 'bg-yellow-100 text-yellow-800'
                      : selectedDelivery.status === 'in_transit'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-green-100 text-green-800'
                  }`}>
                    {selectedDelivery.status === 'pending' 
                      ? 'Pending' 
                      : selectedDelivery.status === 'in_transit' 
                      ? 'In Transit' 
                      : 'Completed'}
                  </span>
                </p>
              </div>
              
              {selectedDelivery.createdAt && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Created At</p>
                  <p className="mt-1 text-sm text-gray-900">{formatDateTime(selectedDelivery.createdAt)}</p>
                </div>
              )}
              
              {selectedDelivery.updatedAt && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Last Updated</p>
                  <p className="mt-1 text-sm text-gray-900">{formatDateTime(selectedDelivery.updatedAt)}</p>
                </div>
              )}
              
              <div className="pt-4 flex space-x-4">
                <button
                  onClick={closeModal}
                  className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:text-sm"
                >
                  Close
                </button>
                <button
                  onClick={() => confirmDelete(selectedDelivery._id)}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:text-sm"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4 md:mx-0">
            <div className="mb-4">
              <h3 className="text-lg font-medium text-gray-900">Confirm Deletion</h3>
              <p className="mt-2 text-sm text-gray-500">
                Are you sure you want to delete this delivery? This action cannot be undone.
              </p>
            </div>
            
            <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
              <button
                type="button"
                className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:col-start-2 sm:text-sm"
                onClick={handleDeleteDelivery}
                disabled={deleteLoading}
              >
                {deleteLoading ? 'Deleting...' : 'Delete'}
              </button>
              <button
                type="button"
                className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:col-start-1 sm:text-sm"
                onClick={cancelDelete}
                disabled={deleteLoading}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeliveryDashboard;