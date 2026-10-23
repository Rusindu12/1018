// Character-level n-gram language model. Trains in milliseconds, shows the
// next-character distribution live and can generate text at a chosen
// "temperature" — a compact, honest look at how statistical LMs work.
const segmenter =
  typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null;

/** Split into grapheme clusters where supported (crucial for Sinhala). */
export function tokenize(text) {
  if (segmenter) return Array.from(segmenter.segment(text), (s) => s.segment);
  return Array.from(text);
}

const splitChars = tokenize;

export class NGramModel {
  constructor({ order = 3 } = {}) {
    this.order = order;
    this.counts = new Map(); // context string -> Map(char -> count)
    this.totals = new Map();
    this.chars = new Set();
    this.trainedChars = 0;
  }

  /** Add a document to the model. Call finalize() after the last document. */
  feed(text) {
    const chars = splitChars(text);
    if (chars.length === 0) return;
    for (let i = 0; i < chars.length; i += 1) {
      this.chars.add(chars[i]);
      for (let k = 1; k <= this.order; k += 1) {
        if (i - k < 0) break;
        const ctx = chars.slice(i - k, i).join('');
        const bucket = this.counts.get(ctx) || new Map();
        bucket.set(chars[i], (bucket.get(chars[i]) || 0) + 1);
        this.counts.set(ctx, bucket);
        this.totals.set(ctx, (this.totals.get(ctx) || 0) + 1);
      }
    }
    this.trainedChars += chars.length;
  }

  finalize() {
    this.vocab = Array.from(this.chars);
    this.vocabSize = this.vocab.length;
    this.contexts = this.counts.size;
    this.tokens = this.trainedChars;
    return this;
  }

  /** Backoff distribution: longest matching context wins. */
  distribution(context) {
    const chars = splitChars(context);
    for (let k = Math.min(this.order, chars.length); k >= 1; k -= 1) {
      const ctx = chars.slice(chars.length - k).join('');
      const bucket = this.counts.get(ctx);
      if (bucket && bucket.size) {
        const total = this.totals.get(ctx);
        const probs = [];
        for (const [ch, count] of bucket) probs.push({ ch, p: count / total });
        probs.sort((a, b) => b.p - a.p);
        return { probs, matched: k };
      }
    }
    const uniform = this.vocab.map((ch) => ({ ch, p: 1 / this.vocabSize }));
    return { probs: uniform, matched: 0 };
  }

  next(context, { temperature = 1, topK = 5 } = {}) {
    const { probs, matched } = this.distribution(context);
    const weighted = probs.map(({ ch, p }) => ({ ch, p: Math.pow(p, 1 / Math.max(temperature, 0.05)) }));
    const total = weighted.reduce((s, d) => s + d.p, 0);
    for (const d of weighted) d.p /= total;
    return { options: weighted.slice(0, topK), matched };
  }

  /** Sample a continuation, seeded by optional prompt. */
  generate(prompt = '', length = 180, { temperature = 1, rng = Math.random } = {}) {
    let out = splitChars(prompt);
    const contextLen = Math.min(this.order, 3);
    while (out.length < length) {
      const context = out.slice(-contextLen).join('');
      const { probs } = this.distribution(context);
      let r = rng();
      let chosen = probs[probs.length - 1]?.ch;
      // Temperature-scaled sampling.
      const weighted = probs.map(({ ch, p }) => ({ ch, p: Math.pow(p, 1 / Math.max(temperature, 0.05)) }));
      const total = weighted.reduce((s, d) => s + d.p, 0);
      let acc = 0;
      for (const d of weighted) {
        acc += d.p / total;
        if (r <= acc) {
          chosen = d.ch;
          break;
        }
      }
      out.push(chosen);
      if (out.length > length * 3) break;
    }
    return out.join('');
  }

  /** Bits-per-character on held-out text (lower is better). */
  perplexity(text, { laplace = 0.1 } = {}) {
    const chars = splitChars(text);
    let bits = 0;
    let n = 0;
    for (let i = 0; i < chars.length; i += 1) {
      const context = chars.slice(Math.max(0, i - this.order), i).join('');
      const { probs } = this.distribution(context);
      const entry = probs.find((d) => d.ch === chars[i]);
      const p = entry ? Math.max(entry.p, laplace / 1000) : laplace / 1000;
      bits += -Math.log2(p);
      n += 1;
    }
    return { bpc: n ? bits / n : 0, chars: n };
  }
}

export const CORPORA = {
  sinhala: {
    label: 'සිංහල',
    text: `අම්මා කුඩා කාලයේ මට කී කතාවක් මතකයි. ගමේ කුඩා පිටියක් මැද පිට්ටනියක් තිබුණා. එහි සෙල්ලම් කරන ළමයින් ගැන අම්මා නිතරම කතා කළා.
එක් දිනක් කුඩා කුරුල්ලෙක් ගසින් වැටී අඬමින් සිටියා. ඔහු තවම ඉගෙන ගනිමින් සිටි අතර පියාපත් තවම ශක්තිමත් වී නොතිබුණි. ළමයින් ඔහු වටා එකතු වී බැලූහ. ඔවුන් ඔහුට උදව් කිරීමට උත්සාහ කළා.
මුත්තා එතැනට ඇවිත් කීවා, කුඩා කුරුල්ලාට උදව් කරන්නට ඕන නම්, ඔහුට තමන්ගේ පියාපත් භාවිතා කිරීමට ඉඩ දෙන්න. අපි ඔහු වෙනුවට පියාඹන්න බැහැ.
ළමයින් එය තේරුම් ගත්තා. ඔවුන් ටිකෙන් ටික ඈතට වී බැලූහ. කුඩා කුරුල්ලා නැවත නැවත උත්සාහ කළා. අවසානයේ ඔහු පියාපත් සෙලවී අහසට නැගුණා.
එදා සිට මම ඉගෙන ගත්තේ එක් දෙයකි. උදව් කිරීම යනු අන් අය වෙනුවට කර දීම නොවේ. ඔවුන්ගේ ශක්තිය වැඩි දියුණු කිරීමට ඉඩ දීමයි.
අද මම ගමට යන විට ඒ පිට්ටනිය දකිනවා. එහි දරුවන් සෙල්ලම් කරනවා. ඔවුන් අතරින් කෙනෙක් අහස දෙස බලා සිනාසෙනවා. මට හිතෙනවා ඒ කුඩා කුරුල්ලා තවමත් අහසේ ඉන්නවා විය හැකියි කියලා.
ඔහු අහසේ ඉන්නවා නම්, ඔහුට තවමත් ළමයින් මතක් වෙනවා ඇති. අපි කවදාවත් ඔහුට උදව් කළේ නැහැ කියලා ඔහු දුක් වෙනවා නම්, ඒක අපේ වරදක් නොවේ. අපි ඔහුට තමන්ගේ මග හොයාගන්න ඉඩ දුන්නා.
ගමේ පාරේ පන්සලක් තියෙනවා. පන්සලේ ලොකු බෝ ගසක් තියෙනවා. ගස යට හිටපු හාමුදුරුවෝ කුඩා කාලයේ මට ලියන්න උගන්වලා තියෙනවා. ඒ දවස්වල පොත් අඩුයි. ඒත් ලියන්න ඕන කම වැඩියි.
අපි හැම දෙනාම එකට එකතු වෙලා කතන්දර ලිව්වා. සමහර කතා හිනා ගියා. සමහර කතා ගැඹුරු වුණා. ඒත් හැම කතාවකුත් අපේම වුණා.
දැන් මම නගරයේ ඉන්නවා. උදේට බස් එකේ යනකොට, ජනේලයෙන් ඈත පිට්ටනි පේනවා. ඒ පිට්ටනිවල ගහලා සෙල්ලම් කරන ළමයි පේනවා. ඔවුන්ව දකිනකොට මට අපේ කුඩා පිට්ටනිය මතක් වෙනවා.
මම හිතනවා, අපි ලොකු වුණත්, ඇතැම් දේවල් වෙනස් වෙන්නේ නැහැ කියලා. උදව් කරන හිත, අහස දෙස බලන කුතුහලය, ලියන ආසාව — ඒවා තවමත් එහෙමමයි.
එහෙව්වා නම්, අපි මේ ලෝකය තව ටිකක් ලස්සන කරන්න පුළුවන්. කුඩා දේවලින් පටන් ගන්න. කුඩා කුරුල්ලාට උදව් කරන්න. කුඩා කතාවක් ලියන්න. කුඩා හිනාවක් හිනා වෙන්න. ඒවා තමයි ඇති වටිනා.`,
  },
  english: {
    label: 'English',
    text: `A small laboratory sat at the edge of the town, and inside it a machine was learning to speak. Nobody had told it what words meant; it only knew that some letters liked to follow other letters. Every morning the researcher fed it another page of stories, and every afternoon it tried to write one of its own.
The first attempts were nonsense, but they were beautiful nonsense. It wrote about a river that remembered the names of birds, and about a door that opened only for people who had forgotten something. The researcher began to suspect that meaning was not something you could pour into a machine. Perhaps it grew, like moss on a stone, wherever attention lingered long enough.
Outside, the town carried on with its ordinary business. The baker argued with the wind, the postman memorised every dog, and the children invented a game that had no rules at all. None of them knew that a machine was reading their stories, quietly learning which words came next.
One evening the machine wrote a sentence nobody had ever written before. It was not wise and it was not true, but it was unmistakably new. The researcher read it twice, laughed, and turned off the lights.
The next morning she brought a new notebook. She wrote down every sentence the machine produced, and beside each one she drew a tiny star. The stars were not for accuracy. They were for surprise, which is a rarer thing.
By the end of the month the notebook was full. The machine had written about weather, about bridges, about the peculiar sadness of empty train stations. It had also written several hundred sentences about cheese. The researcher did not mind. She had learned that a mind, even a small one, needs room to be strange.
Years later, long after the laboratory closed, people still told the story. They said a machine had once learned to write by reading stories at the edge of a town. And they said that when it finally wrote something true, the whole room smelled faintly of rain.`,
  },
  programming: {
    label: 'Code',
    text: `export class Network {
  constructor(sizes, seed = 1337) {
    this.sizes = sizes;
    this.weights = sizes.slice(1).map((n, i) => init(n, sizes[i], seed + i));
  }

  forward(input) {
    let a = input;
    for (let l = 0; l < this.weights.length; l++) {
      a = this.weights[l].map((row, o) => relu(dot(row, a) + this.biases[l][o]));
    }
    return softmax(a);
  }

  train(batch, learningRate) {
    const gradients = this.backward(batch);
    for (const [name, grad] of Object.entries(gradients)) {
      this[name] = this[name].map((v, i) => v - learningRate * grad[i]);
    }
  }
}

const model = new Network([256, 64, 32, 10]);
const data = generateDataset(700);
for (let epoch = 0; epoch < 12; epoch++) {
  for (const batch of chunks(data, 32)) {
    model.train(batch, 0.0016);
  }
  console.log('epoch', epoch, 'loss', model.loss(data));
}`,
  },
};
