# Jsw's slaafje - my personal Discord bot

![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)
![Deno JS](https://img.shields.io/badge/deno%20js-000000?style=for-the-badge&logo=deno&logoColor=white)
![Discord](https://img.shields.io/badge/Discord-%235865F2.svg?style=for-the-badge&logo=discord&logoColor=white)

> A relatively simple Discord bot, made with Deno, TS and Discord.JS.

> [!IMPORTANT]
> This bot was made as a learning project that I could use for personal use with
> friends. I have not made it user friendly to install it yourself. It is
> however licensed under the unlicense so you may use the code however you like.

## Commands

### Utility Commands

- **Ping**
  - Command: `ping`
  - Accessibility: Everyone
  - Response: "pong lol"

- **Timestamp**
  - Command: `time`
  - Accessibility: Everyone
  - Description: Generates and previews a Discord timestamp.
  - Parameters:
    - `time`: REQUIRED string; a JavaScript date string.
    - `type`: REQUIRED string; the type of Discord timestamp to generate (with
      autocomplete).

- **Typst**
  - Description: Compiles Typst code into a PNG image.
  - Accessibility: Everyone
  - Commands:
    - `typst inline`
      - Parameters:
        - `Code`: REQUIRED string; your Typst code.
        - `file`: bool (default: false); attaches your Typst code as a file.
        - `transparent`: bool (default: true); sets the background to
          transparent and text to white (not compatible with Discord's light
          mode).
    - `typst multiline`
      - Same as `typst inline`, but opens a modal with a textarea for multi-line
        input.

- **TypeScript Interpreter**
  - Accessibility: Configured user IDs only.
  - Commands:
    - `ts inline`
      - Parameters:
        - `code`: REQUIRED string; TypeScript code.
        - `output`: bool (default: true); replies with the input and outputs
          (e.g., console logs).
    - `ts multiline`
      - Opens a modal for multi-line TypeScript code (max 4000 characters).

### Sexy Commands

These commands allows me and my friends to save and share unappealing images of
each other as memes.

- Accessibility: Users in a configured guild or user ID only.
- Commands:
  - `sexy carousel`
    - Displays all images of a specified user in a carousel.
    - Parameters:
      - `Nickname`: REQUIRED string; specifies the user.
      - `Page`: number (default: 0); specifies the starting page.
      - `Public`: bool (default: false); makes the response visible to everyone.
  - `sexy image`
    - Returns a specified image.
    - Parameters:
      - `Nickname`: REQUIRED string; specifies the user.
      - `Image`: REQUIRED string; specifies the image.
      - `Public`: bool (default: false); makes the response visible to everyone.
  - `sexy-upload`
    - Allows users to upload images.
    - Parameters:
      - `Nickname`: REQUIRED string; specifies the directory for the image.
      - `Filename`: REQUIRED string; a short description of the image.
      - `Image`: REQUIRED attachment; the image to upload.

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

> [!WARNING]
> The program _DOES NOT_ support jsonc as config. This means that you'll have to
> remove the comments.

- Create a config.json based on the `config.template.json`, see
  <a href="#configuration">configuration</a>.
- Create a sexy-mfs folder at the path you provided in the config.
- Run `deno run -A ./src/main.ts`

## Screenshots and recordings

### Sexy mfs

https://github.com/user-attachments/assets/5ade453d-41c9-430f-893f-04c1c20819b8

### Utilities

https://github.com/user-attachments/assets/1413376d-a00a-4909-a01e-5e86f9cbe201
