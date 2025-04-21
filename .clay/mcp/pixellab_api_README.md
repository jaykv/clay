# PixelLab API MCP Extension

This MCP extension provides tools for generating pixel art images, animations, and more using the [PixelLab API](https://pixellab.ai/).

## Features

- Generate pixel art images from text descriptions
- Apply custom art styles using reference images
- Create animations from text descriptions or skeleton poses
- Rotate pixel art characters or objects
- Edit and modify existing pixel art through inpainting
- Check your PixelLab account balance

## Requirements

- A PixelLab API key (get one at https://pixellab.ai/account)
- Python packages: `requests`, `Pillow`

## Setup

1. Set your PixelLab API key as an environment variable:
   ```bash
   export PIXELLAB_API_KEY=your_api_key_here
   ```
   
   Or provide it as a parameter when calling the tools.

2. Install required Python packages in the virtual environment:
   ```bash
   cd .clay/mcp
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   pip install requests pillow
   ```

## Tools

### 1. Generate Image (Pixflux)

The `generate_image_pixflux` tool generates pixel art images from text descriptions using the Pixflux model.

#### Parameters:
- `description`: Text description of the image to generate
- `image_size`: Dictionary with width and height keys (e.g., {"width": 128, "height": 128})
- `negative_description`: Text description of what to avoid in the generated image
- `text_guidance_scale`: How closely to follow the text description (1.0-20.0)
- `outline`: Outline style (single color black outline, single color outline, selective outline, lineless)
- `shading`: Shading style (flat shading, basic shading, medium shading, detailed shading, highly detailed shading)
- `detail`: Detail level (low detail, medium detail, highly detailed)
- `view`: Camera view angle (side, low top-down, high top-down)
- `direction`: Subject direction (north, north-east, east, south-east, south, south-west, west, north-west)
- `isometric`: Generate in isometric view
- `no_background`: Generate with transparent background
- `init_image`: Base64-encoded initial image to start from
- `init_image_strength`: Strength of the initial image influence (1-999)
- `color_image`: Base64-encoded image containing colors for forced palette
- `seed`: Seed for reproducible results
- `api_key`: PixelLab API key
- `save_path`: Optional path to save the generated image

#### Example:
```
generate_image_pixflux(
    description="cute dragon",
    image_size={"width": 128, "height": 128},
    negative_description="blurry, low quality",
    text_guidance_scale=8.0,
    outline="single color black outline",
    shading="medium shading",
    detail="highly detailed",
    view="side",
    direction="east",
    no_background=True
)
```

### 2. Generate Image (Bitforge)

The `generate_image_bitforge` tool generates pixel art images with style control using the Bitforge model.

#### Parameters:
- `description`: Text description of the image to generate
- `image_size`: Dictionary with width and height keys (e.g., {"width": 128, "height": 128})
- `negative_description`: Text description of what to avoid in the generated image
- `text_guidance_scale`: How closely to follow the text description (1.0-20.0)
- `extra_guidance_scale`: How closely to follow the style reference (0.0-20.0)
- `style_strength`: Strength of the style transfer (0.0-100.0)
- `outline`: Outline style (single color black outline, single color outline, selective outline, lineless)
- `shading`: Shading style (flat shading, basic shading, medium shading, detailed shading, highly detailed shading)
- `detail`: Detail level (low detail, medium detail, highly detailed)
- `view`: Camera view angle (side, low top-down, high top-down)
- `direction`: Subject direction (north, north-east, east, south-east, south, south-west, west, north-west)
- `isometric`: Generate in isometric view
- `oblique_projection`: Generate in oblique projection
- `no_background`: Generate with transparent background
- `coverage_percentage`: Percentage of the canvas to cover (0.0-100.0)
- `init_image`: Base64-encoded initial image to start from
- `init_image_strength`: Strength of the initial image influence (1-999)
- `style_image`: Base64-encoded reference image for style transfer
- `inpainting_image`: Base64-encoded reference image for inpainting
- `mask_image`: Base64-encoded mask image for inpainting (white areas are inpainted)
- `color_image`: Base64-encoded image containing colors for forced palette
- `seed`: Seed for reproducible results
- `api_key`: PixelLab API key
- `save_path`: Optional path to save the generated image

#### Example:
```
generate_image_bitforge(
    description="fantasy warrior",
    image_size={"width": 64, "height": 64},
    style_image=base64_encoded_style_image,
    style_strength=50.0,
    outline="selective outline",
    shading="detailed shading"
)
```

### 3. Inpaint

The `inpaint` tool edits parts of an existing pixel art image.

#### Parameters:
- `description`: Text description of what to generate in the masked area
- `image_size`: Dictionary with width and height keys (e.g., {"width": 128, "height": 128})
- `inpainting_image`: Base64-encoded image to be inpainted
- `mask_image`: Base64-encoded mask image (white areas are inpainted)
- `negative_description`: Text description of what to avoid in the generated image
- `text_guidance_scale`: How closely to follow the text description (1.0-10.0)
- `extra_guidance_scale`: How closely to follow the style reference (0.0-20.0)
- `outline`: Outline style (single color black outline, single color outline, selective outline, lineless)
- `shading`: Shading style (flat shading, basic shading, medium shading, detailed shading, highly detailed shading)
- `detail`: Detail level (low detail, medium detail, highly detailed)
- `view`: Camera view angle (side, low top-down, high top-down)
- `direction`: Subject direction (north, north-east, east, south-east, south, south-west, west, north-west)
- `isometric`: Generate in isometric view
- `oblique_projection`: Generate in oblique projection
- `no_background`: Generate with transparent background
- `init_image`: Base64-encoded initial image to start from
- `init_image_strength`: Strength of the initial image influence (1-999)
- `color_image`: Base64-encoded image containing colors for forced palette
- `seed`: Seed for reproducible results
- `api_key`: PixelLab API key
- `save_path`: Optional path to save the generated image

#### Example:
```
inpaint(
    description="wings",
    image_size={"width": 64, "height": 64},
    inpainting_image=base64_encoded_character_image,
    mask_image=base64_encoded_mask_for_wings
)
```

### 4. Rotate

The `rotate` tool rotates a pixel art character or object to a different view or direction.

#### Parameters:
- `from_image`: Base64-encoded image to rotate
- `image_size`: Dictionary with width and height keys (e.g., {"width": 64, "height": 64})
- `from_view`: Original camera view angle (side, low top-down, high top-down)
- `to_view`: Target camera view angle (side, low top-down, high top-down)
- `from_direction`: Original subject direction (north, north-east, east, south-east, south, south-west, west, north-west)
- `to_direction`: Target subject direction (north, north-east, east, south-east, south, south-west, west, north-west)
- `image_guidance_scale`: How closely to follow the reference image (1.0-20.0)
- `isometric`: Generate in isometric view
- `oblique_projection`: Generate in oblique projection
- `init_image`: Base64-encoded initial image to start from
- `init_image_strength`: Strength of the initial image influence (1-999)
- `mask_image`: Base64-encoded mask image for inpainting (white areas are inpainted)
- `color_image`: Base64-encoded image containing colors for forced palette
- `seed`: Seed for reproducible results
- `api_key`: PixelLab API key
- `save_path`: Optional path to save the generated image

#### Example:
```
rotate(
    from_image=base64_encoded_character_image,
    image_size={"width": 64, "height": 64},
    from_view="side",
    to_view="side",
    from_direction="south",
    to_direction="east"
)
```

### 5. Animate with Skeleton

The `animate_with_skeleton` tool generates a pixel art animation based on skeleton poses.

#### Parameters:
- `reference_image`: Base64-encoded reference image
- `image_size`: Dictionary with width and height keys (e.g., {"width": 64, "height": 64})
- `skeleton_keypoints`: List of skeleton keypoints for each frame
- `view`: Camera view angle (side, low top-down, high top-down)
- `direction`: Subject direction (north, north-east, east, south-east, south, south-west, west, north-west)
- `guidance_scale`: How closely to follow the reference image and skeleton keypoints (1.0-20.0)
- `isometric`: Generate in isometric view
- `oblique_projection`: Generate in oblique projection
- `init_images`: List of base64-encoded initial images to start from
- `init_image_strength`: Strength of the initial image influence (1-999)
- `inpainting_images`: List of base64-encoded images used for showing the model with connected skeleton
- `mask_images`: List of base64-encoded mask images (white areas are inpainted)
- `color_image`: Base64-encoded image containing colors for forced palette
- `seed`: Seed for reproducible results
- `api_key`: PixelLab API key
- `save_path`: Optional base path to save the generated images

#### Example:
```
animate_with_skeleton(
    reference_image=base64_encoded_character_image,
    image_size={"width": 64, "height": 64},
    skeleton_keypoints=skeleton_keypoints_list,
    view="side",
    direction="east"
)
```

### 6. Animate with Text

The `animate_with_text` tool generates a pixel art animation based on text description.

#### Parameters:
- `description`: Character description
- `action`: Action description
- `reference_image`: Base64-encoded reference image
- `image_size`: Dictionary with width and height keys (must be {"width": 64, "height": 64})
- `negative_description`: Negative prompt to guide what not to generate
- `text_guidance_scale`: How closely to follow the text prompts (1.0-20.0)
- `image_guidance_scale`: How closely to follow the reference image (1.0-20.0)
- `n_frames`: Length of full animation (2-20)
- `start_frame_index`: Starting frame index of the full animation (0-19)
- `view`: Camera view angle (side, low top-down, high top-down)
- `direction`: Subject direction (north, north-east, east, south-east, south, south-west, west, north-west)
- `init_images`: List of base64-encoded initial images to start from
- `init_image_strength`: Strength of the initial image influence (1-999)
- `inpainting_images`: List of base64-encoded existing animation frames to guide the generation
- `mask_images`: List of base64-encoded mask images (white areas are inpainted)
- `color_image`: Base64-encoded image containing colors for forced palette
- `seed`: Seed for reproducible results (0 for random)
- `api_key`: PixelLab API key
- `save_path`: Optional base path to save the generated images

#### Example:
```
animate_with_text(
    description="human mage",
    action="walk",
    reference_image=base64_encoded_character_image,
    image_size={"width": 64, "height": 64},
    view="side",
    direction="east",
    n_frames=4
)
```

### 7. Get Balance

The `get_balance` tool retrieves the current balance for your PixelLab account.

#### Parameters:
- `api_key`: PixelLab API key (if not provided, will use PIXELLAB_API_KEY env var)

#### Example:
```
get_balance()
```

## Notes

- All image inputs and outputs are in base64 format
- The API requires authentication with a valid API key
- Some operations consume credits from your PixelLab account
- For best results, provide detailed descriptions and appropriate parameters
- The maximum image size varies by endpoint (see API documentation for details)
- For more information, visit the [PixelLab website](https://pixellab.ai/)

## Troubleshooting

If you encounter errors:

1. Verify your API key is correct and has sufficient credits
2. Check that all required dependencies are installed
3. Ensure your image sizes are within the supported ranges
4. Try simplifying your prompts or using different parameters
5. Check the API response for specific error messages
