/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: {
          light: '#F7F7F5',
          dark: '#0E0F11',
        },
        card: {
          light: '#FFFFFF',
          dark: '#17181B',
        },
        accent: {
          DEFAULT: '#4F46E5',
          hover: '#4338CA',
          light: '#EEF2FF',
          dark: '#6366F1',
        },
        positive: {
          DEFAULT: '#16A34A',
          hover: '#15803D',
          light: '#DCFCE7',
          dark: '#22C55E',
        },
        negative: {
          DEFAULT: '#DC2626',
          hover: '#B91C1C',
          light: '#FEE2E2',
          dark: '#EF4444',
        },
        border: {
          light: '#E5E7EB',
          dark: '#27272A',
        },
        subtle: {
          light: '#F4F4F5',
          dark: '#1F2023',
        }
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['11px', '14px'],
        'xs': ['12px', '16px'],
        'sm': ['14px', '20px'],
        'base': ['16px', '24px'],
        'lg': ['20px', '28px'],
        'xl': ['28px', '36px'],
        '2xl': ['40px', '48px'],
      },
      borderRadius: {
        'card': '16px',
        'sheet': '20px',
        'pill': '9999px',
      },
      boxShadow: {
        'soft': '0 2px 10px -2px rgba(0, 0, 0, 0.04), 0 1px 3px -1px rgba(0, 0, 0, 0.02)',
        'sheet': '0 -4px 20px -2px rgba(0, 0, 0, 0.08)',
        'dialog': '0 20px 40px -8px rgba(0, 0, 0, 0.12)',
      }
    },
  },
  plugins: [],
}
