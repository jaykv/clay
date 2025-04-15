"""
MCP extension for generating 2D game sprites based on natural language descriptions.
This extension uses the Replicate API to generate sprites using Stable Diffusion.
"""
import os
import base64
import requests
import time
import io
from typing import Dict, List, Optional, Union
from PIL import Image

def tool_generate_sprite(
    prompt: str,
    style: str = "pixel-art",
    size: int = 64,
    background: str = "transparent",
    api_key: Optional[str] = None
) -> Dict:
    """Generates a 2D game sprite based on a text description

    Args:
        prompt: Detailed description of the sprite to generate (e.g., "a red dragon with wings")
        style: Visual style of the sprite (pixel-art, cartoon, realistic, isometric)
        size: Size of the sprite in pixels (32, 64, 128, 256)
        background: Background type (transparent, white, black, colored)
        api_key: Optional Replicate API key (if not provided, will use REPLICATE_API_TOKEN env var)
    """
    try:
        # Get API key from parameter or environment variable
        replicate_api_token = api_key or os.environ.get("REPLICATE_API_TOKEN")
        
        if not replicate_api_token:
            return {
                "content": [
                    {
                        "type": "text",
                        "text": "Error: No Replicate API token provided. Please provide an API key or set the REPLICATE_API_TOKEN environment variable."
                    }
                ],
                "isError": True
            }
        
        # Validate parameters
        valid_styles = ["pixel-art", "cartoon", "realistic", "isometric"]
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
        
        # Enhance prompt based on style
        style_prompts = {
            "pixel-art": "pixel art style, 16-bit, game sprite, ",
            "cartoon": "cartoon style, simple, flat colors, game asset, ",
            "realistic": "detailed, realistic texture, game character, ",
            "isometric": "isometric view, game asset, "
        }
        
        enhanced_prompt = f"{style_prompts[style]}{prompt}, {size}x{size} sprite, for 2D game, on {background} background"
        
        # Call Replicate API to generate image
        # Using Stable Diffusion model
        headers = {
            "Authorization": f"Token {replicate_api_token}",
            "Content-Type": "application/json",
        }
        
        # Select appropriate model based on style
        if style == "pixel-art":
            model = "stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b"
        else:
            model = "stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b"
        
        # Set up model parameters
        payload = {
            "version": model,
            "input": {
                "prompt": enhanced_prompt,
                "negative_prompt": "blurry, low quality, distorted, deformed, ugly, bad anatomy",
                "width": size,
                "height": size,
                "num_outputs": 1,
                "guidance_scale": 7.5,
                "num_inference_steps": 30
            }
        }
        
        # Start prediction
        response = requests.post(
            "https://api.replicate.com/v1/predictions",
            json=payload,
            headers=headers
        )
        response.raise_for_status()
        prediction = response.json()
        
        # Get prediction ID
        prediction_id = prediction["id"]
        
        # Poll for results
        max_attempts = 60  # 5 minutes max (5 seconds * 60)
        for attempt in range(max_attempts):
            response = requests.get(
                f"https://api.replicate.com/v1/predictions/{prediction_id}",
                headers=headers
            )
            response.raise_for_status()
            prediction = response.json()
            
            if prediction["status"] == "succeeded":
                # Get the image URL
                image_url = prediction["output"][0]
                
                # Download the image
                image_response = requests.get(image_url)
                image_response.raise_for_status()
                
                # Process the image if needed (e.g., make background transparent)
                if background == "transparent":
                    img = Image.open(io.BytesIO(image_response.content))
                    
                    # Convert to RGBA if not already
                    if img.mode != "RGBA":
                        img = img.convert("RGBA")
                    
                    # Save to bytes
                    img_byte_arr = io.BytesIO()
                    img.save(img_byte_arr, format='PNG')
                    img_byte_arr.seek(0)
                    image_data = img_byte_arr.read()
                else:
                    image_data = image_response.content
                
                # Encode image to base64
                base64_image = base64.b64encode(image_data).decode('utf-8')
                
                # Return the result
                return {
                    "content": [
                        {
                            "type": "text",
                            "text": f"Generated sprite for prompt: '{prompt}'"
                        },
                        {
                            "type": "image",
                            "image": {
                                "data": f"data:image/png;base64,{base64_image}"
                            }
                        },
                        {
                            "type": "text",
                            "text": "You can save this image and use it in your game."
                        }
                    ]
                }
            elif prediction["status"] == "failed":
                return {
                    "content": [
                        {
                            "type": "text",
                            "text": f"Error: Image generation failed: {prediction.get('error', 'Unknown error')}"
                        }
                    ],
                    "isError": True
                }
            
            # Wait before polling again
            time.sleep(5)
        
        # If we get here, the prediction timed out
        return {
            "content": [
                {
                    "type": "text",
                    "text": "Error: Image generation timed out after 5 minutes."
                }
            ],
            "isError": True
        }
    
    except requests.exceptions.RequestException as e:
        return {
            "content": [
                {
                    "type": "text",
                    "text": f"Error: API request failed: {str(e)}"
                }
            ],
            "isError": True
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

def tool_generate_sprite_set(
    prompt: str,
    count: int = 4,
    style: str = "pixel-art",
    size: int = 64,
    background: str = "transparent",
    api_key: Optional[str] = None
) -> Dict:
    """Generates a set of related 2D game sprites based on a text description

    Args:
        prompt: Detailed description of the sprite set to generate (e.g., "fantasy RPG characters")
        count: Number of sprites to generate (1-4)
        style: Visual style of the sprites (pixel-art, cartoon, realistic, isometric)
        size: Size of the sprites in pixels (32, 64, 128, 256)
        background: Background type (transparent, white, black, colored)
        api_key: Optional Replicate API key (if not provided, will use REPLICATE_API_TOKEN env var)
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
        variations = []
        base_result = {
            "content": [
                {
                    "type": "text",
                    "text": f"Generated {count} sprites for prompt: '{prompt}'"
                }
            ]
        }
        
        for i in range(count):
            # Generate a sprite with a slight variation
            variation_prompt = f"{prompt}, variation {i+1}"
            result = tool_generate_sprite(variation_prompt, style, size, background, api_key)
            
            # If there was an error, return it
            if result.get("isError", False):
                return result
            
            # Add the image to the result
            for content in result["content"]:
                if content["type"] == "image":
                    base_result["content"].append(content)
        
        # Add final message
        base_result["content"].append({
            "type": "text",
            "text": "You can save these images and use them in your game."
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
        "id": "sprite-generator",
        "description": "Generate 2D game sprites from natural language descriptions",
        "version": "1.0.0",
        "author": "Clay",
        "tools": [tool_generate_sprite, tool_generate_sprite_set],
        "resources": [],
        "prompts": []
    }
