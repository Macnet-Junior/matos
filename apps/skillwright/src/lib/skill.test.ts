import assert from "node:assert/strict";
import test from "node:test";
import { templates, serializeSkill, validateName, validateSkill, mentionedPaths } from "./skill";

test("name rules reject uppercase, edges, and double hyphens", () => {
  assert.equal(validateName("review-a-change"), null);
  assert.match(validateName("Review") ?? "", /lowercase/);
  assert.match(validateName("-review") ?? "", /start or end/);
  assert.match(validateName("review--change") ?? "", /consecutive/);
});

test("serialized skill has quoted description and folder-matching name", () => {
  const draft = templates[1].create();
  const text = serializeSkill(draft);
  assert.match(text, /^---\nname: review-a-change\n/);
  assert.match(text, /description: "Review a code change/);
  assert.match(text, /## Steps/);
  const issues = validateSkill(draft).filter((issue) => issue.level === "error");
  assert.deepEqual(issues, []);
});

test("release template mentions its script and reference", () => {
  const draft = templates[2].create();
  const mentions = mentionedPaths(draft.body);
  assert.ok(mentions.includes("scripts/check-release.sh"));
  assert.ok(mentions.includes("references/release-notes.md"));
  const errors = validateSkill(draft).filter((issue) => issue.level === "error");
  assert.deepEqual(errors, []);
});

test("explicit command emits disable-model-invocation", () => {
  const text = serializeSkill(templates[3].create());
  assert.match(text, /disable-model-invocation: true/);
  assert.match(text, /icon: book-open/);
  assert.match(text, /color: orange/);
});

test("missing description and a bad file path are errors", () => {
  const draft = templates[0].create();
  draft.name = "ok-name";
  draft.description = "";
  draft.files = [{ id: "1", path: "../secret", content: "" }];
  const errors = validateSkill(draft).filter((issue) => issue.level === "error");
  assert.ok(errors.some((issue) => issue.field === "description"));
  assert.ok(errors.some((issue) => issue.field === "files"));
});