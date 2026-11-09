/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans"', '"Instrument Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Bricolage Grotesque"', '"Instrument Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        canvas: 'rgb(var(--c-canvas) / <alpha-value>)',
        ink: 'rgb(var(--c-ink) / <alpha-value>)',
        line: {
          DEFAULT: 'rgb(var(--c-line) / <alpha-value>)',
          strong: 'rgb(var(--c-line-strong) / <alpha-value>)',
        },
        brand: {
          DEFAULT: '#7B2FF2',
          dark: '#6A22E0',
          deep: '#2A0066',
          light: 'rgb(var(--c-brand-light) / <alpha-value>)',
          tint: 'rgb(var(--c-brand-tint) / <alpha-value>)',
        },
        lavender: {
          DEFAULT: 'rgb(var(--c-lavender) / <alpha-value>)',
          deep: 'rgb(var(--c-lavender-deep) / <alpha-value>)',
        },
        magenta: '#B145F0',
        mint: {
          DEFAULT: 'rgb(var(--c-mint) / <alpha-value>)',
          deep: '#0E9F4F',
        },
        success: {
          DEFAULT: '#0E9F4F',
          tint: 'rgb(var(--c-success-tint) / <alpha-value>)',
        },
        danger: {
          DEFAULT: '#E0313A',
          tint: 'rgb(var(--c-danger-tint) / <alpha-value>)',
        },
        warn: {
          DEFAULT: '#8A5A00',
          tint: 'rgb(var(--c-warn-tint) / <alpha-value>)',
        },
        // Neutral scale re-mapped onto the violet-grey text and surface tokens so
        // existing text-neutral-* / border-neutral-* classes pick up the new theme.
        neutral: {
          50: 'rgb(var(--c-n50) / <alpha-value>)',
          100: 'rgb(var(--c-n100) / <alpha-value>)',
          200: 'rgb(var(--c-n200) / <alpha-value>)',
          300: 'rgb(var(--c-n300) / <alpha-value>)',
          400: 'rgb(var(--c-n400) / <alpha-value>)',
          500: 'rgb(var(--c-n500) / <alpha-value>)',
          600: 'rgb(var(--c-n600) / <alpha-value>)',
          700: 'rgb(var(--c-n700) / <alpha-value>)',
          800: 'rgb(var(--c-n800) / <alpha-value>)',
          900: 'rgb(var(--c-n900) / <alpha-value>)',
        },
        red: {
          50: 'rgb(var(--c-r50) / <alpha-value>)',
          100: 'rgb(var(--c-r100) / <alpha-value>)',
          200: 'rgb(var(--c-r200) / <alpha-value>)',
          300: 'rgb(var(--c-r300) / <alpha-value>)',
          500: '#E0313A',
          600: '#E0313A',
          700: 'rgb(var(--c-r700) / <alpha-value>)',
        },
        amber: {
          50: 'rgb(var(--c-a50) / <alpha-value>)',
          100: 'rgb(var(--c-a100) / <alpha-value>)',
          300: 'rgb(var(--c-a300) / <alpha-value>)',
          500: '#C98A00',
          600: '#A86F00',
          700: 'rgb(var(--c-a700) / <alpha-value>)',
          800: 'rgb(var(--c-a800) / <alpha-value>)',
          900: 'rgb(var(--c-a900) / <alpha-value>)',
        },
      },
      borderRadius: {
        card: '10px',
        'card-lg': '12px',
        input: '10px',
        pill: '999px',
      },
      boxShadow: {
        primary: '0 12px 28px -14px rgba(123,47,242,.8)',
        card: 'none',
      },
      letterSpacing: {
        tightest: '-0.035em',
      },
    },
  },
  plugins: [],
}
