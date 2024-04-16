// This function is called when the extension is installed or updated
chrome.runtime.onInstalled.addListener(() => {
  // Create a context menu item
  // See: https://developer.chrome.com/docs/extensions/reference/api/contextMenus#method-create
  chrome.contextMenus.create({
    id: "exampleContextMenu", // Unique identifier for the context menu item
    title: "Context Menu", // Text to be displayed in the context menu
    contexts: ["selection"], // Show the context menu item only when text is selected
  });
});

const loginUrls = {};

function addLoginUrl(linkUrl, loginUrl) {
    loginUrls[linkUrl] = loginUrl;
}

function handleLinkClick(linkUrl) {
    const loginPageUrl = loginUrls[linkUrl];
    if (!loginPageUrl) {
        console.error('Login URL not found for link:', linkUrl);
        return;
    }

    chrome.tabs.create({ url: loginPageUrl }, function(tab) {
        chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
            if (tabId === tab.id && info.status === 'complete') {
                chrome.tabs.sendMessage(tabId, { action: 'login', targetUrl: linkUrl });
                chrome.tabs.onUpdated.removeListener(listener);
            }
        });
    });
}

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'handleLinkClick') {
        handleLinkClick(request.linkUrl);
    }
});
