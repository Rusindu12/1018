import { initNav, revealOnScroll, $, $$ } from './ui.js';

initNav();
revealOnScroll();

const links = $$('.about-nav a');
const sections = links
  .map((a) => document.querySelector(a.getAttribute('href')))
  .filter(Boolean);

if ('IntersectionObserver' in window && sections.length) {
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        links.forEach((a) => a.classList.toggle('on', a.getAttribute('href') === `#${entry.target.id}`));
      }
    },
    { rootMargin: '-20% 0px -65% 0px', threshold: 0 }
  );
  sections.forEach((s) => io.observe(s));
}

// Smooth-scroll offset for the sticky nav.
links.forEach((a) => {
  a.addEventListener('click', (e) => {
    const target = document.querySelector(a.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    const top = target.getBoundingClientRect().top + window.scrollY - 84;
    window.scrollTo({ top, behavior: 'smooth' });
    history.replaceState(null, '', a.getAttribute('href'));
  });
});
