#!/usr/bin/env python3
"""
Python script for loading MCP extensions
"""
import json
import importlib.util
import sys
import inspect
import typing
import re
import os
from typing import get_type_hints, Any, Optional, List, Dict, Union

def parse_docstring(docstring):
    """Parse a docstring to extract the description"""
    if not docstring:
        return ""

    # Extract just the description (first paragraph)
    description = ""

    if docstring:
        lines = docstring.strip().split('\n')
        for line in lines:
            line = line.strip()
            # Stop at the first section marker (Args, Returns, etc.)
            if line.lower().startswith("args:") or line.lower().startswith("arguments:") or line.lower().startswith("returns:"):
                break
            description += line + " "

    return description.strip()

def type_to_zod_schema(py_type):
    """Convert Python type to Zod schema name"""
    if py_type == int:
        return "number().int()"
    elif py_type == float:
        return "number()"
    elif py_type == str:
        return "string()"
    elif py_type == bool:
        return "boolean()"
    elif py_type == list or getattr(py_type, "__origin__", None) == list:
        return "array()"
    elif py_type == dict or getattr(py_type, "__origin__", None) == dict:
        return "object()"
    else:
        return "any()"

def analyze_function(func):
    """Analyze a function and extract its parameter info"""
    sig = inspect.signature(func)
    type_hints = get_type_hints(func)
    description = parse_docstring(func.__doc__)

    parameters = {}
    for param_name, param in sig.parameters.items():
        # Skip 'self' parameter for methods
        if param_name == 'self':
            continue

        param_type = type_hints.get(param_name, Any)
        has_default = param.default != inspect.Parameter.empty
        is_optional = False

        # Check if it's an Optional type
        if getattr(param_type, "__origin__", None) == Union:
            args = getattr(param_type, "__args__", [])
            if type(None) in args:
                is_optional = True
                # Get the actual type (excluding None)
                non_none_args = [arg for arg in args if arg != type(None)]
                if non_none_args:
                    param_type = non_none_args[0]

        parameters[param_name] = {
            "type": str(param_type),
            "zod_type": type_to_zod_schema(param_type),
            "has_default": has_default,
            "default_value": param.default if has_default else None,
            "is_optional": is_optional or has_default,
            "description": "" # No parameter descriptions from docstrings
        }

    return {
        "name": func.__name__,
        "parameters": parameters,
        "description": description
    }

def load_extension(file_path, output_path):
    """Load an extension from a Python file"""
    try:
        # Add the directory containing the module to the Python path
        module_dir = os.path.dirname(os.path.abspath(file_path))
        if module_dir not in sys.path:
            sys.path.insert(0, module_dir)

        # Load the module
        spec = importlib.util.spec_from_file_location("extension", file_path)
        module = importlib.util.module_from_spec(spec)
        sys.modules["extension"] = module
        spec.loader.exec_module(module)

        # Check for the new-style main() function first
        result = {}
        if hasattr(module, "main") and callable(module.main):
            # New-style extension with main() function
            extension_def = module.main()

            # Basic extension info
            result["id"] = extension_def.get("id", "")
            result["description"] = extension_def.get("description", "")
            result["author"] = extension_def.get("author", "")
            result["version"] = extension_def.get("version", "")
            result["format"] = "dynamic"

            # Process tools
            tools = []
            for func in extension_def.get("tools", []):
                if callable(func):
                    func_info = analyze_function(func)
                    tool_name = func_info["name"]

                    # Remove 'tool_' prefix if present
                    if tool_name.startswith("tool_"):
                        tool_name = tool_name[5:]

                    tools.append({
                        "id": f"{result['id']}-{tool_name}" if result['id'] else tool_name,
                        "function_name": func_info["name"],
                        "description": func_info["description"],
                        "parameters": func_info["parameters"]
                    })
            result["tools"] = tools

            # Process resources
            resources = []
            for func in extension_def.get("resources", []):
                if callable(func):
                    func_info = analyze_function(func)
                    resource_name = func_info["name"]

                    # Remove 'resource_' prefix if present
                    if resource_name.startswith("resource_"):
                        resource_name = resource_name[9:]

                    resources.append({
                        "id": f"{result['id']}-{resource_name}" if result['id'] else resource_name,
                        "function_name": func_info["name"],
                        "description": func_info["description"],
                        "parameters": func_info["parameters"],
                        "template": f"{resource_name}://{{path}}"
                    })
            result["resources"] = resources

            # Process prompts
            prompts = []
            for func in extension_def.get("prompts", []):
                if callable(func):
                    func_info = analyze_function(func)
                    prompt_name = func_info["name"]

                    # Remove 'prompt_' prefix if present
                    if prompt_name.startswith("prompt_"):
                        prompt_name = prompt_name[7:]

                    prompts.append({
                        "id": f"{result['id']}-{prompt_name}" if result['id'] else prompt_name,
                        "function_name": func_info["name"],
                        "description": func_info["description"],
                        "parameters": func_info["parameters"]
                    })
            result["prompts"] = prompts

        # Write to output file
        with open(output_path, "w") as f:
            json.dump(result, f)
            
        return True
    except Exception as e:
        # Write error to output file
        with open(output_path, "w") as f:
            json.dump({"error": str(e)}, f)
        return False

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python-loader.py <file_path> <output_path>")
        sys.exit(1)
    
    file_path = sys.argv[1]
    output_path = sys.argv[2]
    
    success = load_extension(file_path, output_path)
    sys.exit(0 if success else 1)
