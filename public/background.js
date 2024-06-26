// OPENAI Stuff

let OpenAI_API_KEY = ''

const SIMILARITY_THRESHOLD = 0.3;

const tabEmbeddings = {}; 

async function calculateEmbedding(content) {

    const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OpenAI_API_KEY}`
        },
        body: JSON.stringify({ input: content, model: "text-embedding-3-small" })
    });

    try {

        if (!response.ok) {
            throw new Error('Failed to calculate embedding');
        }

        const data = await response.json();

        return data.data[0].embedding;
    } catch (error) {
        console.error('Error calculating embedding:', error);
        return null;
    }
}

async function calculateSimilarity(embedding1, embedding2) {
    if (!embedding1 || !embedding2) return 0;

    const similarity = embedding1.reduce((acc, val, i) => acc + val * embedding2[i], 0);

    return similarity;
}


async function groupTabsByContent(tabObjects) {
    try {
        const similarityScores = {};

        for (const tab of tabObjects) {
            const content = tab.title
            const embedding = await calculateEmbedding(content);
            tabEmbeddings[tab.title] = embedding;
            similarityScores[tab.title] = [];
        }

        for (let i = 0; i < tabObjects.length; i++) {
            const tab1 = tabObjects[i];
            for (let j = i + 1; j < tabObjects.length; j++) {
                const tab2 = tabObjects[j];
                const similarity = await calculateSimilarity(tabEmbeddings[tab1.title], tabEmbeddings[tab2.title]);
                similarityScores[tab1.title].push({ title: tab2.title, similarity });
                similarityScores[tab2.title].push({ title: tab1.title, similarity });
            }
        }

        const groups = [];
        const visited = {};
        for (const tab of tabObjects) {
            if (!visited[tab.title]) {
                const group = [tab];
                visited[tab.title] = true;
                const queue = [tab];
                while (queue.length > 0) {
                    const currentTab = queue.shift();
                    for (const neighbor of similarityScores[currentTab.title]) {
                        if (!visited[neighbor.title] && neighbor.similarity > SIMILARITY_THRESHOLD) {
                            group.push(tabObjects.find(t => t.title === neighbor.title));
                            visited[neighbor.title] = true;
                            queue.push(tabObjects.find(t => t.title === neighbor.title));
                        }
                    }
                }
                groups.push(group);
            }
        }

        return groups;
    } catch (error) {
        console.error('Error grouping tabs by title:', error);
        return [];
    }
}

async function suggestedGroupName(tabObjects) {
    try {

        const tabTitles = tabObjects.map(tab => tab.title);

        const prompt = `Provide an appropriate name (whatever you do make sure you don't return an empty string) for a Chrome tab group consisting of the following tabs:\n${tabTitles.join('\n')}\n`;

        const completion = await fetch('https://api.openai.com/v1/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OpenAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-3.5-turbo-instruct",
                prompt: prompt,
                max_tokens: 50,
                temperature: 0.4,
            }),
        });

        const data = await completion.json();

        const l = (data.choices[0].text).length

        const generatedName = (data.choices[0].text).substring(2, l - 1);

        return generatedName;
    } catch (error) {
        console.error('Error generating suggested group name:', error);
        return 'Unnamed Group';
    }
}

/*
async function groupCurrentTabs() {
    const tabs = await chrome.tabs.query({});
    const tabObjects = tabs.map(tab => ({ title: tab.title, url: tab.url }));
    return await groupTabsByContent(tabObjects);
}
*/

// IndexedDB Stuff
let dbPromise = initializeDatabase();

async function initializeDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('tabGroupsDB', 1);
        request.onerror = (event) => {
            reject('Error opening database');
        };
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('tabGroups')) {
                db.createObjectStore('tabGroups', { keyPath: 'name' });
            }
            if (!db.objectStoreNames.contains('tabs')) {
                db.createObjectStore('tabs', { keyPath: 'id', autoIncrement: true }).createIndex('group', 'group');
            }
        };
        request.onsuccess = (event) => {
            resolve(event.target.result);
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

async function fetchAndProcessContent(url) {
    try {
        const content = await new Promise((resolve, reject) => {
            chrome.scripting.executeScript({
                target: { tabId: sender.tab.id },
                function: window.extractContentFromURL,
                args: [url]
            }, results => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError.message);
                } else {
                    resolve(results[0].result);
                }
            });
        });
        // Perform further processing with the content
    } catch (error) {
        console.error('Error fetching and processing content:', error);
    }
}

const operations = {  

    async getApiKey() {
        return OpenAI_API_KEY;
    },

    async setApiKey(key) {
        OpenAI_API_KEY = key.key;
        return key;
    },

    /*
    groupCurrentTabs: async () => {
        return await groupCurrentTabs();
    },
    */

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

            console.log(`Read tabs from ${groupName}`)
    
            return tabs;
        } catch (err) {
            console.error(`Error reading tabs from group ${groupName}:`, err);
            return [];
        }
    },
    
    async writeTabsToGroup(data) {
            
        try {
            const existingTabs = await this.readTabsFromGroup(data.groupName);

            const db = await dbPromise;
            const tx = db.transaction(['tabs', 'tabGroups'], 'readwrite');
            const tabStore = tx.objectStore('tabs');
            const groupStore = tx.objectStore('tabGroups');
            
            const newTabs = data.tabObjects.filter((tab, index, self) => {
                const isUniqueInTabObjects = self.findIndex(t => t.url === tab.url) === index;
                const isDuplicate = existingTabs.some(existingTab => existingTab.url === tab.url);        
                return isUniqueInTabObjects && !isDuplicate;
            });

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

            await Promise.all(newTabs.map(tab => {
                return tabStore.put({ ...tab, group: data.groupName });
            }));
            
            await groupStore.put({ name: data.groupName, tabs: uniqueCombinedTabs });
            await tx.complete;

            console.log(`Tabs successfully added to ${data.groupName}.`);

    
        } catch (err) {
            console.log(err)
            console.log(`Tabs NOT added to ${data.groupName}.`);
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
          const store = tx.objectStore('tabs');
          const tabs = [];
      
          await new Promise((resolve, reject) => {
            const cursorRequest = store.openCursor();
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

      async getAllGroups() {
        try {
            const tabObjects = await this.getAllTabsFromDatabase();
    
            const groups = {};
    
            tabObjects.forEach(tab => {
                if (!groups[tab.group]) {
                    groups[tab.group] = [];
                }
                groups[tab.group].push({ title: tab.title, url: tab.url });
            });
    
            const formattedGroups = Object.keys(groups).map(groupName => ({
                groupName: groupName,
                tabs: groups[groupName]
            }));
    
            return formattedGroups;
        } catch (error) {
            console.error('Error getting formatted groups list:', error);
            return [];
        }
    },

      async getSuggestedTabGroups() {
        const tabObjects = await this.getAllTabsFromDatabase()

        if (tabObjects.length === 0) {
            return;
        }
        else {
            try {
                const groups = await groupTabsByContent(tabObjects.map(tab => ({ title: tab.title, url: tab.url })));
                const filteredGroups = groups.filter(group => group.length > 1);
                const groupedTabs = filteredGroups.map(async (group, index) => {
                    const name = await suggestedGroupName(group);
                    return {
                        groupName: name,
                        tabs: group
                    };
                });
        
                return await Promise.all(groupedTabs);
            } catch (error) {
                throw new Error('Error:', error);
            }
        }
    },

    async getSuggestedOpenTabs() {
        const tabObjects = await chrome.tabs.query({});

        if (tabObjects.length === 0) {
            return;
        }
        else {
            try {
                const groups = await groupTabsByContent(tabObjects.map(tab => ({ title: tab.title, url: tab.url })));
                const filteredGroups = groups.filter(group => group.length > 1);
                const groupedTabs = filteredGroups.map(async (group, index) => {
                    const name = await suggestedGroupName(group);
                    return {
                        groupName: name,
                        tabs: group
                    };
                });
        
                return await Promise.all(groupedTabs);
            } catch (error) {
                throw new Error('Error:', error);
            }
        }
    },

    async removeGroup(groupName) {
        const db = await dbPromise; // Ensure you have access to the IndexedDB instance
        const tx = db.transaction(['tabGroups', 'tabs'], 'readwrite'); // Start a transaction that involves both stores
        const groupStore = tx.objectStore('tabGroups');
        const tabStore = tx.objectStore('tabs');
        const tabIndex = tabStore.index('group'); // Assuming you have an index by 'group'
    
        try {
            // Delete the group
            await groupStore.delete(groupName);
    
            // Check and delete tabs only associated with this group
            const range = IDBKeyRange.only(groupName);
            const cursorRequest = tabIndex.openCursor(range);
            cursorRequest.onsuccess = async event => {
                const cursor = event.target.result;
                if (cursor) {
                    const tab = cursor.value;
                    // Check if this tab belongs to any other group
                    const checkCursorRequest = tabStore.openCursor();
                    let isUniqueToGroup = true;
                    checkCursorRequest.onsuccess = event => {
                        const checkCursor = event.target.result;
                        if (checkCursor) {
                            if (checkCursor.value.url === tab.url && checkCursor.value.group !== groupName) {
                                isUniqueToGroup = false;
                            }
                            checkCursor.continue();
                        }
                    };
                    await tx.complete; // Wait for all checks to complete
                    if (isUniqueToGroup) {
                        cursor.delete(); // Delete the tab if only linked to the removed group
                    }
                    cursor.continue(); // Move to the next tab
                }
            };
    
            await tx.complete; // Ensure all operations are completed before resolving
            console.log(`Group '${groupName}' has been removed successfully. Associated tabs checked and removed if unique.`);
        } catch (error) {
            console.error(`Error removing group '${groupName}':`, error);
            throw error; // Throw error so that it can be caught by the message listener
        }
    },

    async renameGroup(names) {
        const oldName = names.oldName;
        const newName = names.newName;
        console.log(oldName);
        console.log(newName);
        const db = await dbPromise;
    
        try {
            const tx = db.transaction(['tabGroups', 'tabs'], 'readwrite');
            const groupStore = tx.objectStore('tabGroups');
            const tabStore = tx.objectStore('tabs');
    
            // Rename the group in the tabGroups store
            const group = await groupStore.get(oldName);
            console.log('group:', group);
    
            if (group) {
                await groupStore.delete(oldName);
                await groupStore.add({ ...group, name: newName });
            } else {
                console.error(`Group with name ${oldName} not found.`);
                return;
            }
    
            // Fetch all tabs within the same transaction
            const tabs = await new Promise((resolve, reject) => {
                const request = tabStore.getAll();
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
    
            // Update tabs within the same transaction
            for (const tab of tabs) {
                if (tab.group === oldName) {
                    tab.group = newName;
                    await tabStore.put(tab);
                }
            }
    
            await tx.complete;
            console.log(`Group '${oldName}' renamed to '${newName}' successfully.`);
        } catch (err) {
            console.error(`Error renaming group from '${oldName}' to '${newName}':`, err);
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


async function getAllTabsFromDatabase() {
    try {
      const db = await dbPromise;
      const tx = db.transaction('tabs', 'readonly');
      const store = tx.objectStore('tabs');
      const tabs = [];
  
      await new Promise((resolve, reject) => {
        const cursorRequest = store.openCursor();
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