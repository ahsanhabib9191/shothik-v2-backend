/**
 * AI-based paragraph scoring and reorganization system
 * Extracts paragraphs from LLM output, scores them with AI detector, and reorganizes by human-likeness
 */

const axios = require("axios");

/**
 * Extracts paragraph variations from LLM markdown-style output
 * @param {string} text - The LLM output text
 * @param {number} humanizeScore - The original humanize score for this output
 * @returns {Array} Array of paragraph objects with their humanize scores
 */
function extractParagraphVariations(text, humanizeScore) {
  try {
    if (!text || typeof text !== "string") {
      console.warn("Invalid text provided to extractParagraphVariations");
      return [];
    }

    const paragraphs = [];
    const lines = text.split("\n");
    let currentParagraph = "";
    let paragraphNumber = null;
    let insideAnalysisSection = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Skip empty lines
      if (!line) {
        // If we were building a paragraph and hit empty line, finalize it
        if (
          currentParagraph.trim() &&
          paragraphNumber !== null &&
          !insideAnalysisSection
        ) {
          paragraphs.push({
            paragraphNumber,
            text: currentParagraph.trim(),
            humanizeScore,
            aiPercentage: null,
            aiAssessment: null,
            totalSentences: null,
            averageWordsPerSentence: null,
          });
          currentParagraph = "";
          paragraphNumber = null;
        }
        continue;
      }

      // Check for analysis/conclusion sections that we should skip entirely
      const analysisMarkers = [
        /^Perplexity and Burstiness Analysis:/i,
        /^Human-like Paragraph Selection:/i,
        /^Part \d+:/i,
        /^Perplexity Rating:/i,
        /^Burstiness Rating:/i,
        /^Justification:/i,
        /^Selected Paragraph:/i,
        /^Perplexity Assessment/i,
        /^Burstiness Assessment/i,
        // New patterns to catch analysis text
        /is selected as the most human-like/i,
        /is the most human-like/i,
        /strikes a good balance/i,
        /maintains simplicity and clarity/i,
        /exhibits.*natural flow/i,
        /perplexity and burstiness scores/i,
        /consistent and easily understandable/i,
      ];

      const isAnalysisSection = analysisMarkers.some((pattern) =>
        pattern.test(line)
      );
      if (isAnalysisSection) {
        // Save current paragraph if we were building one and it's not analysis
        if (
          currentParagraph.trim() &&
          paragraphNumber !== null &&
          !insideAnalysisSection
        ) {
          paragraphs.push({
            paragraphNumber,
            text: currentParagraph.trim(),
            humanizeScore,
            aiPercentage: null,
            aiAssessment: null,
            totalSentences: null,
            averageWordsPerSentence: null,
          });
          currentParagraph = "";
          paragraphNumber = null;
        }
        insideAnalysisSection = true;
        continue;
      }

      // Check for paragraph variation headers
      const paragraphMatch = line.match(/^Paragraph\s+(\d+):/i);
      if (paragraphMatch) {
        // Save previous paragraph if exists and it's not analysis
        if (
          currentParagraph.trim() &&
          paragraphNumber !== null &&
          !insideAnalysisSection
        ) {
          paragraphs.push({
            paragraphNumber,
            text: currentParagraph.trim(),
            humanizeScore,
            aiPercentage: null,
            aiAssessment: null,
            totalSentences: null,
            averageWordsPerSentence: null,
          });
        }

        paragraphNumber = parseInt(paragraphMatch[1]);
        currentParagraph = "";
        insideAnalysisSection = false; // Reset when we find a new paragraph header
        continue;
      }

      // Check if we're entering "Paragraph Variations:" section (reset analysis flag)
      if (line.match(/^Paragraph\s+Variations?:/i)) {
        insideAnalysisSection = false;
        continue;
      }

      // If we're inside an analysis section, skip this line entirely
      if (insideAnalysisSection) {
        continue;
      }

      // If we have a paragraph number and we're not in analysis, collect the text
      if (paragraphNumber !== null && !insideAnalysisSection) {
        // Additional filters for analysis-like content
        const isAnalysisContent =
          line.toLowerCase().includes("rating:") ||
          line.toLowerCase().includes("justification:") ||
          line.toLowerCase().includes("most human-like") ||
          line.toLowerCase().includes("perplexity") ||
          line.toLowerCase().includes("burstiness") ||
          line.toLowerCase().includes("strikes a") ||
          line.toLowerCase().includes("maintains") ||
          line.toLowerCase().includes("exhibits") ||
          line.toLowerCase().includes("consistent and") ||
          line.toLowerCase().includes("easily understandable") ||
          line.toLowerCase().includes("natural flow") ||
          line.toLowerCase().includes("compared to") ||
          line.match(/^\s*[-*]\s/) || // bullet points
          line.match(/^\d+\.\s/); // numbered lists

        if (!isAnalysisContent) {
          if (currentParagraph) {
            currentParagraph += " " + line;
          } else {
            currentParagraph = line;
          }
        }
      }
    }

    // Don't forget the last paragraph (if it's not analysis)
    if (
      currentParagraph.trim() &&
      paragraphNumber !== null &&
      !insideAnalysisSection
    ) {
      paragraphs.push({
        paragraphNumber,
        text: currentParagraph.trim(),
        humanizeScore,
        aiPercentage: null,
        aiAssessment: null,
        totalSentences: null,
        averageWordsPerSentence: null,
      });
    }

    // Filter out paragraphs that are too short or contain analysis keywords
    return paragraphs.filter((p) => {
      if (!p.text || p.text.length < 50) return false; // Increased minimum length

      const text = p.text.toLowerCase();
      const analysisKeywords = [
        "most human-like",
        "perplexity",
        "burstiness",
        "strikes a good balance",
        "maintains simplicity",
        "exhibits",
        "natural flow",
        "compared to",
        "consistent and easily",
        "understandable writing",
        "rating:",
        "justification:",
      ];

      // If paragraph contains analysis keywords, skip it
      const containsAnalysisKeywords = analysisKeywords.some((keyword) =>
        text.includes(keyword)
      );
      return !containsAnalysisKeywords;
    });
  } catch (error) {
    console.error("Error extracting paragraph variations:", error);
    return [];
  }
}

/**
 * Calls the AI detector API to analyze text
 * @param {string} text - Text to analyze
 * @param {string} aiDetectorApiUrl - URL of the AI detector API
 * @returns {Promise<Object>} AI detection result
 */
async function callAiDetectorApi(text, aiDetectorApiUrl) {
  try {
    if (!text || typeof text !== "string" || text.trim().length === 0) {
      throw new Error("Invalid text provided to AI detector");
    }

    const response = await axios.post(
      aiDetectorApiUrl,
      {
        text: text.trim(),
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 60000, // 60 second timeout
      }
    );

    if (!response.data || !response.data.success) {
      throw new Error("AI detector API returned unsuccessful response");
    }

    return response.data.result;
  } catch (error) {
    console.error("Error calling AI detector API:", error.message);

    // Return default values on API failure
    return {
      ai_percentage: 50, // Default middle score
      assessment: "Unknown",
      total_sentences: 0,
      average_words_per_sentence: 0,
    };
  }
}

/**
 * Processes paragraphs with AI detection and rate limiting
 * @param {Array} paragraphs - Array of paragraph objects
 * @param {string} aiDetectorApiUrl - URL of the AI detector API
 * @param {number} rateLimitDelay - Delay between API calls in ms (default: 1000ms)
 * @returns {Promise<Array>} Paragraphs with AI scores
 */
async function scoreParagraphsWithAiDetection(
  paragraphs,
  aiDetectorApiUrl,
  rateLimitDelay = 1000
) {
  const scoredParagraphs = [];

  for (let i = 0; i < paragraphs.length; i++) {
    const paragraph = paragraphs[i];

    try {
      console.log(
        `Processing paragraph ${i + 1}/${
          paragraphs.length
        }: "${paragraph.text.substring(0, 50)}..."`
      );

      const aiResult = await callAiDetectorApi(
        paragraph.text,
        aiDetectorApiUrl
      );

      //   console.log(aiResult, "aiResult");

      scoredParagraphs.push({
        ...paragraph,
        aiPercentage: aiResult.summary?.ai_percentage || 50,
        aiAssessment: aiResult.summary?.assessment || "Unknown",
        totalSentences: aiResult.summary?.total_sentences || 0,
        averageWordsPerSentence:
          aiResult.summary?.average_words_per_sentence || 0,
      });

      // Rate limiting - wait between requests
      if (i < paragraphs.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, rateLimitDelay));
      }
    } catch (error) {
      console.error(`Error processing paragraph ${i + 1}:`, error.message);

      // Add paragraph with default scores on error
      scoredParagraphs.push({
        ...paragraph,
        aiPercentage: 75, // Conservative high AI score on error
        aiAssessment: "Error - Could not analyze",
        totalSentences: 0,
        averageWordsPerSentence: 0,
      });
    }
  }

  return scoredParagraphs;
}

/**
 * Reorganizes paragraphs by AI percentage (lowest first = most human-like)
 * @param {Array} paragraphs - Array of paragraph objects with AI scores
 * @returns {Array} Reorganized paragraphs
 */
function reorganizeParagraphsByHumanLikeness(paragraphs) {
  if (!Array.isArray(paragraphs) || paragraphs.length === 0) {
    return [];
  }

  return paragraphs
    .filter((p) => p && p.text) // Remove any invalid entries
    .sort((a, b) => {
      // Primary sort: by AI percentage (ascending - lower is more human-like)
      const aiDiff = (a.aiPercentage || 100) - (b.aiPercentage || 100);
      if (aiDiff !== 0) return aiDiff;

      // Secondary sort: by original humanize score (descending - higher is better)
      const scoreDiff = (b.humanizeScore || 0) - (a.humanizeScore || 0);
      if (scoreDiff !== 0) return scoreDiff;

      // Tertiary sort: by paragraph number (ascending - maintain original order)
      return (a.paragraphNumber || 0) - (b.paragraphNumber || 0);
    });
}

/**
 * Main function to process humanize output and reorganize paragraphs
 * @param {Array} finalOutput - The final output array from humanize function
 * @param {string} aiDetectorApiUrl - URL of the AI detector API
 * @param {Object} options - Additional options
 * @returns {Promise<Array>} Reorganized paragraphs with AI scores
 */
async function processHumanizeOutputWithAiScoring(
  finalOutput,
  aiDetectorApiUrl,
  options = {}
) {
  const {
    rateLimitDelay = 1000,
    maxParagraphs = 50,
    minParagraphLength = 20,
  } = options;

  try {
    console.log(
      `Starting to process ${finalOutput.length} humanize outputs...`
    );

    let allParagraphs = [];

    // Extract paragraphs from all outputs
    for (const output of finalOutput) {
      if (!output || !output.text) {
        console.warn("Skipping invalid output:", output);
        continue;
      }

      const paragraphs = extractParagraphVariations(
        output.text,
        output.score || output.humanizeScore || 90
      );

      allParagraphs = allParagraphs.concat(paragraphs);
    }

    console.log(`Extracted ${allParagraphs.length} paragraphs total`);

    // Filter paragraphs by minimum length
    allParagraphs = allParagraphs.filter(
      (p) => p.text && p.text.length >= minParagraphLength
    );

    // Limit number of paragraphs to process (to avoid excessive API calls)
    if (allParagraphs.length > maxParagraphs) {
      console.log(
        `Limiting to first ${maxParagraphs} paragraphs to avoid excessive API calls`
      );
      allParagraphs = allParagraphs.slice(0, maxParagraphs);
    }

    if (allParagraphs.length === 0) {
      console.warn("No valid paragraphs found to process");
      return [];
    }

    // Score paragraphs with AI detection
    console.log(
      `Scoring ${allParagraphs.length} paragraphs with AI detector...`
    );
    const scoredParagraphs = await scoreParagraphsWithAiDetection(
      allParagraphs,
      aiDetectorApiUrl,
      rateLimitDelay
    );

    // Reorganize by human-likeness (lowest AI percentage first)
    const reorganizedParagraphs =
      reorganizeParagraphsByHumanLikeness(scoredParagraphs);

    console.log(
      `Reorganization complete. Best paragraph has ${reorganizedParagraphs[0]?.aiPercentage}% AI detection`
    );

    return reorganizedParagraphs;
  } catch (error) {
    console.error("Error in processHumanizeOutputWithAiScoring:", error);
    return [];
  }
}

/**
 * Utility function to get the best paragraphs (lowest AI percentage)
 * @param {Array} reorganizedParagraphs - Reorganized paragraphs array
 * @param {number} count - Number of best paragraphs to return (default: 3)
 * @returns {Array} Best paragraphs
 */
function getBestParagraphs(reorganizedParagraphs, count = 3) {
  if (!Array.isArray(reorganizedParagraphs)) return [];
  return reorganizedParagraphs.slice(
    0,
    Math.min(count, reorganizedParagraphs.length)
  );
}

/**
 * Utility function to log paragraph analysis results
 * @param {Array} paragraphs - Array of analyzed paragraphs
 */
function logParagraphAnalysis(paragraphs) {
  if (!Array.isArray(paragraphs) || paragraphs.length === 0) {
    console.log("No paragraphs to analyze");
    return;
  }

  console.log("\n=== PARAGRAPH ANALYSIS RESULTS ===");
  paragraphs.forEach((p, index) => {
    console.log(`\nRank ${index + 1}:`);
    console.log(`  AI Percentage: ${p.aiPercentage}%`);
    console.log(`  Assessment: ${p.aiAssessment}`);
    console.log(`  Humanize Score: ${p.humanizeScore}`);
    console.log(`  Original Paragraph: ${p.paragraphNumber}`);
    console.log(`  Text Preview: "${p.text.substring(0, 100)}..."`);
  });
  console.log("================================\n");
}

module.exports = {
  extractParagraphVariations,
  callAiDetectorApi,
  scoreParagraphsWithAiDetection,
  reorganizeParagraphsByHumanLikeness,
  processHumanizeOutputWithAiScoring,
  getBestParagraphs,
  logParagraphAnalysis,
};
