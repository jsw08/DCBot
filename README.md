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

| **Command**          | Description                                                                                                                                                                                                                                        | Parameters                                                                                                                                                                                                                                | Availability                                  | Preview |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | ------- |
| `/ping`              | Responds with "pong"                                                                                                                                                                                                                               | None                                                                                                                                                                                                                                      | Everywhere                                    |         |
| `/time`              | Command to generate Discord Timestamps                                                                                                                                                                                                             | - time: REQUIRED string; must be a valid js-datestring. - type: REQUIRED autocompleted string; several options for the timestring, including relative, full date etc...                                                                   | Everywhere                                    |         |
| `/say`               | Will say something as the bot.                                                                                                                                                                                                                     | You must specify one of these parameters. - content: string; the message. - json: string; parsed json, use this to add embeds.                                                                                                            | Everywhere                                    |         |
| Typst                | This set of commands allow you to type and compile typst code in discord. Useful for those moments where you're explaining math to someone.                                                                                                        | Common parameters: - transparant: boolean; it'll set the background color of the png to transparant. Only compatible with discord dark mode as the text color will be set to white. - file: boolean; it'll attach the typst code as file. | Everywhere                                    |         |
| - `/typst inline`    | You can type one line of typst code within the input itself and it'll generate a picture out of it.                                                                                                                                                | - code: REQUIRED string; the typst code. + common parameters                                                                                                                                                                              | Everywhere                                    |         |
| - `/typst multiline` | A modal with a text input will be opened once you run this command so you can type multiple lines of typst code (up to 4000 chars)                                                                                                                 | + common parameters                                                                                                                                                                                                                       | Everywhere                                    |         |
| Typescript Eval      | Runs the provided typescript code.                                                                                                                                                                                                                 | Common parameters: - output: boolean; if enabled the bot will respond with the input+output of your code in public chat (not ephemeral).                                                                                                  | Nowhere (only configured userids may use it.) |         |
| - `/ts inline`       | Allow's for one line of typescript code. So you can either just run simple or minified code.                                                                                                                                                       | - code: REQUIRED string; ts code. + common parameters                                                                                                                                                                                     | Nowhere                                       |         |
| - `/ts multiline`    | Opens a modal for longer codesnippets (again max length of 4000 characters).                                                                                                                                                                       | + common parameters                                                                                                                                                                                                                       | Nowhere                                       |         |
| Sexy                 | This collection of commands allows me and my friends to - Upload unappealing pictures of eachother to my server. - Send them (within my discord server) using my bot. This allows us to have a central place to store funny pictures of eachother. | Common parameters: - nickname: REQUIRED autocompleted string; the nickname under which the photos are stored - public: bool; makes the message not ephemeral.                                                                             | At specified guilds                           |         |
| - `/sexy carousel`   | Displays the pictures in a 4x4 grid with scrolling buttons on the bottom                                                                                                                                                                           | - page: autocompleted number; specifies the page the carousel should start at. + common parameters                                                                                                                                        | At specified guilds                           |         |
| - `/sexy image`      | Allows you to pick one image to send.                                                                                                                                                                                                              | - image: REQUIRED autocompleted string; specifies the iamge that should be displayed. + common parameters                                                                                                                                 | At specified guilds                           |         |
| - `/sexy-upload      | Uploads the specified image to the server's filesystem.                                                                                                                                                                                            | - nickname: REQUIRED autocompleted string; the nickname under which the photos are stored - filename: REQUIRED string; a name that should describe the image. - image: REQUIRED asset; the image file.                                    | At specified guilds                           |         |

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

This program works using dotenv. So you can either place a .env file in the
project root, or set the environment variables. See the
[template file](https://github.com/jsw08/DCBot/blob/master/template.env).

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
