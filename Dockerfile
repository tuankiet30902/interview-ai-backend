# Use Node.js 14 base image
FROM node:18-alpine

ENV NODE_ENV=production
ENV HOST=0.0.0.0
# Set TESSDATA_PREFIX to the directory containing Tesseract's trained data
ENV TESSDATA_PREFIX=/usr/share/tesseract-ocr/4.00/tessdata

WORKDIR /usr/src/app

# Install required system dependencies
RUN apk add --no-cache \
    python3 \
    py3-pip \
    make \
    g++ \
    cairo-dev \
    pango-dev \
    giflib-dev \
    jpeg-dev \
    bash \
    musl-dev \
    linux-headers \
    tesseract-ocr \
    ghostscript \
    curl

# Manually install Tesseract language data for English and Vietnamese
RUN mkdir -p /usr/share/tesseract-ocr/4.00/tessdata && \
    curl -L -o /usr/share/tesseract-ocr/4.00/tessdata/eng.traineddata \
    https://github.com/tesseract-ocr/tessdata_best/raw/main/eng.traineddata && \
    curl -L -o /usr/share/tesseract-ocr/4.00/tessdata/vie.traineddata \
    https://github.com/tesseract-ocr/tessdata_best/raw/main/vie.traineddata

# Copy package files
COPY ["package.json", "npm-shrinkwrap.json*", "./"]

# Install Node.js dependencies
RUN npm install --unsafe-perm=true --allow-root --production --silent && mv node_modules ../

# Copy Python requirements
COPY requirements.txt ./
RUN pip3 install --no-cache-dir --break-system-packages -r requirements.txt

# Copy application files
COPY . .

# Set environment variables
ENV NODE_ENV=${NODE_ENV}
ENV HOST=${HOST}

# Expose the port the app runs on
EXPOSE 3000

# Start the server
ENTRYPOINT [ "node", "server.js" ]
