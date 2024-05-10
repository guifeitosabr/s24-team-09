const axios = require('axios');
const cheerio = require('cheerio');
const openai = require('openai'); 

const OpenAI_API_KEY = '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'; 

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

async function summarizeAndExtract(tabObjects) {

    for (const tab of tabObjects) {
        const content = await extractContentFromURL(tab.url);

        console.log("content: " + content)

    }


    try {
        openai.apiKey = OpenAI_API_KEY;

        const tabData = [];

        for (const tab of tabObjects) {
            const content = await extractContentFromURL(tab.url);

            console.log("content: " + content)

            const response = await openai.summarize({
                text: content,
                max_tokens: 50 
            });

            const summary = response.data.summary;

            tabData.push({
                url: tab.url,
                title: tab.title,
                summary: summary,
                content: content
            });
        }

        return tabData;
    } catch (error) {
        console.error('Error summarizing and extracting tab data:', error);
        return [];
    }
}

const tabObjects = [
    { id: 1, url: "https://www.cmu.edu/", title: "Page 1 Title" },
    { id: 2, url: "https://en.wikipedia.org/wiki/David_Bowie", title: "Page 2 Title" },
];

summarizeAndExtract(tabObjects)
    .then(tabData => {
        console.log('Tab Data:', tabData);
    })
    .catch(error => {
        console.error('Error:', error);
    });