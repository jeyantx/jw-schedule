import "./_env.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";

// node --test isolates each test file in its own process, so mutating the store
// singleton here does not leak into the other suites.
const { store } = await import("../js/store.js");

test("canReadKind: the owner reads every kind", () => {
  store.congregation = { ownerEmail: "owner@x.com" };
  store.email = "owner@x.com";
  store.permissions = {};
  for (const k of ["clm", "weekend", "av", "cleaning", "fsm", "attendant", "publishers", "groups", "meta"])
    assert.equal(store.canReadKind(k), true, k);
});

test("canReadKind: a member reads a schedule only with a view/edit entry; shared kinds are always readable", () => {
  store.congregation = { ownerEmail: "owner@x.com" };
  store.email = "member@x.com";
  store.permissions = { clm: { view: true }, weekend: { edit: true }, av: {} };
  assert.equal(store.canReadKind("clm"), true);        // explicit view
  assert.equal(store.canReadKind("weekend"), true);    // edit implies read
  assert.equal(store.canReadKind("av"), false);        // entry present but neither flag
  assert.equal(store.canReadKind("fsm"), false);       // no entry at all
  assert.equal(store.canReadKind("cleaning"), false);
  assert.equal(store.canReadKind("publishers"), true); // shared reference data
  assert.equal(store.canReadKind("groups"), true);
  assert.equal(store.canReadKind("meta"), true);
});
