const axios = require('axios');
const cheerio = require('cheerio');
const openai = require('openai');

const OpenAI_API_KEY = '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';

const openAI = new openai.OpenAI({
    apiKey: OpenAI_API_KEY
});

const SIMILARITY_THRESHOLD = 0.5;

async function extractContentFromURL(url) {
    try {
        const response = await axios.get(url);
        const html = response.data;
        const $ = cheerio.load(html);

        const contentUnfiltered = $('p').slice(0, 10).text();

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
        const embeddings = await openAI.embeddings.create({
            model: "text-embedding-ada-002",
            input: [content],
            encoding_format: "float",
        });
        return embeddings.data[0].embedding;
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

        const completion = await openAI.completions.create({
            model: "gpt-3.5-turbo-instruct",
            prompt: prompt,
            max_tokens: 50, 
            temperature: 0.7, 
            top_p: 1, 
            frequency_penalty: 0, 
            presence_penalty: 0, 
            stop: '\n' 
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


module.exports = {
    getSuggestedTabGroups,
};


// Testing out 

/*
const tabObjects = [
    { url: 'https://www.wikipedia.org', title: 'Wikipedia' },
    { url: 'https://www.nytimes.com', title: 'NY Times' },
    { url: 'https://www.bbc.com', title: 'BBC' },
    { url: 'https://www.reddit.com', title: 'Reddit' },
    { url: 'https://www.stackoverflow.com', title: 'Stack Overflow' },
    { url: 'https://www.github.com', title: 'GitHub' },
    { url: 'https://www.netflix.com', title: 'Netflix' },
    { url: 'https://www.amazon.com', title: 'Amazon' },
    { url: 'https://www.apple.com', title: 'Apple' },
    { url: 'https://www.spotify.com', title: 'Spotify' }
];

async function testGetSuggestedTabGroups() {
    try {
        const suggestedGroups = await getSuggestedTabGroups(tabObjects);
        console.log('Suggested Tab Groups:');
        console.log(suggestedGroups);
    } catch (error) {
        console.error('Error in test:', error);
    }
}

testGetSuggestedTabGroups();
*/