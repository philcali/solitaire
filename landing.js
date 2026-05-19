// Landing page: variant selector and start button

let selectedVariant = 'klondike';

// Variant selection
document.querySelectorAll('.variant-card').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelector('.variant-card.selected').classList.remove('selected');
    card.classList.add('selected');
    selectedVariant = card.dataset.variant;
  });
});

// Start game
document.getElementById('start-btn').addEventListener('click', () => {
  localStorage.setItem('solitaire-variant', selectedVariant);
  window.location.href = 'index.html';
});

// Restore previous selection
const prev = localStorage.getItem('solitaire-variant');
if (prev) {
  const el = document.querySelector(`.variant-card[data-variant="${prev}"]`);
  if (el) {
    document.querySelector('.variant-card.selected').classList.remove('selected');
    el.classList.add('selected');
    selectedVariant = prev;
  }
}
