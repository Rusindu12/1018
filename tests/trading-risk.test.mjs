import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateRisk } from '../trading/risk.js';
test('sizes long positions by risk and caps at available cash',()=>{
  assert.deepEqual(calculateRisk(10000,1,100,90),{budget:100,quantity:10,cost:1000,estimatedLoss:100,capped:false});
  const r=calculateRisk(1000,2,100,99);assert.equal(r.quantity,10);assert.equal(r.cost,1000);assert.equal(r.estimatedLoss,10);assert.equal(r.capped,true);
});
test('rejects invalid or unsafe inputs',()=>{for(const args of [[0,1,100,90],[100,0,100,90],[100,101,100,90],[100,1,100,100],[100,1,100,110],[100,1,100,0],[NaN,1,100,90]])assert.throws(()=>calculateRisk(...args));});
