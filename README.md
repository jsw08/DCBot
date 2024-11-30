# Jsw's slaafje - my personal Discord bot

![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)
![Deno JS](https://img.shields.io/badge/deno%20js-000000?style=for-the-badge&logo=deno&logoColor=white)
![Discord](https://img.shields.io/badge/Discord-%235865F2.svg?style=for-the-badge&logo=discord&logoColor=white)

> A relatively simple Discord bot, made with Deno, TS and Discord.JS.

> [!IMPORTANT]
> This bot was made as a learning project that I could use for personal use with
> friends. I have not made it user friendly to install it yourself. It is
> however licensed under the unlicense so you may use the code however you like.

## Features

I haven't implemented many commands yet.

- Utility
  - Ping
    - Will respond pong lol.
- Sexy commands: this group of commands allows me and my friends to save
  (unappealing) images of eachother in a central place and send them as memes.
  - `sexy-get`
    - Will display images of a person.
    - It has two modes; carousel and image. When there's no image specified, it
      will display every image found in a carousel. You are allowed to use the
      page parameter to specify the starting page when it's in carousel mode.
    - Parameters
      - Nickname: REQUIRED string; used to specify from what user it should grep
        the images from.
      - Page: number; used to specify the page if there's no image specified.
      - Image: string; overwrites carousel mode to display one image.
      - Public bool; makes the response visible to everyone;
  - `sexy-up`
    - Allows users to upload sexy images to server.
    - Parameters
      - Nickname: REQUIRED string; used to specify under what directory it
        should upload the image.
      - Filename: REQUIRED string; it should be set to a short description of
        the image.
      - Image: REQUIRED attachment: the image you want to upload.

## Installation

### Prerequisites

- Deno
- Git
- Port forwarding / a different solution to get the web server online.

### Installation

- `git clone https://github.com/jsw08/dcbot`
- `cd dcbot`
- `deno i`

## Configuration

```jsonc
{
  "token": "", // Provide your discord token here. You can find it under the 'bot' tab in the discord dashboard.
  "client_id": "", // Provide your discord bot's client_id. You can find it under the 'general' tab in the discord dashboard, it is named 'Application Id'.
  "private": {
    "enabled": true, // This allows you to disable some commands per server. As of now this is configured in the command files (./src/commands/*) themselves, because this is a personal project, not a template lol.
    "user_ids": [""], // These users are allowed to use the commands everywhere.
    "guild_ids": [""] // Some commands are allowed to be used in some guilds, but not everywhere. Enter those guild's ids here.
  },
  "sexy-mfs": {
    "dir": "", // The path to the sexy-mfs folder. see #features for an explaination
    "port": 8000, // The port at which the web server runs at.
    "image_url": "", // External url to access the web server. Please include the port you set above as well (if you're not using a reverse-proxy.)
    "title_url": "" // This is the url that will be set on the image embeds. The common url will make the images display in a 2x2 grid.
  }
}
```

## Usage

- Create a config.json based on the `config.template.json`, see
  <a href="#configuration">configuration</a>.
- Create a sexy-mfs folder at the path you provided in the config.
- Run `deno run -A ./src/main.ts`

## Screenshots and recordings

### Sexy mfs

https://github.com/user-attachments/assets/5ade453d-41c9-430f-893f-04c1c20819b8
