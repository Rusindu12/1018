import { NGramModel, CORPORA, tokenize } from '../core/ngram.js';
import { initNav, revealOnScroll, toast, $ } from '../ui.js';

initNav();
revealOnScroll();

const corpusInput = $('#corpusInput');
const corpusChips = $('#corpusChips');
const trainBtn = $('#trainBtn');
const orderSelect = $('#orderSelect');
const tempRange = $('#tempRange');
const tempVal = $('#tempVal');
const lenRange = $('#lenRange');
const lenVal = $('#lenVal');
const promptInput = $('#promptInput');
const nextChips = $('#nextChips');
const matchedNote = $('#matchedNote');
const generateBtn = $('#generateBtn');
const genOut = $('#genOut');
const genSeedEl = $('#genSeed');
const genTextEl = $('#genText');
const genCursor = $('#genCursor');

const statChars = $('#statChars');
const statVocab = $('#statVocab');
const statContexts = $('#statContexts');
const statBpc = $('#statBpc');
const statOrder = $('#statOrder');

let model = null;
let currentCorpus = 'sinhala';
let typeTimer = null;
let generated = '';
let seedText = '';
let generationMeta = null;

const SEEDS = {
  sinhala: 'අම්මා කුඩා කාලයේ',
  english: 'The first attempts',
  programming: 'function train(',
  custom: 'අපි',
};

function setActiveChip(key) {
  corpusChips.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c.dataset.corpus === key));
}

function loadCorpus(key, { focus = false } = {}) {
  currentCorpus = key;
  setActiveChip(key);
  if (key !== 'custom') {
    corpusInput.value = CORPORA[key].text;
    promptInput.value = SEEDS[key];
  } else if (!corpusInput.value.trim()) {
    corpusInput.value = '';
    promptInput.value = SEEDS.custom;
  }
  if (focus) corpusInput.focus();
  train();
}

corpusChips.querySelectorAll('.chip').forEach((chip) => {
  chip.addEventListener('click', () => loadCorpus(chip.dataset.corpus));
});

const fmt = (n) => Number(n).toLocaleString();

function train({ silent = false } = {}) {
  const text = corpusInput.value;
  const tokens = tokenize(text);
  if (tokens.length < 40) {
    toast('පුහුණුවට අඩුම තරමේ අකුරු 40ක් වත් අවශ්‍යයි');
    return;
  }
  const order = Number(orderSelect.value);
  const cut = Math.floor(tokens.length * 0.85);
  const trainText = tokens.slice(0, cut).join('');
  const heldout = tokens.slice(cut).join('');

  model = new NGramModel({ order });
  model.feed(trainText);
  model.finalize();
  const { bpc } = model.perplexity(heldout);

  statChars.textContent = fmt(model.trainedChars);
  statVocab.textContent = fmt(model.vocabSize);
  statContexts.textContent = fmt(model.contexts);
  statBpc.textContent = bpc ? bpc.toFixed(2) : '–';
  statOrder.textContent = `n = ${order}`;

  updateNext();
  if (!silent) toast(`ආකෘතිය පුහුණු විය · ${fmt(model.trainedChars)} අකුරු · ${bpc.toFixed(2)} bits/char`);
}

function displayChar(ch) {
  if (ch === ' ') return '␣';
  if (ch === '\n') return '↵';
  if (ch === '\t') return '⇥';
  return ch;
}

function updateNext() {
  if (!model) return;
  const context = promptInput.value;
  const { options, matched } = model.next(context, {
    temperature: Number(tempRange.value),
    topK: 6,
  });
  nextChips.innerHTML = '';
  options.forEach(({ ch, p }, i) => {
    const el = document.createElement('span');
    el.className = `next-chip${i === 0 ? ' best' : ''}`;
    el.innerHTML = `<span>${escapeHtml(displayChar(ch))}</span><small>${(p * 100).toFixed(1)}%</small>`;
    nextChips.appendChild(el);
  });
  if (!options.length) {
    nextChips.innerHTML = '<span class="dim" style="font-size:12.5px;">ආදානයක් ලියන්න…</span>';
  }
  matchedNote.textContent = matched
    ? `ගැළපුණු context: අකුරු ${matched}`
    : 'මෙම context එක පුහුණු දත්තවල නැහැ — backoff සිදු වෙනවා';
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function generate() {
  if (!model) return;
  clearInterval(typeTimer);
  const tokens = tokenize(model.trainedChars ? corpusInput.value : '');
  const fallbackSeed = tokens.slice(0, 12).join('');
  const prompt = promptInput.value || fallbackSeed;
  const total = Number(lenRange.value);
  const temperature = Number(tempRange.value);
  const target = Math.max(prompt.length + 40, total);

  generated = model.generate(prompt, target, { temperature });
  if (generated.length <= prompt.length + 4) {
    toast('මෙම context එකෙන් දිගටම ලියන්න දත්ත මදි');
    return;
  }
  seedText = prompt;
  generationMeta = { temperature, order: model.order };

  genSeedEl.textContent = prompt;
  genTextEl.textContent = '';
  genOut.classList.add('typing');
  genCursor.style.display = 'inline-block';

  let i = prompt.length;
  typeTimer = setInterval(() => {
    const step = generated[i] === '\n' ? 1 : 2;
    genTextEl.textContent += generated.slice(i, i + step);
    i += step;
    genOut.scrollTop = genOut.scrollHeight;
    if (i >= generated.length) {
      clearInterval(typeTimer);
      genTextEl.textContent = generated.slice(prompt.length);
      genCursor.style.display = 'none';
      genOut.classList.remove('typing');
    }
  }, 22);
}

generateBtn.addEventListener('click', generate);
trainBtn.addEventListener('click', () => train());

promptInput.addEventListener('input', () => {
  if (typeTimer) {
    clearInterval(typeTimer);
    genCursor.style.display = 'none';
    genOut.classList.remove('typing');
  }
  updateNext();
});

orderSelect.addEventListener('change', () => {
  train({ silent: true });
  toast(`n = ${orderSelect.value} · ආකෘතිය නැවත පුහුණු විය`);
});

tempRange.addEventListener('input', () => {
  tempVal.textContent = Number(tempRange.value).toFixed(2);
  updateNext();
});

lenRange.addEventListener('input', () => {
  lenVal.textContent = `${lenRange.value} අකුරු`;
});

corpusInput.addEventListener('input', () => {
  if (currentCorpus !== 'custom') {
    currentCorpus = 'custom';
    setActiveChip('custom');
  }
});

corpusInput.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    e.preventDefault();
    train();
  }
});

document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && document.activeElement === promptInput) {
    e.preventDefault();
    generate();
  }
});

/* boot */
tempVal.textContent = Number(tempRange.value).toFixed(2);
lenVal.textContent = `${lenRange.value} අකුරු`;
corpusInput.value = CORPORA.sinhala.text;
promptInput.value = SEEDS.sinhala;
train({ silent: true });
genSeedEl.textContent = '';
genTextEl.textContent = '';
