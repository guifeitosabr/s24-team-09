let dbPromise;

async function initializeDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('tabGroupsDB', 1);
        request.onerror = (event) => {
            reject('Error opening database');
        };
        request.onsuccess = (event) => {
            resolve(event.target.result);
        };
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            db.createObjectStore('tabGroups', { keyPath: 'name' });
            db.createObjectStore('tabs', { keyPath: 'id', autoIncrement: true })
                .createIndex('group', 'group');
        };
    });
}

async function initialize() {
    try {
        const db = await initializeDatabase();
        dbPromise = Promise.resolve(db);
        console.log('Database initialized.');
    } catch (error) {
        console.error('Error initializing database:', error);
    }
}

const operations = {

    async createTabGroup(data) {
        try {
            const db = await dbPromise;
            const tx = db.transaction('tabGroups', 'readwrite');
            const store = tx.objectStore('tabGroups');
            await store.add({ name: data.name });
            await tx.complete;
            console.log(`Tab group ${data.name} created successfully.`);
        } catch (err) {
            console.error(`Error creating tab group ${data.name}:`, err);
        }
    },
    
    async writeTabsToGroup(data) {
    
        const existingTabs = await readTabsFromGroup(data.groupName);
    
        try {
            const db = await dbPromise;
            const tx = db.transaction(['tabs', 'tabGroups'], 'readwrite');
            const tabStore = tx.objectStore('tabs');
            const groupStore = tx.objectStore('tabGroups');
    
            const newTabs = data.tabObjects.filter((tab, index, self) => {
                const isUniqueInTabObjects = self.findIndex(t => t.url === tab.url) === index;
                const isDuplicate = existingTabs.some(existingTab => existingTab.url === tab.url);        
                return isUniqueInTabObjects && !isDuplicate;
            });
    
            await Promise.all(newTabs.map(tab => {
                return tabStore.put({ ...tab, group: data.groupName });
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
            
            
            await groupStore.put({ name: data.groupName, tabs: uniqueCombinedTabs });
            await tx.complete;
    
    
        } catch (err) {
            console.error(`Error writing tabs to group ${data.groupName}:`, err);
        }
    },
    
    
    async readTabsFromGroup(groupName) {
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
    },
    
    async removeTabFromGroup(data) {
        try {
            const db = await dbPromise;
            const tx = db.transaction('tabs', 'readwrite');
            const store = tx.objectStore('tabs');
            const index = store.index('group');
            const range = IDBKeyRange.only(data.groupName);
            const cursorRequest = index.openCursor(range);
    
            await new Promise((resolve, reject) => {
                cursorRequest.onerror = () => {
                    reject(cursorRequest.error);
                };
                cursorRequest.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (cursor) {
                        const tab = cursor.value;
                        if (tab.url === data.tabObject.url && tab.title === data.tabObject.title) {
                            cursor.delete();
                        }
                        cursor.continue();
                    } else {
                        resolve();
                    }
                };
            });
        } catch (err) {
            console.error(`Error removing tab ${data.tabObject.title} from group ${data.groupName}:`, err);
        }
    },
    
    async getAllGroupNames() {
        try {
            const db = await dbPromise;
            if (!db) {
                throw new Error('Database not initialized.');
            }
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
    },
    
    async getAllTabsFromDatabase() {
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
    },
    
    
    async getSuggestions() {
        try {
            const tabObjects = await getAllTabsFromDatabase();
            const tabGroups = await getSuggestedTabGroups(tabObjects);
            return tabGroups;
        } catch (error) {
            console.error('Error getting suggested tab groups:', error);
            return [];
        }
    }
}


chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (operations[request.action]) {
        operations[request.action](request.data)
            .then(result => sendResponse({ result }))
            .catch(error => sendResponse({ error: error.message }));
        return true; 
    }
});

chrome.runtime.onInstalled.addListener(() => {
    console.log('Extension installed or updated. Initializing...');
    initialize();
});

chrome.runtime.onStartup.addListener(() => {
    console.log('Extension started.');
});
