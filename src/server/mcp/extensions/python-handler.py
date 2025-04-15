#!/usr/bin/env python3
"""
Python script for calling MCP extension handlers
"""
import json
import importlib.util
import sys
import os

def call_handler(file_path, handler_type, params_path, result_path):
    """Call a handler function in a Python extension"""
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

        # Load the parameters
        with open(params_path, "r") as f:
            params = json.load(f)

        # Get the function
        function_name = params.pop("function_name")
        func = getattr(module, function_name, None)
        if func is None:
            result = {"error": f"Function {function_name} not found"}
        else:
            # Call the function
            if handler_type == "resource":
                uri = params["uri"]
                uri_params = params["params"]
                result = func(uri, uri_params)
            else:
                result = func(**params)

        # Write the result to the output file
        with open(result_path, "w") as f:
            json.dump(result, f)

        return True
    except Exception as e:
        # Write error to the output file
        with open(result_path, "w") as f:
            json.dump({"error": str(e)}, f)
        return False

if __name__ == "__main__":
    if len(sys.argv) < 5:
        print("Usage: python-handler.py <file_path> <handler_type> <params_path> <result_path>")
        sys.exit(1)

    file_path = sys.argv[1]
    handler_type = sys.argv[2]
    params_path = sys.argv[3]
    result_path = sys.argv[4]

    success = call_handler(file_path, handler_type, params_path, result_path)
    sys.exit(0 if success else 1)
