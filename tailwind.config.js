import forms from '@tailwindcss/forms';

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        teal: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#20c997',
          600: '#14b8a6',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a'
        }
      },
      boxShadow: {
        glow: '0 0 30px rgba(32, 201, 151, 0.14)'
      }
    }
  },
  plugins: [forms]
};
