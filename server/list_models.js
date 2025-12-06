
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

async function listModels() {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    // Note: listModels is not directly exposed on genAI instance in some versions, 
    // but we can use the API directly or check if the SDK supports it.
    // Actually, the SDK has a ModelManager or similar?
    // Let's just use axios to be safe and simple as I know the endpoint works.
    
    const axios = require('axios');
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`;
    
    try {
        const response = await axios.get(url);
        const models = response.data.models;
        console.log('Available Models:');
        models.forEach(m => {
            if (m.supportedGenerationMethods.includes('generateContent')) {
                console.log(`- ${m.name} (${m.displayName})`);
            }
        });
    } catch (error) {
        console.error('Error listing models:', error.message);
    }
}

listModels();
