import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        popover: 'var(--popover)',
        'popover-edge': 'var(--popover-edge)',
        panel: 'var(--panel)',
        hover: 'var(--hover)',
        inset: 'var(--inset)',
        divider: 'var(--divider)',
        border: 'var(--border)',
        'border-strong': 'var(--border-strong)',
        ink: 'var(--ink)',
        ink2: 'var(--ink2)',
        ink3: 'var(--ink3)',
        ink4: 'var(--ink4)',
        mono: 'var(--mono-color)',
        accent: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
          ink: 'var(--accent-ink)',
          soft: 'var(--accent-soft)',
          border: 'var(--accent-border)',
        },
        success: {
          DEFAULT: 'var(--success)',
          soft: 'var(--success-soft)',
          border: 'var(--success-border)',
        },
        warning: {
          DEFAULT: 'var(--warning)',
          soft: 'var(--warning-soft)',
          border: 'var(--warning-border)',
        },
        danger: {
          DEFAULT: 'var(--danger)',
          soft: 'var(--danger-soft)',
          border: 'var(--danger-border)',
        },
        info: {
          DEFAULT: 'var(--info)',
          soft: 'var(--info-soft)',
          border: 'var(--info-border)',
        },
        neutral: {
          DEFAULT: 'var(--neutral)',
          soft: 'var(--neutral-soft)',
        },
      },
      fontFamily: {
        sans: [
          'Geist',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'system-ui',
          'sans-serif',
        ],
        mono: ['"Geist Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        '2xs': ['10px', { lineHeight: '1.35' }],
        '3xs': ['8.5px', { lineHeight: '1.35' }],
        xs: ['11px', { lineHeight: '1.4' }],
        sm: ['12px', { lineHeight: '1.4' }],
        base: ['13px', { lineHeight: '1.45' }],
        md: ['14px', { lineHeight: '1.45' }],
        lg: ['16px', { lineHeight: '1.4' }],
        xl: ['18px', { lineHeight: '1.3' }],
        '2xl': ['22px', { lineHeight: '1.2' }],
      },
      boxShadow: {
        popover:
          '0 1px 0 var(--popover-edge) inset, 0 12px 32px var(--shadow), 0 24px 64px var(--shadow-strong)',
        card: '0 1px 0 var(--popover-edge) inset, 0 4px 12px var(--shadow)',
      },
      borderRadius: {
        sm: '4px',
        md: '6px',
        lg: '10px',
        xl: '14px',
        '2xl': '16px',
      },
      keyframes: {
        robinPulse: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.55', transform: 'scale(0.92)' },
        },
        robinFloat: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-3px)' },
        },
        robinShimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        spin: {
          to: { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        'robin-pulse': 'robinPulse 1.8s ease-in-out infinite',
        'robin-float': 'robinFloat 4s ease-in-out infinite',
        'robin-shimmer': 'robinShimmer 1.4s linear infinite',
        spin: 'spin 1.2s linear infinite',
      },
    },
  },
  plugins: [],
};

export default config;
