// Копирует svg-иконки из nodes/ в dist/nodes/ (аналог gulp-задачи из n8n-nodes-starter).
import { cpSync, mkdirSync } from "node:fs";
mkdirSync("dist/nodes/FreedomSpeech", { recursive: true });
cpSync("nodes/FreedomSpeech/freedomspeech.svg", "dist/nodes/FreedomSpeech/freedomspeech.svg");
