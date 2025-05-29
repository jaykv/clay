import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

const server = new McpServer({
  name: 'Calculator',
  version: '1.0.0'
});

// Basic arithmetic tools
server.tool('add', 
  { 
    a: z.number().describe('First number'),
    b: z.number().describe('Second number')
  },
  async ({ a, b }) => ({
    content: [{ type: 'text', text: `${a} + ${b} = ${a + b}` }]
  })
);

server.tool('subtract',
  {
    a: z.number().describe('First number'),
    b: z.number().describe('Second number')
  },
  async ({ a, b }) => ({
    content: [{ type: 'text', text: `${a} - ${b} = ${a - b}` }]
  })
);

server.tool('multiply',
  {
    a: z.number().describe('First number'),
    b: z.number().describe('Second number')
  },
  async ({ a, b }) => ({
    content: [{ type: 'text', text: `${a} × ${b} = ${a * b}` }]
  })
);

server.tool('divide',
  {
    a: z.number().describe('Dividend'),
    b: z.number().describe('Divisor')
  },
  async ({ a, b }) => {
    if (b === 0) {
      return {
        content: [{ type: 'text', text: 'Error: Division by zero is not allowed' }],
        isError: true
      };
    }
    return {
      content: [{ type: 'text', text: `${a} ÷ ${b} = ${a / b}` }]
    };
  }
);

// Advanced math tools
server.tool('power',
  {
    base: z.number().describe('Base number'),
    exponent: z.number().describe('Exponent')
  },
  async ({ base, exponent }) => ({
    content: [{ type: 'text', text: `${base}^${exponent} = ${Math.pow(base, exponent)}` }]
  })
);

server.tool('sqrt',
  {
    number: z.number().min(0).describe('Number to find square root of')
  },
  async ({ number }) => ({
    content: [{ type: 'text', text: `√${number} = ${Math.sqrt(number)}` }]
  })
);

// Math constants resource
server.resource(
  'math-constants',
  'math://constants',
  async (uri) => ({
    contents: [{
      uri: uri.href,
      text: `Mathematical Constants:
π (pi) = ${Math.PI}
e (Euler's number) = ${Math.E}
√2 = ${Math.SQRT2}
ln(2) = ${Math.LN2}
ln(10) = ${Math.LN10}
log₁₀(e) = ${Math.LOG10E}
log₂(e) = ${Math.LOG2E}`
    }]
  })
);

// Math formulas resource
server.resource(
  'math-formulas',
  'math://formulas/{category}',
  async (uri, { category }) => {
    const formulas = {
      geometry: `Geometry Formulas:
Circle Area: A = πr²
Circle Circumference: C = 2πr
Rectangle Area: A = length × width
Triangle Area: A = ½ × base × height
Sphere Volume: V = (4/3)πr³`,
      
      algebra: `Algebra Formulas:
Quadratic Formula: x = (-b ± √(b² - 4ac)) / 2a
Distance Formula: d = √((x₂-x₁)² + (y₂-y₁)²)
Slope Formula: m = (y₂-y₁) / (x₂-x₁)
Point-Slope Form: y - y₁ = m(x - x₁)`,
      
      trigonometry: `Trigonometry Formulas:
sin²θ + cos²θ = 1
tan θ = sin θ / cos θ
Law of Sines: a/sin A = b/sin B = c/sin C
Law of Cosines: c² = a² + b² - 2ab cos C`
    };

    const formula = formulas[category] || 'Category not found. Available: geometry, algebra, trigonometry';
    
    return {
      contents: [{
        uri: uri.href,
        text: formula
      }]
    };
  }
);

// Math problem solving prompt
server.prompt(
  'solve-equation',
  { 
    equation: z.string().describe('Mathematical equation to solve'),
    steps: z.boolean().default(true).describe('Show step-by-step solution')
  },
  ({ equation, steps }) => ({
    messages: [{
      role: 'user',
      content: {
        type: 'text',
        text: steps 
          ? `Please solve this equation step by step: ${equation}`
          : `Please solve this equation: ${equation}`
      }
    }]
  })
);

// Math explanation prompt
server.prompt(
  'explain-concept',
  { 
    concept: z.string().describe('Mathematical concept to explain'),
    level: z.enum(['basic', 'intermediate', 'advanced']).default('intermediate').describe('Explanation level')
  },
  ({ concept, level }) => ({
    messages: [{
      role: 'user',
      content: {
        type: 'text',
        text: `Please explain the mathematical concept "${concept}" at a ${level} level with examples.`
      }
    }]
  })
);

// Export for Clay to load
export { server };
