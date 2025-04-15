# Sprite Generator MCP Extensions

This directory contains MCP extensions for generating 2D game sprites from natural language descriptions.

## Available Extensions

### 1. Sprite Generator (API-based)

The `sprite_generator.py` extension uses the Replicate API to generate high-quality sprites using Stable Diffusion.

#### Requirements

- A Replicate API key (get one at https://replicate.com/)
- Python packages: `requests`, `Pillow`

#### Setup

1. Set your Replicate API key as an environment variable:
   ```bash
   export REPLICATE_API_TOKEN=your_api_key_here
   ```
   
   Or provide it as a parameter when calling the tool.

2. Install required Python packages:
   ```bash
   pip install requests Pillow
   ```

#### Tools

- **generate_sprite**: Generates a single sprite based on a text description
  - Parameters:
    - `prompt`: Description of the sprite (e.g., "a red dragon with wings")
    - `style`: Visual style (pixel-art, cartoon, realistic, isometric)
    - `size`: Size in pixels (32, 64, 128, 256)
    - `background`: Background type (transparent, white, black, colored)
    - `api_key`: Optional Replicate API key

- **generate_sprite_set**: Generates multiple related sprites
  - Parameters:
    - `prompt`: Description of the sprite set (e.g., "fantasy RPG characters")
    - `count`: Number of sprites to generate (1-4)
    - `style`: Visual style (pixel-art, cartoon, realistic, isometric)
    - `size`: Size in pixels (32, 64, 128, 256)
    - `background`: Background type (transparent, white, black, colored)
    - `api_key`: Optional Replicate API key

### 2. Procedural Sprite Generator (No API required)

The `procedural_sprite_generator.py` extension generates simple procedural sprites without requiring any external API keys.

#### Requirements

- Python package: `Pillow`

#### Setup

1. Install required Python package:
   ```bash
   pip install Pillow
   ```

#### Tools

- **generate_procedural_sprite**: Generates a single procedural sprite
  - Parameters:
    - `prompt`: Description of the sprite (e.g., "red dragon", "magic sword")
    - `style`: Visual style (pixel-art, cartoon, simple)
    - `size`: Size in pixels (32, 64, 128, 256)
    - `background`: Background type (transparent, white, black, colored)

- **generate_procedural_sprite_set**: Generates multiple procedural sprites
  - Parameters:
    - `prompt`: Description of the sprite set (e.g., "fantasy characters")
    - `count`: Number of sprites to generate (1-4)
    - `style`: Visual style (pixel-art, cartoon, simple)
    - `size`: Size in pixels (32, 64, 128, 256)
    - `background`: Background type (transparent, white, black, colored)

## Usage Examples

### Using the API-based Sprite Generator

```
# Generate a pixel art dragon sprite
generate_sprite(prompt="red dragon with wings", style="pixel-art", size=64, background="transparent")

# Generate a set of fantasy character sprites
generate_sprite_set(prompt="fantasy RPG characters", count=4, style="cartoon", size=128, background="transparent")
```

### Using the Procedural Sprite Generator

```
# Generate a procedural sword sprite
generate_procedural_sprite(prompt="magic sword with blue glow", style="pixel-art", size=64, background="transparent")

# Generate a set of tree sprites
generate_procedural_sprite_set(prompt="forest trees", count=4, style="simple", size=64, background="transparent")
```

## Notes

- The API-based generator produces higher quality, more detailed sprites but requires an API key.
- The procedural generator works offline but produces simpler, more abstract sprites.
- Generated sprites are returned as base64-encoded PNG images.
- All sprites are generated with the specified background type.
