import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage } from '@langchain/core/messages';
import * as dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

async function test() {
  try {
    console.log('Testing gemini-3.6-flash...');
    const llm = new ChatGoogleGenerativeAI({
      model: 'gemini-3.6-flash',
      temperature: 0,
      apiKey: process.env.GEMINI_API_KEY
    });
    console.log('Invoking...');
    const res = await llm.invoke([new HumanMessage("Salam labas 3lik")]);
    console.log('Response:', res.content);
  } catch (err) {
    console.error('Error:', err);
  }
}

test();
