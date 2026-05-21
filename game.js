// ── Constants ──

const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
const SUIT_SYMBOLS = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };
const RED_SUITS = new Set(['hearts', 'diamonds']);
const FOUNDATION_SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
const VALUE_LABELS = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };
const MAX_HISTORY = 50;

// ── State ──

let state = {
  stock: [],
  waste: [],
  foundations: [[], [], [], []],
  tableau: [[], [], [], [], [], [], []]
};

let game = { history: [], won: false, lost: false };

// ── Card creation ──

function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (let value = 1; value <= 13; value++) {
      deck.push({ suit, value, faceUp: false });
    }
  }
  return deck;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Deal ──

function deal() {
  const deck = shuffle(createDeck());
  state = { stock: [], waste: [], foundations: [[], [], [], []], tableau: [[], [], [], [], [], [], []] };

  let idx = 0;
  for (let col = 0; col < 7; col++) {
    for (let row = 0; row <= col; row++) {
      const card = deck[idx++];
      card.faceUp = (row === col);
      state.tableau[col].push(card);
    }
  }
  state.stock = deck.slice(idx);
  for (const c of state.stock) c.faceUp = false;

  game = { history: [], won: false, lost: false };
  saveHistory();
  render();
}

// ── History (undo) ──

function saveHistory() {
  game.history.push(JSON.parse(JSON.stringify(state)));
  if (game.history.length > MAX_HISTORY) game.history.shift();
}

function undo() {
  if (game.history.length <= 1) return;
  game.history.pop();
  const prev = game.history[game.history.length - 1];
  state.stock = JSON.parse(JSON.stringify(prev.stock));
  state.waste = JSON.parse(JSON.stringify(prev.waste));
  state.foundations = JSON.parse(JSON.stringify(prev.foundations));
  state.tableau = JSON.parse(JSON.stringify(prev.tableau));
  game.won = false;
  game.lost = false;
  hideOverlay();
  render();
}

// ── Game rules ──

function isValidTableauMove(card, colIndex) {
  const col = state.tableau[colIndex];
  if (col.length === 0) return card.value === 13;
  const top = col[col.length - 1];
  if (!top.faceUp) return false;
  return top.value === card.value + 1 && RED_SUITS.has(top.suit) !== RED_SUITS.has(card.suit);
}

function canMoveToFoundation(card) {
  for (let i = 0; i < 4; i++) {
    const pile = state.foundations[i];
    if (FOUNDATION_SUITS[i] !== card.suit) continue;
    if (pile.length === 0) { if (card.value === 1) return i; }
    else if (pile[pile.length - 1].value === card.value - 1) return i;
  }
  return -1;
}

// ── No-moves detection ──

function hasValidMoves() {
  // Check all face-up cards against all tableau columns
  for (let srcCol = 0; srcCol < 7; srcCol++) {
    const col = state.tableau[srcCol];
    for (let i = 0; i < col.length; i++) {
      const card = col[i];
      if (!card.faceUp) continue;

      // Check if this card can move to another tableau column
      for (let dstCol = 0; dstCol < 7; dstCol++) {
        if (srcCol === dstCol) continue;
        if (isValidTableauMove(card, dstCol)) return true;
      }

      // Check if this card can move to foundation
      if (canMoveToFoundation(card) !== -1) return true;
    }
  }

  // Check waste card
  if (state.waste.length > 0) {
    const card = state.waste[state.waste.length - 1];
    if (canMoveToFoundation(card) !== -1) return true;
  }

  return false;
}

// ── Moves ──

function drawFromStock() {
  saveHistory();
  if (state.stock.length > 0) {
    const card = state.stock.pop();
    card.faceUp = true;
    state.waste.push(card);
  } else if (state.waste.length > 0) {
    state.stock = state.waste.reverse().map(c => ({ ...c, faceUp: false }));
    state.waste = [];
  }
  game.won = false;
  game.lost = false;
  hideOverlay();
  render();
}

function executeMove(from, to) {
  saveHistory();

  let cards;
  switch (from.type) {
    case 'waste':
      cards = [state.waste.pop()];
      break;
    case 'tableau':
      const col = state.tableau[from.index];
      cards = col.splice(from.cardIndex).map(c => ({ ...c }));
      if (col.length > 0) col[col.length - 1].faceUp = true;
      break;
    case 'foundation':
      cards = [state.foundations[from.index].pop()];
      break;
  }

  switch (to.type) {
    case 'tableau':
      state.tableau[to.index].push(...cards);
      break;
    case 'foundation':
      state.foundations[to.index].push(cards[0]);
      break;
  }

  // Check win
  if (state.foundations.every(f => f.length === 13)) {
    game.won = true;
    showOverlay('win');
  } else {
    // Check for no valid moves
    if (!hasValidMoves() && state.stock.length === 0) {
      game.lost = true;
      showOverlay('lose');
    }
  }
  render();
}

// ── Card lookup helpers ──

function getCard(type, index, cardIndex) {
  switch (type) {
    case 'waste': return state.waste.length ? state.waste[state.waste.length - 1] : null;
    case 'tableau': return state.tableau[index][cardIndex] || null;
    case 'foundation': return state.foundations[index].length ? state.foundations[index][state.foundations[index].length - 1] : null;
  }
  return null;
}

function getDragCards(type, index, cardIndex) {
  if (type === 'tableau') {
    const col = state.tableau[index];
    const cards = [];
    for (let i = cardIndex; i < col.length; i++) {
      if (!col[i].faceUp) break;
      cards.push({...col[i], index: i});
    }
    return cards;
  }
  if (type === 'waste') {
    return state.waste.length ? [state.waste[state.waste.length - 1]] : [];
  }
  return [];
}

// ── Overlay ──

const overlayMessages = {
  win: { title: 'You Win!', subtitle: 'Congratulations! All cards built to foundations.' },
  lose: { title: 'No Moves Left', subtitle: 'There are no more valid moves. Try again!' }
};

function showOverlay(type) {
  const overlay = document.getElementById('win-overlay');
  const msg = overlayMessages[type];
  overlay.querySelector('h1').textContent = msg.title;
  const subtitle = overlay.querySelector('.win-subtitle');
  if (subtitle) subtitle.textContent = msg.subtitle;
  else {
    const sub = document.createElement('p');
    sub.className = 'win-subtitle';
    sub.textContent = msg.subtitle;
    overlay.querySelector('.win-dialog').appendChild(sub);
  }
  overlay.hidden = false;
}

function hideOverlay() {
  document.getElementById('win-overlay').hidden = true;
}

// ── Rendering ──

let selectedCard = null;

function render() {
  renderStock();
  renderWaste();
  renderFoundations();
  renderTableau();
  updateControls();
  updateWinOverlay();
}

function updateWinOverlay() {
  const overlay = document.getElementById('win-overlay');
  overlay.hidden = !(game.won || game.lost);
}

function createCardEl(card) {
  const el = document.createElement('div');
  el.className = 'card';

  if (!card.faceUp) {
    el.classList.add('face-down');
  } else {
    el.classList.add(RED_SUITS.has(card.suit) ? 'red' : 'black', 'face-up');
    const label = VALUE_LABELS[card.value] || String(card.value);
    const sym = SUIT_SYMBOLS[card.suit];
    el.innerHTML = `
      <div class="card-corner card-corner-top">${label}<span class="card-suit">${sym}</span></div>
      <div class="card-center">${sym}</div>
      <div class="card-corner card-corner-bottom">${label}<span class="card-suit">${sym}</span></div>`;
  }

  el.dataset.suit = card.suit;
  el.dataset.value = card.value;
  return el;
}

function renderStock() {
  const el = document.getElementById('stock');
  el.innerHTML = '';
  el.className = 'pile-slot stock' + (state.stock.length === 0 ? ' empty' : '');
  if (state.stock.length > 0) {
    const back = document.createElement('div');
    back.className = 'card face-down';
    back.style.position = 'relative';
    back.style.cursor = 'pointer';
    el.appendChild(back);
  }
}

function renderWaste() {
  const el = document.getElementById('waste');
  el.innerHTML = '';
  if (state.waste.length === 0) return;

  // Show only the top card
  const card = state.waste[state.waste.length - 1];
  const el2 = createCardEl(card);
  el2.style.position = 'relative';
  el2.dataset.source = 'waste';
  el2.dataset.cardIndex = state.waste.length - 1;
  el.appendChild(el2);
}

function renderFoundations() {
  for (let i = 0; i < 4; i++) {
    const el = document.getElementById(`foundation-${i}`);
    el.dataset.suit = SUIT_SYMBOLS[FOUNDATION_SUITS[i]];
    el.innerHTML = '';
    const pile = state.foundations[i];
    if (pile.length > 0) {
      const cardEl = createCardEl(pile[pile.length - 1]);
      cardEl.style.position = 'relative';
      cardEl.dataset.source = `foundation-${i}`;
      cardEl.dataset.cardIndex = pile.length - 1;
      el.appendChild(cardEl);
    }
  }
}

function renderTableau() {
  for (let i = 0; i < 7; i++) {
    const container = document.getElementById(`tableau-${i}`);
    container.innerHTML = '';
    const col = state.tableau[i];
    if (col.length === 0) continue;

    for (let j = 0; j < col.length; j++) {
      const cardEl = createCardEl(col[j]);
      cardEl.style.position = 'absolute';
      cardEl.style.top = `${j * 3.5}vmin`;
      cardEl.dataset.source = `tableau-${i}`;
      cardEl.dataset.cardIndex = j;

      if (selectedCard && selectedCard.type === 'tableau' && selectedCard.index === i) {
        const dragCards = getDragCards('tableau', i, selectedCard.cardIndex);
        if (dragCards.includes(j)) cardEl.classList.add('selected');
      }

      container.appendChild(cardEl);
    }
  }
}

function updateControls() {
  document.getElementById('undo-btn').disabled = game.history.length <= 1;
}

// ── Click-to-move ──

function handleCardClick(cardInfo) {
  const { type, index, cardIndex } = cardInfo;
  const card = getCard(type, index, cardIndex);
  if (!card || !card.faceUp) return;

  // Try to auto-move to foundation
  const fIdx = canMoveToFoundation(card);
  if (fIdx !== -1) {
    executeMove({ type, index, cardIndex }, { type: 'foundation', index: fIdx });
    return;
  }

  // Check if card is already selected — deselect
  if (selectedCard && selectedCard.type === type && selectedCard.index === index && selectedCard.cardIndex === cardIndex) {
    selectedCard = null;
    render();
    return;
  }

  // Select this card
  selectedCard = { type, index, cardIndex };
  render();
}

// ── Interaction ──

let dragState = null;

function setupInteraction() {
  document.addEventListener('pointerdown', onPointerDown, { passive: false });
  document.addEventListener('pointermove', onPointerMove, { passive: false });
  document.addEventListener('pointerup', onPointerUp, { passive: false });

  document.getElementById('stock').addEventListener('click', () => {
    if (dragState && dragState.moved) return;
    drawFromStock();
  });

  document.getElementById('new-game').addEventListener('click', () => deal());
  document.getElementById('undo-btn').addEventListener('click', () => undo());
  document.getElementById('play-again').addEventListener('click', () => deal());
}

function findCardEl(target) {
  return target.closest('.card');
}

function parseSource(el) {
  const source = el.dataset.source;
  if (!source) return null;
  if (source === 'waste') return { type: 'waste', index: 0, cardIndex: state.waste.length - 1 };
  if (source.startsWith('foundation-')) {
    const idx = parseInt(source.split('-')[1]);
    return { type: 'foundation', index: idx, cardIndex: state.foundations[idx].length - 1 };
  }
  if (source.startsWith('tableau-')) {
    const idx = parseInt(source.split('-')[1]);
    return { type: 'tableau', index: idx, cardIndex: parseInt(el.dataset.cardIndex) || state.tableau[idx].length - 1 };
  }
  return null;
}

function onPointerDown(e) {
  // Don't intercept clicks on controls or overlay
  if (e.target.closest('.controls') || e.target.closest('.win-overlay') || e.target.closest('#play-again')) return;

  const cardEl = findCardEl(e.target);

  // Clicking empty stock pile
  if (!cardEl && e.target.classList.contains('stock') && state.stock.length === 0) {
    drawFromStock();
    return;
  }
  if (!cardEl) return;

  const source = parseSource(cardEl);
  if (!source) return;

  const card = getCard(source.type, source.index, source.cardIndex);
  if (!card || !card.faceUp) return;

  // Can only drag from tableau or waste
  if (source.type !== 'waste' && source.type !== 'tableau') return;

  e.preventDefault();
  e.stopPropagation();

  // Get the DOM elements for the cards being dragged
  const dragEls = [];
  if (source.type === 'tableau') {
    const indices = getDragCards('tableau', source.index, source.cardIndex);
    for (const selectedCard of indices) {
      const selected = `#tableau-${source.index} .card[data-card-index="${selectedCard.index}"]`;
      const el = document.querySelector(selected);
      if (el) dragEls.push(el);
    }
  } else {
    dragEls.push(cardEl); // use the directly-grabbed element
  }

  // Get the rendered card's bounding rect for offset calculation
  const rect = cardEl.getBoundingClientRect();

  dragState = {
    source,
    cardIndex: source.cardIndex,
    dragEls,
    offsetX: e.clientX - rect.left,
    offsetY: e.clientY - rect.top,
    startX: e.clientX,
    startY: e.clientY,
    moved: false
  };

}

function onPointerMove(e) {
  if (!dragState) return;
  e.preventDefault();

  const dx = e.clientX - dragState.startX;
  const dy = e.clientY - dragState.startY;
  if (Math.abs(dx) + Math.abs(dy) > 10) dragState.moved = true;

  if (!dragState.moved) return;

  // Move the actual DOM cards
  const vmin = Math.min(window.innerWidth, window.innerHeight) / 100;
  const stackGap = vmin * 2.5;

  for (let i = 0; i < dragState.dragEls.length; i++) {
    const el = dragState.dragEls[i];
    el.style.position = 'fixed';
    el.style.left = (e.clientX - dragState.offsetX) + 'px';
    el.style.top = (i === 0 ? e.clientY - dragState.offsetY : e.clientY - dragState.offsetY + i * stackGap) + 'px';
    el.style.zIndex = 1000 + i;
    el.style.pointerEvents = 'none';
    el.classList.add('dragging');
  }

  highlightDropTargets(e.clientX, e.clientY);
}

function onPointerUp(e) {
  if (!dragState) return;

  if (dragState.moved) {
    const target = findDropTarget(e.clientX, e.clientY);
    if (target) {
      const from = {
        type: dragState.source.type,
        index: dragState.source.index,
        cardIndex: dragState.cardIndex
      };
      executeMove(from, target);
    }
  } else {
    // Tap — try click-to-move (auto-move to foundation)
    handleCardClick(dragState.source);
  }

  // Clean up
  dragState = null;
  clearHighlights();
  render();
}

function findDropTarget(x, y) {
  const el = document.elementFromPoint(x, y);
  if (!el) return null;

  const card = getCard(dragState.source.type, dragState.source.index, dragState.cardIndex);
  if (!card) return null;

  // Check tableau drop target
  const tableauEl = el.closest('.tableau');
  if (tableauEl) {
    const colIndex = parseInt(tableauEl.dataset.tableau);
    const col = state.tableau[colIndex];
    if (col.length === 0) {
      if (card.value === 13) return { type: 'tableau', index: colIndex };
    } else {
      const top = col[col.length - 1];
      if (top.faceUp && top.value === card.value + 1 && RED_SUITS.has(top.suit) !== RED_SUITS.has(card.suit)) {
        return { type: 'tableau', index: colIndex };
      }
    }
  }

  // Check foundation drop target
  const foundationEl = el.closest('.foundation');
  if (foundationEl) {
    const fIdx = parseInt(foundationEl.dataset.foundation);
    if (canMoveToFoundation(card) === fIdx) {
      return { type: 'foundation', index: fIdx };
    }
  }

  return null;
}

function highlightDropTargets(x, y) {
  clearHighlights();
  const el = document.elementFromPoint(x, y);
  if (!el) return;

  const card = getCard(dragState.source.type, dragState.source.index, dragState.cardIndex);
  if (!card) return;

  const tableauEl = el.closest('.tableau');
  if (tableauEl) {
    const colIndex = parseInt(tableauEl.dataset.tableau);
    if (isValidTableauMove(card, colIndex)) {
      tableauEl.classList.add('drop-target');
    }
  }

  const foundationEl = el.closest('.foundation');
  if (foundationEl) {
    const fIdx = parseInt(foundationEl.dataset.foundation);
    if (canMoveToFoundation(card) === fIdx) {
      foundationEl.classList.add('drop-target');
    }
  }
}

function clearHighlights() {
  document.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target'));
}

// ── Init ──

function init() {
  setupInteraction();
  deal();
}

// Register service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

init();
