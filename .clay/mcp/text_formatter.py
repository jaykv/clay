"""
Text formatting tools for MCP
"""
import re
import json
from typing import List, Dict, Union, Optional, Literal

def tool_format_case(
    text: str, 
    case_type: Literal["upper", "lower", "title", "sentence", "camel", "snake", "kebab"] = "title"
) -> Dict:
    """Converts text to different case formats"""
    result = text
    
    if case_type == "upper":
        result = text.upper()
    elif case_type == "lower":
        result = text.lower()
    elif case_type == "title":
        result = text.title()
    elif case_type == "sentence":
        result = text.capitalize()
    elif case_type == "camel":
        # Convert to camelCase
        words = re.findall(r'[A-Za-z0-9]+', text.lower())
        result = words[0] if words else ""
        result += ''.join(word.capitalize() for word in words[1:])
    elif case_type == "snake":
        # Convert to snake_case
        words = re.findall(r'[A-Za-z0-9]+', text.lower())
        result = '_'.join(words)
    elif case_type == "kebab":
        # Convert to kebab-case
        words = re.findall(r'[A-Za-z0-9]+', text.lower())
        result = '-'.join(words)
    
    return {
        "content": [
            {
                "type": "text",
                "text": result
            }
        ]
    }

def tool_format_json(
    json_text: str, 
    indent: int = 2, 
    sort_keys: bool = False
) -> Dict:
    """Formats JSON text with proper indentation and optional sorting"""
    try:
        # Parse the JSON
        parsed = json.loads(json_text)
        
        # Format it with the specified options
        formatted = json.dumps(parsed, indent=indent, sort_keys=sort_keys)
        
        return {
            "content": [
                {
                    "type": "text",
                    "text": formatted
                }
            ]
        }
    except json.JSONDecodeError as e:
        return {
            "content": [
                {
                    "type": "text",
                    "text": f"Error: Invalid JSON - {str(e)}"
                }
            ],
            "isError": True
        }

def tool_truncate_text(
    text: str, 
    max_length: int = 100, 
    add_ellipsis: bool = True
) -> Dict:
    """Truncates text to a specified maximum length"""
    if len(text) <= max_length:
        return {
            "content": [
                {
                    "type": "text",
                    "text": text
                }
            ]
        }
    
    truncated = text[:max_length]
    if add_ellipsis:
        truncated += "..."
    
    return {
        "content": [
            {
                "type": "text",
                "text": truncated
            }
        ]
    }

def tool_count_words(text: str) -> Dict:
    """Counts the number of words, characters, and lines in text"""
    words = len(re.findall(r'\b\w+\b', text))
    chars = len(text)
    chars_no_spaces = len(text.replace(" ", ""))
    lines = len(text.split("\n"))
    
    result = f"""Word count: {words}
Character count (with spaces): {chars}
Character count (without spaces): {chars_no_spaces}
Line count: {lines}"""
    
    return {
        "content": [
            {
                "type": "text",
                "text": result
            }
        ]
    }

def tool_find_replace(
    text: str, 
    find: str, 
    replace: str, 
    case_sensitive: bool = True,
    all_occurrences: bool = True
) -> Dict:
    """Finds and replaces text within a string"""
    if not case_sensitive:
        if all_occurrences:
            result = re.sub(re.escape(find), replace, text, flags=re.IGNORECASE)
        else:
            result = re.sub(re.escape(find), replace, text, count=1, flags=re.IGNORECASE)
    else:
        if all_occurrences:
            result = text.replace(find, replace)
        else:
            result = text.replace(find, replace, 1)
    
    return {
        "content": [
            {
                "type": "text",
                "text": result
            }
        ]
    }

def tool_extract_regex(
    text: str, 
    pattern: str,
    group: int = 0
) -> Dict:
    """Extracts text matching a regular expression pattern"""
    try:
        matches = re.findall(pattern, text)
        
        if not matches:
            return {
                "content": [
                    {
                        "type": "text",
                        "text": "No matches found."
                    }
                ]
            }
        
        # Handle different match types
        if isinstance(matches[0], tuple) and group < len(matches[0]):
            # If matches are tuples (groups), extract the requested group
            results = [match[group] for match in matches]
        elif group == 0:
            # If matches are strings and group is 0, return all matches
            results = matches
        else:
            return {
                "content": [
                    {
                        "type": "text",
                        "text": f"Error: Group {group} not found in matches."
                    }
                ],
                "isError": True
            }
        
        formatted_results = "\n".join(results)
        return {
            "content": [
                {
                    "type": "text",
                    "text": formatted_results
                }
            ]
        }
    except re.error as e:
        return {
            "content": [
                {
                    "type": "text",
                    "text": f"Error: Invalid regular expression - {str(e)}"
                }
            ],
            "isError": True
        }

def main():
    """Define the extension"""
    return {
        "id": "text-formatter",
        "description": "Tools for formatting and manipulating text",
        "version": "1.0.0",
        "author": "Clay",
        "tools": [
            tool_format_case,
            tool_format_json,
            tool_truncate_text,
            tool_count_words,
            tool_find_replace,
            tool_extract_regex
        ],
        "resources": [],
        "prompts": []
    }
