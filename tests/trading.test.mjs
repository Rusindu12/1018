import { test } from 'node:test';
import assert from 'node:assert/strict';
import { indicators } from '../trading/indicators.js';
test('indicator calculations and trends',()=>{let x=indicators(Array.from({length:21},(_,i)=>100+i));assert.equal(x.bias,'Upward');assert.equal(x.rsi,100);assert.equal(x.ma,110.5);assert.ok(Math.abs(x.momentum-20)<1e-10);let y=indicators(Array.from({length:21},(_,i)=>120-i));assert.equal(y.bias,'Downward');assert.equal(y.rsi,0);assert.equal(indicators(Array(21).fill(1)).rsi,50)});
test('rejects insufficient or invalid prices',()=>{assert.throws(()=>indicators([1,2]));assert.throws(()=>indicators(Array(21).fill(0)))});
