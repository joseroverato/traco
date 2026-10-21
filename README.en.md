# Traço

**Mark up, review and quantify PDF drawings.** Free and open source, made by an engineer, for engineers.

🇧🇷 [Leia em português](README.md) · The app speaks Portuguese, English, Spanish, French, German, Italian and Chinese (Simplified).

![Traço demo: scale from the title block, measuring, rooms, live 3D and pulling the height of a solid](docs/demo.gif)

Traço opens a PDF drawing and lets you measure right on it: length, area and count, with a scale per sheet or per region. The takeoff builds itself, with formulas, rooms and levels, and exports to Excel. A SketchUp-style 3D mode shows what you measured as volume.

## What it does

- **Measure on the plan:** length, area, count and voids (pits, shafts, columns). Click inside a room and the outline is traced from the PDF's own lines.
- **Auto count:** draw a box around one symbol and Traço finds all the matching ones, even rotated, on this sheet or on all of them.
- **Instant takeoff:** items with formulas (`A + P*H`, `L * 1.10`, `ceil(N/10)`…), grouping by item, room, level, sheet or status, SINAPI price database with markup (BDI) and Excel export.
- **3D:** draw a solid's footprint on the plan and pull its height with the mouse. Measured walls, rooms and slabs show up as volume. Split screen (plan and live 3D) and Revit-style navigation.
- **Review and coordination:** revision clouds, numbered items with assignee, priority and due date, PDF and Excel reports, revision comparison and discipline overlay.
- **Sheet management:** reorder, rotate, duplicate, extract, split, rename from the title block, batch stamps and OCR in 7 languages. Units can be metric or imperial (ft, ft², yd³; scales like 1/4" = 1'-0"), and every tool shortcut can be remapped in Settings.
- **Permanent redaction:** the text and image under a redaction bar are really removed from the PDF, while the vector linework stays intact for measuring (desktop app and web version).
- **Claude (optional):** a panel that uses your own API key, plus an MCP server for Claude Desktop.

## Install

1. Download the `Traco-Setup-…exe` installer from the [**Releases**](https://github.com/joseroverato/traco/releases/latest) page.
2. Run it. Windows may show the blue **SmartScreen** screen ("Windows protected your PC"), because the app is not digitally signed yet and is new to Windows. Click *More info*, then *Run anyway*. To check the file is the original, compare its hash with the one in `SHA256SUMS.txt` on the same release (`certutil -hashfile Traco-Setup-….exe SHA256` in Command Prompt).
3. Open a PDF or a `.traco` project.

There is also a **web version** (`Traco-Web-…zip`, with Docker) to run on a server. The desktop app checks for updates on launch (Settings › About).

## Language

Traço picks your system language (Portuguese, English, Spanish, French, German, Italian or Chinese) and falls back to English. Change it any time in **Settings › About › Language**. The translations are not word-for-word: tool names and construction terms follow the usage of each language (see [docs/IDIOMAS.md](docs/IDIOMAS.md), in Portuguese). Text drawn *inside* exported PDFs (legends, reports) uses Portuguese, English, Spanish, French, German or Italian; in Chinese it falls back to English because the standard PDF fonts have no ideographs.

## Privacy

Everything runs on your computer: your PDFs are not sent anywhere. The only connections are the update check (it reads the releases on GitHub), the download of OCR data for Spanish, French, German, Italian or Chinese (1 to 4 MB, once, only if you ask for OCR in that language and confirm; Portuguese and English ship with the installer, and your sheets are not uploaded) and, **only if you use the Claude panel**, sending the sheets you ask about to the Anthropic API, with your own key (stored encrypted on the PC).

## Built with AI

Traço was built with the help of artificial intelligence (Claude). The vision of what an engineer needs, the testing on real plans and the decisions are human; the AI helped write, test and fix the code. The automated tests cover the calculations (measurements, formulas, takeoff, project format and 3D rules).

## Code signing policy

The Windows installer is **not signed yet**. Free code signing for open-source projects is being requested from the [SignPath Foundation](https://signpath.org); until it is approved, the warning and hash check described under *Install* apply. Once approved, only installers built by this repository's automated workflow (GitHub Actions) from the public code will be signed, and every release will need manual approval.

- **Author, reviewer and approver:** José Roverato ([@joseroverato](https://github.com/joseroverato)), with two-factor authentication on GitHub.
- **Privacy:** the program does not collect or send data. The only connections are the update check against GitHub Releases and, only if you use the Claude panel, sending the sheets you ask about to the Anthropic API (see *Privacy*).

## Contributing

Found a bug, missing a feature or have an idea? Open an [issue](https://github.com/joseroverato/traco/issues). See [CONTRIBUTING.md](CONTRIBUTING.md) (in Portuguese) for running the project and sending changes. Fixing a translation is the easiest first contribution: see [docs/IDIOMAS.md](docs/IDIOMAS.md).

## License

[MIT](LICENSE). Third-party libraries and their licenses are listed in [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md).
