// Copies the CMS bundle from the installed package into the built admin folder, so the editor is
// served from the site itself at the version pinned in package.json (no CDN).
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
const src = "node_modules/@sveltia/cms/dist/sveltia-cms.js";
mkdirSync("dist/admin", { recursive: true });
copyFileSync(src, "dist/admin/sveltia-cms.js");
const v = JSON.parse(readFileSync("node_modules/@sveltia/cms/package.json", "utf8")).version;
console.log("cms bundle copied, version " + v);
