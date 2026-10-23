# NeuraLab · මොළයක් හදමු

**Three machine-learning experiments that train live in your browser.**
No cloud, no API keys, no pre-trained weights, no runtime dependencies.

```
𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋
01  පියාඹන මොළය      neuroevolution + genetic algorithm
02  අඳින අතේ අංකය    handwritten digits + backpropagation
03  අකුරු අනාවැකි      grapheme-level n-gram language model
𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋𑁋
```

NeuraLab is a small, honest AI laboratory you can read end-to-end. Every byte of training data is
generated in the browser, every weight starts random, and everything you draw or type stays on your
device.

---

## The labs

| # | Lab | What actually happens | Algorithms |
|---|-----|-----------------------|------------|
| 01 | **Flying brain** (පියාඹන මොළය) | 80 drones, each with a 4→8→1 neural network, learn to fly through a fixed gate course. Fitness = distance + gates × 420 + alignment. | elitism, tournament selection, crossover, Gaussian mutation |
| 02 | **Draw a digit** (අඳින අතේ අංකය) | Your stroke becomes a 16×16 normalised ink grid, then a 256→64→32→10 MLP predicts the digit. You can correct it and teach it your own handwriting. | ReLU MLP, softmax, cross-entropy, backprop, Adam |
| 03 | **Next character** (අකුරු අනාවැකි) | A grapheme-level n-gram model learns any Sinhala/English/code corpus you give it and samples continuations at a chosen temperature. | n-grams, backoff, temperature sampling, bits-per-character |

All three are bilingual (Sinhala first, English secondary) and responsive.

## Run it

```bash
npm start            # http://localhost:4173
PORT=8080 npm start  # custom port
```

`server.js` is a ~90-line static file server; no install step is required because there are no
dependencies. You can also open the pages with any static server (`python3 -m http.server`), since all
modules are plain ES modules. Serving over HTTP is required — `file://` blocks module imports.

## Tests

```bash
npm test
```

24 tests cover the numerical core, the simulation, the language model, the digit dataset, a static
link audit, a syntax check of every module, and a real HTTP smoke test of the server.

Highlights:

- the MLP learns a non-linear 3-class problem past 98% accuracy;
- the digit pipeline trains to >80% accuracy in a few seconds;
- the GA population measurably improves its gate record within 14 generations;
- Sinhala is tokenised by grapheme cluster (`ක්` is one token, not two);
- server returns correct MIME types, a real 404, and rejects path traversal.

## How it works

### Neural network (`assets/js/core/mlp.js`)

```text
z[l] = W[l] · a[l−1] + b[l]
a[l] = ReLU(z[l])                    (hidden layers)
ŷ    = softmax(z[L])
L    = −log ŷ[y]                     (cross-entropy)
```

Backpropagation is implemented by hand with `Float32Array` scratch buffers. Adam keeps a first and
second moment per weight, so the digit lab converges in ~12 epochs on 700 synthetic samples. Weights
are initialised with He scaling from a seeded mulberry32 PRNG, which makes every run reproducible.

### Neuroevolution (`assets/js/core/evolution.js`)

Each genome is 49 floats: `(4+1)·8 + (8+1)·1`. The course is generated once per seed and shared by
every generation so the fitness curve is comparable. The next generation is built from the top 10%
unchanged (elitism) plus children of tournament-selected parents, with per-gene crossover and
mutation. A small alignment-shaping term gives the population an early gradient; without it the GA
plateaus for dozens of generations before a lucky mutant appears.

### Digit pipeline (`assets/js/core/digits.js`)

Ten stroke templates are rasterised at 4× supersampling with random rotation, shear, scale, shift and
brush width, then cropped to the ink bounding box and scaled into a 16×16 grid. The drawing canvas is
downsampled through the browser's own area-averaging (`drawImage` into 64×64), converted to ink
density, and normalised the same way. This is why the on-screen preview and the network input match.

### Language model (`assets/js/core/ngram.js`)

Counts of `context → next grapheme` for orders 1–4, with longest-context backoff. Generation samples
from `P(c)^(1/T)`, so temperature below 1 becomes deterministic and above 1 becomes adventurous.
Held-out bits-per-character is measured on the last 15% of the corpus, which is *not* trained on.

Sinhala combining marks are kept together with `Intl.Segmenter` (grapheme clusters), so the model never
emits a broken vowel sign.

## Project structure

```text
.
├── index.html              landing page + animated hero network
├── about.html              the maths, the honesty section, privacy
├── labs/
│   ├── drone.html          lab 01
│   ├── digits.html         lab 02
│   └── text.html           lab 03
├── assets/
│   ├── css/style.css       one design system for all pages
│   └── js/
│       ├── core/           pure, testable logic (no DOM)
│       │   ├── mlp.js      MLP + Adam + softmax
│       │   ├── evolution.js Brain + EvolutionSim + world
│       │   ├── digits.js   glyph synthesis + normalisation
│       │   ├── ngram.js    NGramModel + corpora + tokenizer
│       │   ├── rng.js      mulberry32, Gaussian, shuffle
│       │   └── util.js     clamp/lerp/smoothstep
│       ├── labs/           page controllers
│       ├── ui.js           canvas fitting, charts, toasts, nav
│       ├── home.js         hero animation
│       └── about.js        scroll spy
├── tests/                  node:test suites + HTTP smoke test
└── server.js               zero-dependency static server
```

## Design notes & limitations

- This is **not** a large language model. The digit net has ~18.9k parameters; GPT-class models have
  billions. The point is to see the machinery, not to compete with it.
- Synthetic digits are cleaner than real handwriting. The net generalises well to mouse/touch strokes,
  but unusual writing styles can still confuse it — you can teach it.
- Evolution is stochastic. Different seeds take different numbers of generations; the **turbo** button
  jumps eight generations at once when you want to see a breakthrough quickly.
- The look is deliberately dark, high-contrast and typographic; all fonts fall back gracefully when
  offline (Google Fonts is the only external request, and it is optional).

## Privacy

No analytics, no cookies, no backend. Drawings, text and weights exist only in the page's memory and
disappear on refresh.

## License

Apache License 2.0 — see [LICENSE](LICENSE).
