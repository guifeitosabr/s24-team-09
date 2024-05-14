let dbPromise;

// OPENAI Stuff

let OpenAI_API_KEY = ''

function setApiKey(key) {
    OpenAI_API_KEY  = key;
}

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

    console.log(similarity)
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

        console.log(data.choices[0].text)

        console.log(prompt)

        const generatedName = data.choices[0].text

        return generatedName;
    } catch (error) {
        console.error('Error generating suggested group name:', error);
        return 'Unnamed Group';
    }
}

// IndexedDB Stuff

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
        console.log('Content:', content);
        // Perform further processing with the content
    } catch (error) {
        console.error('Error fetching and processing content:', error);
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
            const tabObjects = await getAllTabsFromDatabase();
    
            const groups = {};
    
            tabObjects.forEach(tab => {
                if (!groups[tab.group]) {
                    groups[tab.group] = [];
                }
                groups[tab.group].push({ title: tab.title, url: tab.url });
            });
    
            const formattedGroups = Object.keys(groups).map(groupName => ({
                name: groupName,
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
                        name: name,
                        tabs: group
                    };
                });
        
                return await Promise.all(groupedTabs);
            } catch (error) {
                throw new Error('Error:', error);
            }
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
