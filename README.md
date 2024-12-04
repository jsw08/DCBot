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
    - `ping`
    - Accessible to everyone
    - Will respond pong lol.
  - Timestamp
    - `time`
    - Accessible to everyone
    - Will generate and preview a discord timestamp
    - Parameters
      - time: REQUIRED: string; A js datestring. 
      - type: REQUIRED: string with autocomplete; The kind of discord timestamp you'd like to generate. Just a list you can pick from.
  - Typst: Typst is a language to write scientific papers.
    - Accessible to everyone.
    - Will compile your typst code into an png.
    - `typst inline`
        - Allows you to enter your typst code into the command parameter.
        - Parameters
            - Code: REQUIRED: string; your typst code.
            - file: bool default false; will attach your typst code as file
            - transparant: bool default true; will set the background color to transparant and text to white. Not compatible with discords light mode.
    - `typst multiline`
        - Same as typst inline but it'll open a modal with a 'textarea'.
        - Parameters
            - file: bool default false; will attach your typst code as file
            - transparant: bool default true; will set the background color to transparant and text to white. Not compatible with discords light mode.
  - Typescript interpreter
    - Only accessible to configured userids.
    - `ts inline`
      - Runs your typescript oneliners.
      - Parameters
        - code: REQUIRED: string; ts code.
        - output: bool default true; replies an public message with the input and (if there are) outputs (console.logs etc). It will delete the command is loading message if you don't interact with the discordjs api.
    - `ts multiline`
      - Opens up a modal to write multiple lines of typescript code (max 4000 chars).
      - Parameters
        - output: bool default true; replies an public message with the input and (if there are) outputs (console.logs etc). It will delete the command is loading message if you don't interact with the discordjs api.
- Sexy commands: this group of commands allows me and my friends to save
  (unappealing) images of eachother in a central place and send them as memes.
  - Only accessible to users in a configured guild or userid
  - `sexy carousel`
    - It will display every image found of a person in a carousel. You can use the page parameter to specify the starting page. Everyone with access (either at server or user level) is able to scroll through the carousel.
    - Parameters
      - Nickname: REQUIRED string with autocomplete; used to specify from what user it should grep
        the images from.
      - Page: number with autocomplete; used to specify the page if there's no image specified.
      - Public bool; makes the response visible to everyone;
  - `sexy image`
    - Will return the specified image.
    - Parameters
      - Nickname: REQUIRED string with autocomplete; used to specify from what user it should grep
        the images from.
      - Image: REQUIRED string with autocomplete; overwrites carousel mode to display one image.
      - Public bool default false; makes the response visible to everyone;
  - `sexy-upload`
    - Allows users to upload sexy images to server.
    - Parameters
      - Nickname: REQUIRED string with autocomplete; used to specify under what directory it
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
