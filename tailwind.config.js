/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./index.html",
    "./pages/**/*.html",
    "./js/**/*.js",   // <--- เติมลูกน้ำตรงนี้ครับ
    "./**/*.html" 
  ],
  theme: {
    extend: {
      colors: {
        slate: { 850: '#151f32' }
      }
    },
  },
  plugins: [],
}