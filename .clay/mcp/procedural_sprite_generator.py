"""
MCP extension for generating simple procedural 2D game sprites based on natural language descriptions.
This extension doesn't require any external API keys and works offline.
"""
import base64
import io
import hashlib
import random
from typing import Dict, List, Optional, Union
from PIL import Image, ImageDraw

def _generate_color_from_text(text: str) -> tuple:
    """Generate a color based on input text"""
    # Create a hash of the text
    hash_object = hashlib.md5(text.encode())
    hex_dig = hash_object.hexdigest()

    # Use the first 6 characters of the hash for the RGB values
    r = int(hex_dig[0:2], 16)
    g = int(hex_dig[2:4], 16)
    b = int(hex_dig[4:6], 16)

    return (r, g, b)

def _generate_procedural_sprite(
    prompt: str,
    size: int = 64,
    style: str = "pixel-art",
    background: str = "transparent"
) -> Image.Image:
    """Generate a procedural sprite based on the prompt"""
    # Seed the random generator with the prompt for consistent results
    random.seed(prompt)

    # Create a new image with transparent background
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Generate colors based on the prompt
    main_color = _generate_color_from_text(prompt)
    secondary_color = _generate_color_from_text(prompt + "secondary")
    detail_color = _generate_color_from_text(prompt + "detail")

    # Set background color if not transparent
    if background == "white":
        img = Image.new("RGBA", (size, size), (255, 255, 255, 255))
        draw = ImageDraw.Draw(img)
    elif background == "black":
        img = Image.new("RGBA", (size, size), (0, 0, 0, 255))
        draw = ImageDraw.Draw(img)
    elif background == "colored":
        bg_color = _generate_color_from_text(prompt + "background")
        img = Image.new("RGBA", (size, size), bg_color + (255,))
        draw = ImageDraw.Draw(img)

    # Determine sprite type based on prompt keywords
    sprite_type = "character"  # default
    if any(word in prompt.lower() for word in ["item", "weapon", "sword", "potion", "treasure"]):
        sprite_type = "item"
    elif any(word in prompt.lower() for word in ["tree", "rock", "bush", "plant", "nature"]):
        sprite_type = "nature"
    elif any(word in prompt.lower() for word in ["house", "building", "castle", "tower"]):
        sprite_type = "building"

    # Generate different sprite patterns based on type
    pixel_size = max(1, size // 16)  # For pixel art style

    if style == "pixel-art":
        # Make a symmetrical pattern for pixel art
        grid = []
        half_width = size // (pixel_size * 2)
        for x in range(half_width):
            row = []
            for y in range(size // pixel_size):
                # Higher probability in the center
                center_x = abs(x - (half_width // 2)) / (half_width // 2)
                center_y = abs(y - (size // pixel_size // 2)) / (size // pixel_size // 2)
                center_dist = (center_x**2 + center_y**2)**0.5 / 1.414

                if random.random() > center_dist * 0.8:
                    row.append(1)
                else:
                    row.append(0)
            grid.append(row)

        # Mirror the grid horizontally
        for x in range(half_width - 1, -1, -1):
            grid.append(grid[x])

        # Draw the pixels
        for x in range(len(grid)):
            for y in range(len(grid[0])):
                if grid[x][y]:
                    # Choose color based on position
                    if x < len(grid) // 3 or x >= 2 * len(grid) // 3:
                        color = secondary_color
                    elif y < len(grid[0]) // 3 or y >= 2 * len(grid[0]) // 3:
                        color = detail_color
                    else:
                        color = main_color

                    draw.rectangle(
                        [x * pixel_size, y * pixel_size, (x + 1) * pixel_size, (y + 1) * pixel_size],
                        fill=color + (255,)
                    )
    else:
        # For other styles, create more detailed shapes
        if sprite_type == "character":
            # Draw a character-like shape
            # Body
            body_height = int(size * 0.6)
            body_width = int(size * 0.4)
            body_left = (size - body_width) // 2
            body_top = (size - body_height) // 2
            draw.ellipse(
                [body_left, body_top, body_left + body_width, body_top + body_height],
                fill=main_color + (255,)
            )

            # Head
            head_size = int(size * 0.3)
            head_left = (size - head_size) // 2
            head_top = body_top - head_size // 2
            draw.ellipse(
                [head_left, head_top, head_left + head_size, head_top + head_size],
                fill=secondary_color + (255,)
            )

            # Details
            detail_size = int(size * 0.1)
            draw.ellipse(
                [head_left + head_size // 4, head_top + head_size // 3,
                 head_left + head_size // 4 + detail_size, head_top + head_size // 3 + detail_size],
                fill=detail_color + (255,)
            )
            draw.ellipse(
                [head_left + head_size - head_size // 4 - detail_size, head_top + head_size // 3,
                 head_left + head_size - head_size // 4, head_top + head_size // 3 + detail_size],
                fill=detail_color + (255,)
            )

        elif sprite_type == "item":
            # Draw an item-like shape
            # Main shape
            item_height = int(size * 0.7)
            item_width = int(size * 0.3)
            item_left = (size - item_width) // 2
            item_top = (size - item_height) // 2

            if "sword" in prompt.lower() or "weapon" in prompt.lower():
                # Draw a sword-like shape
                draw.rectangle(
                    [item_left, item_top, item_left + item_width, item_top + item_height],
                    fill=secondary_color + (255,)
                )
                # Handle
                handle_height = int(item_height * 0.3)
                draw.rectangle(
                    [item_left - item_width//2, item_top + item_height - handle_height,
                     item_left + item_width + item_width//2, item_top + item_height],
                    fill=detail_color + (255,)
                )
            else:
                # Draw a potion or generic item
                draw.ellipse(
                    [item_left, item_top, item_left + item_width, item_top + item_height],
                    fill=main_color + (255,)
                )
                # Cap or detail
                cap_height = int(item_height * 0.2)
                draw.rectangle(
                    [item_left, item_top, item_left + item_width, item_top + cap_height],
                    fill=detail_color + (255,)
                )

        elif sprite_type == "nature":
            # Draw a nature-like shape
            if "tree" in prompt.lower():
                # Tree trunk
                trunk_width = int(size * 0.2)
                trunk_height = int(size * 0.5)
                trunk_left = (size - trunk_width) // 2
                trunk_top = size - trunk_height
                draw.rectangle(
                    [trunk_left, trunk_top, trunk_left + trunk_width, size],
                    fill=detail_color + (255,)
                )

                # Tree top
                top_size = int(size * 0.6)
                top_left = (size - top_size) // 2
                top_top = trunk_top - top_size // 2
                draw.ellipse(
                    [top_left, top_top, top_left + top_size, top_top + top_size],
                    fill=main_color + (255,)
                )
            else:
                # Rock or bush
                for _ in range(5):
                    blob_size = random.randint(int(size * 0.2), int(size * 0.4))
                    blob_left = random.randint(0, size - blob_size)
                    blob_top = random.randint(int(size * 0.3), size - blob_size)
                    draw.ellipse(
                        [blob_left, blob_top, blob_left + blob_size, blob_top + blob_size],
                        fill=main_color + (255,)
                    )

        elif sprite_type == "building":
            # Draw a building-like shape
            building_width = int(size * 0.7)
            building_height = int(size * 0.8)
            building_left = (size - building_width) // 2
            building_top = size - building_height

            # Main structure
            draw.rectangle(
                [building_left, building_top, building_left + building_width, size],
                fill=main_color + (255,)
            )

            # Roof
            roof_height = int(size * 0.3)
            draw.polygon(
                [
                    (building_left - int(size * 0.1), building_top),
                    (building_left + building_width + int(size * 0.1), building_top),
                    (building_left + building_width // 2, building_top - roof_height)
                ],
                fill=secondary_color + (255,)
            )

            # Door
            door_width = int(building_width * 0.3)
            door_height = int(building_height * 0.4)
            door_left = building_left + (building_width - door_width) // 2
            door_top = size - door_height
            draw.rectangle(
                [door_left, door_top, door_left + door_width, size],
                fill=detail_color + (255,)
            )

            # Windows
            window_size = int(building_width * 0.15)
            window_margin = int(building_width * 0.15)

            # Left window
            draw.rectangle(
                [
                    building_left + window_margin,
                    building_top + window_margin,
                    building_left + window_margin + window_size,
                    building_top + window_margin + window_size
                ],
                fill=detail_color + (255,)
            )

            # Right window
            draw.rectangle(
                [
                    building_left + building_width - window_margin - window_size,
                    building_top + window_margin,
                    building_left + building_width - window_margin,
                    building_top + window_margin + window_size
                ],
                fill=detail_color + (255,)
            )

    return img

def tool_generate_procedural_sprite(
    prompt: str,
    style: str = "pixel-art",
    size: int = 64,
    background: str = "transparent"
) -> Dict:
    """Generates a simple procedural 2D game sprite based on a text description

    Args:
        prompt: Description of the sprite to generate (e.g., "red dragon", "magic sword")
        style: Visual style of the sprite (pixel-art, cartoon, simple)
        size: Size of the sprite in pixels (32, 64, 128, 256)
        background: Background type (transparent, white, black, colored)
    """
    try:
        # Validate parameters
        valid_styles = ["pixel-art", "cartoon", "simple"]
        valid_sizes = [32, 64, 128, 256]
        valid_backgrounds = ["transparent", "white", "black", "colored"]

        if style not in valid_styles:
            return {
                "content": [
                    {
                        "type": "text",
                        "text": f"Error: Invalid style '{style}'. Valid options are: {', '.join(valid_styles)}"
                    }
                ],
                "isError": True
            }

        if size not in valid_sizes:
            return {
                "content": [
                    {
                        "type": "text",
                        "text": f"Error: Invalid size '{size}'. Valid options are: {', '.join(map(str, valid_sizes))}"
                    }
                ],
                "isError": True
            }

        if background not in valid_backgrounds:
            return {
                "content": [
                    {
                        "type": "text",
                        "text": f"Error: Invalid background '{background}'. Valid options are: {', '.join(valid_backgrounds)}"
                    }
                ],
                "isError": True
            }

        # Generate the sprite
        img = _generate_procedural_sprite(prompt, size, style, background)

        # Convert to base64
        img_byte_arr = io.BytesIO()
        img.save(img_byte_arr, format='PNG')
        img_byte_arr.seek(0)
        base64_image = base64.b64encode(img_byte_arr.getvalue()).decode('utf-8')

        # Return the result
        return {
            "content": [
                {
                    "type": "text",
                    "text": f"Generated procedural sprite for prompt: '{prompt}'"
                },
                {
                    "type": "text",
                    "text": f"data:image/png;base64,{base64_image}"
                },
                {
                    "type": "text",
                    "text": "Note: This is a procedurally generated sprite based on the prompt text. For more detailed sprites, use the sprite-generator extension with a Replicate API key."
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

def tool_generate_procedural_sprite_set(
    prompt: str,
    count: int = 4,
    style: str = "pixel-art",
    size: int = 64,
    background: str = "transparent"
) -> Dict:
    """Generates a set of simple procedural 2D game sprites based on a text description

    Args:
        prompt: Description of the sprite set to generate (e.g., "fantasy characters")
        count: Number of sprites to generate (1-4)
        style: Visual style of the sprites (pixel-art, cartoon, simple)
        size: Size of the sprites in pixels (32, 64, 128, 256)
        background: Background type (transparent, white, black, colored)
    """
    try:
        # Validate count
        if count < 1 or count > 4:
            return {
                "content": [
                    {
                        "type": "text",
                        "text": "Error: Count must be between 1 and 4."
                    }
                ],
                "isError": True
            }

        # Generate variations of the prompt
        base_result = {
            "content": [
                {
                    "type": "text",
                    "text": f"Generated {count} procedural sprites for prompt: '{prompt}'"
                }
            ]
        }

        for i in range(count):
            # Generate a sprite with a slight variation
            variation_prompt = f"{prompt}, variation {i+1}"

            # Generate the sprite
            img = _generate_procedural_sprite(variation_prompt, size, style, background)

            # Convert to base64
            img_byte_arr = io.BytesIO()
            img.save(img_byte_arr, format='PNG')
            img_byte_arr.seek(0)
            base64_image = base64.b64encode(img_byte_arr.getvalue()).decode('utf-8')

            # Add the image to the result
            base_result["content"].append({
                "type": "text",
                "text": f"data:image/png;base64,{base64_image}"
            })

        # Add final message
        base_result["content"].append({
            "type": "text",
            "text": "Note: These are procedurally generated sprites based on the prompt text. For more detailed sprites, use the sprite-generator extension with a Replicate API key."
        })

        return base_result

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
        "id": "procedural-sprite-generator",
        "description": "Generate simple procedural 2D game sprites from text descriptions (no API key required)",
        "version": "1.0.0",
        "author": "Clay",
        "tools": [tool_generate_procedural_sprite, tool_generate_procedural_sprite_set],
        "resources": [],
        "prompts": []
    }
