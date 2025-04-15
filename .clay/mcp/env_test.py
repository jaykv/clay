"""
MCP extension for testing environment variables
"""
import os
from typing import Dict

def tool_test_env_vars() -> Dict:
    """Test if environment variables are loaded correctly
    """
    # Get all environment variables
    env_vars = os.environ
    
    # Check for specific environment variables
    gemini_api_key = os.environ.get("GEMINI_API_KEY", "Not found")
    
    # Return the result
    return {
        "content": [
            {
                "type": "text",
                "text": f"GEMINI_API_KEY: {'Found (first 4 chars: ' + gemini_api_key[:4] + '...)' if gemini_api_key != 'Not found' else 'Not found'}"
            },
            {
                "type": "text",
                "text": f"Total environment variables: {len(env_vars)}"
            }
        ]
    }

def main():
    """Define the extension"""
    return {
        "id": "env-test",
        "description": "Test environment variables",
        "author": "Clay",
        "version": "1.0.0",
        "tools": [tool_test_env_vars],
        "resources": [],
        "prompts": []
    }
