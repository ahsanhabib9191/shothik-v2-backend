# Changelog

All notable changes to this project will be documented in this file.

#

============================
Initial Changelog Setup [CL]
23-12-2024 3:49 PM

- Created changelog file to track all project changes
- Implemented changelog format with date, time, and feature separators

============================
Project Documentation [DOC]
02-01-2025 12:21 PM

- Created comprehensive README.md file
- Added detailed project features and tech stack
- Included setup instructions and configuration details
- Added Docker and environment variable documentation

============================
Humanize Config Update [HCU]
02-01-2025 12:46 PM

- Updated sample text responses in config.js
- Improved readability of AI explanations
- Modified text to be more user-friendly and concise

============================
Humanize Studio Enhancement [HSE]
02-01-2025 1:25 PM

- Restructured system instructions for better clarity
- Added new phase for linking words and sentence structure
- Consolidated phases for better workflow
- Fixed README.md line endings

============================
User Package Management [UPM]
02-01-2025 4:41 PM

- Added user information retrieval endpoint
- Implemented manual package upgrade functionality
- Updated UserTransaction model to support manual payments
- Enhanced package permission logging
- Enabled word limit validation in humanizeV2
- Modified admin routes for package management

============================
Live Streaming Text Implementation [LST]
04-01-2025 12:52 PM

- Adding live streaming text functionality to model responses
- Implementing streaming response handling in test.js

============================
Request Rate Testing Implementation [RRT]
04-01-2025 12:55 PM

- Added request rate testing functionality
- Created new test file for measuring requests per minute

============================
High Load Testing [HLT]
04-01-2025 12:57 PM

- Enhanced request rate test for 100 req/min
- Added detailed latency and loss metrics

============================
Real-time Performance Logging [RPL]
04-01-2025 1:02 PM

- Added per-second performance logging
- Enhanced metrics tracking with real-time stats

============================
Total Request Tracking [TRT]
04-01-2025 1:07 PM

- Added total request count tracking
- Enhanced metrics to show cumulative requests

============================
High Throughput Testing [HTT]
04-01-2025 1:09 PM

- Increased test load to 1500 req/min
- Testing with gemini-2.0-flash model

============================
Extreme Load Testing [ELT]
04-01-2025 1:15 PM

- Increased test load to 2000 req/min
- Testing maximum throughput with gemini-2.0-flash
- Enhanced performance tracking for high load scenarios

============================
Environment Configuration Update [ECU]
04-01-2025 6:32 PM

- Added AI_DETECTOR_URL configuration
- Cleaned up environment file formatting
- Removed duplicate entries

============================
Redis Integration Update [RIU]
05-01-2025 5:57 PM

- Updated chooseAPIKey.js to use correct Redis methods
- Replaced hash operations with JSON storage
- Improved data type handling for Redis values
- Updated Redis key expiration handling
- Fixed Redis key removal method

============================
LT: Load Testing Implementation
05-01-2025 6:54 PM
Performance Metrics:

1. Throughput:

   - 3.27 requests/second
   - ~196 requests/minute
   - 108 total requests in 30.24s

2. Latency:

   - Average: 2.92s
   - Median (50%): 2.87s
   - Best (2.5%): 2.85s
   - Worst (97.5%): 3.16s
   - Max: 4.49s

3. Stability:
   - All requests completed successfully
   - Consistent performance (low standard deviation)
   - No failed requests

============================
Humanize Model V2 Update [HMV2]
07-01-2025 12:48 PM

- Updated humanizeModelV2 functionality in humanizeV2.js
- Enhanced model response processing
- Improved code organization and readability

============================
Humanizer Load Testing [HLT]
07-01-2025 6:24 PM

- Implemented 100 request load test for humanizer API
- Added detailed performance metrics logging
- Improved error handling and test flow
- Added request amount control instead of duration-based testing

============================
Error Handling Enhancement [EHE]
11-01-2025 12:12 PM

- Improved API key error logging in chooseAPIKey.js
- Added detailed error message output for better debugging
- Enhanced error visibility for rate limit issues

============================
AI Studio Development [ASD]
11-01-2025 6:45 PM

- Working on AI Studio feature implementation
- Modifying aistudio.js and chooseAPIKey.js files
- Updating route configurations in index.js
