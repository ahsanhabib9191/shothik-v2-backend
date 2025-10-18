const { GoogleGenerativeAI } = require("@google/generative-ai");

const apiKey = "AIzaSyBV9bmDvpUVN6KtFBolWrjQa5WAyM-qX70";
const genAI = new GoogleGenerativeAI(apiKey);

const model = genAI.getGenerativeModel({
  model: "gemini-2.0-flash",
});

const generationConfig = {
  temperature: 1,
  topP: 0.95,
  topK: 40,
  maxOutputTokens: 8192,
};

class PerformanceTracker {
  constructor() {
    this.reset();
    this.lastLogTime = Date.now();
    this.startTime = Date.now();
    this.totalRequestsSent = 0;
  }

  reset() {
    this.currentSecond = {
      successful: 0,
      failed: 0,
      totalLatency: 0,
      maxLatency: 0,
      minLatency: Infinity,
      totalResponseSize: 0,
      errors: new Map(),
    };
  }

  track(response) {
    this.totalRequestsSent++;
    if (response.success) {
      this.currentSecond.successful++;
      this.currentSecond.totalLatency += response.latency;
      this.currentSecond.maxLatency = Math.max(
        this.currentSecond.maxLatency,
        response.latency
      );
      this.currentSecond.minLatency = Math.min(
        this.currentSecond.minLatency,
        response.latency
      );
      this.currentSecond.totalResponseSize += response.responseSize;
    } else {
      this.currentSecond.failed++;
      const errorType = response.error.includes("timeout")
        ? "Timeout"
        : response.error.split(":")[0];
      this.currentSecond.errors.set(
        errorType,
        (this.currentSecond.errors.get(errorType) || 0) + 1
      );
    }
  }

  logIfNeeded() {
    const now = Date.now();
    if (now - this.lastLogTime >= 1000) {
      this.logMetrics();
      this.lastLogTime = now;
      this.reset();
    }
  }

  logMetrics() {
    const elapsedSeconds = Math.floor((Date.now() - this.startTime) / 1000);
    const total = this.currentSecond.successful + this.currentSecond.failed;
    const avgLatency = this.currentSecond.successful
      ? this.currentSecond.totalLatency / this.currentSecond.successful
      : 0;
    const avgResponseSize = this.currentSecond.successful
      ? this.currentSecond.totalResponseSize / this.currentSecond.successful
      : 0;

    console.log(`\n[Second ${elapsedSeconds}] Performance Metrics:`);
    console.log(
      `├─ Total Requests Sent (Cumulative): ${this.totalRequestsSent}`
    );
    console.log(
      `├─ Current Second: ${total} total (${this.currentSecond.successful} success, ${this.currentSecond.failed} failed)`
    );
    console.log(
      `├─ Success Rate: ${
        total ? ((this.currentSecond.successful / total) * 100).toFixed(1) : 0
      }%`
    );
    if (this.currentSecond.successful > 0) {
      console.log(
        `├─ Latency: avg=${avgLatency.toFixed(0)}ms, min=${
          this.currentSecond.minLatency
        }ms, max=${this.currentSecond.maxLatency}ms`
      );
      console.log(`├─ Avg Response Size: ${avgResponseSize.toFixed(1)} chars`);
    }
    if (this.currentSecond.failed > 0) {
      console.log(
        `└─ Errors:${Array.from(this.currentSecond.errors.entries())
          .map(([type, count]) => ` ${type}=${count}`)
          .join(",")}`
      );
    }
  }

  getTotalRequests() {
    return this.totalRequestsSent;
  }
}

async function makeRequest(id) {
  const startTime = Date.now();
  try {
    const chatSession = model.startChat({ generationConfig });
    const result = await chatSession.sendMessageStream(
      "quick test message " + id
    );
    let responseSize = 0;
    for await (const chunk of result.stream) {
      responseSize += chunk.text().length;
    }
    const endTime = Date.now();
    return {
      success: true,
      time: endTime - startTime,
      responseSize,
      latency: endTime - startTime,
      id,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      latency: Date.now() - startTime,
      id,
    };
  }
}

async function runTest(targetRequestsPerMinute = 1500, duration = 60000) {
  console.log(
    `Starting high throughput test targeting ${targetRequestsPerMinute} requests per minute for ${
      duration / 1000
    } seconds\n`
  );

  const startTime = Date.now();
  const results = {
    successful: 0,
    failed: 0,
    totalTime: 0,
    totalResponseSize: 0,
    requests: [],
    latencies: [],
    errors: new Map(),
    timeoutErrors: 0,
  };

  const performanceTracker = new PerformanceTracker();

  // Calculate delay between requests to achieve target rate
  const delayBetweenRequests = Math.floor(60000 / targetRequestsPerMinute);
  const concurrentRequests = Math.ceil(targetRequestsPerMinute / 60);

  console.log(`High Load Configuration:`);
  console.log(`├─ Concurrent Requests: ${concurrentRequests}`);
  console.log(`├─ Delay Between Batches: ${delayBetweenRequests}ms`);
  console.log(
    `└─ Expected Requests per Second: ${(targetRequestsPerMinute / 60).toFixed(
      2
    )}\n`
  );

  let requestId = 0;
  let lastBatchTime = startTime;

  while (Date.now() - startTime < duration) {
    const requests = [];
    for (let i = 0; i < concurrentRequests; i++) {
      requestId++;
      requests.push(makeRequest(requestId));
    }

    const responses = await Promise.all(requests);

    responses.forEach((response) => {
      results.latencies.push(response.latency);
      performanceTracker.track(response);

      if (response.success) {
        results.successful++;
        results.totalTime += response.time;
        results.totalResponseSize += response.responseSize;
        results.requests.push(response);
      } else {
        results.failed++;
        const errorType = response.error.includes("timeout")
          ? "Timeout"
          : response.error.split(":")[0];
        results.errors.set(errorType, (results.errors.get(errorType) || 0) + 1);
        if (response.error.includes("timeout")) {
          results.timeoutErrors++;
        }
      }
    });

    performanceTracker.logIfNeeded();

    // Wait for next batch interval
    const now = Date.now();
    const elapsed = now - lastBatchTime;
    if (elapsed < delayBetweenRequests) {
      await new Promise((resolve) =>
        setTimeout(resolve, delayBetweenRequests - elapsed)
      );
    }
    lastBatchTime = now;
  }

  const totalTime = Date.now() - startTime;
  const actualRequestsPerMinute = (results.successful / totalTime) * 60000;
  const lossRate =
    (results.failed / (results.successful + results.failed)) * 100;

  // Calculate latency percentiles
  const sortedLatencies = results.latencies.sort((a, b) => a - b);
  const p50 = sortedLatencies[Math.floor(sortedLatencies.length * 0.5)];
  const p95 = sortedLatencies[Math.floor(sortedLatencies.length * 0.95)];
  const p99 = sortedLatencies[Math.floor(sortedLatencies.length * 0.99)];

  console.log("\nFinal Test Results:");
  console.log("=================");
  console.log(`Total Requests Sent: ${performanceTracker.getTotalRequests()}`);
  console.log(`Target Requests per Minute: ${targetRequestsPerMinute}`);
  console.log(
    `Actual Requests per Minute: ${actualRequestsPerMinute.toFixed(2)}`
  );
  console.log(
    `Total Requests Completed: ${results.successful + results.failed}`
  );
  console.log(`Successful Requests: ${results.successful}`);
  console.log(`Failed Requests: ${results.failed}`);
  console.log(`Loss Rate: ${lossRate.toFixed(2)}%`);

  console.log("\nLatency Metrics (ms):");
  console.log("===================");
  console.log(
    `Average: ${(results.totalTime / results.successful).toFixed(2)}`
  );
  console.log(`P50 (Median): ${p50}ms`);
  console.log(`P95: ${p95}ms`);
  console.log(`P99: ${p99}ms`);
  console.log(`Min: ${sortedLatencies[0]}ms`);
  console.log(`Max: ${sortedLatencies[sortedLatencies.length - 1]}ms`);

  console.log("\nError Analysis:");
  console.log("==============");
  for (const [errorType, count] of results.errors) {
    console.log(`${errorType}: ${count} occurrences`);
  }

  console.log("\nPerformance Metrics:");
  console.log("===================");
  console.log(
    `Average Response Size: ${(
      results.totalResponseSize / results.successful
    ).toFixed(2)} characters`
  );
  console.log(`Total Data Processed: ${results.totalResponseSize} characters`);
}

// Run the high throughput test with 1500 requests per minute
runTest(2000, 60000);
