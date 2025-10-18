# Use the official Node.js Slim 18 image as the base image
FROM node:18-slim

# Set the working directory in the container
WORKDIR /usr/src/app


# Define the build-time variable for GitHub Personal Access Token
ARG GITHUB_PAT

COPY .npmrc.template .npmrc
RUN sed -i "s|\${GITHUB_PAT}|${GITHUB_PAT}|" .npmrc
# Configure npm to use the GitHub PAT and registry
RUN echo "@ridz-shothikai:registry=https://npm.pkg.github.com" > .npmrc && \
    echo "//npm.pkg.github.com/:_authToken=${GITHUB_PAT}" >> .npmrc && \
    echo "always-auth=true" >> .npmrc


# Install ffmpeg and clean up APT cache
# RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && \
#     apt-get clean && rm -rf /var/lib/apt/lists/*

RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    libxshmfence1 \
    xdg-utils \
    --no-install-recommends ffmpeg\
    && rm -rf /var/lib/apt/lists/* \
    && wget -qO - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list' \
    && apt-get update && apt-get install -y \
    google-chrome-stable \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

RUN ffmpeg -version

# Copy package.json and package-lock.json (if available) to the working directory
COPY package*.json ./
# Install npm dependencies
RUN npm install
# Copy the rest of the application source code to the working directory
COPY . .
# Expose the port on which your Node.js application will run
EXPOSE 8080
# Command to run your Node.js application
CMD ["node", "index.js"]  
