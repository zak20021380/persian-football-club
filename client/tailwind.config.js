/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Vazirmatn', 'Tahoma', 'Arial', 'sans-serif'] },
      colors: {
        pitch: { 400: '#34d399', 500: '#10b981', 600: '#059669' },
        ink: { 950: '#07111f', 900: '#0b1728', 850: '#102036', 800: '#14263d' }
      },
      boxShadow: { card: '0 16px 40px rgba(0,0,0,.24)' }
    }
  },
  plugins: []
};
