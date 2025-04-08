#!/usr/bin/env node
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import WebSocket from 'ws';
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// Constants
const BINANCE_WS_URL = 'wss://stream.binance.com:9443/ws';
const BINANCE_REST_API = 'https://api.binance.com/api/v3';
const USER_AGENT = 'binance-mcp-tool/1.0.0';

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Type definitions for Binance API responses
interface TickerData {
  symbol: string;
  priceChange: string;
  priceChangePercent: string;
  weightedAvgPrice: string;
  prevClosePrice: string;
  lastPrice: string;
  lastQty: string;
  bidPrice: string;
  bidQty: string;
  askPrice: string;
  askQty: string;
  openPrice: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
  openTime: number;
  closeTime: number;
  firstId: number;
  lastId: number;
  count: number;
}

interface BookTickerData {
  symbol: string;
  bidPrice: string;
  bidQty: string;
  askPrice: string;
  askQty: string;
}

interface TradeData {
  e: string;      // Event type
  E: number;      // Event time
  s: string;      // Symbol
  t: number;      // Trade ID
  p: string;      // Price
  q: string;      // Quantity
  b: number;      // Buyer order ID
  a: number;      // Seller order ID
  T: number;      // Trade time
  m: boolean;     // Is the buyer the market maker?
  M: boolean;     // Ignore
}

interface KlineData {
  e: string;      // Event type
  E: number;      // Event time
  s: string;      // Symbol
  k: {
    t: number;    // Kline start time
    T: number;    // Kline close time
    s: string;    // Symbol
    i: string;    // Interval
    f: number;    // First trade ID
    L: number;    // Last trade ID
    o: string;    // Open price
    c: string;    // Close price
    h: string;    // High price
    l: string;    // Low price
    v: string;    // Base asset volume
    n: number;    // Number of trades
    x: boolean;   // Is this kline closed?
    q: string;    // Quote asset volume
    V: string;    // Taker buy base asset volume
    Q: string;    // Taker buy quote asset volume
    B: string;    // Ignore
  }
}

// Helper function to fetch data from Binance REST API
async function fetchFromBinance<T>(endpoint: string): Promise<T> {
  const url = `${BINANCE_REST_API}${endpoint}`;
  const headers = {
    'User-Agent': USER_AGENT,
  };
  
  try {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json() as T;
  } catch (error) {
    // console.error('Error fetching from Binance:', error);
    throw error;
  }
}

// Helper function to format trade data
function formatTrades(trades: TradeData[], symbol: string) {
  if (trades.length === 0) {
    return { 
      symbol: symbol.toUpperCase(),
      message: "No trades received during the specified period",
      timestamp: new Date().toISOString()
    };
  }
  
  // Calculate some basic statistics
  const prices = trades.map(t => parseFloat(t.p));
  const volumes = trades.map(t => parseFloat(t.q));
  const totalVolume = volumes.reduce((sum, vol) => sum + vol, 0);
  const avgPrice = prices.reduce((sum, price, i) => sum + price * volumes[i], 0) / totalVolume;
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  
  // Count buy vs sell orders (market maker = sell, taker = buy)
  const buyCount = trades.filter(t => !t.m).length;
  const sellCount = trades.filter(t => t.m).length;
  
  return {
    symbol: symbol.toUpperCase(),
    period: `${trades.length > 0 ? new Date(trades[0].E).toISOString() : ''} to ${trades.length > 0 ? new Date(trades[trades.length - 1].E).toISOString() : ''}`,
    tradesCount: trades.length,
    averagePrice: `$${avgPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
    priceRange: {
      min: `$${minPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
      max: `$${maxPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
      spread: `$${(maxPrice - minPrice).toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
    },
    volume: totalVolume.toLocaleString(undefined, { maximumFractionDigits: 8 }),
    marketActivity: {
      buyOrders: buyCount,
      sellOrders: sellCount,
      buySellRatio: (buyCount / (sellCount || 1)).toFixed(2)
    },
    recentTrades: trades.slice(-5).map(t => ({
      price: `$${parseFloat(t.p).toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
      quantity: parseFloat(t.q).toLocaleString(undefined, { maximumFractionDigits: 8 }),
      time: new Date(t.T).toISOString(),
      type: t.m ? 'SELL' : 'BUY'
    })),
    timestamp: new Date().toISOString(),
  };
}

// Read the prompt template
const promptTemplatePath = path.join(__dirname, '../src/prompt.md');
const promptTemplate = fs.existsSync(promptTemplatePath) 
  ? fs.readFileSync(promptTemplatePath, 'utf-8')
  : "# Binance Bitcoin Market Analysis Tool\n\nUse the available tools to analyze Bitcoin market data.";

// Create MCP server instance
const server = new McpServer({
  name: "binance-bitcoin-mcp",
  version: "1.0.0",
  description: "A server that provides tools for analyzing Bitcoin market data from Binance",
  promptTemplate: promptTemplate
});

// Helper function to format response for MCP
function formatMcpResponse(data: any) {
  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify(data, null, 2)
    }]
  };
}

// Register tools using the decorator-like method
// Tool to get Bitcoin ticker data
server.tool(
  "get_bitcoin_ticker", 
  "Get current Bitcoin ticker data including price, 24h change, volume, and more",
  async (args: { symbol?: string } = {}) => {
    const symbol = args.symbol || "BTCUSDT";
    try {
      const ticker = await fetchFromBinance<TickerData>(`/ticker/24hr?symbol=${symbol}`);
      
      // Format the response for better readability
      const result = {
        symbol: ticker.symbol,
        currentPrice: `$${parseFloat(ticker.lastPrice).toLocaleString()}`,
        priceChange24h: `$${parseFloat(ticker.priceChange).toLocaleString()} (${ticker.priceChangePercent}%)`,
        high24h: `$${parseFloat(ticker.highPrice).toLocaleString()}`,
        low24h: `$${parseFloat(ticker.lowPrice).toLocaleString()}`,
        volume24h: parseFloat(ticker.volume).toLocaleString(),
        quoteVolume24h: `$${parseFloat(ticker.quoteVolume).toLocaleString()}`,
        openPrice: `$${parseFloat(ticker.openPrice).toLocaleString()}`,
        timestamp: new Date(ticker.closeTime).toISOString(),
      };
      return formatMcpResponse(result);
    } catch (error) {
      return formatMcpResponse({ error: `Failed to fetch Bitcoin ticker: ${error}` });
    }
  }
);

// Tool to get current order book for Bitcoin
server.tool(
  "get_bitcoin_order_book",
  "Get current best bid and ask prices for Bitcoin",
  async (args: { symbol?: string } = {}) => {
    const symbol = args.symbol || "BTCUSDT";
    try {
      const bookTicker = await fetchFromBinance<BookTickerData>(`/ticker/bookTicker?symbol=${symbol}`);
      
      const result = {
        symbol: bookTicker.symbol,
        bestBid: {
          price: `$${parseFloat(bookTicker.bidPrice).toLocaleString()}`,
          quantity: parseFloat(bookTicker.bidQty).toLocaleString(),
        },
        bestAsk: {
          price: `$${parseFloat(bookTicker.askPrice).toLocaleString()}`,
          quantity: parseFloat(bookTicker.askQty).toLocaleString(),
        },
        spread: `$${(parseFloat(bookTicker.askPrice) - parseFloat(bookTicker.bidPrice)).toLocaleString()}`,
        spreadPercentage: `${((parseFloat(bookTicker.askPrice) - parseFloat(bookTicker.bidPrice)) / parseFloat(bookTicker.bidPrice) * 100).toFixed(4)}%`,
        timestamp: new Date().toISOString(),
      };
      return formatMcpResponse(result);
    } catch (error) {
      return formatMcpResponse({ error: `Failed to fetch order book: ${error}` });
    }
  }
);

// Tool to get recent trades for Bitcoin
server.tool(
  "get_bitcoin_recent_trades",
  "Get recent trades for Bitcoin",
  async (args: { symbol?: string, limit?: number } = {}) => {
    const symbol = args.symbol || "BTCUSDT";
    const limit = args.limit || 10;
    try {
      const trades = await fetchFromBinance<any[]>(`/trades?symbol=${symbol}&limit=${limit}`);
      
      const result = {
        symbol,
        trades: trades.map(trade => ({
          id: trade.id,
          price: `$${parseFloat(trade.price).toLocaleString()}`,
          quantity: parseFloat(trade.qty).toLocaleString(),
          time: new Date(trade.time).toISOString(),
          isBuyerMaker: trade.isBuyerMaker,
        })),
        timestamp: new Date().toISOString(),
      };
      return formatMcpResponse(result);
    } catch (error) {
      return formatMcpResponse({ error: `Failed to fetch recent trades: ${error}` });
    }
  }
);

// Tool to get Bitcoin price history
server.tool(
  "get_bitcoin_price_history",
  "Get historical kline/candlestick data for Bitcoin",
  async (args: { 
    symbol?: string, 
    interval?: '1m'|'3m'|'5m'|'15m'|'30m'|'1h'|'2h'|'4h'|'6h'|'8h'|'12h'|'1d'|'3d'|'1w'|'1M',
    limit?: number 
  } = {}) => {
    const symbol = args.symbol || "BTCUSDT";
    const interval = args.interval || '1h';
    const limit = args.limit || 24;
    try {
      const klines = await fetchFromBinance<any[]>(`/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
      
      const result = {
        symbol,
        interval,
        candles: klines.map(k => ({
          openTime: new Date(k[0]).toISOString(),
          open: `$${parseFloat(k[1]).toLocaleString()}`,
          high: `$${parseFloat(k[2]).toLocaleString()}`,
          low: `$${parseFloat(k[3]).toLocaleString()}`,
          close: `$${parseFloat(k[4]).toLocaleString()}`,
          volume: parseFloat(k[5]).toLocaleString(),
          closeTime: new Date(k[6]).toISOString(),
          quoteVolume: `$${parseFloat(k[7]).toLocaleString()}`,
          trades: k[8],
        })),
        timestamp: new Date().toISOString(),
      };
      return formatMcpResponse(result);
    } catch (error) {
      return formatMcpResponse({ error: `Failed to fetch price history: ${error}` });
    }
  }
);

// Tool to subscribe to real-time Bitcoin price updates
server.tool(
  "get_realtime_bitcoin_price",
  "Get real-time Bitcoin price updates for a short period (5 seconds)",
  async (args: { symbol?: string, duration?: number } = {}) => {
    const symbol = args.symbol || "btcusdt";
    const duration = args.duration || 5;
    // Cap the duration to prevent long-running connections
    const cappedDuration = Math.min(duration, 30);
    
    return new Promise((resolve) => {
      const trades: TradeData[] = [];
      const ws = new WebSocket(`${BINANCE_WS_URL}/${symbol.toLowerCase()}@trade`);
      
      ws.on('open', () => {
        // Connection opened
      });
      
      ws.on('message', (data) => {
        const trade = JSON.parse(data.toString()) as TradeData;
        trades.push(trade);
      });
      
      ws.on('error', (error) => {
        ws.close();
        resolve(formatMcpResponse({ 
          error: `WebSocket error: ${error.message}`,
          partialData: formatTrades(trades, symbol)
        }));
      });
      
      // Close the connection after specified duration
      setTimeout(() => {
        ws.close();
        resolve(formatMcpResponse(formatTrades(trades, symbol)));
      }, cappedDuration * 1000);
    });
  }
);

// Start the server with stdio transport
const transport = new StdioServerTransport();
server.connect(transport);