const { execFileSync } = require('child_process');
const path = require('path');

// We ship with identity: null (no Apple Developer certificate), so
// electron-builder skips its own signing step entirely. That leaves the app
// bundle with a mix of Electron's own prebuilt (already-signed) Helper.app
// binaries plus our unsigned additions — macOS treats that inconsistent mix
// as a broken/tampered signature and refuses to open it ("is damaged" /
// "contains malware"), which is a different failure from the milder
// "unidentified developer" Gatekeeper warning.
//
// Re-signing the whole bundle tree with one consistent ad-hoc signature
// (what a user would otherwise have to do by hand with `codesign --deep`)
// fixes that. It does NOT remove the "unidentified developer" warning —
// that requires a real paid Apple Developer ID + notarization.
module.exports = async function afterSign(context) {
  const { appOutDir, packager, electronPlatformName } = context;
  if (electronPlatformName !== 'darwin') return;

  const appPath = path.join(appOutDir, `${packager.appInfo.productFilename}.app`);

  console.log(`[afterSign] Re-signing ${appPath} with one deep ad-hoc signature`);
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], { stdio: 'inherit' });

  console.log('[afterSign] Verifying signature');
  execFileSync('codesign', ['--verify', '--deep', '--strict', appPath], { stdio: 'inherit' });
};
