# Prompt Architect

A focused React application for generating AI image prompts using structured scene specifications.

## Features

- **Preset Management**: Load and save different prompt templates (HWS14, ORJ)
- **Structured Prompt Building**: Define prompts using composition, environment, time, weather, lighting, and lens parameters
- **Random Selection**: Choose specific options or use random selection for each parameter
- **Batch Generation**: Generate multiple prompts at once with configurable concurrency
- **OpenAI Integration**: Send prompts to GPT models for processing
- **Export Options**: Copy to clipboard or download as text file

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

## Usage

1. Select a preset from the dropdown (HWS14, ORJ)
2. Configure the LLM instructions for prompt generation
3. Set up your parameter lists (Pre, Composition, Environment, etc.)
4. Choose specific options or enable random selection for each parameter
5. Configure generation settings (model, batch size, concurrency)
6. Click "Send to GPT" to generate prompts
7. Copy or download the results

## Project Structure

```
src/
├── App.tsx                 # Main app component
├── components/             # Shared UI pieces (BoxEditor, PresetSelector, etc.)
├── config/                 # Client configuration such as API keys
├── presets/                # JSON preset definitions bundled with the app
├── services/               # Data helpers for presets and persistence
├── utils/                  # Randomisation helpers
├── PromptArchitect.tsx     # Main prompt generation interface
├── styles.css              # Application styles
└── main.tsx                # Application entry point
```

## Presets

Presets are stored as JSON files in the `src/presets/` directory. Each preset contains:
- `instructions`: The system prompt for the LLM
- `sections`: Ordered list of section definitions (title, list text, defaults)
- `defaults`: Default generation settings (model, seed, batch, concurrency)


## Development

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run typecheck` - Run TypeScript type checking
