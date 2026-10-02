import { chromium } from "playwright";
import { basename,dirname,join } from "node:path";
import { existsSync } from "node:fs";

/** Use the same browser for independent HTML inspection and Hyperframes export. */
export function motionBrowserPath(){
 if(process.env.HYPERFRAMES_BROWSER_PATH)return process.env.HYPERFRAMES_BROWSER_PATH;
 const regular=chromium.executablePath(),installation=dirname(dirname(regular)),revision=basename(installation).replace(/^chromium-/,"");
 const windowsShell=join(dirname(installation),`chromium_headless_shell-${revision}`,"chrome-headless-shell-win64","chrome-headless-shell.exe");
 return process.platform==="win32"&&existsSync(windowsShell)?windowsShell:regular;
}
/** Relevant rasterization flags match pinned Hyperframes 0.8.97 software capture. */
export const motionBrowserArgs=["--disable-dev-shm-usage","--font-render-hinting=none","--force-color-profile=srgb","--disable-gpu-compositing","--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"];
