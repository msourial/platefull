import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Calendar, MoreHorizontal, ChevronDown } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface OrdersListProps {
  isLoading: boolean;
  orders: any[];
  onUpdateStatus: (orderId: number, newStatus: string) => void;
  actions: { label: string; value: string }[];
}

export default function OrdersList({ isLoading, orders, onUpdateStatus, actions }: OrdersListProps) {
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Get status badge variant based on status
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Pending</Badge>;
      case "confirmed":
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Confirmed</Badge>;
      case "delivering":
      case "ready_for_pickup":
        return <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
          {status === "delivering" ? "Delivering" : "Ready for Pickup"}
        </Badge>;
      case "completed":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Completed</Badge>;
      case "cancelled":
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const viewOrderDetails = (order: any) => {
    setSelectedOrder(order);
    setIsDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="text-sm text-muted-foreground">Loading orders...</p>
        </div>
      </div>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <div className="rounded-full bg-muted p-3">
          <Calendar className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="mt-4 text-lg font-semibold">No orders found</h3>
        <p className="text-sm text-muted-foreground text-center mt-1">
          There are no orders with this status at the moment.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order ID</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => (
              <TableRow key={order.id}>
                <TableCell className="font-medium">#{order.id}</TableCell>
                <TableCell>
                  {order.telegramUser?.firstName || "Unknown"} {order.telegramUser?.lastName || ""}
                </TableCell>
                <TableCell>
                  {formatDistanceToNow(new Date(order.createdAt), { addSuffix: true })}
                </TableCell>
                <TableCell>${parseFloat(order.totalAmount.toString()).toFixed(2)}</TableCell>
                <TableCell>
                  <Badge variant={order.isDelivery ? "outline" : "secondary"}>
                    {order.isDelivery ? "Delivery" : "Pickup"}
                  </Badge>
                </TableCell>
                <TableCell>{getStatusBadge(order.status)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => viewOrderDetails(order)}>
                      View
                    </Button>
                    {actions.length > 0 && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {actions.map((action) => (
                            <DropdownMenuItem 
                              key={action.value}
                              onClick={() => onUpdateStatus(order.id, action.value)}
                            >
                              {action.label}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Order Details Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Order #{selectedOrder?.id}</DialogTitle>
            <DialogDescription>
              Placed {selectedOrder && formatDistanceToNow(new Date(selectedOrder.createdAt), { addSuffix: true })}
            </DialogDescription>
          </DialogHeader>
          
          {selectedOrder && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium mb-2">Customer</h4>
                <p>{selectedOrder.telegramUser?.firstName || "Unknown"} {selectedOrder.telegramUser?.lastName || ""}</p>
                {selectedOrder.telegramUser?.username && (
                  <p className="text-sm text-muted-foreground">@{selectedOrder.telegramUser.username}</p>
                )}
              </div>
              
              {selectedOrder.isDelivery && selectedOrder.deliveryAddress && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Delivery Address</h4>
                  <p className="text-sm">{selectedOrder.deliveryAddress}</p>
                  {selectedOrder.deliveryInstructions && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Note: {selectedOrder.deliveryInstructions}
                    </p>
                  )}
                </div>
              )}
              
              <div>
                <h4 className="text-sm font-medium mb-2">Order Items</h4>
                <div className="space-y-2">
                  {selectedOrder.orderItems?.map((item: any) => (
                    <div key={item.id} className="flex justify-between">
                      <div>
                        <p>{item.quantity}x {item.menuItem?.name}</p>
                        {item.specialInstructions && (
                          <p className="text-xs text-muted-foreground">Note: {item.specialInstructions}</p>
                        )}
                        {item.customizations && Object.keys(item.customizations).length > 0 && (
                          <p className="text-xs text-muted-foreground">
                            {Object.entries(item.customizations as Record<string, string>)
                              .map(([key, value]) => `${key}: ${value}`)
                              .join(', ')}
                          </p>
                        )}
                      </div>
                      <p>${(parseFloat(item.price.toString()) * item.quantity).toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="pt-2 border-t">
                <div className="flex justify-between">
                  <p>Subtotal</p>
                  <p>${(parseFloat(selectedOrder.totalAmount.toString()) - parseFloat(selectedOrder.deliveryFee.toString())).toFixed(2)}</p>
                </div>
                {selectedOrder.isDelivery && (
                  <div className="flex justify-between">
                    <p>Delivery Fee</p>
                    <p>${parseFloat(selectedOrder.deliveryFee.toString()).toFixed(2)}</p>
                  </div>
                )}
                <div className="flex justify-between font-medium pt-2 border-t mt-2">
                  <p>Total</p>
                  <p>${parseFloat(selectedOrder.totalAmount.toString()).toFixed(2)}</p>
                </div>
              </div>
              
              <div>
                <h4 className="text-sm font-medium mb-2">Payment</h4>
                <p>Method: {selectedOrder.paymentMethod === 'crypto' ? 'Coinbase (Cryptocurrency)' : 'Cash on ' + (selectedOrder.isDelivery ? 'Delivery' : 'Pickup')}</p>
                <p>Status: {selectedOrder.paymentStatus}</p>
              </div>

              {actions.length > 0 && (
                <div className="flex justify-end gap-2 pt-4">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline">
                        Update Status <ChevronDown className="ml-2 h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {actions.map((action) => (
                        <DropdownMenuItem 
                          key={action.value}
                          onClick={() => {
                            onUpdateStatus(selectedOrder.id, action.value);
                            setIsDialogOpen(false);
                          }}
                        >
                          {action.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
