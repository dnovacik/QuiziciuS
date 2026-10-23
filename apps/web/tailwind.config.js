/**
 * Theme ported from the Stitch "Obsidian Neon Pub" design system.
 *
 * The app screens use the Material 3 token names Stitch generated (`surface-container-low`,
 * `on-primary-container`, …). The public landing page was generated with a separate
 * `brand` / `dark` palette, which is kept here so it can be ported 1:1.
 */

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        background: '#11131a',
        surface: '#11131a',
        'surface-dim': '#11131a',
        'surface-bright': '#373941',
        'surface-container-lowest': '#0c0e15',
        'surface-container-low': '#191b23',
        'surface-container': '#1d1f27',
        'surface-container-high': '#282a31',
        'surface-container-highest': '#33343c',
        'surface-variant': '#33343c',
        'on-background': '#e2e2ec',
        'on-surface': '#e2e2ec',
        'on-surface-variant': '#cbc3d7',
        outline: '#958ea0',
        'outline-variant': '#494454',

        primary: '#d0bcff',
        'on-primary': '#3c0091',
        'primary-container': '#a078ff',
        'on-primary-container': '#340080',
        'inverse-primary': '#6d3bd7',

        secondary: '#ffb95f',
        'on-secondary': '#472a00',
        'secondary-container': '#ee9800',
        'on-secondary-container': '#5b3800',

        tertiary: '#4edea3',
        'on-tertiary': '#003824',
        'tertiary-container': '#00a572',
        'on-tertiary-container': '#00311f',

        error: '#ffb4ab',
        'on-error': '#690005',
        'error-container': '#93000a',
        'on-error-container': '#ffdad6',

        brand: {
          50: '#f5f3ff',
          100: '#ede9fe',
          500: '#8b5cf6',
          600: '#6938ef',
          700: '#5925dc',
          glow: '#a855f7',
        },
        dark: {
          950: '#06080f',
          900: '#0b0d17',
          850: '#101323',
          800: '#16192e',
          700: '#1f243d',
        },
      },
      fontSize: {
        'display-lg': ['40px', { lineHeight: '48px', letterSpacing: '-0.03em', fontWeight: '800' }],
        'display-lg-mobile': ['32px', { lineHeight: '40px', letterSpacing: '-0.02em', fontWeight: '800' }],
        'headline-lg': ['28px', { lineHeight: '36px', letterSpacing: '-0.02em', fontWeight: '700' }],
        'headline-md': ['22px', { lineHeight: '28px', letterSpacing: '-0.01em', fontWeight: '700' }],
        'headline-sm': ['18px', { lineHeight: '24px', fontWeight: '600' }],
        'body-lg': ['16px', { lineHeight: '24px', fontWeight: '500' }],
        'body-md': ['14px', { lineHeight: '20px', fontWeight: '400' }],
        'body-sm': ['12px', { lineHeight: '16px', fontWeight: '400' }],
        'label-lg': ['14px', { lineHeight: '20px', letterSpacing: '0.04em', fontWeight: '700' }],
        'label-md': ['12px', { lineHeight: '16px', letterSpacing: '0.05em', fontWeight: '600' }],
        'label-sm': ['10px', { lineHeight: '14px', letterSpacing: '0.08em', fontWeight: '700' }],
      },
      spacing: {
        'space-xs': '0.25rem',
        'space-sm': '0.5rem',
        'space-md': '1rem',
        'space-lg': '1.5rem',
        'space-xl': '2rem',
        gutter: '1rem',
        'gutter-sm': '0.75rem',
        'gutter-lg': '1.5rem',
        margin: '1rem',
        'margin-sm': '0.75rem',
        'margin-lg': '2rem',
      },
      boxShadow: {
        'neon-violet': '0 0 25px -5px rgba(139, 92, 246, 0.45)',
        'neon-glow': '0 0 35px -5px rgba(105, 56, 239, 0.55)',
        'team-glow': '0 0 35px -5px rgba(139, 92, 246, 0.4)',
        glass: '0 8px 32px 0 rgba(0, 0, 0, 0.45)',
        'glow-primary': '0 0 20px -4px rgba(160, 120, 255, 0.4)',
        'glow-gold': '0 0 20px -3px rgba(245, 158, 11, 0.35)',
        'glow-success': '0 0 20px -2px rgba(16, 185, 129, 0.45)',
      },
    },
  },
  plugins: [],
};
