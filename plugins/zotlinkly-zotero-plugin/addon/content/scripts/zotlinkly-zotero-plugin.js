(function () {
  const Cc = Components.classes;
  const Ci = Components.interfaces;
  const state = {
    cursor: 0,
    observerId: null,
    serverSocket: null,
    port: Services.prefs.getIntPref(
      "extensions.zotero.zotlinkly-zotero-plugin.bridge.port",
      23121,
    ),
  };

  function bumpCursor() {
    state.cursor += 1;
  }

  function registerNotifier() {
    if (state.observerId != null) {
      return;
    }
    if (!Zotero.Notifier || !Zotero.Notifier.registerObserver) {
      return;
    }
    state.observerId = Zotero.Notifier.registerObserver(
      {
        notify() {
          bumpCursor();
        },
      },
      ["item", "collection", "tag"],
      "zotlinkly-zotero-plugin",
    );
  }

  function unregisterNotifier() {
    if (state.observerId == null) {
      return;
    }
    if (Zotero.Notifier && Zotero.Notifier.unregisterObserver) {
      Zotero.Notifier.unregisterObserver(state.observerId);
    }
    state.observerId = null;
  }

  async function getAllItems() {
    const items = await Zotero.Items.getAll(1, false);
    return Array.isArray(items) ? items : Array.from(items || []);
  }

  async function listItems(params) {
    const limit = params.limit || undefined;
    return (await getAllItems())
      .filter((item) => item && item.isRegularItem && item.isRegularItem())
      .slice(0, limit)
      .map(serializeItem);
  }

  function getItem(itemKey) {
    const item = Zotero.Items.getByLibraryAndKey(1, itemKey);
    if (!item) {
      throw new Error(`Item not found: ${itemKey}`);
    }
    return serializeItem(item);
  }

  async function listAttachments(itemKey) {
    const parent = itemKey ? Zotero.Items.getByLibraryAndKey(1, itemKey) : null;
    const attachmentIDs = parent
      ? parent.getAttachments()
      : (await getAllItems())
          .filter((item) => item && item.isAttachment && item.isAttachment())
          .map((item) => item.id);

    return attachmentIDs
      .map((id) => Zotero.Items.get(id))
      .filter(Boolean)
      .map(serializeAttachment);
  }

  function getAttachmentFilePath(attachmentKey) {
    const attachment = Zotero.Items.getByLibraryAndKey(1, attachmentKey);
    if (!attachment) {
      throw new Error(`Attachment not found: ${attachmentKey}`);
    }
    return {
      attachmentKey,
      path: attachment.getFilePath ? attachment.getFilePath() : null,
    };
  }

  async function listNotes(itemKey) {
    const parent = itemKey ? Zotero.Items.getByLibraryAndKey(1, itemKey) : null;
    const noteIDs = parent
      ? parent.getNotes()
      : (await getAllItems())
          .filter((item) => item && item.isNote && item.isNote())
          .map((item) => item.id);

    return noteIDs
      .map((id) => Zotero.Items.get(id))
      .filter(Boolean)
      .map((item) => ({
        key: item.key,
        parentItem: item.parentKey,
        title: item.getDisplayTitle(),
        note: item.getNote(),
      }));
  }

  async function listAnnotations(itemKey) {
    const rows = [];
    const candidateAttachments = itemKey
      ? (Zotero.Items.getByLibraryAndKey(1, itemKey)?.getAttachments() || [])
      : (await getAllItems())
          .filter((item) => item && item.isAttachment && item.isAttachment())
          .map((item) => item.id);

    for (const attachmentID of candidateAttachments) {
      const attachment = Zotero.Items.get(attachmentID);
      if (!attachment || !attachment.getAnnotations) {
        continue;
      }
      for (const annotation of attachment.getAnnotations()) {
        rows.push({
          key: annotation.key,
          parentItem: attachment.parentKey,
          parentAttachment: attachment.key,
          annotationText: annotation.annotationText || "",
          comment: annotation.annotationComment || "",
          color: annotation.annotationColor || "",
          pageLabel: annotation.annotationPageLabel || "",
        });
      }
    }
    return rows;
  }

  function getCollections() {
    return Zotero.Collections.getByLibrary(1).map((collection) => ({
      key: collection.key,
      name: collection.name,
    }));
  }

  function getTags() {
    return Zotero.Tags.getAll(1).map((tag) => ({
      tag: tag.tag,
      type: tag.type,
    }));
  }

  function serializeItem(item) {
    const creators = item.getCreators().map((creator) => ({
      firstName: creator.firstName || "",
      lastName: creator.lastName || "",
      creatorType: creator.creatorType || "",
    }));
    const tags = item.getTags().map((tag) => ({
      tag: tag.tag,
      type: tag.type,
    }));
    const collections = item.getCollections()
      .map((collectionID) => {
        const collection = Zotero.Collections.get(collectionID);
        return collection ? { key: collection.key, name: collection.name } : null;
      })
      .filter(Boolean);

    return {
      key: item.key,
      title: item.getField("title"),
      abstractNote: item.getField("abstractNote"),
      date: item.getField("date"),
      publicationTitle: item.getField("publicationTitle"),
      creators,
      tags,
      collections,
      hasAttachments: item.numAttachments && item.numAttachments() > 0,
      hasNotes: item.numNotes && item.numNotes() > 0,
    };
  }

  function serializeAttachment(item) {
    return {
      key: item.key,
      parentItem: item.parentKey,
      title: item.getDisplayTitle(),
      path: item.getFilePath ? item.getFilePath() : null,
      contentType: item.attachmentContentType || "",
    };
  }

  async function handleRpc(payload) {
    const method = payload.method;
    const params = payload.params || {};

    switch (method) {
      case "ping":
        return { status: "ok" };
      case "get_change_cursor":
        return { cursor: state.cursor };
      case "list_items":
        return await listItems(params);
      case "get_item":
        return getItem(params.itemKey);
      case "list_attachments":
        return await listAttachments(params.itemKey);
      case "get_attachment_file_path":
        return getAttachmentFilePath(params.attachmentKey);
      case "list_notes":
        return await listNotes(params.itemKey);
      case "list_annotations":
        return await listAnnotations(params.itemKey);
      case "get_collections":
        return getCollections();
      case "get_tags":
        return getTags();
      case "get_library_snapshot":
        return {
          items: await listItems({}),
          attachments: await listAttachments(),
          notes: await listNotes(),
          annotations: await listAnnotations(),
          collections: getCollections(),
          tags: getTags(),
        };
      default:
        throw new Error(`Unknown RPC method: ${method}`);
    }
  }

  function startHttpServer() {
    if (state.serverSocket) {
      return;
    }
    state.serverSocket = Cc["@mozilla.org/network/server-socket;1"].createInstance(
      Ci.nsIServerSocket,
    );
    state.serverSocket.init(state.port, true, -1);
    state.serverSocket.asyncListen({
      onSocketAccepted(_server, transport) {
        handleTransport(transport);
      },
      onStopListening() {},
    });
  }

  function stopHttpServer() {
    if (!state.serverSocket) {
      return;
    }
    try {
      state.serverSocket.close();
    } catch (_error) {
    }
    state.serverSocket = null;
  }

  async function handleTransport(transport) {
    const input = transport.openInputStream(0, 0, 0);
    const output = transport.openOutputStream(0, 0, 0);
    const scriptable = Cc["@mozilla.org/scriptableinputstream;1"].createInstance(
      Ci.nsIScriptableInputStream,
    );
    scriptable.init(input);
    let requestText = "";
    let attempts = 0;

    while (attempts < 100) {
      const available = input.available();
      if (available > 0) {
        requestText += scriptable.read(available);
        if (requestText.indexOf("\r\n\r\n") !== -1) {
          const contentLengthMatch = requestText.match(/Content-Length:\s*(\d+)/i);
          const contentLength = contentLengthMatch ? parseInt(contentLengthMatch[1], 10) : 0;
          const bodyIndex = requestText.indexOf("\r\n\r\n") + 4;
          if (requestText.length - bodyIndex >= contentLength) {
            break;
          }
        }
      } else {
        attempts += 1;
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    }

    const bodyIndex = requestText.indexOf("\r\n\r\n");
    const body = bodyIndex === -1 ? "" : requestText.slice(bodyIndex + 4);
    let responseText = buildHttpResponse(404, { error: { message: "Not found" } });

    try {
      const requestLine = requestText.split("\r\n")[0] || "";
      if (/POST\s+\/rpc\s+HTTP\/1\.[01]/.test(requestLine)) {
        const payload = JSON.parse(body || "{}");
        const result = await handleRpc(payload);
        responseText = buildHttpResponse(200, { result });
      }
    } catch (error) {
      responseText = buildHttpResponse(500, {
        error: {
          message: error && error.message ? error.message : String(error),
        },
      });
    }

    output.write(responseText, responseText.length);
    output.close();
    scriptable.close();
    input.close();
  }

  function buildHttpResponse(status, payload) {
    const body = JSON.stringify(payload);
    const statusText =
      status === 200 ? "OK" : status === 404 ? "Not Found" : "Internal Server Error";
    return (
      `HTTP/1.1 ${status} ${statusText}\r\n` +
      "Content-Type: application/json; charset=utf-8\r\n" +
      `Content-Length: ${body.length}\r\n` +
      "Connection: close\r\n\r\n" +
      body
    );
  }

  Zotero.ZotLinkly = {
    hooks: {
      async onStartup() {
        startHttpServer();
        registerNotifier();
      },
      async onMainWindowLoad(window) {},
      async onMainWindowUnload(window) {},
      async onShutdown() {
        unregisterNotifier();
        stopHttpServer();
      },
    },
  };
})();
