"""
PixelLab API MCP Extension

This extension provides tools for generating pixel art images, animations, and more
using the PixelLab API (https://pixellab.ai/).

The API allows you to:
- Generate pixel art images from text descriptions
- Apply custom art styles using reference images
- Create animations from text descriptions or skeleton poses
- Rotate pixel art characters or objects
- Edit and modify existing pixel art through inpainting
"""

import os
import json
import base64
import requests
from typing import Dict, List, Optional, Union, Literal
from io import BytesIO
from PIL import Image

# Check if required dependencies are installed
DEPS_LOADED = True
try:
    import requests
    from PIL import Image
except ImportError:
    DEPS_LOADED = False

# Base URL for the PixelLab API
API_BASE_URL = "https://api.pixellab.ai/v1"

# Helper function to handle API requests
def _make_api_request(endpoint: str, data: Dict, api_key: Optional[str] = None) -> Dict:
    """Makes a request to the PixelLab API

    Args:
        endpoint: API endpoint path
        data: Request data
        api_key: PixelLab API key (if not provided, will use PIXELLAB_API_KEY env var)
    """
    # Get API key from parameter or environment variable
    pixellab_api_key = api_key or os.environ.get("PIXELLAB_API_KEY")

    if not pixellab_api_key:
        return {
            "content": [
                {
                    "type": "text",
                    "text": "Error: No PixelLab API key provided. Please provide an API key or set the PIXELLAB_API_KEY environment variable."
                }
            ],
            "isError": True
        }

    # Set up headers with authentication
    headers = {
        "Authorization": f"Bearer {pixellab_api_key}",
        "Content-Type": "application/json"
    }

    try:
        # Make the API request
        response = requests.post(
            f"{API_BASE_URL}/{endpoint}",
            headers=headers,
            json=data
        )

        # Check for errors
        response.raise_for_status()

        # Return the response data
        return response.json()
    except requests.exceptions.RequestException as e:
        error_message = str(e)

        # Try to extract more detailed error information if available
        if hasattr(e, 'response') and e.response is not None:
            try:
                error_data = e.response.json()
                if 'detail' in error_data:
                    error_message = error_data['detail']
            except:
                pass

        return {
            "content": [
                {
                    "type": "text",
                    "text": f"API Error: {error_message}"
                }
            ],
            "isError": True
        }

# Helper function to process and save images
def _process_image(image_data: Dict, save_path: Optional[str] = None) -> Dict:
    """Processes image data from the API response

    Args:
        image_data: Image data from API response
        save_path: Optional path to save the image
    """
    if not DEPS_LOADED:
        return {
            "content": [
                {
                    "type": "text",
                    "text": "Warning: PIL not installed, cannot process image."
                }
            ]
        }

    try:
        # Extract base64 data
        if image_data.get("type") == "base64" and "base64" in image_data:
            base64_data = image_data["base64"]

            # Remove data URL prefix if present
            if base64_data.startswith("data:"):
                base64_data = base64_data.split(",", 1)[1]

            # Decode base64 data
            image_bytes = base64.b64decode(base64_data)

            # Create PIL image
            image = Image.open(BytesIO(image_bytes))

            # Save image if path provided
            if save_path:
                os.makedirs(os.path.dirname(os.path.abspath(save_path)), exist_ok=True)
                image.save(save_path)
                return {
                    "type": "text",
                    "text": f"Image saved to {save_path}"
                }

            # Return base64 data
            return {
                "type": "text",
                "text": image_data["base64"]
            }
    except Exception as e:
        return {
            "type": "text",
            "text": f"Error processing image: {str(e)}"
        }

    return {
        "type": "text",
        "text": "No valid image data found"
    }

# Helper function to process multiple images
def _process_images(images_data: List[Dict], save_path: Optional[str] = None) -> List[Dict]:
    """Processes multiple images from the API response

    Args:
        images_data: List of image data from API response
        save_path: Optional base path to save the images
    """
    results = []

    for i, image_data in enumerate(images_data):
        # Generate unique filename if saving multiple images
        current_save_path = None
        if save_path:
            path_parts = os.path.splitext(save_path)
            current_save_path = f"{path_parts[0]}_{i}{path_parts[1]}"

        # Process each image
        result = _process_image(image_data, current_save_path)
        results.append(result)

    return results

# Generate Image (Pixflux) Tool
def tool_generate_image_pixflux(
    description: str,
    image_size: Dict[str, int],
    negative_description: str = "",
    text_guidance_scale: float = 8.0,
    outline: Optional[str] = None,
    shading: Optional[str] = None,
    detail: Optional[str] = None,
    view: Optional[str] = None,
    direction: Optional[str] = None,
    isometric: bool = False,
    no_background: bool = False,
    init_image: Optional[str] = None,
    init_image_strength: int = 300,
    color_image: Optional[str] = None,
    seed: Optional[int] = None,
    api_key: Optional[str] = None,
    save_path: Optional[str] = None
) -> Dict:
    """Generates a pixel art image based on text description using the Pixflux model

    Args:
        description: Text description of the image to generate
        image_size: Dictionary with width and height keys (e.g., {"width": 128, "height": 128})
        negative_description: Text description of what to avoid in the generated image
        text_guidance_scale: How closely to follow the text description (1.0-20.0)
        outline: Outline style (single color black outline, single color outline, selective outline, lineless)
        shading: Shading style (flat shading, basic shading, medium shading, detailed shading, highly detailed shading)
        detail: Detail level (low detail, medium detail, highly detailed)
        view: Camera view angle (side, low top-down, high top-down)
        direction: Subject direction (north, north-east, east, south-east, south, south-west, west, north-west)
        isometric: Generate in isometric view
        no_background: Generate with transparent background
        init_image: Base64-encoded initial image to start from
        init_image_strength: Strength of the initial image influence (1-999)
        color_image: Base64-encoded image containing colors for forced palette
        seed: Seed for reproducible results
        api_key: PixelLab API key
        save_path: Optional path to save the generated image
    """
    if not DEPS_LOADED:
        return {
            "content": [
                {
                    "type": "text",
                    "text": "Error: Required dependencies (requests, Pillow) are not installed. Please set up a virtual environment with these packages."
                }
            ],
            "isError": True
        }

    # Prepare request data
    data = {
        "description": description,
        "image_size": image_size,
        "negative_description": negative_description,
        "text_guidance_scale": text_guidance_scale,
        "isometric": isometric,
        "no_background": no_background,
        "init_image_strength": init_image_strength
    }

    # Add optional parameters if provided
    if outline:
        data["outline"] = outline
    if shading:
        data["shading"] = shading
    if detail:
        data["detail"] = detail
    if view:
        data["view"] = view
    if direction:
        data["direction"] = direction
    if seed is not None:
        data["seed"] = seed

    # Add base64 images if provided
    if init_image:
        data["init_image"] = {"type": "base64", "base64": init_image}
    if color_image:
        data["color_image"] = {"type": "base64", "base64": color_image}

    # Make API request
    response = _make_api_request("generate-image-pixflux", data, api_key)

    # Check for API error
    if "isError" in response and response["isError"]:
        return response

    # Process the image
    image_result = _process_image(response.get("image", {}), save_path)

    # Prepare the result
    result = {
        "content": [
            {
                "type": "text",
                "text": f"Generated pixel art image using Pixflux model for prompt: '{description}'"
            },
            image_result
        ]
    }

    # Add usage information if available
    if "usage" in response:
        result["content"].append({
            "type": "text",
            "text": f"Usage: {response['usage'].get('usd', 'N/A')} USD"
        })

    return result

# Generate Image (Bitforge) Tool
def tool_generate_image_bitforge(
    description: str,
    image_size: Dict[str, int],
    negative_description: str = "",
    text_guidance_scale: float = 3.0,
    extra_guidance_scale: float = 3.0,
    style_strength: float = 0.0,
    outline: Optional[str] = None,
    shading: Optional[str] = None,
    detail: Optional[str] = None,
    view: Optional[str] = None,
    direction: Optional[str] = None,
    isometric: bool = False,
    oblique_projection: bool = False,
    no_background: bool = False,
    coverage_percentage: Optional[float] = None,
    init_image: Optional[str] = None,
    init_image_strength: int = 300,
    style_image: Optional[str] = None,
    inpainting_image: Optional[str] = None,
    mask_image: Optional[str] = None,
    color_image: Optional[str] = None,
    seed: Optional[int] = None,
    api_key: Optional[str] = None,
    save_path: Optional[str] = None
) -> Dict:
    """Generates a pixel art image with style control using the Bitforge model

    Args:
        description: Text description of the image to generate
        image_size: Dictionary with width and height keys (e.g., {"width": 128, "height": 128})
        negative_description: Text description of what to avoid in the generated image
        text_guidance_scale: How closely to follow the text description (1.0-20.0)
        extra_guidance_scale: How closely to follow the style reference (0.0-20.0)
        style_strength: Strength of the style transfer (0.0-100.0)
        outline: Outline style (single color black outline, single color outline, selective outline, lineless)
        shading: Shading style (flat shading, basic shading, medium shading, detailed shading, highly detailed shading)
        detail: Detail level (low detail, medium detail, highly detailed)
        view: Camera view angle (side, low top-down, high top-down)
        direction: Subject direction (north, north-east, east, south-east, south, south-west, west, north-west)
        isometric: Generate in isometric view
        oblique_projection: Generate in oblique projection
        no_background: Generate with transparent background
        coverage_percentage: Percentage of the canvas to cover (0.0-100.0)
        init_image: Base64-encoded initial image to start from
        init_image_strength: Strength of the initial image influence (1-999)
        style_image: Base64-encoded reference image for style transfer
        inpainting_image: Base64-encoded reference image for inpainting
        mask_image: Base64-encoded mask image for inpainting (white areas are inpainted)
        color_image: Base64-encoded image containing colors for forced palette
        seed: Seed for reproducible results
        api_key: PixelLab API key
        save_path: Optional path to save the generated image
    """
    if not DEPS_LOADED:
        return {
            "content": [
                {
                    "type": "text",
                    "text": "Error: Required dependencies (requests, Pillow) are not installed. Please set up a virtual environment with these packages."
                }
            ],
            "isError": True
        }

    # Prepare request data
    data = {
        "description": description,
        "image_size": image_size,
        "negative_description": negative_description,
        "text_guidance_scale": text_guidance_scale,
        "extra_guidance_scale": extra_guidance_scale,
        "style_strength": style_strength,
        "isometric": isometric,
        "oblique_projection": oblique_projection,
        "no_background": no_background,
        "init_image_strength": init_image_strength
    }

    # Add optional parameters if provided
    if outline:
        data["outline"] = outline
    if shading:
        data["shading"] = shading
    if detail:
        data["detail"] = detail
    if view:
        data["view"] = view
    if direction:
        data["direction"] = direction
    if coverage_percentage is not None:
        data["coverage_percentage"] = coverage_percentage
    if seed is not None:
        data["seed"] = seed

    # Add base64 images if provided
    if init_image:
        data["init_image"] = {"type": "base64", "base64": init_image}
    if style_image:
        data["style_image"] = {"type": "base64", "base64": style_image}
    if inpainting_image:
        data["inpainting_image"] = {"type": "base64", "base64": inpainting_image}
    if mask_image:
        data["mask_image"] = {"type": "base64", "base64": mask_image}
    if color_image:
        data["color_image"] = {"type": "base64", "base64": color_image}

    # Make API request
    response = _make_api_request("generate-image-bitforge", data, api_key)

    # Check for API error
    if "isError" in response and response["isError"]:
        return response

    # Process the image
    image_result = _process_image(response.get("image", {}), save_path)

    # Prepare the result
    result = {
        "content": [
            {
                "type": "text",
                "text": f"Generated pixel art image using Bitforge model for prompt: '{description}'"
            },
            image_result
        ]
    }

    # Add usage information if available
    if "usage" in response:
        result["content"].append({
            "type": "text",
            "text": f"Usage: {response['usage'].get('usd', 'N/A')} USD"
        })

    return result

# Inpaint Tool
def tool_inpaint(
    description: str,
    image_size: Dict[str, int],
    inpainting_image: str,
    mask_image: str,
    negative_description: str = "",
    text_guidance_scale: float = 3.0,
    extra_guidance_scale: float = 3.0,
    outline: Optional[str] = None,
    shading: Optional[str] = None,
    detail: Optional[str] = None,
    view: Optional[str] = None,
    direction: Optional[str] = None,
    isometric: bool = False,
    oblique_projection: bool = False,
    no_background: bool = False,
    init_image: Optional[str] = None,
    init_image_strength: int = 300,
    color_image: Optional[str] = None,
    seed: Optional[int] = None,
    api_key: Optional[str] = None,
    save_path: Optional[str] = None
) -> Dict:
    """Inpaints (edits) parts of an existing pixel art image

    Args:
        description: Text description of what to generate in the masked area
        image_size: Dictionary with width and height keys (e.g., {"width": 128, "height": 128})
        inpainting_image: Base64-encoded image to be inpainted
        mask_image: Base64-encoded mask image (white areas are inpainted)
        negative_description: Text description of what to avoid in the generated image
        text_guidance_scale: How closely to follow the text description (1.0-10.0)
        extra_guidance_scale: How closely to follow the style reference (0.0-20.0)
        outline: Outline style (single color black outline, single color outline, selective outline, lineless)
        shading: Shading style (flat shading, basic shading, medium shading, detailed shading, highly detailed shading)
        detail: Detail level (low detail, medium detail, highly detailed)
        view: Camera view angle (side, low top-down, high top-down)
        direction: Subject direction (north, north-east, east, south-east, south, south-west, west, north-west)
        isometric: Generate in isometric view
        oblique_projection: Generate in oblique projection
        no_background: Generate with transparent background
        init_image: Base64-encoded initial image to start from
        init_image_strength: Strength of the initial image influence (1-999)
        color_image: Base64-encoded image containing colors for forced palette
        seed: Seed for reproducible results
        api_key: PixelLab API key
        save_path: Optional path to save the generated image
    """
    if not DEPS_LOADED:
        return {
            "content": [
                {
                    "type": "text",
                    "text": "Error: Required dependencies (requests, Pillow) are not installed. Please set up a virtual environment with these packages."
                }
            ],
            "isError": True
        }

    # Prepare request data
    data = {
        "description": description,
        "image_size": image_size,
        "inpainting_image": {"type": "base64", "base64": inpainting_image},
        "mask_image": {"type": "base64", "base64": mask_image},
        "negative_description": negative_description,
        "text_guidance_scale": text_guidance_scale,
        "extra_guidance_scale": extra_guidance_scale,
        "isometric": isometric,
        "oblique_projection": oblique_projection,
        "no_background": no_background,
        "init_image_strength": init_image_strength
    }

    # Add optional parameters if provided
    if outline:
        data["outline"] = outline
    if shading:
        data["shading"] = shading
    if detail:
        data["detail"] = detail
    if view:
        data["view"] = view
    if direction:
        data["direction"] = direction
    if seed is not None:
        data["seed"] = seed

    # Add base64 images if provided
    if init_image:
        data["init_image"] = {"type": "base64", "base64": init_image}
    if color_image:
        data["color_image"] = {"type": "base64", "base64": color_image}

    # Make API request
    response = _make_api_request("inpaint", data, api_key)

    # Check for API error
    if "isError" in response and response["isError"]:
        return response

    # Process the image
    image_result = _process_image(response.get("image", {}), save_path)

    # Prepare the result
    result = {
        "content": [
            {
                "type": "text",
                "text": f"Inpainted pixel art image for prompt: '{description}'"
            },
            image_result
        ]
    }

    # Add usage information if available
    if "usage" in response:
        result["content"].append({
            "type": "text",
            "text": f"Usage: {response['usage'].get('usd', 'N/A')} USD"
        })

    return result

# Rotate Tool
def tool_rotate(
    from_image: str,
    image_size: Dict[str, int],
    from_view: str = "side",
    to_view: str = "side",
    from_direction: str = "south",
    to_direction: str = "east",
    image_guidance_scale: float = 3.0,
    isometric: bool = False,
    oblique_projection: bool = False,
    init_image: Optional[str] = None,
    init_image_strength: int = 300,
    mask_image: Optional[str] = None,
    color_image: Optional[str] = None,
    seed: Optional[int] = None,
    api_key: Optional[str] = None,
    save_path: Optional[str] = None
) -> Dict:
    """Rotates a pixel art character or object to a different view or direction

    Args:
        from_image: Base64-encoded image to rotate
        image_size: Dictionary with width and height keys (e.g., {"width": 64, "height": 64})
        from_view: Original camera view angle (side, low top-down, high top-down)
        to_view: Target camera view angle (side, low top-down, high top-down)
        from_direction: Original subject direction (north, north-east, east, south-east, south, south-west, west, north-west)
        to_direction: Target subject direction (north, north-east, east, south-east, south, south-west, west, north-west)
        image_guidance_scale: How closely to follow the reference image (1.0-20.0)
        isometric: Generate in isometric view
        oblique_projection: Generate in oblique projection
        init_image: Base64-encoded initial image to start from
        init_image_strength: Strength of the initial image influence (1-999)
        mask_image: Base64-encoded mask image for inpainting (white areas are inpainted)
        color_image: Base64-encoded image containing colors for forced palette
        seed: Seed for reproducible results
        api_key: PixelLab API key
        save_path: Optional path to save the generated image
    """
    if not DEPS_LOADED:
        return {
            "content": [
                {
                    "type": "text",
                    "text": "Error: Required dependencies (requests, Pillow) are not installed. Please set up a virtual environment with these packages."
                }
            ],
            "isError": True
        }

    # Prepare request data
    data = {
        "from_image": {"type": "base64", "base64": from_image},
        "image_size": image_size,
        "from_view": from_view,
        "to_view": to_view,
        "from_direction": from_direction,
        "to_direction": to_direction,
        "image_guidance_scale": image_guidance_scale,
        "isometric": isometric,
        "oblique_projection": oblique_projection,
        "init_image_strength": init_image_strength
    }

    # Add optional parameters if provided
    if seed is not None:
        data["seed"] = seed

    # Add base64 images if provided
    if init_image:
        data["init_image"] = {"type": "base64", "base64": init_image}
    if mask_image:
        data["mask_image"] = {"type": "base64", "base64": mask_image}
    if color_image:
        data["color_image"] = {"type": "base64", "base64": color_image}

    # Make API request
    response = _make_api_request("rotate", data, api_key)

    # Check for API error
    if "isError" in response and response["isError"]:
        return response

    # Process the image
    image_result = _process_image(response.get("image", {}), save_path)

    # Prepare the result
    result = {
        "content": [
            {
                "type": "text",
                "text": f"Rotated pixel art from {from_direction} facing {from_view} to {to_direction} facing {to_view}"
            },
            image_result
        ]
    }

    # Add usage information if available
    if "usage" in response:
        result["content"].append({
            "type": "text",
            "text": f"Usage: {response['usage'].get('usd', 'N/A')} USD"
        })

    return result

# Animate with Skeleton Tool
def tool_animate_with_skeleton(
    reference_image: str,
    image_size: Dict[str, int],
    skeleton_keypoints: List[List[Dict]],
    view: str = "side",
    direction: str = "east",
    guidance_scale: float = 4.0,
    isometric: bool = False,
    oblique_projection: bool = False,
    init_images: Optional[List[str]] = None,
    init_image_strength: int = 300,
    inpainting_images: Optional[List[str]] = None,
    mask_images: Optional[List[str]] = None,
    color_image: Optional[str] = None,
    seed: Optional[int] = None,
    api_key: Optional[str] = None,
    save_path: Optional[str] = None
) -> Dict:
    """Generates a pixel art animation based on skeleton poses

    Args:
        reference_image: Base64-encoded reference image
        image_size: Dictionary with width and height keys (e.g., {"width": 64, "height": 64})
        skeleton_keypoints: List of skeleton keypoints for each frame
        view: Camera view angle (side, low top-down, high top-down)
        direction: Subject direction (north, north-east, east, south-east, south, south-west, west, north-west)
        guidance_scale: How closely to follow the reference image and skeleton keypoints (1.0-20.0)
        isometric: Generate in isometric view
        oblique_projection: Generate in oblique projection
        init_images: List of base64-encoded initial images to start from
        init_image_strength: Strength of the initial image influence (1-999)
        inpainting_images: List of base64-encoded images used for showing the model with connected skeleton
        mask_images: List of base64-encoded mask images (white areas are inpainted)
        color_image: Base64-encoded image containing colors for forced palette
        seed: Seed for reproducible results
        api_key: PixelLab API key
        save_path: Optional base path to save the generated images
    """
    if not DEPS_LOADED:
        return {
            "content": [
                {
                    "type": "text",
                    "text": "Error: Required dependencies (requests, Pillow) are not installed. Please set up a virtual environment with these packages."
                }
            ],
            "isError": True
        }

    # Prepare request data
    data = {
        "reference_image": {"type": "base64", "base64": reference_image},
        "image_size": image_size,
        "skeleton_keypoints": skeleton_keypoints,
        "view": view,
        "direction": direction,
        "guidance_scale": guidance_scale,
        "isometric": isometric,
        "oblique_projection": oblique_projection,
        "init_image_strength": init_image_strength
    }

    # Add optional parameters if provided
    if seed is not None:
        data["seed"] = seed

    # Add base64 images if provided
    if init_images:
        data["init_images"] = [{"type": "base64", "base64": img} for img in init_images]
    if inpainting_images:
        data["inpainting_images"] = [{"type": "base64", "base64": img} for img in inpainting_images]
    if mask_images:
        data["mask_images"] = [{"type": "base64", "base64": img} for img in mask_images]
    if color_image:
        data["color_image"] = {"type": "base64", "base64": color_image}

    # Make API request
    response = _make_api_request("animate-with-skeleton", data, api_key)

    # Check for API error
    if "isError" in response and response["isError"]:
        return response

    # Process the images
    image_results = _process_images(response.get("images", []), save_path)

    # Prepare the result
    result = {
        "content": [
            {
                "type": "text",
                "text": f"Generated pixel art animation with {len(response.get('images', []))} frames using skeleton poses"
            }
        ]
    }

    # Add each image result
    for img_result in image_results:
        result["content"].append(img_result)

    # Add usage information if available
    if "usage" in response:
        result["content"].append({
            "type": "text",
            "text": f"Usage: {response['usage'].get('usd', 'N/A')} USD"
        })

    return result

# Animate with Text Tool
def tool_animate_with_text(
    description: str,
    action: str,
    reference_image: str,
    image_size: Dict[str, int],
    negative_description: str = "",
    text_guidance_scale: float = 8.0,
    image_guidance_scale: float = 1.4,
    n_frames: int = 4,
    start_frame_index: int = 0,
    view: str = "side",
    direction: str = "east",
    init_images: Optional[List[str]] = None,
    init_image_strength: int = 300,
    inpainting_images: Optional[List[str]] = None,
    mask_images: Optional[List[str]] = None,
    color_image: Optional[str] = None,
    seed: int = 0,
    api_key: Optional[str] = None,
    save_path: Optional[str] = None
) -> Dict:
    """Generates a pixel art animation based on text description

    Args:
        description: Character description
        action: Action description
        reference_image: Base64-encoded reference image
        image_size: Dictionary with width and height keys (must be {"width": 64, "height": 64})
        negative_description: Negative prompt to guide what not to generate
        text_guidance_scale: How closely to follow the text prompts (1.0-20.0)
        image_guidance_scale: How closely to follow the reference image (1.0-20.0)
        n_frames: Length of full animation (2-20)
        start_frame_index: Starting frame index of the full animation (0-19)
        view: Camera view angle (side, low top-down, high top-down)
        direction: Subject direction (north, north-east, east, south-east, south, south-west, west, north-west)
        init_images: List of base64-encoded initial images to start from
        init_image_strength: Strength of the initial image influence (1-999)
        inpainting_images: List of base64-encoded existing animation frames to guide the generation
        mask_images: List of base64-encoded mask images (white areas are inpainted)
        color_image: Base64-encoded image containing colors for forced palette
        seed: Seed for reproducible results (0 for random)
        api_key: PixelLab API key
        save_path: Optional base path to save the generated images
    """
    if not DEPS_LOADED:
        return {
            "content": [
                {
                    "type": "text",
                    "text": "Error: Required dependencies (requests, Pillow) are not installed. Please set up a virtual environment with these packages."
                }
            ],
            "isError": True
        }

    # Prepare request data
    data = {
        "description": description,
        "action": action,
        "reference_image": {"type": "base64", "base64": reference_image},
        "image_size": image_size,
        "negative_description": negative_description,
        "text_guidance_scale": text_guidance_scale,
        "image_guidance_scale": image_guidance_scale,
        "n_frames": n_frames,
        "start_frame_index": start_frame_index,
        "view": view,
        "direction": direction,
        "init_image_strength": init_image_strength,
        "seed": seed
    }

    # Add base64 images if provided
    if init_images:
        data["init_images"] = [{"type": "base64", "base64": img} for img in init_images]
    if inpainting_images:
        data["inpainting_images"] = [{"type": "base64", "base64": img} for img in inpainting_images]
    if mask_images:
        data["mask_images"] = [{"type": "base64", "base64": img} for img in mask_images]
    if color_image:
        data["color_image"] = {"type": "base64", "base64": color_image}

    # Make API request
    response = _make_api_request("animate-with-text", data, api_key)

    # Check for API error
    if "isError" in response and response["isError"]:
        return response

    # Process the images
    image_results = _process_images(response.get("images", []), save_path)

    # Prepare the result
    result = {
        "content": [
            {
                "type": "text",
                "text": f"Generated pixel art animation with {len(response.get('images', []))} frames for '{description}' performing '{action}'"
            }
        ]
    }

    # Add each image result
    for img_result in image_results:
        result["content"].append(img_result)

    # Add usage information if available
    if "usage" in response:
        result["content"].append({
            "type": "text",
            "text": f"Usage: {response['usage'].get('usd', 'N/A')} USD"
        })

    return result

# Get Balance Tool
def tool_get_balance(api_key: Optional[str] = None) -> Dict:
    """Gets the current balance for your PixelLab account

    Args:
        api_key: PixelLab API key (if not provided, will use PIXELLAB_API_KEY env var)
    """
    # Get API key from parameter or environment variable
    pixellab_api_key = api_key or os.environ.get("PIXELLAB_API_KEY")

    if not pixellab_api_key:
        return {
            "content": [
                {
                    "type": "text",
                    "text": "Error: No PixelLab API key provided. Please provide an API key or set the PIXELLAB_API_KEY environment variable."
                }
            ],
            "isError": True
        }

    # Set up headers with authentication
    headers = {
        "Authorization": f"Bearer {pixellab_api_key}"
    }

    try:
        # Make the API request
        response = requests.get(
            f"{API_BASE_URL}/balance",
            headers=headers
        )

        # Check for errors
        response.raise_for_status()

        # Get the response data
        data = response.json()

        return {
            "content": [
                {
                    "type": "text",
                    "text": f"Current balance: {data.get('usd', 'N/A')} USD"
                }
            ]
        }
    except requests.exceptions.RequestException as e:
        error_message = str(e)

        # Try to extract more detailed error information if available
        if hasattr(e, 'response') and e.response is not None:
            try:
                error_data = e.response.json()
                if 'detail' in error_data:
                    error_message = error_data['detail']
            except:
                pass

        return {
            "content": [
                {
                    "type": "text",
                    "text": f"API Error: {error_message}"
                }
            ],
            "isError": True
        }

def main():
    """Define the extension"""
    return {
        "id": "pixellab-api",
        "description": "Tools for generating pixel art using the PixelLab API",
        "version": "1.0.0",
        "author": "Clay",
        "tools": [
            tool_generate_image_pixflux,
            tool_generate_image_bitforge,
            tool_inpaint,
            tool_rotate,
            tool_animate_with_skeleton,
            tool_animate_with_text,
            tool_get_balance
        ],
        "resources": [],
        "prompts": []
    }