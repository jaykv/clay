# Gemini Image Generator MCP Extension

This MCP extension provides tools for generating images using Google's Gemini API, including both Gemini 2.0 Flash Experimental and Imagen 3.0 models.

## Requirements

- A Google Gemini API key (get one at https://ai.google.dev/)
- Python packages: `google-generativeai`, `Pillow`, `requests`

## Setup

1. Set your Gemini API key as an environment variable:
   ```bash
   export GEMINI_API_KEY=your_api_key_here
   ```
   
   Or provide it as a parameter when calling the tools.

2. Install required Python packages in the virtual environment:
   ```bash
   cd .clay/mcp
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   pip install google-generativeai pillow requests
   ```

## Tools

### 1. Generate Image with Gemini 2.0

The `generate_gemini_image` tool uses Google's Gemini 2.0 Flash Experimental model to generate images based on text prompts.

#### Parameters:
- `prompt`: Detailed description of the image to generate
- `api_key`: (Optional) Google Gemini API key
- `width`: Width of the image in pixels (default: 1024)
- `height`: Height of the image in pixels (default: 1024)
- `style`: Image style (vivid or natural, default: vivid)

#### Example:
```
generate_gemini_image(prompt="A futuristic city with flying cars and tall skyscrapers at sunset")
```

### 2. Generate Image with Imagen 3.0

The `generate_imagen_image` tool uses Google's Imagen 3.0 model to generate high-quality images based on text prompts.

#### Parameters:
- `prompt`: Detailed description of the image to generate
- `api_key`: (Optional) Google Gemini API key
- `number_of_images`: Number of images to generate (1-4, default: 1)
- `aspect_ratio`: Aspect ratio of the image (1:1, 16:9, 9:16, 4:3, 3:4, default: 1:1)

#### Example:
```
generate_imagen_image(prompt="A photorealistic image of a cat wearing a space helmet", number_of_images=2, aspect_ratio="16:9")
```

## Notes

- Imagen 3.0 generally produces higher quality images but requires a paid Gemini API plan.
- Gemini 2.0 Flash Experimental is available on the free tier but may have limitations.
- All generated images include SynthID watermarks as required by Google.
- The Imagen 3.0 model only supports English prompts.
- For best results with Gemini 2.0, use English, Spanish (es-MX), Japanese (ja-JP), Chinese (zh-CN), or Hindi (hi-IN).

## Troubleshooting

If you encounter errors:

1. Verify your API key is correct and has sufficient quota
2. Check that all required dependencies are installed
3. Try simplifying your prompt or using different wording
4. For Imagen 3.0, ensure you have a paid Gemini API plan
