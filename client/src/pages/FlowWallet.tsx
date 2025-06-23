import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Wallet, Shield, Award, ArrowLeftRight, Copy, CheckCircle } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface FlowAddress {
  address: string;
  valid: boolean;
}

interface LoyaltyData {
  address: string;
  points: number;
  tier: string;
}

interface CurrencyConversion {
  original: number;
  converted: number;
  from: string;
  to: string;
  rate: number;
}

export default function FlowWallet() {
  const [walletAddress, setWalletAddress] = useState('');
  const [connectedAddress, setConnectedAddress] = useState<string | null>(
    localStorage.getItem('flowWalletAddress')
  );
  const [convertAmount, setConvertAmount] = useState('');
  const [convertFrom, setConvertFrom] = useState<'USD' | 'FLOW'>('USD');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Verify wallet address
  const verifyAddressMutation = useMutation({
    mutationFn: async (address: string): Promise<FlowAddress> => {
      const response = await fetch('/api/flow/verify-address', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address })
      });
      if (!response.ok) throw new Error('Failed to verify address');
      return response.json();
    },
    onSuccess: (data) => {
      if (data.valid) {
        setConnectedAddress(data.address);
        localStorage.setItem('flowWalletAddress', data.address);
        toast({
          title: "Wallet Connected",
          description: `Successfully connected to Flow wallet: ${data.address.slice(0, 8)}...${data.address.slice(-6)}`
        });
        queryClient.invalidateQueries({ queryKey: ['/api/flow/loyalty'] });
      } else {
        toast({
          title: "Invalid Address",
          description: "Please enter a valid Flow wallet address",
          variant: "destructive"
        });
      }
    },
    onError: () => {
      toast({
        title: "Connection Failed",
        description: "Unable to verify wallet address. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Get loyalty points
  const { data: loyaltyData, isLoading: loyaltyLoading } = useQuery<LoyaltyData>({
    queryKey: ['/api/flow/loyalty', connectedAddress],
    queryFn: async () => {
      if (!connectedAddress) throw new Error('No wallet connected');
      const response = await fetch(`/api/flow/loyalty/${connectedAddress}`);
      if (!response.ok) throw new Error('Failed to fetch loyalty data');
      return response.json();
    },
    enabled: !!connectedAddress,
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Currency conversion
  const convertMutation = useMutation({
    mutationFn: async (params: { amount: number; from: string; to: string }): Promise<CurrencyConversion> => {
      const response = await fetch('/api/flow/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      if (!response.ok) throw new Error('Failed to convert currency');
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Conversion Complete",
        description: `${data.original} ${data.from} = ${data.converted.toFixed(4)} ${data.to}`
      });
    }
  });

  const handleConnectWallet = () => {
    if (!walletAddress.trim()) {
      toast({
        title: "Address Required",
        description: "Please enter your Flow wallet address",
        variant: "destructive"
      });
      return;
    }
    verifyAddressMutation.mutate(walletAddress.trim());
  };

  const handleDisconnectWallet = () => {
    setConnectedAddress(null);
    setWalletAddress('');
    localStorage.removeItem('flowWalletAddress');
    toast({
      title: "Wallet Disconnected",
      description: "Your Flow wallet has been disconnected"
    });
  };

  const handleConvert = () => {
    const amount = parseFloat(convertAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount to convert",
        variant: "destructive"
      });
      return;
    }

    const to = convertFrom === 'USD' ? 'FLOW' : 'USD';
    convertMutation.mutate({ amount, from: convertFrom, to });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Address copied to clipboard"
    });
  };

  const getTierColor = (tier: string) => {
    switch (tier.toLowerCase()) {
      case 'gold': return 'bg-yellow-500';
      case 'silver': return 'bg-gray-400';
      case 'bronze': return 'bg-orange-600';
      default: return 'bg-blue-500';
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Flow Blockchain Wallet</h1>
        <p className="text-muted-foreground">
          Connect your Flow wallet to enable crypto payments and earn NFT loyalty rewards
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Wallet Connection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Wallet Connection
            </CardTitle>
            <CardDescription>
              Connect your Flow wallet to access blockchain features
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!connectedAddress ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="wallet-address">Flow Wallet Address</Label>
                  <Input
                    id="wallet-address"
                    placeholder="0x1234567890abcdef"
                    value={walletAddress}
                    onChange={(e) => setWalletAddress(e.target.value)}
                    className="font-mono text-sm"
                  />
                </div>
                <Button 
                  onClick={handleConnectWallet}
                  disabled={verifyAddressMutation.isPending}
                  className="w-full"
                >
                  {verifyAddressMutation.isPending ? 'Connecting...' : 'Connect Wallet'}
                </Button>
              </>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-sm font-medium text-green-700 dark:text-green-400">
                    Wallet Connected
                  </span>
                </div>
                <div className="space-y-2">
                  <Label>Connected Address</Label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 p-2 bg-muted rounded text-sm">
                      {connectedAddress}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(connectedAddress)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <Button 
                  onClick={handleDisconnectWallet}
                  variant="outline"
                  className="w-full"
                >
                  Disconnect Wallet
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Loyalty Points */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              Loyalty Program
            </CardTitle>
            <CardDescription>
              Your blockchain-powered loyalty rewards
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!connectedAddress ? (
              <div className="text-center py-8 text-muted-foreground">
                <Shield className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Connect your wallet to view loyalty points</p>
              </div>
            ) : loyaltyLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="mt-2 text-sm text-muted-foreground">Loading loyalty data...</p>
              </div>
            ) : loyaltyData ? (
              <div className="space-y-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary mb-1">
                    {loyaltyData.points.toLocaleString()}
                  </div>
                  <div className="text-sm text-muted-foreground">Loyalty Points</div>
                </div>
                <div className="flex justify-center">
                  <Badge className={`${getTierColor(loyaltyData.tier)} text-white`}>
                    {loyaltyData.tier} Tier
                  </Badge>
                </div>
                <Separator />
                <div className="text-xs text-muted-foreground text-center">
                  Points are stored securely on the Flow blockchain and can be redeemed for exclusive NFT rewards
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>No loyalty data available</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Currency Converter */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowLeftRight className="h-5 w-5" />
              Currency Converter
            </CardTitle>
            <CardDescription>
              Convert between USD and FLOW tokens for crypto payments
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3 items-end">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="0.00"
                  value={convertAmount}
                  onChange={(e) => setConvertAmount(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="from-currency">From</Label>
                <select
                  id="from-currency"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={convertFrom}
                  onChange={(e) => setConvertFrom(e.target.value as 'USD' | 'FLOW')}
                >
                  <option value="USD">USD</option>
                  <option value="FLOW">FLOW</option>
                </select>
              </div>
              <Button 
                onClick={handleConvert}
                disabled={convertMutation.isPending}
                className="w-full"
              >
                {convertMutation.isPending ? 'Converting...' : 'Convert'}
              </Button>
            </div>
            
            {convertMutation.data && (
              <div className="mt-4 p-4 bg-muted rounded-lg">
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {convertMutation.data.converted.toFixed(4)} {convertMutation.data.to}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Exchange rate: 1 {convertMutation.data.from} = {convertMutation.data.rate.toFixed(4)} {convertMutation.data.to}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Features Info */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Blockchain Features</CardTitle>
          <CardDescription>
            Available features with Flow Agent Kit integration
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="text-center p-4">
              <Wallet className="h-8 w-8 mx-auto mb-2 text-primary" />
              <h3 className="font-semibold mb-1">Crypto Payments</h3>
              <p className="text-sm text-muted-foreground">
                Pay for orders using FLOW tokens directly from your wallet
              </p>
            </div>
            <div className="text-center p-4">
              <Award className="h-8 w-8 mx-auto mb-2 text-primary" />
              <h3 className="font-semibold mb-1">NFT Loyalty</h3>
              <p className="text-sm text-muted-foreground">
                Earn exclusive NFT rewards and loyalty points stored on-chain
              </p>
            </div>
            <div className="text-center p-4">
              <Shield className="h-8 w-8 mx-auto mb-2 text-primary" />
              <h3 className="font-semibold mb-1">Order Tracking</h3>
              <p className="text-sm text-muted-foreground">
                All orders are recorded on the blockchain for transparency
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}