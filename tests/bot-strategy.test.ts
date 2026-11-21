import assert from "node:assert/strict";
import { test } from "node:test";
import { getAffordableOrderQuantity } from "../app/utils/bot-strategy";

const btcRules = {
  base_dp: 5,
  base_tick: 0.00001,
  base_min: 0.00001,
  min_notional: 10,
};

test("order quantity rounds down to fit the allocation including fees", () => {
  const price = 60_294.4;
  const marginPerNotional = 1.0005;
  const allocation = 50;
  const targetNotional = allocation / marginPerNotional;

  const quantity = getAffordableOrderQuantity(
    targetNotional,
    price,
    btcRules,
    allocation,
    marginPerNotional,
  );

  if (quantity === null) assert.fail("Expected an affordable order quantity");
  assert.equal(quantity, 0.00082);
  assert.ok(quantity * price * marginPerNotional <= allocation);
});

test("order sizing returns no quantity when the minimum exceeds the allocation", () => {
  const rules = {
    base_dp: 2,
    base_tick: 0.01,
    base_min: 0.01,
    min_notional: 10,
  };

  assert.equal(getAffordableOrderQuantity(9, 100, rules, 9, 1), null);
});

test("order sizing still honors exchange minimums when the allocation permits", () => {
  const rules = {
    base_dp: 2,
    base_tick: 0.01,
    base_min: 0.01,
    min_notional: 10,
  };

  assert.equal(getAffordableOrderQuantity(5, 100, rules, 10, 1), 0.1);
});
