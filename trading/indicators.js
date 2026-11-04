// Transparent indicator heuristic. This is not a trained predictive model.
export function indicators(closes) {
  if (closes.length < 21 || closes.some(v => !Number.isFinite(v) || v <= 0)) throw new Error('At least 21 valid closing prices required');
  const last = closes.at(-1), ma = closes.slice(-20).reduce((a,b)=>a+b,0)/20;
  let gains=0, losses=0;
  for(let i=closes.length-14;i<closes.length;i++){const d=closes[i]-closes[i-1];gains+=Math.max(d,0);losses+=Math.max(-d,0)}
  const rsi=losses===0?(gains===0?50:100):100-100/(1+gains/losses);
  const momentum=(last/closes.at(-21)-1)*100;
  const bias=last>ma&&momentum>0?'Upward':last<ma&&momentum<0?'Downward':'Mixed';
  return {ma,rsi,momentum,bias,explanation:`Price is ${last>=ma?'above':'below'} its 20-period average. RSI is ${rsi>=70?'overbought (70+)':rsi<=30?'oversold (30 or below)':'in the middle range'}. These indicators can be wrong and do not predict future prices.`};
}
