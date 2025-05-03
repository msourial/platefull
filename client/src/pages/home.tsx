import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from "recharts";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowUpRight, ShoppingBag, Truck, CheckCircle, Clock, DollarSign } from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";

export default function Home() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['/api/stats'],
  });

  // Sample data for charts (in a real app, this would come from the API)
  const orderData = [
    { name: "Mon", orders: 12 },
    { name: "Tue", orders: 19 },
    { name: "Wed", orders: 15 },
    { name: "Thu", orders: 22 },
    { name: "Fri", orders: 30 },
    { name: "Sat", orders: 40 },
    { name: "Sun", orders: 25 },
  ];

  const revenueData = [
    { name: "Mon", revenue: 120 },
    { name: "Tue", revenue: 190 },
    { name: "Wed", revenue: 150 },
    { name: "Thu", revenue: 220 },
    { name: "Fri", revenue: 300 },
    { name: "Sat", revenue: 400 },
    { name: "Sun", revenue: 250 },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <DashboardHeader />
      
      <main className="flex-1 p-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">Restaurant Dashboard</h1>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Pending Orders</p>
                    <h2 className="text-3xl font-bold">{isLoading ? "..." : stats?.pendingCount || 0}</h2>
                  </div>
                  <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                    <Clock className="w-6 h-6 text-orange-500" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Confirmed Orders</p>
                    <h2 className="text-3xl font-bold">{isLoading ? "..." : stats?.confirmedCount || 0}</h2>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <ShoppingBag className="w-6 h-6 text-blue-500" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Delivering</p>
                    <h2 className="text-3xl font-bold">{isLoading ? "..." : stats?.deliveringCount || 0}</h2>
                  </div>
                  <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                    <Truck className="w-6 h-6 text-purple-500" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Total Revenue</p>
                    <h2 className="text-3xl font-bold">${isLoading ? "..." : stats?.totalRevenue || "0.00"}</h2>
                  </div>
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    <DollarSign className="w-6 h-6 text-green-500" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <Card>
              <CardHeader>
                <CardTitle>Orders This Week</CardTitle>
                <CardDescription>Number of orders received per day</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={orderData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="orders" fill="hsl(var(--chart-1))" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Revenue This Week</CardTitle>
                <CardDescription>Daily revenue in USD</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={revenueData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="revenue" stroke="hsl(var(--chart-2))" activeDot={{ r: 8 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle>Recent Orders</CardTitle>
              <CardDescription>Latest completed orders</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-4">Loading recent orders...</div>
              ) : (
                <div className="space-y-4">
                  {stats?.recentOrders && stats.recentOrders.length > 0 ? (
                    stats.recentOrders.map((order: any, index: number) => (
                      <div key={order.id} className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="bg-primary-50 p-2 rounded-full">
                            <CheckCircle className="text-green-500 h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-medium">Order #{order.id}</p>
                            <p className="text-sm text-muted-foreground">
                              {new Date(order.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          <Badge variant={order.isDelivery ? "outline" : "secondary"}>
                            {order.isDelivery ? "Delivery" : "Pickup"}
                          </Badge>
                          <p className="font-medium">${parseFloat(order.totalAmount.toString()).toFixed(2)}</p>
                        </div>
                        {index < (stats.recentOrders.length - 1) && <Separator className="mt-4" />}
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-4">No recent orders found</div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
