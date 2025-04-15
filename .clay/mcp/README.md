# MCP Extensions

This directory contains extensions for the Model Context Protocol (MCP) server. You can add your own custom tools, resources, and prompts by creating JavaScript, TypeScript, or Python files in this directory.

## Extension Types

The MCP server supports three types of extensions:

1. **Tools**: Functions that can be called by AI models to perform actions
2. **Resources**: Data sources that can be accessed by AI models
3. **Prompts**: Pre-defined prompts that can be used by AI models

## Creating Extensions

### JavaScript/TypeScript Extensions

Create a JavaScript (.js) or TypeScript (.ts) file with the following structure:

```javascript
// For TypeScript files, you'll need to compile them to JavaScript first
// You can use `tsc your-extension.ts` to compile

const { z } = require('zod'); // For parameter validation

// Define the extension
const extension = {
  id: 'your-extension-id', // Required: Unique identifier for the extension
  type: 'tool', // Required: 'tool', 'resource', or 'prompt'
  description: 'Description of your extension', // Optional
  author: 'Your Name', // Optional
  version: '1.0.0', // Optional

  // For tools and prompts: Define parameters using Zod schemas
  parameters: {
    param1: z.string().describe('Description of param1'),
    param2: z.number().optional().describe('Description of param2'),
    // Add more parameters as needed
  },

  // For resources: Define the URI template
  // template: 'your-scheme://{param1}/{param2}',

  // Handler function for the extension
  handler: async (params) => {
    // For tools: Return content
    return {
      content: [
        {
          type: 'text',
          text: `Result: ${params.param1}`,
        },
      ],
    };

    // For resources: Return contents
    // return {
    //   contents: [
    //     {
    //       uri: uri.href,
    //       text: 'Resource content',
    //     },
    //   ],
    // };

    // For prompts: Return messages
    // return {
    //   messages: [
    //     {
    //       role: 'user',
    //       content: {
    //         type: 'text',
    //         text: `Prompt with ${params.param1}`,
    //       },
    //     },
    //   ],
    // };
  },
};

// Export the extension
module.exports = { extension };
// For ES modules: export default extension;
```

### Python Extensions

#### Dynamic Format (Recommended)

Create a Python (.py) file with functions for tools, resources, and prompts, and a `main()` function that returns the extension definition:

```python
"""
Example MCP extension with dynamic tools
"""

def tool_add_numbers(number1: int, number2: int) -> int:
    """Adds two numbers together and returns the result

    Args:
        number1: The first number to add
        number2: The second number to add
    """
    result = number1 + number2
    return {
        "content": [
            {
                "type": "text",
                "text": f"The sum of {number1} and {number2} is {result}"
            }
        ]
    }

def tool_subtract_numbers(number1: int, number2: int, number3: int = 0) -> int:
    """Subtracts numbers from each other and returns the result

    Args:
        number1: The number to subtract from
        number2: The first number to subtract
        number3: The second number to subtract (optional)
    """
    result = number1 - number2 - number3
    return {
        "content": [
            {
                "type": "text",
                "text": f"The result of {number1} - {number2} - {number3} is {result}"
            }
        ]
    }

def prompt_math_professor():
    """Creates a prompt for a math professor persona

    Args:
        None
    """
    return {
        "messages": [
            {
                "role": "user",
                "content": {
                    "type": "text",
                    "text": "You are a math professor who explains concepts clearly and concisely."
                }
            }
        ]
    }

def resource_math_formula(formula_name: str = "pythagorean"):
    """Provides common mathematical formulas

    Args:
        formula_name: The name of the formula to retrieve (pythagorean, quadratic)
    """
    formulas = {
        "pythagorean": "a² + b² = c²",
        "quadratic": "x = (-b ± √(b² - 4ac)) / 2a"
    }

    formula = formulas.get(formula_name, "Formula not found")

    return {
        "contents": [
            {
                "uri": f"math://{formula_name}",
                "text": formula
            }
        ]
    }

def main():
    """Define the extension"""
    return {
        "id": "math-tools",
        "description": "Mathematical tools and formulas",
        "version": "1.0.0",
        "author": "Clay",
        "tools": [tool_add_numbers, tool_subtract_numbers],
        "resources": [resource_math_formula],
        "prompts": [prompt_math_professor]
    }
```

With this format:

- Function parameters are automatically converted to MCP parameters
- Type annotations are used to determine parameter types
- Docstrings are used for function and parameter descriptions
- Default values become optional parameters with the specified defaults
- Function names are used for tool/resource/prompt IDs (prefixes like `tool_`, `resource_`, and `prompt_` are removed)

### Parameter Descriptions

The MCP server now supports extracting parameter descriptions from Python docstrings. This allows you to provide detailed information about each parameter that will be displayed in the MCP dashboard and made available to MCP clients.

To add parameter descriptions, use the standard Python docstring format with an Args section:

```python
def tool_function(param1: str, param2: int = 0):
    """Function description

    Args:
        param1: Description of the first parameter
        param2: Description of the second parameter with default value

    Returns:
        Description of the return value
    """
    # Function implementation
```

The parameter descriptions will be automatically extracted and included in the MCP tool definition, making your tools more user-friendly and easier to use.

## Example Extensions

This directory includes several example extensions to help you get started:

1. `example-tool.js`: A simple tool that reverses text (JavaScript, static format)
2. `example-resource.js`: A resource that provides the current date and time (JavaScript, static format)
3. `example-prompt.js`: A prompt for summarizing text (JavaScript, static format)
4. `example-python-tool.py`: A simple calculator implemented in Python (Python, dynamic format)
5. `math_tools.py`: Mathematical tools and formulas (Python, dynamic format)
6. `text_formatter.py`: Text formatting and manipulation tools (Python, dynamic format)
7. `example_with_param_docs.py`: Example tools with parameter descriptions in docstrings (Python, dynamic format)

## Loading Extensions

Extensions are automatically loaded when the MCP server starts. You can add, modify, or remove extensions while the server is running, but you'll need to restart the server for the changes to take effect.

## Debugging Extensions

If your extension isn't working as expected, check the Clay extension logs in VS Code for error messages. You can also add console.log statements to your JavaScript/TypeScript extensions or print statements to your Python extensions for debugging.

## Advanced Usage

For more advanced extensions, you can:

1. Use external libraries in your extensions
2. Make HTTP requests to external APIs
3. Access the file system (with appropriate permissions)
4. Implement complex business logic

Just make sure your extensions are secure and don't expose sensitive information or functionality that could be misused.
