export default {
 defaults: {
  model: "gpt-4.1",
  resources: [
   'fileTree', 'completeSources', 'testing',
  ],
  selectedFiles: [
   ".tokenring/guidelines.txt"
  ],
  persona: 'deep-rag'
 },
 models: {
  Anthropic: {
   apiKey: process.env.ANTHROPIC_API_KEY,
   provider: 'anthropic',
  },
  Cerebras: {
   apiKey: process.env.CEREBRAS_API_KEY,
   provider: 'cerebras',
  },
  DeepSeek: {
   apiKey: process.env.DEEPSEEK_API_KEY,
   provider: 'deepseek',
  },
  OpenAI: {
   apiKey: process.env.OPENAI_API_KEY,
   provider: 'openai',
  },
  OpenRouter: {
   apiKey: process.env.OPENROUTER_API_KEY,
   provider: 'openrouter',
   modelFilter: (model) => {
    if (! model.supported_parameters?.includes('tools')) {
     return false;
    } else if (/openai|anthropic|xai|perplexity|cerebras/.test(model.id)) {
     return false;
    }
    return true;
   }
  },
 },
 indexedFiles: [
  {path: "./"},
 ],
 watchedFiles: [
  {path: "./", include: /.(js|md|jsx|sql|txt)$/}
 ],
 resources: {
  fileTree: {
   type: "fileTree",
   description: `Include the complete file tree in the context`,
   items: [
    {path: `./`, include: /\.(txt|js|md)$/}
   ]
  },
  completeSource: {
   type: "wholeFile",
   description: `Include the complete source code in the context`,
   items: [
    {path: `./`, include: /.\/[^\/]*\.(js)$/}
   ]
  },
  completeTestSource: {
   type: "wholeFile",
   description: `Include the complete testing source code in the context`,
   items: [
    {path: `./test`, include: /.\/[^\/]*\.(js)$/}
   ]
  },
  packageTests: {
   type: "testing",
   description: `NPM Tests`,
   tests: {
    npmTests: {
     description: "Run package tests",
     command: "npm run test",
     workingDirectory: './',
    },
    eslint: {
     description: "Verify & fix formatting and lint rules",
     command: "npm run eslint",
     workingDirectory: './'
    }
   }
  }
 }
};
