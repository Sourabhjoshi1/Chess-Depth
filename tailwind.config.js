// Builds a trimmed copy of Tailwind CSS 2.2 that contains only the classes this site uses.
// Run automatically by .github/workflows/jekyll-gh-pages.yml on every deploy.
module.exports = {
  purge: {
    enabled: true,
    content: ['./*.html', './pages/**/*.html', './_includes/**/*.html', './_layouts/**/*.html', './_posts/**/*.md', './assets/js/**/*.js'],
    options: { safelist: ['hidden', 'shadow-xl', '-translate-y-full'] },
  },
  darkMode: false,
  theme: { extend: {} },
  variants: { extend: {} },
  plugins: [],
};
