FROM node:current-alpine

# Create app directory
WORKDIR /usr/src/app

# Copy package files and install
COPY package*.json ./
RUN npm install

# Bundle app source
COPY . .

# Expose port
EXPOSE 3000

CMD [ "node", "server.js" ]