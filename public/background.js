const fs = require('fs');

function createTabGroup(groupName) {
    try {
        let data;
        if (fs.existsSync('groups.json')) {
            const existingData = fs.readFileSync('groups.json', 'utf8');
            data = JSON.parse(existingData);
        } else {
            data = {};
        }
        data[groupName] = { tabs: [] };
        fs.writeFileSync('groups.json', JSON.stringify(data));
    } catch (err) {
        console.error(`Error creating tab group ${groupName}:`, err);
    }
}

function writeTabsToGroup(groupName, tabObjects) {
    try {
        const existingData = fs.readFileSync('groups.json', 'utf8');
        const data = JSON.parse(existingData);
        data[groupName].tabs = tabObjects;
        fs.writeFileSync('groups.json', JSON.stringify(data));
    } catch (err) {
        console.error(`Error writing tabs to group ${groupName}:`, err);
    }
}

function readTabsFromGroup(groupName) {
    try {
        const existingData = fs.readFileSync('groups.json', 'utf8');
        const data = JSON.parse(existingData);
        return data[groupName] ? data[groupName].tabs : [];
    } catch (err) {
        console.error(`Error reading tabs from group ${groupName}:`, err);
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

