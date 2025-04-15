"""
Example MCP extension with virtual environment dependencies

This extension requires the following packages:
- Pillow
- numpy

To set up the virtual environment:
1. cd .clay/mcp
2. python -m venv .venv
3. source .venv/bin/activate  # On Windows: .venv\Scripts\activate
4. pip install pillow numpy
"""
from typing import Dict, List, Optional
import sys

# Try to import dependencies
try:
    import numpy as np
    from PIL import Image
    import io
    import base64
    DEPS_LOADED = True
except ImportError:
    DEPS_LOADED = False

def tool_generate_image(width: int = 256, height: int = 256, color: str = "blue") -> Dict:
    """Generates a simple colored image

    Args:
        width: Width of the image in pixels
        height: Height of the image in pixels
        color: Color of the image (blue, red, green, yellow)
    """
    if not DEPS_LOADED:
        return {
            "content": [
                {
                    "type": "text",
                    "text": "Error: Required dependencies (Pillow, NumPy) are not installed. Please set up a virtual environment with these packages."
                }
            ],
            "isError": True
        }
        
    try:
        # Create a new image with the specified color
        color_map = {
            "blue": (0, 0, 255),
            "red": (255, 0, 0),
            "green": (0, 255, 0),
            "yellow": (255, 255, 0)
        }
        
        rgb_color = color_map.get(color.lower(), (0, 0, 255))
        
        # Create image using PIL
        img = Image.new('RGB', (width, height), rgb_color)
        
        # Add some numpy-generated pattern
        arr = np.zeros((height, width, 3), dtype=np.uint8)
        for i in range(height):
            for j in range(width):
                if (i + j) % 20 < 10:
                    arr[i, j] = [min(c + 50, 255) for c in rgb_color]
                else:
                    arr[i, j] = rgb_color
        
        # Convert numpy array to image
        pattern_img = Image.fromarray(arr)
        
        # Save to bytes
        buffer = io.BytesIO()
        pattern_img.save(buffer, format="PNG")
        img_str = base64.b64encode(buffer.getvalue()).decode('utf-8')
        
        return {
            "content": [
                {
                    "type": "text",
                    "text": f"Generated a {width}x{height} {color} image with pattern"
                },
                {
                    "type": "image",
                    "image": {
                        "data": f"data:image/png;base64,{img_str}"
                    }
                }
            ]
        }
    except Exception as e:
        return {
            "content": [
                {
                    "type": "text",
                    "text": f"Error: {str(e)}"
                }
            ],
            "isError": True
        }

def tool_analyze_dimensions(width: int, height: int) -> Dict:
    """Analyzes the dimensions of an image

    Args:
        width: Width of the image in pixels
        height: Height of the image in pixels
    """
    try:
        aspect_ratio = width / height
        area = width * height
        perimeter = 2 * (width + height)
        
        return {
            "content": [
                {
                    "type": "text",
                    "text": f"Dimension Analysis:\n- Aspect Ratio: {aspect_ratio:.2f}\n- Area: {area} pixels\n- Perimeter: {perimeter} pixels"
                }
            ]
        }
    except Exception as e:
        return {
            "content": [
                {
                    "type": "text",
                    "text": f"Error: {str(e)}"
                }
            ],
            "isError": True
        }

def main():
    """Define the extension"""
    return {
        "id": "image-generator",
        "description": "Generate simple images with patterns using virtual environment dependencies",
        "version": "1.0.0",
        "author": "Clay",
        "tools": [tool_generate_image, tool_analyze_dimensions],
        "resources": [],
        "prompts": []
    }
