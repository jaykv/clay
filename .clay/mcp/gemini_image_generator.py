"""
MCP extension for generating images using Google's Gemini API.

This extension requires the following packages:
- google-generativeai
- Pillow
- requests

To set up the virtual environment:
1. cd .clay/mcp
2. python -m venv .venv
3. source .venv/bin/activate  # On Windows: .venv\Scripts\activate
4. pip install google-generativeai pillow requests
"""
import os
import base64
import io
from typing import Dict, List, Optional, Union

# Try to import dependencies
try:
    from google import genai
    from google.genai import types
    from PIL import Image
    import requests
    DEPS_LOADED = True
except ImportError:
    DEPS_LOADED = False

def tool_generate_gemini_image(
    prompt: str,
    api_key: Optional[str] = None,
    width: int = 1024,
    height: int = 1024,
    style: str = "vivid",
    save_path: Optional[str] = None
) -> Dict:
    """Generates an image using Google's Gemini 2.0 Flash Experimental model

    Args:
        prompt: Detailed description of the image to generate
        api_key: Google Gemini API key (if not provided, will use GEMINI_API_KEY env var)
        width: Width of the image in pixels (1024 recommended)
        height: Height of the image in pixels (1024 recommended)
        style: Image style (vivid or natural)
        save_path: Optional file path to save the generated image (e.g., 'images/cat.png')
    """
    if not DEPS_LOADED:
        return {
            "content": [
                {
                    "type": "text",
                    "text": "Error: Required dependencies (google-generativeai, Pillow, requests) are not installed. Please set up a virtual environment with these packages."
                }
            ],
            "isError": True
        }

    try:
        # Get API key from parameter or environment variable
        gemini_api_key = api_key or os.environ.get("GEMINI_API_KEY")

        if not gemini_api_key:
            return {
                "content": [
                    {
                        "type": "text",
                        "text": "Error: No Gemini API key provided. Please provide an API key or set the GEMINI_API_KEY environment variable."
                    }
                ],
                "isError": True
            }

        # Configure the Gemini API
        genai.configure(api_key=gemini_api_key)

        # Generate the image using Gemini 2.0 Flash Experimental
        model = genai.GenerativeModel("gemini-2.0-flash-exp-image-generation")
        response = model.generate_content(
            prompt,
            generation_config={"response_modalities": ["TEXT", "IMAGE"]}
        )

        # Extract the image from the response
        image_data = None
        text_response = ""

        for part in response.parts:
            if hasattr(part, 'text') and part.text:
                text_response += part.text + "\n"
            elif hasattr(part, 'inline_data') and part.inline_data:
                image_data = part.inline_data.data

        if not image_data:
            return {
                "content": [
                    {
                        "type": "text",
                        "text": "Error: No image was generated. Try a different prompt."
                    }
                ],
                "isError": True
            }

        # Save the image to a file if a path is provided
        save_result = None
        if save_path:
            try:
                # Create directory if it doesn't exist
                save_dir = os.path.dirname(save_path)
                if save_dir and not os.path.exists(save_dir):
                    os.makedirs(save_dir)

                # Decode the base64 image data
                image_bytes = base64.b64decode(image_data)

                # Save the image to the specified path
                with open(save_path, 'wb') as f:
                    f.write(image_bytes)

                save_result = f"Image saved to {save_path}"
            except Exception as e:
                save_result = f"Error saving image to {save_path}: {str(e)}"

        # Return the result
        result = {
            "content": [
                {
                    "type": "text",
                    "text": f"Generated image for prompt: '{prompt}'"
                },
                {
                    "type": "text",
                    "text": text_response.strip() if text_response else "Image generated successfully."
                }
            ]
        }

        # Add save result if available
        if save_result:
            result["content"].append({
                "type": "text",
                "text": save_result
            })

        # Add the image data
        result["content"].append({
            "type": "text",
            "text": f"data:image/png;base64,{image_data}"
        })

        return result

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

def tool_generate_imagen_image(
    prompt: str,
    api_key: Optional[str] = None,
    number_of_images: int = 1,
    aspect_ratio: str = "1:1",
    save_path: Optional[str] = None
) -> Dict:
    """Generates an image using Google's Imagen 3.0 model

    Args:
        prompt: Detailed description of the image to generate
        api_key: Google Gemini API key (if not provided, will use GEMINI_API_KEY env var)
        number_of_images: Number of images to generate (1-4)
        aspect_ratio: Aspect ratio of the image (1:1, 16:9, 9:16, 4:3, 3:4)
        save_path: Optional file path to save the generated image(s). If multiple images are generated,
                  the path will be used as a base and index numbers will be added (e.g., 'image_0.png', 'image_1.png')
    """
    if not DEPS_LOADED:
        return {
            "content": [
                {
                    "type": "text",
                    "text": "Error: Required dependencies (google-generativeai, Pillow, requests) are not installed. Please set up a virtual environment with these packages."
                }
            ],
            "isError": True
        }

    try:
        # Get API key from parameter or environment variable
        gemini_api_key = api_key or os.environ.get("GEMINI_API_KEY")

        if not gemini_api_key:
            return {
                "content": [
                    {
                        "type": "text",
                        "text": "Error: No Gemini API key provided. Please provide an API key or set the GEMINI_API_KEY environment variable."
                    }
                ],
                "isError": True
            }

        # Validate parameters
        valid_aspect_ratios = ["1:1", "16:9", "9:16", "4:3", "3:4"]

        if aspect_ratio not in valid_aspect_ratios:
            return {
                "content": [
                    {
                        "type": "text",
                        "text": f"Error: Invalid aspect ratio '{aspect_ratio}'. Valid options are: {', '.join(valid_aspect_ratios)}"
                    }
                ],
                "isError": True
            }

        if number_of_images < 1 or number_of_images > 4:
            return {
                "content": [
                    {
                        "type": "text",
                        "text": "Error: Number of images must be between 1 and 4."
                    }
                ],
                "isError": True
            }

        # Configure the Gemini API
        client = genai.Client(api_key=gemini_api_key)

        # Generate the image using Imagen 3.0
        response = client.models.generate_images(
            model="imagen-3.0-generate-002",
            prompt=prompt,
            config=types.GenerateImagesConfig(
                number_of_images=number_of_images,
                aspect_ratio=aspect_ratio,
                person_generation="ALLOW_ADULT"  # Default setting
            )
        )

        # Process the generated images
        result = {
            "content": [
                {
                    "type": "text",
                    "text": f"Generated {number_of_images} image(s) for prompt: '{prompt}'"
                }
            ]
        }

        # Create directory for saving images if needed
        if save_path and number_of_images > 0:
            try:
                save_dir = os.path.dirname(save_path)
                if save_dir and not os.path.exists(save_dir):
                    os.makedirs(save_dir)
            except Exception as e:
                result["content"].append({
                    "type": "text",
                    "text": f"Error creating directory: {str(e)}"
                })

        # Add each image to the result
        for i, generated_image in enumerate(response.images):
            image_bytes = generated_image._image_bytes
            base64_image = base64.b64encode(image_bytes).decode('utf-8')

            # Save the image if a path is provided
            if save_path:
                try:
                    # Determine the file path (add index for multiple images)
                    file_path = save_path
                    if number_of_images > 1:
                        # Split the path to insert the index before the extension
                        base, ext = os.path.splitext(save_path)
                        file_path = f"{base}_{i}{ext}"

                    # Save the image
                    with open(file_path, 'wb') as f:
                        f.write(image_bytes)

                    result["content"].append({
                        "type": "text",
                        "text": f"Image {i+1} saved to {file_path}"
                    })
                except Exception as e:
                    result["content"].append({
                        "type": "text",
                        "text": f"Error saving image {i+1} to {file_path}: {str(e)}"
                    })

            # Add the image data
            result["content"].append({
                "type": "text",
                "text": f"data:image/png;base64,{base64_image}"
            })

        # Add final message
        result["content"].append({
            "type": "text",
            "text": "Images generated using Google's Imagen 3.0 model."
        })

        return result

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
        "id": "gemini-image-generator",
        "description": "Generate images using Google's Gemini API (requires API key)",
        "version": "1.0.0",
        "author": "Clay",
        "tools": [tool_generate_gemini_image, tool_generate_imagen_image],
        "resources": [],
        "prompts": []
    }
