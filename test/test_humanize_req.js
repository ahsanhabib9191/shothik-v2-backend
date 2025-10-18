const autocannon = require('autocannon');
const axios = require('axios');

const payload = {
    text: "Artificial Intelligence (AI) is a rapidly evolving field that has revolutionized the way we interact with technology and solve complex problems. By mimicking human intelligence, AI enables machines to learn from data, recognize patterns, and make decisions with remarkable accuracy. From virtual assistants and self-driving cars to advanced healthcare diagnostics and personalized recommendations, AI is seamlessly integrating into our daily lives. Its potential to enhance efficiency and drive innovation is transforming industries such as finance, education, manufacturing, and entertainment.",
    model: "panda",
    level: 2,
    initial: true
};

const headers = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiI2NzYxNDY1M2Y1ZjIxNTdmNzk5MzQwNzMiLCJzdWIiOiI2NzYxNDY1M2Y1ZjIxNTdmNzk5MzQwNzMiLCJlbWFpbCI6InJpZHpAc2hvdGhpay5haSIsInBhY2thZ2UiOiJwcm9fcGxhbiIsImlzX3ZlcmlmaWVkIjp0cnVlLCJyb2xlIjoidXNlciIsImlhdCI6MTczNjI1MTUwM30.2H2NAniXCd_2qcQZMbvHEMwkiL3RuQnokrXC1TK77AY'
};

async function runLoadTest() {
    const instance = autocannon({
        url: 'https://az-api.shothik.ai/api/humanizerV2/',
        connections: 10,
        pipelining: 1,
        amount: 400, // Set to exactly 100 requests
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload),
    });

    autocannon.track(instance);

    return new Promise((resolve) => {
        instance.on('done', (results) => {
            console.log('\n========== Load Test Results ==========');
            console.log('Total requests completed:', results.requests.total);
            console.log('Requests per second:', results.requests.average.toFixed(2));
            console.log('Average latency (ms):', results.latency.average.toFixed(2));
            console.log('Min latency (ms):', results.latency.min);
            console.log('Max latency (ms):', results.latency.max);
            console.log('Successful responses:', results.requests.total - results.non2xx);
            console.log('Failed responses:', results.non2xx);
            console.log('=====================================\n');
            resolve(results);
        });
    });
}

// Run a single test to verify API is working
async function testSingleRequest() {
    try {
        const response = await axios.post("https://az-api.shothik.ai/api/humanizerV2/", 
            payload,
            { headers }
        );
        console.log('Single test successful:', response.status);
        return true;
    } catch (error) {
        console.error('Single test failed:', error.message);
        return false;
    }
}

// Execute the tests
(async () => {
    console.log('Starting load test for 100 requests...');
    const singleTestResult = await testSingleRequest();
    
    if (singleTestResult) {
        console.log('Initial test passed, starting load test...');
        await runLoadTest();
    } else {
        console.log('Initial test failed, aborting load test');
    }
})();