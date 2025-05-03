import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Check, AlertCircle } from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";

export default function Settings() {
  const [botToken, setBotToken] = useState("");
  const [saveStatus, setSaveStatus] = useState<{type: "success" | "error", message: string} | null>(null);

  const handleSaveToken = () => {
    // In a real application, you would save this to the server
    if (!botToken) {
      setSaveStatus({
        type: "error",
        message: "Please enter a valid Telegram bot token"
      });
      return;
    }
    
    setSaveStatus({
      type: "success",
      message: "Telegram bot token saved successfully!"
    });
    
    // Reset the status after a delay
    setTimeout(() => {
      setSaveStatus(null);
    }, 3000);
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <DashboardHeader />
      
      <main className="flex-1 p-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">Settings</h1>
          
          <Tabs defaultValue="general">
            <TabsList className="mb-6">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="telegram">Telegram Bot</TabsTrigger>
              <TabsTrigger value="payment">Payment</TabsTrigger>
            </TabsList>
            
            <TabsContent value="general">
              <Card>
                <CardHeader>
                  <CardTitle>Restaurant Information</CardTitle>
                  <CardDescription>Manage your restaurant details</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="restaurant-name">Restaurant Name</Label>
                      <Input id="restaurant-name" defaultValue="Delicious Restaurant" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="restaurant-phone">Phone Number</Label>
                      <Input id="restaurant-phone" type="tel" />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="restaurant-address">Address</Label>
                      <Input id="restaurant-address" />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="restaurant-description">Description</Label>
                      <Input id="restaurant-description" />
                    </div>
                  </div>
                  <Button className="mt-2">Save Changes</Button>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="telegram">
              <Card>
                <CardHeader>
                  <CardTitle>Telegram Bot Configuration</CardTitle>
                  <CardDescription>Manage your Telegram bot settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="telegram-token">Bot Token</Label>
                    <Input 
                      id="telegram-token" 
                      value={botToken}
                      onChange={(e) => setBotToken(e.target.value)}
                      placeholder="Enter your Telegram bot token" 
                    />
                    <p className="text-sm text-muted-foreground">
                      You can get a bot token by talking to @BotFather on Telegram.
                    </p>
                  </div>
                  
                  {saveStatus && (
                    <Alert variant={saveStatus.type === "success" ? "default" : "destructive"} className="mt-4">
                      <div className="flex items-center gap-2">
                        {saveStatus.type === "success" ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <AlertCircle className="h-4 w-4" />
                        )}
                        <AlertDescription>{saveStatus.message}</AlertDescription>
                      </div>
                    </Alert>
                  )}
                  
                  <Button onClick={handleSaveToken}>Save Bot Token</Button>
                </CardContent>
              </Card>
              
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>Bot Commands</CardTitle>
                  <CardDescription>Default commands for your Telegram bot</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="rounded-md border">
                      <div className="p-4 border-b">
                        <div className="flex justify-between items-center">
                          <div>
                            <h4 className="font-medium">/start</h4>
                            <p className="text-sm text-muted-foreground">Start the conversation with the bot</p>
                          </div>
                        </div>
                      </div>
                      <div className="p-4 border-b">
                        <div className="flex justify-between items-center">
                          <div>
                            <h4 className="font-medium">/menu</h4>
                            <p className="text-sm text-muted-foreground">Show the restaurant menu</p>
                          </div>
                        </div>
                      </div>
                      <div className="p-4 border-b">
                        <div className="flex justify-between items-center">
                          <div>
                            <h4 className="font-medium">/order</h4>
                            <p className="text-sm text-muted-foreground">View current order</p>
                          </div>
                        </div>
                      </div>
                      <div className="p-4">
                        <div className="flex justify-between items-center">
                          <div>
                            <h4 className="font-medium">/help</h4>
                            <p className="text-sm text-muted-foreground">Show help information</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="payment">
              <Card>
                <CardHeader>
                  <CardTitle>Payment Settings</CardTitle>
                  <CardDescription>Configure your payment options</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="coinbase-api-key">Coinbase API Key</Label>
                    <Input id="coinbase-api-key" type="password" placeholder="Enter your Coinbase API key" />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="delivery-fee">Delivery Fee ($)</Label>
                    <Input id="delivery-fee" type="number" defaultValue="2.00" />
                  </div>
                  
                  <Button>Save Payment Settings</Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
