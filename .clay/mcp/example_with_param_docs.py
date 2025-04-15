"""
Example MCP extension with parameter descriptions in docstrings
"""
from typing import Dict, List, Optional, Union, Literal

def tool_process_text(
    text: str,
    operation: Literal["uppercase", "lowercase", "capitalize", "reverse"] = "uppercase",
    repeat: int = 1
) -> Dict:
    """Process text with various operations
    
    Args:
        text: The input text to process
        operation: The operation to perform on the text
        repeat: Number of times to repeat the operation
    
    Returns:
        A dictionary with the processed text
    """
    result = text
    
    for _ in range(repeat):
        if operation == "uppercase":
            result = result.upper()
        elif operation == "lowercase":
            result = result.lower()
        elif operation == "capitalize":
            result = result.capitalize()
        elif operation == "reverse":
            result = result[::-1]
    
    return {
        "content": [
            {
                "type": "text",
                "text": result
            }
        ]
    }

def tool_analyze_numbers(
    numbers: str,
    operation: Literal["sum", "average", "min", "max"] = "sum",
    ignore_errors: bool = True
) -> Dict:
    """Analyze a list of numbers
    
    Args:
        numbers: Comma-separated list of numbers to analyze
        operation: The analysis operation to perform
        ignore_errors: Whether to ignore non-numeric values
    
    Returns:
        A dictionary with the analysis result
    """
    # Parse the numbers
    num_list = []
    for num_str in numbers.split(','):
        try:
            num = float(num_str.strip())
            num_list.append(num)
        except ValueError:
            if not ignore_errors:
                return {
                    "content": [
                        {
                            "type": "text",
                            "text": f"Error: '{num_str.strip()}' is not a valid number"
                        }
                    ],
                    "isError": True
                }
    
    if not num_list:
        return {
            "content": [
                {
                    "type": "text",
                    "text": "No valid numbers found"
                }
            ]
        }
    
    # Perform the operation
    result = None
    if operation == "sum":
        result = sum(num_list)
    elif operation == "average":
        result = sum(num_list) / len(num_list)
    elif operation == "min":
        result = min(num_list)
    elif operation == "max":
        result = max(num_list)
    
    return {
        "content": [
            {
                "type": "text",
                "text": f"Result: {result}"
            }
        ]
    }

def main():
    """Define the extension"""
    return {
        "id": "example-with-param-docs",
        "description": "Example tools with parameter descriptions in docstrings",
        "version": "1.0.0",
        "author": "Clay",
        "tools": [
            tool_process_text,
            tool_analyze_numbers
        ],
        "resources": [],
        "prompts": []
    }
