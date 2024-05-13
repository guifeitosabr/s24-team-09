let dbPromise;

// OPENAI STUFF
let OpenAI_API_KEY = ''

function setApiKey(key) {
    OpenAI_API_KEY = key;
}

const SIMILARITY_THRESHOLD = 0.5;

async function extractContentFromURL(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('Failed to fetch content from URL');
        }
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const paragraphs = doc.querySelectorAll('p');
        const contentUnfiltered = Array.from(paragraphs)
            .slice(0, 10)
            .map(p => p.textContent)
            .join(' ');
        const words = contentUnfiltered.split(/\s+/);
        const content = words.slice(0, 100).join(' ');
        return content;
    } catch (error) {
        console.error('Error extracting content from URL:', error);
        return null;
    }
}

const tabEmbeddings = {}; 

async function calculateEmbedding(content) {
    try {
        const response = await fetch('https://api.openai.com/v1/engines/text-embedding-ada-002/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OpenAI_API_KEY}`
            },
            body: JSON.stringify({
                prompt: content,
                max_tokens: 1
            })
        });
        if (!response.ok) {
            throw new Error('Failed to calculate embedding');
        }
        const data = await response.json();
        return data.choices[0].text;
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
            const content = await extractContentFromURL(tab.url);
            const embedding = await calculateEmbedding(content);
            tabEmbeddings[tab.url] = embedding;
            similarityScores[tab.url] = [];
        }

        for (let i = 0; i < tabObjects.length; i++) {
            const tab1 = tabObjects[i];
            for (let j = i + 1; j < tabObjects.length; j++) {
                const tab2 = tabObjects[j];
                const similarity = await calculateSimilarity(tabEmbeddings[tab1.url], tabEmbeddings[tab2.url]);
                similarityScores[tab1.url].push({ url: tab2.url, similarity });
                similarityScores[tab2.url].push({ url: tab1.url, similarity });
            }
        }

        const groups = [];
        const visited = {};
        for (const tab of tabObjects) {
            if (!visited[tab.url]) {
                const group = [tab];
                visited[tab.url] = true;
                const queue = [tab];
                while (queue.length > 0) {
                    const currentTab = queue.shift();
                    for (const neighbor of similarityScores[currentTab.url]) {
                        if (!visited[neighbor.url] && neighbor.similarity > SIMILARITY_THRESHOLD) {
                            group.push(tabObjects.find(t => t.url === neighbor.url));
                            visited[neighbor.url] = true;
                            queue.push(tabObjects.find(t => t.url === neighbor.url));
                        }
                    }
                }
                groups.push(group);
            }
        }

        return groups;
    } catch (error) {
        console.error('Error grouping tabs by content:', error);
        return [];
    }
}

async function suggestedGroupName(tabObjects) {
    try {

        const tabTitles = tabObjects.map(tab => tab.title);

        const prompt = `Provide an appropriate name for a Chrome tab group consisting of the following tabs:\n${tabTitles.join('\n')}\n`;

        const response = await fetch('https://api.openai.com/v1/engines/davinci/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OpenAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "text-davinci-003",
                prompt: prompt,
                context: context,
                max_tokens: 100
            })
        });

        const generatedName = completion.choices[0].text.trim();

        return generatedName;
    } catch (error) {
        console.error('Error generating suggested group name:', error);
        return 'Unnamed Group';
    }
}

async function getSuggestedTabGroups(tabObjects) {
    try {
        const groups = await groupTabsByContent(tabObjects);
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
    
    
    async getSuggestions() {
        try {
            const tabObjects = await this.getAllTabsFromDatabase();
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
