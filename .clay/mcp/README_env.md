# Using Environment Variables with MCP Extensions

The MCP server automatically loads environment variables from a `.env` file in the `.clay/mcp` directory. This allows you to securely store sensitive information like API keys without hardcoding them in your extension code.

## How It Works

1. Create a `.env` file in the `.clay/mcp` directory
2. Add your environment variables in the format `KEY=VALUE`
3. Access the environment variables in your Python extensions using `os.environ.get("KEY")`

## Example .env File

```
GEMINI_API_KEY=your_api_key_here
OPENAI_API_KEY=your_openai_key_here
CUSTOM_VARIABLE=some_value
```

## Example Python Extension

```python
"""
Example MCP extension that uses environment variables
"""
import os
from typing import Dict, Optional

def tool_use_api_key(param: str, api_key: Optional[str] = None) -> Dict:
    """Example tool that uses an API key from environment variables
    
    Args:
        param: Some parameter
        api_key: API key (if not provided, will use GEMINI_API_KEY env var)
    """
    # Get API key from parameter or environment variable
    actual_api_key = api_key or os.environ.get("GEMINI_API_KEY")
    
    if not actual_api_key:
        return {
            "content": [
                {
                    "type": "text",
                    "text": "Error: No API key provided. Please provide an API key or set the GEMINI_API_KEY environment variable."
                }
            ],
            "isError": True
        }
    
    # Use the API key (in a real extension, you would make an API call here)
    return {
        "content": [
            {
                "type": "text",
                "text": f"Using API key: {actual_api_key[:4]}...{actual_api_key[-4:]}"
            }
        ]
    }

def main():
    """Define the extension"""
    return {
        "id": "env-var-example",
        "description": "Example extension that uses environment variables",
        "author": "Clay",
        "version": "1.0.0",
        "tools": [tool_use_api_key],
        "resources": [],
        "prompts": []
    }
```

## Security Considerations

- Never commit your `.env` file to version control
- Add `.env` to your `.gitignore` file
- Consider using a password manager or secure vault for storing API keys
- Rotate API keys periodically for better security

## Troubleshooting

If your environment variables are not being loaded:

1. Make sure the `.env` file is in the `.clay/mcp` directory
2. Check that the format is correct (KEY=VALUE, no spaces around the equals sign)
3. Restart the MCP server after making changes to the `.env` file
4. Check the logs for any errors related to loading environment variables
