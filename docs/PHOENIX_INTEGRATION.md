# Phoenix Integration

Clay extension now includes integrated support for Arize Phoenix, an open-source observability tool for AI and LLM applications.

## Features

- **Bundled Phoenix**: Phoenix is bundled as a standalone .pyz file with the extension
- **Automatic Installation**: Phoenix dependencies are installed automatically on first run
- **Proxy Integration**: Phoenix UI is accessible through Clay's gateway server
- **Lifecycle Management**: Start/stop Phoenix server through VSCode commands
- **Configuration**: Configurable host, port, and data directory

## Usage

### Commands

- `Clay: Start Phoenix Server` - Start the Phoenix server
- `Clay: Stop Phoenix Server` - Stop the Phoenix server
- `Clay: Open Phoenix UI` - Open Phoenix UI (starts server if needed)

### Keybindings

- `Ctrl+Shift+P` (Windows/Linux) / `Cmd+Shift+P` (Mac) - Open Phoenix UI

### Configuration

Phoenix can be configured in the Clay configuration file (`~/.clay/config.yaml`):

```yaml
phoenix:
  port: 6006                    # PHOENIX_PORT - HTTP server port
  host: localhost               # PHOENIX_HOST - server host
  enabled: true                 # Enable/disable Phoenix integration
  autostart: false              # Auto-start Phoenix with Clay
  pythonCommand: python         # Optional: override Python command
  workingDir: ~/.phoenix        # Optional: PHOENIX_WORKING_DIR
  grpcPort: 4317               # Optional: PHOENIX_GRPC_PORT for traces
  databaseUrl: sqlite:///path   # Optional: PHOENIX_SQL_DATABASE_URL
  enablePrometheus: false       # Optional: PHOENIX_ENABLE_PROMETHEUS
```

### Access Methods

1. **Direct Access**: `http://localhost:6006` (when Phoenix is running)
2. **VSCode Command**: Use `Clay: Open Phoenix UI` command

## Technical Details

### Architecture

- Phoenix is bundled as a standalone Python zip application (.pyz)
- Uses environment variables for configuration (PHOENIX_HOST, PHOENIX_PORT, etc.)
- Uses the same Python detection logic as MCP extensions
- Runs as a subprocess managed by Clay
- Accessed directly at the configured host and port

### Files

- `phoenix.pyz` - Bundled Phoenix application
- `scripts/build-phoenix-simple.py` - Build script for creating the .pyz bundle
- `src/server/phoenix/` - Phoenix service manager
- `copy-phoenix.js` - Script to copy Phoenix bundle to extension

### Build Process

1. `npm run build-phoenix` - Creates the Phoenix .pyz bundle
2. `npm run copy-deps` - Copies Phoenix bundle to extension dist
3. `npm run compile-all` - Full build including Phoenix

## Troubleshooting

### Phoenix Won't Start

1. Check that Python is available in your PATH
2. Verify the Phoenix .pyz file exists in the extension
3. Check Clay extension logs for error messages
4. Try deleting `~/.clay/phoenix` and restarting

### Phoenix UI Not Loading

1. Ensure Phoenix server is running (`Clay: Start Phoenix Server`)
2. Check that port 6006 is not blocked by firewall
3. Try accessing directly at `http://localhost:6006`

### Performance Issues

1. Phoenix installs dependencies to `~/.clay/phoenix` on first run
2. Subsequent starts should be faster
3. Consider using a virtual environment for better isolation

## Development

### Building Phoenix Bundle

```bash
# Build the Phoenix .pyz bundle
npm run build-phoenix

# Or run the script directly
python scripts/build-phoenix-simple.py
```

### Testing

```bash
# Test the Phoenix bundle directly
python phoenix.pyz serve --help
python phoenix.pyz serve --port 6007
```

### Debugging

Enable debug logging in Clay configuration:

```yaml
gateway:
  logLevel: debug
```

Check Clay extension output panel for detailed logs.
