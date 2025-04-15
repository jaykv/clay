# Using a Virtual Environment with MCP Python Extensions

This guide explains how to set up and use a shared virtual environment for your Python MCP extensions.

## Why Use a Virtual Environment?

A virtual environment allows you to:
1. Install Python dependencies needed by your extensions
2. Keep your global Python environment clean
3. Ensure all extensions have access to the same dependencies
4. Make your extensions more portable and reproducible

## Setting Up the Shared Virtual Environment

### 1. Create the Virtual Environment

Create a `.venv` directory in the `.clay/mcp` folder:

```bash
# Navigate to the MCP extensions directory
cd .clay/mcp

# Create a virtual environment
python -m venv .venv

# On Windows, activate the virtual environment
.venv\Scripts\activate

# On macOS/Linux, activate the virtual environment
source .venv/bin/activate
```

### 2. Install Dependencies

With the virtual environment activated, install the dependencies your extensions need:

```bash
# Install dependencies
pip install pillow numpy requests

# Optionally, create a requirements.txt file
pip freeze > requirements.txt
```

### 3. Create Your Extensions

Create your Python extension files with the necessary imports:

```python
"""
Example MCP extension using dependencies from the virtual environment
"""
from typing import Dict
import numpy as np
from PIL import Image
import io
import base64

def tool_generate_image(width: int = 256, height: int = 256, color: str = "blue") -> Dict:
    """Generates a simple colored image

    Args:
        width: Width of the image in pixels
        height: Height of the image in pixels
        color: Color of the image (blue, red, green, yellow)
    """
    # Your implementation using the installed packages
    # ...

def main():
    """Define the extension"""
    return {
        "id": "image-generator",
        "description": "Generate simple images with patterns",
        "version": "1.0.0",
        "author": "Clay",
        "tools": [tool_generate_image],
        "resources": [],
        "prompts": []
    }
```

## How It Works

The MCP extension system will:

1. Check for a `.venv` directory in the `.clay/mcp` folder
2. If found, use the Python interpreter from that virtual environment
3. Load your extensions and their dependencies from the virtual environment
4. Fall back to the system Python if no virtual environment is found

## Troubleshooting

If your extensions fail to load:

1. Make sure the `.venv` directory is in the `.clay/mcp` folder
2. Check that all required dependencies are installed in the virtual environment
3. Verify that your extension's `main()` function returns the correct format
4. Look at the extension logs in VS Code for error messages
