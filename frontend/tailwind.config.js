/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brandG: '#0072CE', // GS25
        brandC: '#652D8A', // CU
        brandS: '#DA291C', // 7-Eleven
        brandE: '#FFB81C', // Emart24
        brandP: '#10B981', // CSpace
      }
    },
  },
  plugins: [],
}
