const fs = require('fs');

async function initialize() {
    await initializeDatabase();    
}

async function initializeDatabase() {
    const dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open('tabGroupsDB', 1);
        request.onerror = (event) => {
            reject('Error opening database');
        };
        request.onsuccess = (event) => {
            resolve(event.target.result);
        };
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            const groupStore = db.createObjectStore('tabGroups', { keyPath: 'name' });
            db.createObjectStore('tabs', { keyPath: 'id', autoIncrement: true })
                .createIndex('group', 'group');
        };
    });
}

const dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open('tabGroupsDB', 1);
    request.onerror = (event) => {
        reject('Error opening database');
    };
    request.onsuccess = (event) => {
        resolve(event.target.result);
    };
    request.onupgradeneeded = (event) => {
        const db = event.target.result;
        const groupStore = db.createObjectStore('tabGroups', { keyPath: 'name' });
        db.createObjectStore('tabs', { keyPath: 'id', autoIncrement: true })
            .createIndex('group', 'group');
    };
});

async function createTabGroup(groupName) {
    try {
        const db = await dbPromise;
        const tx = db.transaction('tabGroups', 'readwrite');
        const store = tx.objectStore('tabGroups');
        await store.add({ name: groupName });
        await tx.complete;
    } catch (err) {
        console.error(`Error creating tab group ${groupName}:`, err);
    }
}

async function writeTabsToGroup(groupName, tabObjects) {
    try {
        const db = await dbPromise;
        const tx = db.transaction(['tabs', 'tabGroups'], 'readwrite');
        const tabStore = tx.objectStore('tabs');
        const groupStore = tx.objectStore('tabGroups');
        await tabStore.clear();
        await groupStore.clear();
        await Promise.all(tabObjects.map(tab => {
            return tabStore.add({ ...tab, group: groupName });
        }));
        await groupStore.put({ name: groupName });
        await tx.complete;
    } catch (err) {
        console.error(`Error writing tabs to group ${groupName}:`, err);
    }
}

async function readTabsFromGroup(groupName) {
    try {
        const db = await dbPromise;
        const tx = db.transaction('tabs', 'readonly');
        const index = tx.objectStore('tabs').index('group');
        const range = IDBKeyRange.only(groupName);
        const cursor = await index.openCursor(range);
        const tabs = [];
        cursor.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                tabs.push(cursor.value);
                cursor.continue();
            }
        };
        await tx.complete;
        return tabs;
    } catch (err) {
        console.error(`Error reading tabs from group ${groupName}:`, err);
        return [];
    }
}


chrome.runtime.onInstalled.addListener(() => {
    initialize();
});

