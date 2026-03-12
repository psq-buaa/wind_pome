/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          50: '#f5f3f0',
          100: '#e8e4de',
          200: '#d4cec4',
          300: '#b8b0a2',
          400: '#9a8f7e',
          500: '#7d7165',
          600: '#665b50',
          700: '#524a41',
          800: '#3d3832',
          900: '#2a2622',
        },
        wind: {
          50: '#f0f7f4',
          100: '#d6ece1',
          200: '#b0d9c5',
          300: '#7dbfa2',
          400: '#4fa27e',
          500: '#338564',
          600: '#266b50',
          700: '#1f5641',
          800: '#1b4536',
          900: '#17392d',
        }
      }
    },
  },
  plugins: [],
}

