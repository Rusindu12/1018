import { test } from 'node:test';
import assert from 'node:assert/strict';
import { backtest } from '../trading/backtest.js';
const candles = Array.from({length:120},(_,i)=>({time:i,open:100+i*0.1,close:100+i*0.1+Math.sin(i)*0.2}));
test('backtest produces deterministic finite metrics on chronological data',()=>{
 const a=backtest(candles); assert.deepEqual(a,backtest(candles));
 assert.equal(a.evaluated,20); assert.ok(Number.isFinite(a.finalValue)); assert.ok(a.finalValue>0); assert.ok(a.maxDrawdownPct>=0); assert.ok(a.trades>=0);
});
test('backtest rejects invalid bars and settings',()=>{
 assert.throws(()=>backtest(candles.slice(0,20)));
 assert.throws(()=>backtest(candles,{fee:1}));
 assert.throws(()=>backtest(candles.map((b,i)=>({...b,time:i===15?0:b.time}))));
 assert.throws(()=>backtest(candles.map((b,i)=>({...b,open:i===15?0:b.open}))));
});
