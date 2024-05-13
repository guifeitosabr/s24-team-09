const { getSuggestedTabGroups } = require('./openai.js');


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

    const existingTabs = await readTabsFromGroup(groupName);

    try {
        const db = await dbPromise;
        const tx = db.transaction(['tabs', 'tabGroups'], 'readwrite');
        const tabStore = tx.objectStore('tabs');
        const groupStore = tx.objectStore('tabGroups');

        const newTabs = tabObjects.filter((tab, index, self) => {
            const isUniqueInTabObjects = self.findIndex(t => t.url === tab.url) === index;
            const isDuplicate = existingTabs.some(existingTab => existingTab.url === tab.url);        
            return isUniqueInTabObjects && !isDuplicate;
        });

        await Promise.all(newTabs.map(tab => {
            return tabStore.put({ ...tab, group: groupName });
        }));

        const combinedTabs = existingTabs.concat(newTabs);

        const uniqueUrls = new Set();

        const uniqueCombinedTabs = combinedTabs.filter(tab => {
            if (!uniqueUrls.has(tab.url)) {
                uniqueUrls.add(tab.url);
                return true;
            } else {
                return false;
            }
        });
        
        
        await groupStore.put({ name: groupName, tabs: uniqueCombinedTabs });
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
        const tabs = [];

        await new Promise((resolve, reject) => {
            const cursorRequest = index.openCursor(range);
            cursorRequest.onerror = () => {
                reject(cursorRequest.error);
            };
            cursorRequest.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    tabs.push(cursor.value);
                    cursor.continue();
                } else {
                    resolve();
                }
            };
        });

        return tabs;
    } catch (err) {
        console.error(`Error reading tabs from group ${groupName}:`, err);
        return [];
    }
}

async function emptyGroup(groupName) {
    try {
        const tabs = await readTabsFromGroup(groupName);
        const db = await dbPromise;
        const tx = db.transaction('tabs', 'readwrite');
        const store = tx.objectStore('tabs');

        await Promise.all(tabs.map(tab => {
            return new Promise((resolve, reject) => {
                const request = store.delete(tab.id);
                request.onsuccess = resolve;
                request.onerror = reject;
            });
        }));

        console.log(`All tabs removed from group ${groupName}`);
    } catch (err) {
        console.error(`Error removing tabs from group ${groupName}:`, err);
    }
}

async function removeTabFromGroup(groupName, tabObject) {
    try {
        const db = await dbPromise;
        const tx = db.transaction('tabs', 'readwrite');
        const store = tx.objectStore('tabs');
        const index = store.index('group');
        const range = IDBKeyRange.only(groupName);
        const cursorRequest = index.openCursor(range);

        await new Promise((resolve, reject) => {
            cursorRequest.onerror = () => {
                reject(cursorRequest.error);
            };
            cursorRequest.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    const tab = cursor.value;
                    if (tab.url === tabObject.url && tab.title === tabObject.title) {
                        cursor.delete();
                    }
                    cursor.continue();
                } else {
                    resolve();
                }
            };
        });
    } catch (err) {
        console.error(`Error removing tab ${tabObject.title} from group ${groupName}:`, err);
    }
}

async function getAllGroupNames() {
    try {
        const db = await dbPromise;
        const tx = db.transaction('tabGroups', 'readonly');
        const store = tx.objectStore('tabGroups');
        const groupNames = [];

        await new Promise((resolve, reject) => {
            const cursorRequest = store.openCursor();
            cursorRequest.onerror = () => {
                reject(cursorRequest.error);
            };
            cursorRequest.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    groupNames.push(cursor.key);
                    cursor.continue();
                } else {
                    resolve();
                }
            };
        });

        return groupNames;
    } catch (err) {
        console.error('Error getting group names:', err);
        return [];
    }
}

async function getAllTabsFromDatabase() {
    try {
        const db = await dbPromise;
        const tx = db.transaction('tabs', 'readonly');
        const index = tx.objectStore('tabs').index('group');
        const range = IDBKeyRange.only(groupName);
        const tabs = [];

        await new Promise((resolve, reject) => {
            const cursorRequest = index.openCursor(range);
            cursorRequest.onerror = () => {
                reject(cursorRequest.error);
            };
            cursorRequest.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    tabs.push(cursor.value);
                    cursor.continue();
                } else {
                    resolve();
                }
            };
        });

        return tabs;
    } catch (err) {
        console.error(`Error reading tabs from database:`, err);
        return [];
    }
}


async function getSuggestions() {
    try {
        const tabObjects = await getAllTabsFromDatabase();
        const tabGroups = await getSuggestedTabGroups(tabObjects);
        return tabGroups;
    } catch (error) {
        console.error('Error getting suggested tab groups:', error);
        return [];
    }
}


chrome.runtime.onInstalled.addListener(() => {
    console.log('Extension installed or updated. Initializing...');
    initialize();
});

chrome.runtime.onStartup.addListener( () => {
    console.log(`Here`);
});

