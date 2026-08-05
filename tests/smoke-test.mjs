import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import vm from "node:vm";

const root = resolve(import.meta.dirname, "..");
const manifest = JSON.parse(await readFile(resolve(root, "manifest.json"), "utf8"));

assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.action.default_popup, "popup.html");
assert.deepEqual(manifest.permissions, ["storage"]);
assert.equal(manifest.host_permissions, undefined);
assert.ok(manifest.content_scripts[0].matches.includes("https://www.youtube.com/*"));
assert.deepEqual(manifest.content_scripts[0].js, ["shared.js", "content.js"]);
assert.equal(manifest.icons["128"], "icons/icon-v2-128.png");

for (const path of ["shared.js", "popup.html", "popup.css", "popup.js", "content.css", "content.js", "tests/player-harness.html"]) {
  const source = await readFile(resolve(root, path), "utf8");
  assert.ok(source.length > 100, `${path} ne doit pas être vide`);
}

for (const size of [16, 32, 48, 128]) {
  const icon = await readFile(resolve(root, `icons/icon-v2-${size}.png`));
  assert.equal(icon.subarray(1, 4).toString(), "PNG", `L’icône ${size}px doit être un PNG`);
}

const contentSource = await readFile(resolve(root, "content.js"), "utf8");
assert.match(contentSource, /playbackRate = speed/);
assert.match(contentSource, /storage\.sync\.set[\s\S]*\.catch\(/);
assert.match(contentSource, /void init\(\)\.catch\(/);

const popupSource = await readFile(resolve(root, "popup.js"), "utf8");
assert.match(popupSource, /void init\(\)\.catch\(/);
assert.match(popupSource, /Communication avec l’onglet YouTube impossible/);

const errors = [];
const context = { console: { error: (message) => errors.push(message) } };
vm.runInNewContext(await readFile(resolve(root, "shared.js"), "utf8"), context);
assert.equal(context.TurboTube.normalizeSpeed(-1), 0.25);
assert.equal(context.TurboTube.normalizeSpeed(99), 16);
assert.equal(context.TurboTube.normalizeSpeed("3.333"), 3.33);
assert.equal(context.TurboTube.formatSpeed(1.5), "1.5");
assert.equal(context.TurboTube.normalizeSettings({ step: 99, rememberSpeed: false }).step, 4);
assert.equal(context.TurboTube.normalizeSettings({ step: 99, rememberSpeed: false }).rememberSpeed, false);
context.TurboTube.reportError("test", new Error("échec contrôlé"));
assert.deepEqual(errors, ["[TurboTube] test: échec contrôlé"]);

console.log("TurboTube smoke test: OK");
