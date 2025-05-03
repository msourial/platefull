import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { QueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import DashboardHeader from "@/components/DashboardHeader";
import OrdersList from "@/components/OrdersList";

export default function Orders() {
  const [activeTab, setActiveTab] = useState("pending");
  
  const { data: orders, isLoading } = useQuery({
    queryKey: ['/api/orders', activeTab],
    queryFn: () => 
      fetch(`/api/orders?status=${activeTab === 'all' ? '' : activeTab}`)
        .then(res => res.json()),
  });

  const handleUpdateStatus = async (orderId: number, newStatus: string) => {
    try {
      await apiRequest('PATCH', `/api/orders/${orderId}/status`, { status: newStatus });
      // Invalidate queries to refetch the updated data
      const queryClient = new QueryClient();
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
    } catch (error) {
      console.error('Error updating order status:', error);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <DashboardHeader />
      
      <main className="flex-1 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Order Management</h1>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle>Orders</CardTitle>
              <CardDescription>View and manage customer orders</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="pending" onValueChange={setActiveTab}>
                <TabsList className="mb-6">
                  <TabsTrigger value="pending">Pending</TabsTrigger>
                  <TabsTrigger value="confirmed">Confirmed</TabsTrigger>
                  <TabsTrigger value="delivering">Delivering</TabsTrigger>
                  <TabsTrigger value="completed">Completed</TabsTrigger>
                  <TabsTrigger value="all">All Orders</TabsTrigger>
                </TabsList>
                
                <TabsContent value="pending">
                  <OrdersList 
                    isLoading={isLoading} 
                    orders={orders} 
                    onUpdateStatus={handleUpdateStatus}
                    actions={[
                      { label: "Confirm", value: "confirmed" },
                      { label: "Cancel", value: "cancelled" }
                    ]}
                  />
                </TabsContent>
                
                <TabsContent value="confirmed">
                  <OrdersList 
                    isLoading={isLoading} 
                    orders={orders} 
                    onUpdateStatus={handleUpdateStatus}
                    actions={[
                      { label: "Start Delivery", value: "delivering" },
                      { label: "Ready for Pickup", value: "ready_for_pickup" }
                    ]}
                  />
                </TabsContent>
                
                <TabsContent value="delivering">
                  <OrdersList 
                    isLoading={isLoading} 
                    orders={orders} 
                    onUpdateStatus={handleUpdateStatus}
                    actions={[
                      { label: "Complete", value: "completed" }
                    ]}
                  />
                </TabsContent>
                
                <TabsContent value="completed">
                  <OrdersList 
                    isLoading={isLoading} 
                    orders={orders} 
                    onUpdateStatus={handleUpdateStatus}
                    actions={[]}
                  />
                </TabsContent>
                
                <TabsContent value="all">
                  <OrdersList 
                    isLoading={isLoading} 
                    orders={orders} 
                    onUpdateStatus={handleUpdateStatus}
                    actions={[
                      { label: "Mark Pending", value: "pending" },
                      { label: "Mark Confirmed", value: "confirmed" },
                      { label: "Mark Delivering", value: "delivering" },
                      { label: "Mark Completed", value: "completed" },
                      { label: "Cancel", value: "cancelled" }
                    ]}
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
