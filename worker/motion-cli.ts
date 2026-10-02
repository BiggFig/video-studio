/** Isolated CLI process: only stripped media environment reaches the browser. */
import { createRequire } from "node:module";
import { dirname,join } from "node:path";
import { pathToFileURL } from "node:url";
import { motionBrowserPath } from "./motion-browser";
const require=createRequire(import.meta.url);
const cli=join(dirname(require.resolve("hyperframes/package.json")),"bin/hyperframes.mjs");
process.env.HYPERFRAMES_BROWSER_PATH=motionBrowserPath();
process.env.HYPERFRAMES_NO_TELEMETRY="1";
process.env.DO_NOT_TRACK="1";
process.env.HYPERFRAMES_SKIP_SKILLS="1";
process.env.HYPERFRAMES_NO_UPDATE_CHECK="1";
process.argv=[process.execPath,cli,...process.argv.slice(2)];
void import(pathToFileURL(cli).href);
