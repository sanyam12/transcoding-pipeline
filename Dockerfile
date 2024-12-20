FROM ubuntu:focal

RUN apt-get update && apt-get install -y curl
RUN curl -fsSL https://deb.nodesource.com/setup_14.x | bash -
RUN apt-get install -y nodejs ffmpeg
RUN node --version
RUN npm --version

WORKDIR /home/app

ENTRYPOINT [ "bash" ]
