import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decide } from '../bot/strategy.js';
const closes=Array.from({length:100},(_,i)=>100+Math.sin(i)*0.5);
test('existing position exits at configured closed candle thresholds',()=>{
 assert.equal(decide(closes,{entry:200,quantity:1}).side,'SELL');
 assert.equal(decide(closes,{entry:50,quantity:1}).side,'SELL');
});
test('strategy fails closed on invalid data',()=>{
 assert.throws(()=>decide([1,2],null));
 assert.throws(()=>decide([...closes.slice(0,-1),NaN],null));
});
