var chromeHandle;
var zotLinklyContext;

function install(data, reason) {}

async function startup({ id, version, resourceURI, rootURI }, reason) {
  var aomStartup = Components.classes[
    "@mozilla.org/addons/addon-manager-startup;1"
  ].getService(Components.interfaces.amIAddonManagerStartup);
  var manifestURI = Services.io.newURI(rootURI + "manifest.json");
  chromeHandle = aomStartup.registerChrome(manifestURI, [
    ["content", "zotlinkly-zotero-plugin", rootURI + "content/"],
  ]);

  zotLinklyContext = {
    Components,
    Services,
    Zotero,
    rootURI,
  };
  zotLinklyContext._globalThis = zotLinklyContext;

  Services.scriptloader.loadSubScript(
    `${rootURI}/content/scripts/zotlinkly-zotero-plugin.js`,
    zotLinklyContext,
  );
  await Zotero.ZotLinkly.hooks.onStartup();
}

async function onMainWindowLoad({ window }, reason) {
  await Zotero.ZotLinkly?.hooks.onMainWindowLoad(window);
}

async function onMainWindowUnload({ window }, reason) {
  await Zotero.ZotLinkly?.hooks.onMainWindowUnload(window);
}

async function shutdown({ id, version, resourceURI, rootURI }, reason) {
  await Zotero.ZotLinkly?.hooks.onShutdown();

  if (reason === APP_SHUTDOWN) {
    return;
  }

  if (chromeHandle) {
    chromeHandle.destruct();
    chromeHandle = null;
  }

  zotLinklyContext = null;
}

async function uninstall(data, reason) {}
