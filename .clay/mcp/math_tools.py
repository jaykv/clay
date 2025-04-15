"""
Example MCP extension with dynamic tools
"""

def tool_add_numbers(number1: int, number2: int) -> int:
    """Adds two numbers together and returns the result"""
    result = number1 + number2
    return result

def tool_subtract_numbers(number1: int, number2: int, number3: int = 0) -> int:
    """Subtracts numbers from each other and returns the result"""
    result = number1 - number2 - number3
    return result

def prompt_math_professor():
    """Creates a prompt for a math professor persona"""
    return {
        "messages": [
            {
                "role": "user",
                "content": {
                    "type": "text",
                    "text": "You are a math professor who explains concepts clearly and concisely. Please help the user understand the mathematical concepts they're asking about."
                }
            }
        ]
    }

def resource_math_formula(formula_name: str = "pythagorean"):
    """Provides common mathematical formulas"""
    formulas = {
        "pythagorean": "a² + b² = c²",
        "quadratic": "x = (-b ± √(b² - 4ac)) / 2a",
        "area_circle": "A = πr²",
        "volume_sphere": "V = (4/3)πr³"
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
