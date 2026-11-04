// Small logistic regression trained only on earlier candles; the final examples are held out.
// This is an experimental classifier, not a trading recommendation.
function features(c, i) {
  const mean = c.slice(i - 9, i + 1).reduce((a,b) => a+b, 0) / 10;
  return [(c[i]/c[i-1]-1)*100, (c[i]/c[i-5]-1)*100, (c[i]/mean-1)*100];
}
function sigmoid(x) { return 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, x)))); }
export function trainModel(closes) {
  if (closes.length < 70 || closes.some(v => !Number.isFinite(v) || v <= 0)) throw new Error('At least 70 valid closes are required');
  const examples = [];
  for (let i = 10; i < closes.length - 1; i++) examples.push({ x: features(closes,i), y: Number(closes[i+1] > closes[i]) });
  const split = Math.floor(examples.length * 0.8), training = examples.slice(0,split), test = examples.slice(split);
  const means = [0,1,2].map(j => training.reduce((sum,e)=>sum+e.x[j],0)/training.length);
  const scales = means.map((m,j)=>Math.sqrt(training.reduce((sum,e)=>sum+(e.x[j]-m)**2,0)/training.length)||1);
  const vector = x => [1,...x.map((v,j)=>(v-means[j])/scales[j])];
  const weights = [0,0,0,0];
  const predict = x => sigmoid(vector(x).reduce((sum,v,j)=>sum+v*weights[j],0));
  for(let epoch=0;epoch<250;epoch++) {
    const gradient=[0,0,0,0];
    for(const e of training) { const x=vector(e.x), error=predict(e.x)-e.y; x.forEach((v,j)=>gradient[j]+=error*v); }
    weights.forEach((w,j)=>{weights[j]-=0.08*(gradient[j]/training.length+(j ? 0.01*w : 0));});
  }
  const correct=test.filter(e => (predict(e.x)>=0.5) === Boolean(e.y)).length;
  const majorityUp = training.filter(e => e.y === 1).length >= training.length / 2;
  const baseline = test.filter(e => Boolean(e.y) === majorityUp).length / test.length;
  return { probability: predict(features(closes,closes.length-1)), accuracy: correct/test.length, baseline, majorityUp, trainCount: training.length, testCount: test.length };
}
