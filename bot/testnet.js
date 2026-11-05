// Deliberately hard-wired to Binance Spot Testnet. Never send real funds here.
import { createHmac, randomBytes } from 'node:crypto';
import { open, readFile, rename, unlink, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { decide } from './strategy.js';

const BASE = 'https://testnet.binance.vision';
const SYMBOL = 'BTCUSDT', INTERVAL = '1h', BAR_MS = 3600000;
const dir = resolve(process.env.BOT_STATE_DIR || '.bot-state');
const statePath = resolve(dir, 'state.json'), lockPath = resolve(dir, 'instance.lock');
const execute = process.argv.includes('--testnet-orders');
const key = process.env.BINANCE_TESTNET_API_KEY, secret = process.env.BINANCE_TESTNET_API_SECRET;
const maxQuote = Number(process.env.BOT_ORDER_USDT ?? 20);
const maxDaily = Number(process.env.BOT_MAX_DAILY_ORDERS ?? 3);
if (!Number.isFinite(maxQuote) || maxQuote < 10 || maxQuote > 100 || !Number.isInteger(maxDaily) || maxDaily < 1 || maxDaily > 5) throw new Error('BOT_ORDER_USDT must be 10–100 and BOT_MAX_DAILY_ORDERS must be 1–5');
if (execute && (!key || !secret)) throw new Error('Testnet API key and secret are required for --testnet-orders');
await mkdir(dir, { recursive: true, mode: 0o700 });
let lock;
try { lock = await open(lockPath, 'wx', 0o600); await lock.writeFile(`${process.pid}\n`); }
catch { throw new Error('Another instance may be running, or a previous lock remains. Verify no bot is running before removing instance.lock.'); }
let exiting = false;
async function cleanup() { if (exiting) return; exiting = true; await lock.close(); await unlink(lockPath).catch(()=>{}); }
for (const sig of ['SIGINT','SIGTERM']) process.once(sig, () => { console.log('Stopping after current operation.'); stopping = true; });
let stopping = false;
let state;
try { state = JSON.parse(await readFile(statePath,'utf8')); }
catch (e) { if (e.code !== 'ENOENT') { await cleanup(); throw new Error('Cannot read bot state; inspect it before proceeding.'); } state={ version:1, position:null, pending:null, lastCandle:0, day:'', orders:0 }; }
if (state.version !== 1 || !Number.isFinite(state.lastCandle) || !Number.isInteger(state.orders) || state.orders < 0 || (state.position && (!Number.isFinite(state.position.quantity) || state.position.quantity <= 0 || !Number.isFinite(state.position.entry) || state.position.entry <= 0))) { await cleanup(); throw new Error('Invalid bot state; inspect and reconcile manually.'); }
async function save() { const tmp=statePath+'.tmp'; await writeFile(tmp,JSON.stringify(state,null,2),{mode:0o600}); await rename(tmp,statePath); }
async function request(path, params = {}, signed = false, method = 'GET') {
  const qs = new URLSearchParams(params);
  if (signed) { qs.set('timestamp',String(Date.now())); qs.set('recvWindow','5000'); qs.set('signature',createHmac('sha256',secret).update(qs.toString()).digest('hex')); }
  const controller = new AbortController(); const timer = setTimeout(()=>controller.abort(),10000);
  try {
    const response=await fetch(BASE+path+'?'+qs,{method,headers:signed?{'X-MBX-APIKEY':key}:{},signal:controller.signal});
    const body=await response.json();
    if(!response.ok) throw new Error(`Binance HTTP ${response.status}: ${String(body.msg || 'request failed')}`);
    return body;
  } finally { clearTimeout(timer); }
}
function floorQuantity(value, step) {
  const digits=(step.split('.')[1]||'').replace(/0+$/,'').length, unit=Number(step);
  if (!unit || !Number.isFinite(value)) throw new Error('Invalid quantity filter');
  return (Math.floor((value + unit*1e-9)/unit)*unit).toFixed(digits);
}
async function cycle() {
  if (state.pending) throw new Error('Unresolved order in state. Stop and reconcile it on Binance Testnet before manually clearing pending.');
  const bars=await request('/api/v3/klines',{symbol:SYMBOL,interval:INTERVAL,limit:'200'});
  if (!Array.isArray(bars)) throw new Error('Invalid candle response');
  const completed=bars.filter(x=>Number(x[6]) < Date.now());
  if(completed.length<70) throw new Error('Not enough closed candles');
  const last=completed.at(-1), closeTime=Number(last[6]);
  if (!Number.isFinite(closeTime) || Date.now()-closeTime > BAR_MS*2 || closeTime > Date.now()) throw new Error('Stale or invalid candles');
  if(closeTime<=state.lastCandle) return;
  const closes=completed.map(x=>Number(x[4]));
  const signal=decide(closes,state.position);
  console.log(`${new Date().toISOString()} ${SYMBOL} ${signal.side}; ${signal.reason}; AI score ${(signal.model.probability*100).toFixed(1)}%; holdout ${(signal.model.accuracy*100).toFixed(1)}% vs baseline ${(signal.model.baseline*100).toFixed(1)}%`);
  if (!execute || signal.side==='HOLD') { state.lastCandle=closeTime; await save(); return; }
  const day=new Date().toISOString().slice(0,10);
  if(state.day!==day) { state.day=day; state.orders=0; }
  if(state.orders>=maxDaily && signal.side==='BUY') { console.log('Daily order limit reached; no new position opened.'); state.lastCandle=closeTime; await save(); return; }
  let params={symbol:SYMBOL,side:signal.side,type:'MARKET',newOrderRespType:'FULL',newClientOrderId:'ml'+randomBytes(12).toString('hex')};
  if(signal.side==='BUY') params.quoteOrderQty=maxQuote.toFixed(2);
  else {
    const info=await request('/api/v3/exchangeInfo',{symbol:SYMBOL});
    const symbol=info.symbols?.[0], filter=symbol?.filters?.find(f=>f.filterType==='LOT_SIZE');
    if(!filter || symbol.status!=='TRADING') throw new Error('Exchange quantity filters unavailable');
    params.quantity=floorQuantity(state.position.quantity,filter.stepSize);
    if(Number(params.quantity)<Number(filter.minQty)) throw new Error('Position is below minimum lot size; reconcile manually.');
  }
  // Persist before submission: any ambiguous outcome requires explicit human reconciliation.
  state.pending={clientOrderId:params.newClientOrderId,side:params.side,candle:closeTime}; await save();
  const order=await request('/api/v3/order',params,true,'POST');
  const qty=Number(order.executedQty), quote=Number(order.cummulativeQuoteQty);
  if(order.status!=='FILLED' || !Number.isFinite(qty) || qty<=0 || !Number.isFinite(quote) || quote<=0 || !Array.isArray(order.fills)) throw new Error('Order not fully confirmed; reconcile pending order manually.');
  if(signal.side==='BUY') {
    const baseFees=order.fills.filter(f=>f.commissionAsset==='BTC').reduce((n,f)=>n+Number(f.commission),0);
    if(!Number.isFinite(baseFees)||baseFees>=qty) throw new Error('Invalid fills; reconcile pending order manually.');
    state.position={quantity:qty-baseFees,entry:quote/qty};
  } else state.position=null; // A sub-step dust balance can remain on the exchange.
  state.orders++; state.lastCandle=closeTime; state.pending=null; await save();
  console.log(`Testnet ${signal.side} filled. Client order ID: ${params.newClientOrderId}`);
}
try {
  console.log(`Market Lens bot: ${execute?'TESTNET ORDERS ENABLED':'DRY RUN'}; BTCUSDT 1h; max ${maxQuote} USDT per buy; max ${maxDaily} orders/day before blocking new buys (exits remain enabled). Not a live trading service.`);
  do { try { await cycle(); } catch(e) { console.error('Bot halted:',e.message); break; } if(!stopping) await new Promise(r=>setTimeout(r,60000)); } while(!stopping);
} finally { await cleanup(); }
