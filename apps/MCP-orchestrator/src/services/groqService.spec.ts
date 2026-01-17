import '../utils/envLoader.js';
import { generateText } from './groqService.js';

async function test() {
  try {
    const result = await generateText('Say you are the best');
    console.log('Generated text:', result);
  } catch (error) {
    console.error('Error:', error);
  }
}

test();
