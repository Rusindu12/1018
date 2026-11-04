import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trainModel } from '../trading/model.js';
test('model trains with chronological holdout and returns finite scores',()=>{
  const data=Array.from({length:100},(_,i)=>100+i*0.1+Math.sin(i));
  const result=trainModel(data);
  assert.equal(result.trainCount,71); assert.equal(result.testCount,18);
  assert.ok(result.probability>=0&&result.probability<=1);
  assert.ok(result.accuracy>=0&&result.accuracy<=1);
  assert.deepEqual(result,trainModel(data));
});
test('model rejects invalid inputs',()=>{assert.throws(()=>trainModel([1,2]));assert.throws(()=>trainModel(Array(70).fill(NaN)))});
