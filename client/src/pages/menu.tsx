import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { queryClient, apiRequest } from "@/lib/queryClient";
import DashboardHeader from "@/components/DashboardHeader";

export default function Menu() {
  const [activeTab, setActiveTab] = useState("all");
  
  // Fetch categories
  const { data: categories, isLoading: categoriesLoading } = useQuery({
    queryKey: ['/api/categories'],
  });
  
  // Fetch menu items
  const { data: menuItems, isLoading: menuItemsLoading } = useQuery({
    queryKey: ['/api/menu-items', activeTab !== 'all' ? activeTab : null],
    queryFn: () => 
      fetch(`/api/menu-items${activeTab !== 'all' ? `?categoryId=${activeTab}` : ''}`)
        .then(res => res.json()),
  });

  // Toggle item availability mutation
  const toggleAvailabilityMutation = useMutation({
    mutationFn: async ({ id, isAvailable }: { id: number, isAvailable: boolean }) => {
      return apiRequest('PATCH', `/api/menu-items/${id}`, { isAvailable });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/menu-items'] });
    },
  });

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <DashboardHeader />
      
      <main className="flex-1 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Menu Management</h1>
            <Button className="mt-4 md:mt-0">Add New Item</Button>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle>Menu Items</CardTitle>
              <CardDescription>View and manage your restaurant menu</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="all" onValueChange={setActiveTab}>
                <TabsList className="mb-6">
                  <TabsTrigger value="all">All Items</TabsTrigger>
                  {!categoriesLoading && categories?.map((category: any) => (
                    <TabsTrigger key={category.id} value={category.id.toString()}>
                      {category.name}
                    </TabsTrigger>
                  ))}
                </TabsList>
                
                <TabsContent value={activeTab}>
                  {menuItemsLoading ? (
                    <div className="flex items-center justify-center p-8">
                      <div className="flex flex-col items-center gap-2">
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
                        <p className="text-sm text-muted-foreground">Loading menu items...</p>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Item</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Price</TableHead>
                            <TableHead>Available</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {menuItems?.map((item: any) => (
                            <TableRow key={item.id}>
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  {item.imageUrl && (
                                    <img 
                                      src={item.imageUrl} 
                                      alt={item.name} 
                                      className="h-10 w-10 rounded object-cover"
                                    />
                                  )}
                                  <div>
                                    <p className="font-medium">{item.name}</p>
                                    <p className="text-xs text-muted-foreground line-clamp-1">
                                      {item.description}
                                    </p>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">
                                  {item.category?.name}
                                </Badge>
                              </TableCell>
                              <TableCell>${parseFloat(item.price.toString()).toFixed(2)}</TableCell>
                              <TableCell>
                                <div className="flex items-center space-x-2">
                                  <Switch 
                                    id={`available-${item.id}`} 
                                    checked={item.isAvailable}
                                    onCheckedChange={(checked) => 
                                      toggleAvailabilityMutation.mutate({ id: item.id, isAvailable: checked })
                                    }
                                  />
                                  <Label htmlFor={`available-${item.id}`}>
                                    {item.isAvailable ? "Yes" : "No"}
                                  </Label>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Button variant="ghost" size="sm">Edit</Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                          
                          {menuItems?.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={5} className="h-24 text-center">
                                No menu items found for this category
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
