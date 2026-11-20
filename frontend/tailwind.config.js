/** @type {import('tailwindcss').Config} */
const color = name => `rgb(var(--${name}) / <alpha-value>)`;
const semanticScale = (name, solid, hover) => ({
  100: color(name), 200: color(name), 300: color(name), 400: color(name),
  500: color(name), 600: solid, 700: hover, 800: color(name), 900: color(name),
});
module.exports = {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        page: color('page'), panel: color('panel'), raised: color('raised'),
        ink: color('ink'), body: color('body'), muted: color('muted'),
        line: color('line'), control: color('control'),
        primary: color('primary'), 'on-primary': color('on-primary'),
        active: color('active'), accent: color('accent'), overlay: color('overlay'),
        // Compatibility aliases keep existing state-dependent utility branches intact.
        slate: {
          950: color('page'), 900: color('panel'), 800: color('raised'),
          700: color('line'), 600: color('control'), 500: color('muted'),
          400: color('muted'), 300: color('body'), 200: color('ink'), 100: color('ink'),
        },
        indigo: {
          100: color('accent'), 200: color('accent'), 300: color('accent'), 400: color('accent'),
          500: color('primary-hover'), 600: color('primary'), 700: color('primary'),
          800: color('accent'), 900: color('accent'),
        },
        emerald: semanticScale('known', '#19764D', '#125C3C'),
        rose: semanticScale('unknown', '#B8324C', '#9F203C'),
        amber: semanticScale('target', '#89520A', '#6D4007'),
        purple: semanticScale('secondary-accent', '#6A4B91', '#553779'),
      },
      borderColor: { slate: { 700: color('line'), 800: color('line') } },
      boxShadow: {
        sm: '0 2px 5px rgb(var(--shadow) / .04)',
        lg: '0 6px 18px rgb(var(--shadow) / .07)',
        xl: '0 12px 32px rgb(var(--shadow) / .09)',
        '2xl': '0 16px 40px rgb(var(--shadow) / .12)',
      },
    },
  },
  plugins: [],
};
