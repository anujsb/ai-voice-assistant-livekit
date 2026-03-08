import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)', 'serif'],
        body:    ['var(--font-body)',    'sans-serif'],
        mono:    ['var(--font-mono)',    'monospace'],
      },
      colors: {
        brand: {
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
        },
        surface: {
          0:   '#0a0a0f',
          50:  '#0f0f18',
          100: '#13131f',
          200: '#1a1a28',
          300: '#222235',
          400: '#2e2e45',
          500: '#3d3d58',
          600: '#52526e',
          700: '#6e6e8a',
          800: '#9898b0',
          900: '#c4c4d4',
          950: '#e8e8f0',
        },
      },
    },
  },
  plugins: [],
}

export default config