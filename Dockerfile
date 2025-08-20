FROM ubuntu:18.04

# Install NodeJS.
RUN wget -qO - https://deb.nodesource.com/setup_16.x | bash - && \
    apt-get install -y nodejs

# Copy the source to the build directory.
COPY . /opt/dev/portal2
WORKDIR /opt/dev/portal2
ENV PORTAL2_DIR=/opt/dev/portal2
COPY portal2 /usr/bin

# Install the app.
RUN npx browserslist@latest --update-db && \
    npm install && \
    npm run build

# Expose the HTTP and WS listen ports.
EXPOSE 3000

# Set the entrypoint.
ENTRYPOINT ["portal2"]
