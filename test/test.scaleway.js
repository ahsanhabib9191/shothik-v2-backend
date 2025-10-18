const { handleScalewayStream } = require('../controllers/research/scaleway');

async function testScalewayStream() {
    try {
        console.log('Testing Scaleway Stream...');
        
        const messages = [
            { role: 'user', content: 'What is artificial intelligence?' }
        ];

        const stream = await handleScalewayStream(messages);

        console.log('Stream response:');
        for await (const chunk of stream) {
            process.stdout.write(chunk.choices[0]?.delta?.content || '');
        }
        console.log('\n\nTest completed successfully!');
    } catch (error) {
        console.error('Test failed:', error.message);
        throw error;
    }
}

// Run the test
testScalewayStream()
    .then(() => console.log('All tests passed!'))
    .catch((error) => {
        console.error('Test suite failed:', error);
        process.exit(1);
    });