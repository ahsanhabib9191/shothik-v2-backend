const { createOpenAI } = require("@ai-sdk/openai");
const { tavily } = require("@tavily/core");
const Exa = require("exa-js").default;
const fetch = require("node-fetch");
const { z } = require("zod");
const {
  convertToCoreMessages,
  smoothStream,
  streamText,
  tool,
  customProvider,
  generateObject,
  wrapLanguageModel,
  extractReasoningMiddleware,
} = require("ai");
const { getGroupConfig } = require("./service");
const { redis } = require("../../lib/Redis");
const { createGoogleGenerativeAI } = require("@ai-sdk/google");
const { ShothikAIModel } = require("../../AiModel/shothik/shothikai");
const { modelRroute } = require("../../AiModel/confiq");
const { researchPrompt } = require("./researchPrompt");

const openai = createOpenAI({
  apiKey: process.env.SCALWAY_API_KEY,
  baseURL: process.env.SCALEWAY_URL,
});
const gemini = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const config = {
  safetySettings: [
    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "OFF" },
    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "OFF" },
    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "OFF" },
    { category: "HARM_CATEGORY_HARASSMENT", threshold: "OFF" },
  ],
};

const scira = customProvider({
  languageModels: {
    "qwen2.5-coder-32b-instruct": openai("qwen2.5-coder-32b-instruct"),
    "llama-3.3-70b-instruct": openai("llama-3.3-70b-instruct"),
    "deepseek-r1-distill-llama-70b": wrapLanguageModel({
      model: openai("deepseek-r1-distill-llama-70b"),
      middleware: extractReasoningMiddleware({
        tagName: "think",
        separator: "\n",
      }),
    }),
    "deepseek-r1": wrapLanguageModel({
      model: openai("deepseek-r1"),
      middleware: extractReasoningMiddleware({
        tagName: "think",
        separator: "\n",
      }),
    }),
    "shothik-brain-1.0": gemini("gemini-2.0-flash-001", config),
    "shothik-brain-1.5": gemini("gemini-2.0-flash-exp", config),
  },
});

function sanitizeUrl(url) {
  return url.replace(/\s+/g, "%20");
}

async function isValidImageUrl(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
    });

    clearTimeout(timeout);

    return (
      response.ok &&
      (response.headers.get("content-type")?.startsWith("image/") ?? false)
    );
  } catch {
    return false;
  }
}

const extractDomain = (url) => {
  const urlPattern = /^https?:\/\/([^/?#]+)(?:[/?#]|$)/i;
  return url.match(urlPattern)?.[1] || url;
};

const deduplicateByDomainAndUrl = (items) => {
  const seenDomains = new Set();
  const seenUrls = new Set();

  return items.filter((item) => {
    const domain = extractDomain(item.url);
    const isNewUrl = !seenUrls.has(item.url);
    const isNewDomain = !seenDomains.has(domain);

    if (isNewUrl && isNewDomain) {
      seenUrls.add(item.url);
      seenDomains.add(domain);
      return true;
    }
    return false;
  });
};

async function getResearh(req, res) {
  try {
    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    let { messages, model, group } = req.body;
    const { tools: activeTools, systemPrompt } = await getGroupConfig(group);

    const response = streamText({
      model: scira.languageModel(model),
      maxSteps: 5,
      providerOptions: {
        scira: {
          reasoning_format: "parsed",
        },
      },
      messages: convertToCoreMessages(messages),

      temperature: 0,
      experimental_activeTools: [...activeTools],
      system: systemPrompt,
      tools: {
        web_search: tool({
          description:
            "Search the web for information with multiple queries, max results and search depth.",
          parameters: z.object({
            queries: z.array(
              z
                .string()
                .describe("Array of search queries to look up on the web.")
            ),
            maxResults: z.array(
              z
                .number()
                .describe(
                  "Array of maximum number of results to return per query."
                )
                .default(10)
            ),
            topics: z.array(
              z
                .enum(["general", "news"])
                .describe("Array of topic types to search for.")
                .default("general")
            ),
            searchDepth: z.array(
              z
                .enum(["basic", "advanced"])
                .describe("Array of search depths to use.")
                .default("basic")
            ),
            exclude_domains: z
              .array(z.string())
              .describe("A list of domains to exclude from all search results.")
              .default([]),
          }),
          execute: async ({
            queries,
            maxResults,
            topics,
            searchDepth,
            exclude_domains,
          }) => {
            const apiKey = process.env.TAVILY_API_KEY;
            const tvly = tavily({ apiKey });
            const includeImageDescriptions = true;

            console.log("Queries:", queries);
            console.log("Max Results:", maxResults);
            console.log("Topics:", topics);
            console.log("Search Depths:", searchDepth);
            console.log("Exclude Domains:", exclude_domains);

            // Execute searches in parallel
            const searchPromises = queries.map(async (query, index) => {
              const data = await tvly.search(query, {
                topic: topics[index] || topics[0] || "general",
                days: topics[index] === "news" ? 7 : undefined,
                maxResults: maxResults[index] || maxResults[0] || 10,
                searchDepth: searchDepth[index] || searchDepth[0] || "basic",
                includeAnswer: true,
                includeImages: true,
                includeImageDescriptions: includeImageDescriptions,
                excludeDomains: exclude_domains,
              });

              return {
                query,
                results: deduplicateByDomainAndUrl(data.results).map((obj) => ({
                  url: obj.url,
                  title: obj.title,
                  content: obj.content,
                  raw_content: obj.raw_content,
                  published_date:
                    topics[index] === "news" ? obj.published_date : undefined,
                })),
                images: includeImageDescriptions
                  ? await Promise.all(
                      deduplicateByDomainAndUrl(data.images).map(
                        async ({ url, description }) => {
                          const sanitizedUrl = sanitizeUrl(url);
                          const isValid = await isValidImageUrl(sanitizedUrl);
                          return isValid
                            ? {
                                url: sanitizedUrl,
                                description: description ?? "",
                              }
                            : null;
                        }
                      )
                    ).then((results) =>
                      results.filter(
                        (image) =>
                          image !== null &&
                          typeof image === "object" &&
                          typeof image.description === "string" &&
                          image.description !== ""
                      )
                    )
                  : await Promise.all(
                      deduplicateByDomainAndUrl(data.images).map(
                        async ({ url }) => {
                          const sanitizedUrl = sanitizeUrl(url);
                          return (await isValidImageUrl(sanitizedUrl))
                            ? sanitizedUrl
                            : null;
                        }
                      )
                    ).then((results) => results.filter((url) => url !== null)),
              };
            });

            const searchResults = await Promise.all(searchPromises);

            return {
              searches: searchResults,
            };
          },
        }),
        academic_search: tool({
          description: "Search academic papers and research.",
          parameters: z.object({
            query: z.string().describe("The search query"),
          }),
          execute: async ({ query }) => {
            try {
              const exa = new Exa(process.env.EXA_API_KEY);

              // Search academic papers with content summary
              const result = await exa.searchAndContents(query, {
                type: "keyword",
                numResults: 15,
                text: true,
                highlights: true,
                includeDomains: ["link.springer.com", "arxiv.org"],
              });

              // Process and clean results
              const processedResults = result.results.reduce((acc, paper) => {
                // Skip if the URL is already present in the accumulator
                if (
                  !acc.some((existingPaper) => existingPaper.url === paper.url)
                ) {
                  acc.push(paper);
                }
                return acc;
              }, []);

              // Take only the first 10 unique, valid results
              const limitedResults = processedResults.slice(0, 10);
              return {
                results: limitedResults,
              };
            } catch (error) {
              console.error("Academic search error:", error);
              throw error;
            }
          },
        }),
      },
      onStepFinish(event) {
        if (event.warnings) {
          console.log("Warnings: ", event.warnings);
        }
      },
      onFinish(event) {
        console.log("Finis reason: ", event.finishReason);
      },
      onError(event) {
        console.log("Error: ", event.error);
      },
    }).toDataStreamResponse({
      sendReasoning: true,
    });

    // Ensure the response has a readable body (stream)
    if (response.body && typeof response.body.getReader === "function") {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      // Create a stream to handle the chunks of data
      while (true) {
        const { value, done: doneReading } = await reader.read();
        if (doneReading) break;

        if (value) {
          const text = decoder.decode(value, { stream: true });
          if (text.startsWith("a:")) {
            const parsedData = JSON.parse(text.replace("a:", ""));
            let academic_search_result = parsedData?.result?.results;
            if (academic_search_result) {
              academic_search_result = academic_search_result.map((item) => {
                const data = item || {};
                data.text = data?.text?.slice(0, 140);
                return data;
              });

              res.write(
                `inovation: ${JSON.stringify(academic_search_result)}\n`
              );
              await new Promise((resolve) => setTimeout(resolve, 1000));
            } else {
              const queries = [];
              let results = [];
              const images = [];
              const data = parsedData?.result?.searches;
              if (data) {
                data.forEach((item) => {
                  queries.push(item?.query);
                  if (Array.isArray(item?.results))
                    results.push(...item.results);
                  if (Array.isArray(item?.images)) images.push(...item.images);
                });
              }

              results = results.slice(0, 9);
              results = results.map((item) => {
                let data = item || {};
                data.content = data?.content?.slice(0, 120);
                return data;
              });

              const payload = { queries, results, images };
              res.write(`inovation: ${JSON.stringify(payload)}\n`);
              await new Promise((resolve) => setTimeout(resolve, 1000));
            }
          } else if (text.startsWith("0:")) {
            const cleanedValue = JSON.parse(text.replace("0:", ""));
            res.write(`0: ${cleanedValue}`);
          }
        }
      }

      res.end();
    } else {
      console.error("Invalid Response body:", response);
      throw { message: "Invalid Response body", status: 500 };
    }
  } catch (error) {
    console.log(error);
    res.status(500).send({ message: error.message });
  }
}

async function suggestQuestions(req, res) {
  try {
    const { history } = req.body;

    const result = await ShothikAIModel(
      history,
      modelRroute.research,
      false,
      null,
      researchPrompt.suggestionQuestion
    );

    const data = result.replaceAll("```", "").replace("json", "").trim();

    res.send({ success: true, data: JSON.parse(data) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function fetchMetadata(req, res) {
  try {
    const { url } = req.body;

    const response = await fetch(url);
    const html = await response.text();

    // Extract title from <title> tag
    const titleMatch = html.match(/<title>(.*?)<\/title>/i);
    let title = titleMatch ? titleMatch[1].trim() : "";

    // Extract description from <meta name="description">
    const descMatch = html.match(
      /<meta\s+name=["']description["']\s+content=["'](.*?)["']/i
    );
    let description = descMatch ? descMatch[1].trim() : "";

    // Extract all JSON-LD scripts
    const jsonLDScriptMatches = [
      ...html.matchAll(
        /<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi
      ),
    ];

    for (const match of jsonLDScriptMatches) {
      try {
        const jsonLD = JSON.parse(match[1]);

        if (jsonLD["@graph"]) {
          const pageData = jsonLD["@graph"].find(
            (item) =>
              item["@type"] === "WebPage" ||
              (Array.isArray(item["@type"]) &&
                item["@type"].includes("Article"))
          );

          if (pageData) {
            if (pageData.headline) title = pageData.headline.trim();
            if (pageData.description) {
              description = pageData.description.trim();
              break; // Stop looping once we find the description
            }
          }
        }
      } catch (jsonError) {
        console.error("Error parsing JSON-LD:", jsonError);
      }
    }

    res.json({ title, description });
  } catch (error) {
    console.log("Error fetching metadata:", error);
    res.status(500).json({ error: "Failed to fetch metadata" });
  }
}

async function fetchGoogleTrends() {
  const fetchTrends = async (geo) => {
    try {
      const response = await fetch(
        `https://trends.google.com/trends/trendingsearches/daily/rss?geo=${geo}`,
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          },
        }
      );

      if (!response.ok) {
        throw new Error(
          `Failed to fetch from Google Trends RSS for geo: ${geo}`
        );
      }

      const xmlText = await response.text();
      const items =
        xmlText.match(/<title>(?!Daily Search Trends)(.*?)<\/title>/g) || [];

      const categories = [
        "trending",
        "community",
        "science",
        "tech",
        "travel",
        "politics",
        "health",
        "sports",
        "finance",
        "football",
      ];

      const schema = z.object({
        category: z.enum(categories),
      });

      const itemsWithCategoryAndIcon = await Promise.all(
        items.map(async (item) => {
          const { object } = await generateObject({
            model: gemini("gemini-2.0-flash-001", config),
            prompt: `Give the category for the topic from the existing values only in lowercase only: ${item.replace(
              /<\/?title>/g,
              ""
            )}

          - if the topic category isn't present in the list, please select 'trending' only!`,
            schema,
            temperature: 0,
          });

          return {
            icon: object.category,
            text: item.replace(/<\/?title>/g, ""),
            category: object.category,
          };
        })
      );

      return itemsWithCategoryAndIcon;
    } catch (error) {
      console.error(`Failed to fetch Google Trends:`, error);
      return [];
    }
  };

  // geo codes:- US (United States) GB (United Kingdom) IN (India) CA (Canada)
  const trends = await fetchTrends("US");

  return [...trends];
}

async function fetchFromMultipleSources() {
  const googleTrends = await fetchGoogleTrends();
  return googleTrends.sort(() => Math.random() - 0.5);
}

async function getTrending(req, res) {
  try {
    // get form redis
    const cacheData = await redis.get("trending");
    if (cacheData) {
      res.json(JSON.parse(cacheData));
      return;
    }

    const trends = await fetchFromMultipleSources();

    if (trends.length === 0) {
      // Fallback queries if both sources fail
      console.error(
        "Both sources failed to fetch trends, returning fallback queries"
      );
      res.json([
        {
          icon: "sparkles",
          text: "What causes the Northern Lights?",
          category: "science",
        },
        {
          icon: "code",
          text: "Explain quantum computing",
          category: "tech",
        },
        {
          icon: "globe",
          text: "Most beautiful places in Japan",
          category: "travel",
        },
      ]);
      return;
    }

    //save radis
    redis.set("trending", JSON.stringify(trends));

    res.json(trends);
  } catch (error) {
    console.error("Failed to fetch trends:", error);
    res.status(500).json({ error: "Failed to fetch trends" });
  }
}

module.exports = {
  getResearh,
  suggestQuestions,
  fetchMetadata,
  getTrending,
};
