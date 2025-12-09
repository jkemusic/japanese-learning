const axios = require('axios');
const cheerio = require('cheerio');

async function test() {
    try {
        const url = `https://www.sigure.tw/dict/jp/${encodeURIComponent('小路')}`;
        console.log(`Fetching ${url}...`);
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        const $ = cheerio.load(data);
        
        console.log('--- Word Text (.word-card__word) ---');
        console.log($('.word-card__word').text());

        console.log('\n--- Number of .word-card elements ---');
        console.log($('.word-card').length);

        console.log('\n--- Iterating over .word-card ---');
        $('.word-card').each((i, el) => {
            console.log(`Card ${i + 1}:`);
            console.log('Word:', $(el).find('.word-card__word').text().trim());
            console.log('Reading:', $(el).find('.word-card__kana').text().trim());
            console.log('----------------');
        });

    } catch (e) {
        console.error(e);
    }
}

test();
