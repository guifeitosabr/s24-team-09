const fs = require('fs');

function createTabGroup(groupName) {
    const data = { tabs: [] };
    const json = JSON.stringify(data);
    fs.writeFileSync(`${groupName}.json`, json);
}

function writeTabsToGroup(groupName, tabObjects) {
    const data = { tabs: tabObjects };
    const json = JSON.stringify(data);
    fs.writeFileSync(`${groupName}.json`, json);
}

function readTabsFromGroup(groupName) {
    try {
        const data = fs.readFileSync(`${groupName}.json`, 'utf8');
        const jsonData = JSON.parse(data);
        return jsonData.tabs;
    } catch (err) {
        console.error(`Error reading tabs from ${groupName}.json:`, err);
        return [];
    }
}

chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "exampleContextMenu", // Unique identifier for the context menu item
        title: "Context Menu", // Text to be displayed in the context menu
        contexts: ["selection"], // Show the context menu item only when text is selected
    });
    
    createTabGroup('defaultTab');
});

