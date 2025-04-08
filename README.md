# Binance Bitcoin MCP Tool

This project provides a Model Context Protocol (MCP) tool for fetching Bitcoin price data from Binance. It allows large language models to access real-time and historical Bitcoin market data through a standardized interface.

## Features

- Get current Bitcoin ticker data (price, 24h change, volume, etc.)
- Get best bid and ask prices from the order book
- Fetch recent trades
- Get historical price data with customizable intervals
- Stream real-time Bitcoin price updates for short durations

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/binance-mcp.git
cd binance-mcp

# Install dependencies
pnpm install

# Build the project
pnpm build
```

## Usage

To use this tool with an MCP-compatible LLM client:

```bash
# Start the MCP server
pnpm start
```

Then connect your MCP-compatible LLM client to interact with the Binance data.

### Available Tools

1. **get_bitcoin_ticker** - Get current Bitcoin ticker data
   - Parameters: 
     - `symbol` (optional, default: "BTCUSDT") - Trading pair symbol

2. **get_bitcoin_order_book** - Get current best bid and ask prices
   - Parameters: 
     - `symbol` (optional, default: "BTCUSDT") - Trading pair symbol

3. **get_bitcoin_recent_trades** - Get recent trades
   - Parameters: 
     - `symbol` (optional, default: "BTCUSDT") - Trading pair symbol
     - `limit` (optional, default: 10) - Number of trades to fetch

4. **get_bitcoin_price_history** - Get historical kline/candlestick data
   - Parameters: 
     - `symbol` (optional, default: "BTCUSDT") - Trading pair symbol
     - `interval` (optional, default: "1h") - Kline interval (1m, 3m, 5m, 15m, 30m, 1h, 2h, 4h, 6h, 8h, 12h, 1d, 3d, 1w, 1M)
     - `limit` (optional, default: 24) - Number of candles to fetch

5. **get_realtime_bitcoin_price** - Get real-time price updates
   - Parameters: 
     - `symbol` (optional, default: "btcusdt") - Trading pair symbol in lowercase
     - `duration` (optional, default: 5, max: 30) - Duration in seconds to collect real-time data

### Example Prompts for LLMs

Once connected to an MCP-compatible LLM, you can use prompts like:

1. "What is the current Bitcoin price and 24-hour change?"
2. "Show me the current spread between bid and ask prices for Bitcoin."
3. "Analyze the last 10 Bitcoin trades and identify any patterns."
4. "Get Bitcoin price history for the last 24 hours and explain the trend."
5. "Watch real-time Bitcoin trades for 5 seconds and tell me if there's more buying or selling pressure."

## Development

To make changes to the project:

1. Modify the source code in the `src` directory
2. Run `pnpm build` to compile the TypeScript code
3. Test your changes with `pnpm start`

## License

ISC

## Disclaimer

This tool is provided for educational and informational purposes only. It is not financial advice. 