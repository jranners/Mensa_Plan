/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./app.js", "./src/**/*.js", "./data/*.js"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "surface-bright": "#f6fafe",
        "on-secondary-fixed": "#221b00",
        "on-primary-fixed": "#001e31",
        "inverse-on-surface": "#edf1f5",
        "primary-fixed": "#cce5ff",
        "on-primary-fixed-variant": "#244a67",
        "on-secondary-fixed-variant": "#544600",
        "text-heading": "#143d59",
        "tertiary-fixed-dim": "#c8c6c6",
        "error": "#ba1a1a",
        "outline-variant": "#c2c7ce",
        "surface-container-lowest": "#ffffff",
        "surface-tint": "#3d6280",
        "secondary-container": "#fdd400",
        "on-surface-variant": "#42474d",
        "on-primary-container": "#83a8c9",
        "text-main": "#373737",
        "primary-container": "#143d59",
        "tertiary-fixed": "#e4e2e1",
        "tertiary-container": "#3a3a3a",
        "on-secondary": "#ffffff",
        "price-badge": "#ffd600",
        "inverse-primary": "#a6cbed",
        "surface-card": "#ffffff",
        "surface-container-highest": "#dfe3e7",
        "tertiary": "#242525",
        "surface": "#f6fafe",
        "on-error-container": "#93000a",
        "secondary": "#705d00",
        "primary": "#00273e",
        "on-tertiary-container": "#a5a4a3",
        "primary-fixed-dim": "#a6cbed",
        "surface-container-high": "#e4e9ed",
        "outline": "#72787e",
        "secondary-fixed-dim": "#e9c400",
        "on-surface": "#171c1f",
        "on-error": "#ffffff",
        "surface-variant": "#dfe3e7",
        "on-primary": "#ffffff",
        "on-background": "#171c1f",
        "surface-container-low": "#f0f4f8",
        "error-container": "#ffdad6",
        "on-tertiary": "#ffffff",
        "border-subtle": "#e5e7eb",
        "secondary-fixed": "#ffe170",
        "surface-dim": "#d6dade",
        "inverse-surface": "#2c3134",
        "background": "#f6fafe",
        "surface-container": "#eaeef2",
        "on-tertiary-fixed": "#1b1c1c",
        "on-secondary-container": "#6f5c00",
        "navy-dark": "#08131e",
        "navy-surface": "#0b1926",
        "navy-card": "#122338",
        "navy-dish": "#182c44",
        "navy-dish-hover": "#1f3754"
      },
      borderRadius: {
        "DEFAULT": "0.375rem",   // 6px – moderner Basis-Radius
        "lg": "0.625rem",        // 10px
        "xl": "0.875rem",        // 14px
        "2xl": "1rem",           // 16px
        "full": "9999px"         // ← KORREKT: echte Pill-Form
      },
      spacing: {
        "margin-page": "16px",
        "inset-card": "16px",
        "control-height": "44px",
        "gutter-card": "12px",
        "stack-md": "16px",
        "stack-sm": "8px",
        "stack-lg": "24px"
      },
      fontFamily: {
        sans: ['"Hanken Grotesk"', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        label: ['"Hanken Grotesk"', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        body: ['"Hanken Grotesk"', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        headline: ['"Hanken Grotesk"', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif']
      },
      fontSize: {
        'headline-lg': ['1.125rem', { lineHeight: '1.25', fontWeight: '700' }],
        'headline-sm': ['0.9375rem', { lineHeight: '1.35', fontWeight: '700' }],
        'label-lg': ['0.875rem', { lineHeight: '1.2', fontWeight: '800' }],
        'label-md': ['0.8125rem', { lineHeight: '1.2', fontWeight: '700' }],
        'label-sm': ['0.6875rem', { lineHeight: '1.0', fontWeight: '600' }],
        'body-lg': ['1rem', { lineHeight: '1.5', fontWeight: '400' }],
        'body-md': ['0.8125rem', { lineHeight: '1.45', fontWeight: '400' }],
        'body-sm': ['0.75rem', { lineHeight: '1.35', fontWeight: '500' }]
      },
      boxShadow: {
        xs: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
      },
      scale: {
        '98': '0.98',
        '102': '1.02'
      }
    }
  },
  plugins: [
    require("@tailwindcss/forms"),
    require("@tailwindcss/container-queries")
  ]
};
